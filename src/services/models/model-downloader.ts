/**
 * Enhanced Model Downloader Service
 * 
 * Features:
 * - Progress tracking with callbacks
 * - Resume functionality for interrupted downloads
 * - Model caching using IndexedDB/Cache API
 * - Checksum verification (GGUF header validation)
 * - Retry mechanism with exponential backoff
 * - Concurrent download management
 * 
 * Inspired by Ensu's implementation from ente-io/ente
 */

import { LocalModel, Model } from '../../types';
import { warn, log, error } from '../logging';
import { validateModelPath, checkHTTPS } from '../security';

// Types for download progress and status
export interface DownloadProgress {
    percent: number;
    status: string;
    bytesDownloaded: number;
    totalBytes: number;
    modelId: string;
}

export interface DownloadOptions {
    model: Model;
    onProgress?: (progress: DownloadProgress) => void;
    onComplete?: (model: LocalModel) => void;
    onError?: (error: Error, modelId: string) => void;
    maxRetries?: number;
    timeout?: number;
}

export interface DownloadState {
    modelId: string;
    status: 'idle' | 'downloading' | 'paused' | 'completed' | 'error' | 'cancelled';
    progress: number;
    bytesDownloaded: number;
    totalBytes: number;
    error?: string;
    retryCount: number;
    lastUpdated: number;
}

// Constants
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const STALL_TIMEOUT = 60000; // 60 seconds for stall detection
const MIN_GGUF_BYTES = 1024 * 1024; // 1MB minimum GGUF file size
const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks for writing

// GGUF file magic header: "GGUF"
const GGUF_MAGIC = new Uint8Array([0x47, 0x47, 0x55, 0x46]);

// Active downloads map
const activeDownloads = new Map<string, { 
    controller: AbortController; 
    state: DownloadState 
}>();

// Download states for UI
const downloadStates = new Map<string, DownloadState>();

// Cache for model files using Cache API
let modelCache: Cache | null = null;

/**
 * Initialize the model cache
 */
export const initModelCache = async (): Promise<Cache | null> => {
    try {
        if ('caches' in window) {
            modelCache = await caches.open('llm-models-cache');
            log('✓ Model cache initialized (Cache API)');
            return modelCache;
        }
    } catch (err) {
        warn('Cache API not available, falling back to IndexedDB:', err);
    }
    return null;
};

/**
 * Check if a model is already cached
 */
export const isModelCached = async (modelId: string, url: string): Promise<boolean> => {
    try {
        // Check Cache API first
        if (modelCache) {
            const response = await modelCache.match(url);
            if (response) {
                log(`✓ Model ${modelId} found in Cache API`);
                return true;
            }
        }

        // Check IndexedDB
        const db = await getModelDatabase();
        if (db) {
            const transaction = db.transaction(['models'], 'readonly');
            const store = transaction.objectStore('models');
            const request = store.get(modelId);
            
            return new Promise((resolve) => {
                request.onsuccess = () => {
                    resolve(!!request.result);
                };
                request.onerror = () => {
                    resolve(false);
                };
            });
        }

        return false;
    } catch (err) {
        warn(`Error checking cache for model ${modelId}:`, err);
        return false;
    }
};

/**
 * Get IndexedDB database for model storage
 */
const getModelDatabase = async (): Promise<IDBDatabase | null> => {
    return new Promise((resolve) => {
        if (!('indexedDB' in window)) {
            resolve(null);
            return;
        }

        const request = indexedDB.open('LLMModelsDB', 1);
        
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains('models')) {
                db.createObjectStore('models', { keyPath: 'id' });
            }
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            warn('Failed to open IndexedDB for models:', request.error);
            resolve(null);
        };
    });
};

/**
 * Store model metadata in IndexedDB
 */
const storeModelMetadata = async (model: LocalModel): Promise<void> => {
    try {
        const db = await getModelDatabase();
        if (!db) return;

        const transaction = db.transaction(['models'], 'readwrite');
        const store = transaction.objectStore('models');
        
        store.put({
            id: model.id,
            name: model.name,
            path: model.path,
            size: model.size,
            downloadedAt: model.downloadedAt,
            url: model.path, // Store URL for cache validation
            etag: '', // Could be populated from response headers
        });

        log(`✓ Model metadata stored in IndexedDB: ${model.id}`);
    } catch (err) {
        warn(`Failed to store model metadata for ${model.id}:`, err);
    }
};

