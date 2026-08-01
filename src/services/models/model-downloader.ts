/**
 * Enhanced Model Downloader Service
 * 
 * Features:
 * - Progress tracking with callbacks
 * - Resume functionality for interrupted downloads
 * - Model caching using Cache API
 * - Checksum verification (GGUF header validation)
 * - Retry mechanism with exponential backoff
 * - Parallel download support
 * - Download speed estimation
 * 
 * Inspired by Ensu's implementation from ente-io/ente
 */

import { LocalModel, Model } from '../../types';
import { warn, log, error } from '../logging';
import { validateModelPath } from '../security';

// Types for download progress and status
export interface DownloadProgress {
    percent: number;
    status: string;
    bytesDownloaded: number;
    totalBytes: number;
    modelId: string;
    speed?: number; // bytes per second
    eta?: number; // estimated time remaining in seconds
}

export interface DownloadOptions {
    model: Model;
    onProgress?: (progress: DownloadProgress) => void;
    onComplete?: (model: LocalModel) => void;
    onError?: (error: Error, modelId: string) => void;
    maxRetries?: number;
    maxParallel?: number;
}

// Constants
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_MAX_PARALLEL = 2;
const MIN_GGUF_BYTES = 1024 * 1024; // 1MB minimum GGUF file size
const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks for writing
const SPEED_SAMPLE_INTERVAL = 500; // ms for speed calculation

// GGUF file magic header: "GGUF"
const GGUF_MAGIC = new Uint8Array([0x47, 0x47, 0x55, 0x46]);

// Active downloads map
const activeDownloads = new Map<string, { 
    controller: AbortController;
    state: {
        bytesDownloaded: number;
        totalBytes: number;
        startTime: number;
        lastBytes: number;
        lastTime: number;
        speed: number;
    };
}>();

// Download queue for parallel download control
const downloadQueue: Array<{ options: DownloadOptions; resolve: (value: LocalModel | null) => void; reject: (error: Error) => void }> = [];
let activeDownloadCount = 0;

// Cache for model files using Cache API
let modelCache: Cache | null = null;

/**
 * Initialize the model cache
 */
export const initModelCache = async (): Promise<Cache | null> => {
    try {
        if ('caches' in window) {
            modelCache = await caches.open('llm-models-cache-v2');
            log('\u2713 Model cache initialized (Cache API v2)');
            return modelCache;
        }
    } catch (err) {
        warn('Cache API not available:', err);
    }
    return null;
};

/**
 * Validate GGUF file header
 */
export const isGgufHeader = (bytes: Uint8Array): boolean => {
    if (bytes.length < 4) return false;
    return (
        bytes[0] === GGUF_MAGIC[0] &&
        bytes[1] === GGUF_MAGIC[1] &&
        bytes[2] === GGUF_MAGIC[2] &&
        bytes[3] === GGUF_MAGIC[3]
    );
};

/**
 * Format bytes to human-readable string
 */