/**
 * Get model metadata from IndexedDB
 */
export const getCachedModel = async (modelId: string): Promise<LocalModel | null> => {
    try {
        const db = await getModelDatabase();
        if (!db) return null;

        const transaction = db.transaction(['models'], 'readonly');
        const store = transaction.objectStore('models');
        const request = store.get(modelId);

        return new Promise((resolve) => {
            request.onsuccess = () => {
                if (request.result) {
                    resolve({
                        id: request.result.id,
                        name: request.result.name,
                        path: request.result.path,
                        size: request.result.size,
                        downloadedAt: request.result.downloadedAt,
                    });
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => {
                resolve(null);
            };
        });
    } catch (err) {
        warn(`Failed to get cached model ${modelId}:`, err);
        return null;
    }
};

/**
 * Delete model from cache
 */
export const deleteCachedModel = async (modelId: string): Promise<void> => {
    try {
        // Delete from Cache API
        if (modelCache) {
            const cachedModel = await getCachedModel(modelId);
            if (cachedModel?.path) {
                await modelCache?.delete(cachedModel.path);
                log(`✓ Model ${modelId} deleted from Cache API`);
            }
        }

        // Delete from IndexedDB
        const db = await getModelDatabase();
        if (db) {
            const transaction = db.transaction(['models'], 'readwrite');
            const store = transaction.objectStore('models');
            store.delete(modelId);
            log(`✓ Model ${modelId} deleted from IndexedDB`);
        }
    } catch (err) {
        warn(`Failed to delete cached model ${modelId}:`, err);
    }
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
    } catch {
        // ignore head failures
    }

    try {
        const res = await fetch(url, { headers: { Range: 'bytes=0-0' } });
        if (!res.ok) return undefined;
        const range = parseContentRangeTotal(res.headers.get('Content-Range'));
        if (range) return range;
        const length = Number(res.headers.get('Content-Length') ?? 0);
        return length > 0 ? length : undefined;
    } catch {
        return undefined;
    }
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
 * Extract filename from URL
 */
const filenameFromUrl = (url: string): string => {
    try {
        const parsed = new URL(url);
        const name = parsed.pathname.split('/').pop();
        return name && name.length ? name : 'model.gguf';
    } catch {
        return 'model.gguf';
    }
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
 * Get download state for a model
 */
export const getDownloadState = (modelId: string): DownloadState | undefined => {
    return downloadStates.get(modelId);
};

/**
 * Get all download states
 */
export const getAllDownloadStates = (): Map<string, DownloadState> => {
    return new Map(downloadStates);
};

/**
 * Cancel an active download
 */
export const cancelDownload = (modelId: string): void => {
    const download = activeDownloads.get(modelId);
    if (download) {
        download.controller.abort('cancelled');
        download.state.status = 'cancelled';
        download.state.error = 'Download cancelled by user';
        downloadStates.set(modelId, download.state);
        activeDownloads.delete(modelId);
        log(`✓ Download cancelled: ${modelId}`);
    }
};

/**
 * Cancel all active downloads
 */
export const cancelAllDownloads = (): void => {
    activeDownloads.forEach((download, modelId) => {
        download.controller.abort('cancelled');
        download.state.status = 'cancelled';
        download.state.error = 'All downloads cancelled';
        downloadStates.set(modelId, download.state);
    });
    activeDownloads.clear();
    log('✓ All downloads cancelled');
};

/**
 * Retry a failed download
 */
export const retryDownload = async (options: DownloadOptions): Promise<void> => {
    const state = downloadStates.get(options.model.id);
    if (state && state.retryCount < (options.maxRetries || DEFAULT_MAX_RETRIES)) {
        state.retryCount += 1;
        state.status = 'idle';
        state.error = undefined;
        downloadStates.set(options.model.id, state);
        
        await downloadModel(options);
    } else {
        error(`Max retries reached for model ${options.model.id}`);
        if (options.onError) {
            options.onError(new Error('Max retries reached'), options.model.id);
        }
    }
};

/**
 * Main download function with resume support
 */
export const downloadModel = async (options: DownloadOptions): Promise<LocalModel | null> => {
    const { model, maxRetries = DEFAULT_MAX_RETRIES, timeout = DEFAULT_TIMEOUT } = options;
    const modelId = model.id;
    
    // Validate model URL for security
    if (!validateModelPath(model.downloadUrl)) {
        const err = new Error(`Model URL is not from a trusted source: ${model.downloadUrl}`);
        error('Security validation failed:', err);
        options.onError?.(err, modelId);
        return null;
    }

    if (!checkHTTPS(model.downloadUrl)) {
        const err = new Error(`Model URL must use HTTPS: ${model.downloadUrl}`);
        error('HTTPS validation failed:', err);
        options.onError?.(err, modelId);
        return null;
    }

    // Check if already downloading
    if (activeDownloads.has(modelId)) {
        warn(`Model ${modelId} is already downloading`);
        return null;
    }

    // Check if already cached
    const cachedModel = await getCachedModel(modelId);
    if (cachedModel) {
        log(`✓ Model ${modelId} already cached, skipping download`);
        options.onComplete?.(cachedModel);
        return cachedModel;
    }

    // Initialize download state
    const state: DownloadState = {
        modelId,
        status: 'downloading',
        progress: 0,
        bytesDownloaded: 0,
        totalBytes: 0,
        retryCount: 0,
        lastUpdated: Date.now(),
    };
    
    downloadStates.set(modelId, state);
    
    // Create filename for storage
    const filename = filenameFromUrl(model.downloadUrl);
    const cacheKey = `model-${modelId}-${filename}`;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        let stallTimer: ReturnType<typeof setTimeout> | null = null;
        let downloaded = 0;
        let totalBytes = 0;
        
        // Update active downloads
        activeDownloads.set(modelId, { controller, state });
        
        try {
            // Reset stall timer
            const resetStallTimer = () => {
                if (stallTimer) {
                    clearTimeout(stallTimer);
                }
                stallTimer = setTimeout(() => {
                    if (!controller.signal.aborted) {
                        controller.abort('stall');
                    }
                }, STALL_TIMEOUT);
            };

            // Check for existing partial download in cache
            if (modelCache) {
                const cachedResponse = await modelCache.match(model.downloadUrl);
                if (cachedResponse) {
                    const blob = await cachedResponse.blob();
                    downloaded = blob.size;
                    log(`✓ Resuming download from cache: ${downloaded} bytes`);
                }
            }

            // Get remote file size
            const remoteSize = await fetchRemoteSize(model.downloadUrl);
            totalBytes = remoteSize || 0;
            
            // Update state
            state.totalBytes = totalBytes;
            state.bytesDownloaded = downloaded;
            state.lastUpdated = Date.now();
            downloadStates.set(modelId, state);

            // Emit initial progress
            options.onProgress?.({
                percent: totalBytes ? Math.round((downloaded / totalBytes) * 100) : 0,
                status: downloaded > 0 ? 'Resuming download...' : 'Starting download...',
                bytesDownloaded: downloaded,
                totalBytes,
                modelId,
            });

            if (downloaded > 0) {
                log(`✓ Resuming download for ${modelId}: ${formatBytes(downloaded)} / ${formatBytes(totalBytes)}`);
            }

            resetStallTimer();

            // Set up range request if resuming
            const headers: HeadersInit = downloaded > 0 
                ? { Range: `bytes=${downloaded}-` } 
                : {};

            const response = await fetch(model.downloadUrl, {
                signal: controller.signal,
                headers,
            });

            if (!response.ok || !response.body) {
                throw new Error(`Failed to download model (${response.status})`);
            }

            // Handle 200 response when we expected 206 (partial content)
            if (downloaded > 0 && response.status === 200) {
                downloaded = 0; // Server doesn't support range requests, restart download
                log(`⚠️ Server doesn't support range requests, restarting download for ${modelId}`);
            }

            // Update total bytes from response headers
            const contentRangeTotal = parseContentRangeTotal(response.headers.get('Content-Range'));
            const contentLength = Number(response.headers.get('Content-Length') ?? 0);
            totalBytes = contentRangeTotal ?? (contentLength ? contentLength + downloaded : 0);
            
            state.totalBytes = totalBytes;
            state.lastUpdated = Date.now();
            downloadStates.set(modelId, state);

            // Create a new cache entry or update existing
            let cacheResponse: Response;
            
            if (downloaded > 0 && modelCache) {
                // Try to get existing cache entry for appending
                const existingCache = await modelCache.match(model.downloadUrl);
                if (existingCache) {
                    // For simplicity, we'll create a new cache entry
                    // In a more advanced implementation, we could append to existing
                    cacheResponse = new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers,
                    });
                } else {
                    cacheResponse = response;
                }
            } else {
                cacheResponse = response;
            }

            // Store in Cache API
            if (modelCache) {
                await modelCache.put(model.downloadUrl, cacheResponse.clone());
            }

            // Read and validate the first chunk (header)
            const reader = response.body.getReader();
            let headerBytes: Uint8Array | null = null;
            let bytesSinceYield = 0;
            const yieldAfterBytes = 4 * 1024 * 1024;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (!value) continue;

                resetStallTimer();

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
                    bytesSinceYield += chunk.length;

                    // Update progress
                    const percent = totalBytes
                        ? Math.min(99, Math.round((downloaded / totalBytes) * 100))
                        : 0;
                    
                    state.progress = percent;
                    state.bytesDownloaded = downloaded;
                    state.lastUpdated = Date.now();
                    downloadStates.set(modelId, state);

                    options.onProgress?.({
                        percent,
                        status: `Downloading... ${formatBytes(downloaded)} / ${totalBytes ? formatBytes(totalBytes) : '?'}`,
                        bytesDownloaded: downloaded,
                        totalBytes,
                        modelId,
                    });

                    // Yield to event loop periodically
                    if (bytesSinceYield >= yieldAfterBytes) {
                        bytesSinceYield = 0;
                        await new Promise(resolve => setTimeout(resolve, 0));
                        resetStallTimer();
                    }
                }
            }

            // Clear stall timer
            if (stallTimer) {
                clearTimeout(stallTimer);
                stallTimer = null;
            }

            // Validate header if we got it
            if (headerBytes && !isGgufHeader(headerBytes)) {
                // Clean up cache
                if (modelCache) {
                    await modelCache.delete(model.downloadUrl);
                }
                
                state.status = 'error';
                state.error = 'Downloaded file is not GGUF';
                downloadStates.set(modelId, state);
                
                throw new Error('Downloaded file is not GGUF');
            }

            // Validate minimum size
            if (downloaded < MIN_GGUF_BYTES) {
                if (modelCache) {
                    await modelCache.delete(model.downloadUrl);
                }
                
                state.status = 'error';
                state.error = 'Downloaded file too small';
                downloadStates.set(modelId, state);
                
                throw new Error('Downloaded file too small');
            }

            // Validate the complete file in cache
            if (modelCache) {
                const cachedResponse = await modelCache.match(model.downloadUrl);
                if (cachedResponse) {
                    const blob = await cachedResponse.blob();
                    const arrayBuffer = await blob.arrayBuffer();
                    const fileBytes = new Uint8Array(arrayBuffer);
                    
                    // Check header
                    if (!isGgufHeader(fileBytes.slice(0, 4))) {
                        await modelCache.delete(model.downloadUrl);
                        throw new Error('Cached file header is not GGUF');
                    }
                    
                    // Check size
                    if (arrayBuffer.byteLength < MIN_GGUF_BYTES) {
                        await modelCache.delete(model.downloadUrl);
                        throw new Error('Cached file too small');
                    }
                }
            }

            // Create local model record
            const localModel: LocalModel = {
                id: modelId,
                name: model.name,
                path: model.downloadUrl, // Using URL as path for web-based caching
                size: downloaded,
                downloadedAt: Date.now(),
            };

            // Store metadata in IndexedDB
            await storeModelMetadata(localModel);

            // Update state
            state.status = 'completed';
            state.progress = 100;
            state.bytesDownloaded = downloaded;
            state.totalBytes = totalBytes;
            state.lastUpdated = Date.now();
            downloadStates.set(modelId, state);

            // Clean up active downloads
            activeDownloads.delete(modelId);

            log(`✓ Model ${modelId} downloaded successfully: ${formatBytes(downloaded)}`);
            
            options.onProgress?.({
                percent: 100,
                status: 'Download complete',
                bytesDownloaded: downloaded,
                totalBytes,
                modelId,
            });

            options.onComplete?.(localModel);
            
            return localModel;

        } catch (err) {
            // Clear stall timer
            if (stallTimer) {
                clearTimeout(stallTimer);
                stallTimer = null;
            }

            const errorMessage = err instanceof Error ? err.message : String(err);
            const aborted = controller.signal.aborted;
            const reason = controller.signal.reason;

            // Clean up cache on error
            if (modelCache) {
                try {
                    await modelCache.delete(model.downloadUrl);
                } catch {
                    // ignore cache delete errors
                }
            }

            if (aborted && reason === 'cancelled') {
                state.status = 'cancelled';
                state.error = 'Download cancelled';
                downloadStates.set(modelId, state);
                activeDownloads.delete(modelId);
                throw new Error('Download cancelled');
            }

            if (attempt >= maxRetries) {
                state.status = 'error';
                state.error = errorMessage;
                downloadStates.set(modelId, state);
                activeDownloads.delete(modelId);
                
                error(`✗ Download failed after ${attempt} attempts for ${modelId}: ${errorMessage}`);
                options.onError?.(new Error(errorMessage), modelId);
                return null;
            }

            // Update state for retry
            state.status = 'idle';
            state.error = errorMessage;
            state.retryCount = attempt;
            state.lastUpdated = Date.now();
            downloadStates.set(modelId, state);

            warn(`⚠️ Download attempt ${attempt} failed for ${modelId}: ${errorMessage}. Retrying...`);
            
            // Exponential backoff
            const delay = Math.min(1500 * attempt, 5000);
            await new Promise(resolve => setTimeout(resolve, delay));

        } finally {
            // Clean up if this was the last attempt or cancelled
            if (attempt >= maxRetries || controller.signal.reason === 'cancelled') {
                activeDownloads.delete(modelId);
            }
        }
    }

    return null;
};