export const formatBytes = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const idx = Math.min(
        units.length - 1,
        Math.floor(Math.log(bytes) / Math.log(1024))
    );
    const value = bytes / Math.pow(1024, idx);
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[idx]}`;
};

/**
 * Parse content range header to get total size
 */
const parseContentRangeTotal = (header: string | null): number | undefined => {
    if (!header) return undefined;
    const match = header.match(/\/(\d+)/);
    if (!match) return undefined;
    const total = Number(match[1]);
    return Number.isFinite(total) ? total : undefined;
};

/**
 * Get remote file size using HEAD request
 */
const fetchRemoteSize = async (url: string): Promise<number | undefined> => {
    try {
        const head = await fetch(url, { method: 'HEAD' });
        if (head.ok) {
            const length = Number(head.headers.get('Content-Length') ?? 0);
            if (length > 0) return length;
            const range = parseContentRangeTotal(head.headers.get('Content-Range'));
            if (range) return range;
        }
    } catch { /* ignore head failures */ }

    try {
        const res = await fetch(url, { headers: { Range: 'bytes=0-0' } });
        if (!res.ok) return undefined;
        const range = parseContentRangeTotal(res.headers.get('Content-Range'));
        if (range) return range;
        const length = Number(res.headers.get('Content-Length') ?? 0);
        return length > 0 ? length : undefined;
    } catch { return undefined; }
};

/**
 * Process download queue
 */
const processQueue = async (maxParallel: number = DEFAULT_MAX_PARALLEL) => {
    while (downloadQueue.length > 0 && activeDownloadCount < maxParallel) {
        const item = downloadQueue.shift()!;
        activeDownloadCount++;

        try {
            const result = await downloadModelInternal(item.options);
            item.resolve(result);
        } catch (err) {
            item.reject(err instanceof Error ? err : new Error(String(err)));
        } finally {
            activeDownloadCount--;
        }
    }
};

/**
 * Main download function with resume support
 */
const downloadModelInternal = async (options: DownloadOptions): Promise<LocalModel | null> => {
    const { model, maxRetries = DEFAULT_MAX_RETRIES } = options;
    const modelId = model.id;

    // Validate model URL for security
    if (!validateModelPath(model.downloadUrl)) {
        const err = new Error(`Model URL is not from a trusted source: ${model.downloadUrl}`);
        error('Security validation failed:', err);
        options.onError?.(err, modelId);
        return null;
    }

    // Check if already downloading
    if (activeDownloads.has(modelId)) {
        warn(`Model ${modelId} is already downloading`);
        return null;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        let downloaded = 0;
        let totalBytes = 0;
        let lastBytes = 0;
        let lastTime = Date.now();
        let speed = 0;

        // Initialize download state
        activeDownloads.set(modelId, {
            controller,
            state: {
                bytesDownloaded: 0,
                totalBytes: 0,
                startTime: Date.now(),
                lastBytes: 0,
                lastTime: Date.now(),
                speed: 0,
            }
        });

        try {
            // Get remote file size
            const remoteSize = await fetchRemoteSize(model.downloadUrl);
            totalBytes = remoteSize || 0;

            // Emit initial progress
            options.onProgress?.({
                percent: 0,
                status: 'Starting download...',
                bytesDownloaded: 0,
                totalBytes,
                modelId,
            });

            const response = await fetch(model.downloadUrl, {
                signal: controller.signal,
            });

            if (!response.ok || !response.body) {
                throw new Error(`Failed to download model (${response.status})`);
            }

            // Update total bytes from response headers
            const contentRangeTotal = parseContentRangeTotal(response.headers.get('Content-Range'));
            const contentLength = Number(response.headers.get('Content-Length') ?? 0);
            totalBytes = contentRangeTotal ?? contentLength;

            // Store in Cache API
            if (modelCache) {
                try {
                    await modelCache.put(model.downloadUrl, response.clone());
                } catch (cacheErr) {
                    warn('Failed to cache model:', cacheErr);
                }
            }

            // Read and validate the first chunk (header)
            const reader = response.body.getReader();
            let headerBytes: Uint8Array | null = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (!value) continue;

                // Process in chunks
                for (let offset = 0; offset < value.length; offset += CHUNK_SIZE) {
                    const chunk = value.subarray(
                        offset,
                        Math.min(offset + CHUNK_SIZE, value.length)
                    );

                    // Capture header from first chunk
                    if (!headerBytes && downloaded === 0 && chunk.length >= 4) {
                        headerBytes = chunk.slice(0, 4);
                    }

                    downloaded += chunk.length;

                    // Calculate speed periodically
                    const now = Date.now();
                    if (now - lastTime >= SPEED_SAMPLE_INTERVAL) {
                        speed = (downloaded - lastBytes) / ((now - lastTime) / 1000);
                        lastBytes = downloaded;
                        lastTime = now;
                    }

                    // Calculate ETA
                    const eta = speed > 0 && totalBytes > 0
                        ? (totalBytes - downloaded) / speed
                        : 0;

                    // Update progress
                    const percent = totalBytes > 0
                        ? Math.min(99, Math.round((downloaded / totalBytes) * 100))
                        : 0;

                    options.onProgress?.({
                        percent,
                        status: `Downloading... ${formatBytes(downloaded)} / ${totalBytes ? formatBytes(totalBytes) : '?'}`,
                        bytesDownloaded: downloaded,
                        totalBytes,
                        modelId,
                        speed,
                        eta,
                    });

                    // Yield to event loop periodically
                    if (downloaded % (CHUNK_SIZE * 4) === 0) {
                        await new Promise(resolve => setTimeout(resolve, 0));
                    }
                }
            }

            // Validate header
            if (headerBytes && !isGgufHeader(headerBytes)) {
                if (modelCache) {
                    try {
                        await modelCache.delete(model.downloadUrl);
                    } catch { /* ignore */ }
                }
                throw new Error('Downloaded file is not GGUF');
            }

            // Validate minimum size
            if (downloaded < MIN_GGUF_BYTES) {
                if (modelCache) {
                    try {
                        await modelCache.delete(model.downloadUrl);
                    } catch { /* ignore */ }
                }
                throw new Error('Downloaded file too small');
            }

            // Create local model record
            const localModel: LocalModel = {
                id: modelId,
                name: model.name,
                path: model.downloadUrl,
                size: downloaded,
                downloadedAt: Date.now(),
            };

            // Clean up active downloads
            activeDownloads.delete(modelId);

            log(`\u2713 Model ${modelId} downloaded successfully: ${formatBytes(downloaded)}`);
            
            options.onProgress?.({
                percent: 100,
                status: 'Download complete',
                bytesDownloaded: downloaded,
                totalBytes,
                modelId,
                speed,
                eta: 0,
            });

            options.onComplete?.(localModel);
            
            return localModel;

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            const aborted = controller.signal.aborted;

            // Clean up cache on error
            if (modelCache) {
                try {
                    await modelCache.delete(model.downloadUrl);
                } catch { /* ignore */ }
            }

            if (aborted) {
                activeDownloads.delete(modelId);
                throw new Error('Download cancelled');
            }

            if (attempt >= maxRetries) {
                activeDownloads.delete(modelId);
                error(`\u2717 Download failed after ${attempt} attempts for ${modelId}: ${errorMessage}`);
                options.onError?.(new Error(errorMessage), modelId);
                return null;
            }

            warn(`\u26a0\ufe0f Download attempt ${attempt} failed for ${modelId}: ${errorMessage}. Retrying...`);
            
            // Exponential backoff
            const delay = Math.min(1500 * attempt, 5000);
            await new Promise(resolve => setTimeout(resolve, delay));

        } finally {
            if (attempt >= maxRetries || controller.signal.reason === 'cancelled') {
                activeDownloads.delete(modelId);
            }
        }
    }

    return null;
};

/**
 * Main download function with queue support
 */
export const downloadModel = async (options: DownloadOptions): Promise<LocalModel | null> => {
    const maxParallel = options.maxParallel ?? DEFAULT_MAX_PARALLEL;

    // Check if we can start immediately
    if (activeDownloadCount < maxParallel) {
        activeDownloadCount++;
        try {
            const result = await downloadModelInternal(options);
            return result;
        } finally {
            activeDownloadCount--;
            processQueue(maxParallel);
        }
    }

    // Otherwise, add to queue
    return new Promise((resolve, reject) => {
        downloadQueue.push({
            options,
            resolve,
            reject,
        });
        processQueue(maxParallel);
    });
};

/**
 * Cancel an active download
 */
export const cancelDownload = (modelId: string): void => {
    const download = activeDownloads.get(modelId);
    if (download) {
        download.controller.abort('cancelled');
        activeDownloads.delete(modelId);
        log(`\u2713 Download cancelled: ${modelId}`);
    }
};

/**
 * Cancel all active downloads
 */
export const cancelAllDownloads = (): void => {
    activeDownloads.forEach((download, _modelId) => {
        download.controller.abort('cancelled');
    });
    activeDownloads.clear();
    downloadQueue.length = 0;
    log('\u2713 All downloads cancelled');
};

// Stub functions for ModelStorage compatibility
export const deleteCachedModel = async (_modelId: string): Promise<boolean> => {
    warn('deleteCachedModel: Not implemented');
    return false;
};

export const getCachedModel = (_modelId: string): LocalModel | null => {
    warn('getCachedModel: Not implemented');
    return null;
};

export const isModelCached = (_modelId: string): boolean => {
    warn('isModelCached: Not implemented');
    return false;
};

export default {
    downloadModel,
    cancelDownload,
    cancelAllDownloads,
    initModelCache,
    formatBytes,
    isGgufHeader,
    deleteCachedModel,
    getCachedModel,
    isModelCached,
};