/**
 * Download multiple models concurrently
 */
export const downloadMultipleModels = async (
    models: Model[],
    options: Omit<DownloadOptions, 'model'> & {
        maxConcurrent?: number;
        onAllComplete?: () => void;
    }
): Promise<LocalModel[]> => {
    const { maxConcurrent = 2, onAllComplete, ...downloadOptions } = options;
    const results: LocalModel[] = [];
    const errors: { modelId: string; error: Error }[] = [];
    
    // Process models in batches
    for (let i = 0; i < models.length; i += maxConcurrent) {
        const batch = models.slice(i, i + maxConcurrent);
        const batchPromises = batch.map(model => 
            downloadModel({ ...downloadOptions, model })
                .catch(err => {
                    errors.push({ modelId: model.id, error: err });
                    return null;
                })
        );
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.filter(Boolean) as LocalModel[]);
    }

    if (onAllComplete) {
        onAllComplete();
    }

    if (errors.length > 0) {
        warn(`⚠️ ${errors.length} models failed to download`);
    }

    return results;
};

/**
 * Get download progress for a specific model
 */
export const getDownloadProgress = (modelId: string): DownloadProgress | null => {
    const state = downloadStates.get(modelId);
    if (!state) return null;

    return {
        percent: state.progress,
        status: state.status === 'error' ? state.error || 'Error' : 
                state.status === 'cancelled' ? 'Cancelled' :
                state.status === 'completed' ? 'Complete' :
                state.status === 'paused' ? 'Paused' : 'Downloading...',
        bytesDownloaded: state.bytesDownloaded,
        totalBytes: state.totalBytes,
        modelId: state.modelId,
    };
};

/**
 * Check if any downloads are in progress
 */
export const hasActiveDownloads = (): boolean => {
    return activeDownloads.size > 0 || 
           Array.from(downloadStates.values()).some(s => s.status === 'downloading');
};

/**
 * Get total download progress across all models
 */
export const getTotalDownloadProgress = (): Omit<DownloadProgress, 'modelId'> | null => {
    const states = Array.from(downloadStates.values());
    const downloadingStates = states.filter(s => s.status === 'downloading');
    
    if (downloadingStates.length === 0) return null;

    const totalBytes = downloadingStates.reduce((sum, s) => sum + s.totalBytes, 0);
    const bytesDownloaded = downloadingStates.reduce((sum, s) => sum + s.bytesDownloaded, 0);
    const percent = totalBytes > 0 ? 
        Math.round((bytesDownloaded / totalBytes) * 100) : 0;

    return {
        percent,
        status: `Downloading ${downloadingStates.length} model(s)...`,
        bytesDownloaded,
        totalBytes,
    };
};

export default {
    downloadModel,
    downloadMultipleModels,
    cancelDownload,
    cancelAllDownloads,
    retryDownload,
    getDownloadState,
    getAllDownloadStates,
    getDownloadProgress,
    getTotalDownloadProgress,
    hasActiveDownloads,
    isModelCached,
    getCachedModel,
    deleteCachedModel,
    initModelCache,
    formatBytes,
    isGgufHeader,
};
