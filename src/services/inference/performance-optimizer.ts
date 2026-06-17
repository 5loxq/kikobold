/**
 * Performance Optimizer for LLM Inference
 * 
 * Provides advanced performance optimizations including:
 * - Adaptive batching
 * - Memory management
 * - GPU/CPU load balancing
 * - Token streaming optimization
 * - Model caching strategies
 */

import { env } from '@xenova/transformers';
import { log, warn, debug } from '../logging';
import { checkWebGPUSupport, getSystemMemoryInfo, MemoryInfo } from '../security';

// ============================================================================
// Performance Constants
// ============================================================================

export const PERFORMANCE_CONFIG = {
    // Token generation
    TOKEN_BATCH_SIZE: 8,           // Process tokens in batches for efficiency
    MAX_CONCURRENT_TOKENS: 32,     // Max tokens to generate concurrently
    
    // Memory management
    MEMORY_WARNING_THRESHOLD: 0.8, // Warn when 80% of available memory is used
    MEMORY_CRITICAL_THRESHOLD: 0.95, // Fallback to CPU at 95%
    MODEL_CACHE_MAX_MEMORY_MB: 2048, // Max memory for cached models (2GB)
    
    // GPU settings
    GPU_NUM_THREADS: {
        mobile: 2,
        desktop: 4,
        highEnd: 8,
    },
    
    // Timeout settings
    TOKEN_TIMEOUT_MS: 5000,       // Timeout for single token generation
    MODEL_LOAD_TIMEOUT_MS: 120000, // 2 minutes for model loading
    
    // Retry settings
    MAX_RETRIES: 3,
    RETRY_DELAY_BASE_MS: 100,
    RETRY_DELAY_MAX_MS: 5000,
} as const;

// ============================================================================
// System Capabilities Detection
// ============================================================================

interface SystemCapabilities {
    webgpuAvailable: boolean;
    wasmSupported: boolean;
    hardwareConcurrency: number;
    deviceMemoryGB: number;
    availableMemoryGB: number;
    isMobile: boolean;
    isHighPerformanceDevice: boolean;
    recommendedBatchSize: number;
    recommendedThreads: number;
}

let systemCapabilities: SystemCapabilities | null = null;

/**
 * Detect and cache system capabilities for performance optimization
 */
export const detectSystemCapabilities = async (): Promise<SystemCapabilities> => {
    if (systemCapabilities) {
        return systemCapabilities;
    }

    const memoryInfo = await getSystemMemoryInfo();
    const webgpuAvailable = await checkWebGPUSupport();
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const hardwareConcurrency = navigator.hardwareConcurrency || (isMobile ? 2 : 4);
    const deviceMemoryGB = memoryInfo.totalMB / 1024;
    const availableMemoryGB = memoryInfo.availableMB / 1024;
    
    // Determine device performance tier
    const isHighPerformanceDevice = (
        !isMobile && 
        deviceMemoryGB >= 8 &&
        hardwareConcurrency >= 8
    );

    // Calculate recommended settings based on capabilities
    const recommendedThreads = isHighPerformanceDevice
        ? PERFORMANCE_CONFIG.GPU_NUM_THREADS.highEnd
        : isMobile
            ? PERFORMANCE_CONFIG.GPU_NUM_THREADS.mobile
            : PERFORMANCE_CONFIG.GPU_NUM_THREADS.desktop;

    const recommendedBatchSize = isHighPerformanceDevice
        ? PERFORMANCE_CONFIG.TOKEN_BATCH_SIZE * 2
        : PERFORMANCE_CONFIG.TOKEN_BATCH_SIZE;

    systemCapabilities = {
        webgpuAvailable,
        wasmSupported: true, // WASM is widely supported
        hardwareConcurrency,
        deviceMemoryGB,
        availableMemoryGB,
        isMobile,
        isHighPerformanceDevice,
        recommendedBatchSize,
        recommendedThreads,
    };

    log('System capabilities detected:', {
        webgpu: webgpuAvailable ? '✓' : '✗',
        wasm: '✓',
        cores: hardwareConcurrency,
        memory: `${deviceMemoryGB.toFixed(1)}GB`,
        available: `${availableMemoryGB.toFixed(1)}GB`,
        mobile: isMobile ? 'Mobile' : 'Desktop',
        performance: isHighPerformanceDevice ? 'High' : 'Standard',
    });

    return systemCapabilities;
};

/**
 * Get current system capabilities (cached)
 */
export const getSystemCapabilities = async (): Promise<SystemCapabilities> => {
    if (!systemCapabilities) {
        return detectSystemCapabilities();
    }
    return systemCapabilities;
};

// ============================================================================
// Adaptive Configuration
// ============================================================================

/**
 * Apply adaptive configuration based on system capabilities
 */
export const applyAdaptiveConfiguration = async (): Promise<void> => {
    const caps = await detectSystemCapabilities();

    // Configure ONNX runtime based on capabilities
    env.backends.onnx.wasm.numThreads = caps.recommendedThreads;
    env.backends.onnx.wasm.simd = true;
    env.backends.onnx.wasm.proxy = false;

    // Browser-specific optimizations
    const isFirefox = navigator.userAgent.includes('Firefox');
    const isChrome = navigator.userAgent.includes('Chrome') || navigator.userAgent.includes('Chromium');
    const isSafari = navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome');

    if (isFirefox) {
        // Firefox has conservative WASM implementation
        env.backends.onnx.wasm.numThreads = Math.min(caps.recommendedThreads, 4);
    } else if (isChrome) {
        // Chrome has excellent WASM support
        env.backends.onnx.wasm.numThreads = caps.recommendedThreads;
        env.backends.onnx.wasm.simd = true;
    } else if (isSafari) {
        // Safari may have memory limitations
        env.backends.onnx.wasm.numThreads = Math.min(caps.recommendedThreads, 3);
    }

    // Enable local model caching for better performance
    env.allowLocalModels = true;
    env.allowRemoteModels = true;

    debug('Adaptive configuration applied:', {
        threads: env.backends.onnx.wasm.numThreads,
        simd: env.backends.onnx.wasm.simd,
        proxy: env.backends.onnx.wasm.proxy,
    });
};

// ============================================================================
// Memory Management
// ============================================================================

interface MemoryUsage {
    usedMB: number;
    totalMB: number;
    availableMB: number;
    usagePercent: number;
    isCritical: boolean;
}

/**
 * Track memory usage and provide warnings
 */
export class MemoryManager {
    private static instance: MemoryManager;
    private modelMemoryMap: Map<string, number> = new Map(); // modelId -> estimated memory in MB
    private peakMemory: number = 0;
    
    private constructor() {}

    public static getInstance(): MemoryManager {
        if (!MemoryManager.instance) {
            MemoryManager.instance = new MemoryManager();
        }
        return MemoryManager.instance;
    }

    /**
     * Register a loaded model with its estimated memory usage
     */
    registerModel(modelId: string, memoryMB: number): void {
        this.modelMemoryMap.set(modelId, memoryMB);
        this.updatePeakMemory();
        debug(`Model ${modelId} registered with ${memoryMB}MB memory`);
    }

    /**
     * Unregister a model when unloaded
     */
    unregisterModel(modelId: string): void {
        this.modelMemoryMap.delete(modelId);
        debug(`Model ${modelId} unregistered`);
    }

    /**
     * Get total memory used by loaded models
     */
    getTotalModelMemory(): number {
        return Array.from(this.modelMemoryMap.values())
            .reduce((sum, mem) => sum + mem, 0);
    }

    /**
     * Get current system memory usage
     */
    async getCurrentUsage(): Promise<MemoryUsage> {
        const memoryInfo = await getSystemMemoryInfo();
        const modelMemory = this.getTotalModelMemory();
        const totalUsed = memoryInfo.usedMB + modelMemory;
        const available = memoryInfo.totalMB - totalUsed;
        const usagePercent = totalUsed / memoryInfo.totalMB;
        
        return {
            usedMB: totalUsed,
            totalMB: memoryInfo.totalMB,
            availableMB: available,
            usagePercent,
            isCritical: usagePercent > PERFORMANCE_CONFIG.MEMORY_CRITICAL_THRESHOLD,
        };
    }

    /**
     * Check if we should fallback to CPU due to memory pressure
     */
    async shouldFallbackToCPU(): Promise<boolean> {
        const usage = await this.getCurrentUsage();
        return usage.isCritical || usage.usagePercent > PERFORMANCE_CONFIG.MEMORY_WARNING_THRESHOLD;
    }

    /**
     * Get models sorted by memory usage (for cleanup decisions)
     */
    getModelsByMemoryUsage(): Array<{ modelId: string; memoryMB: number }> {
        return Array.from(this.modelMemoryMap.entries())
            .map(([modelId, memoryMB]) => ({ modelId, memoryMB }))
            .sort((a, b) => b.memoryMB - a.memoryMB);
    }

    /**
     * Clear all memory tracking
     */
    clear(): void {
        this.modelMemoryMap.clear();
        this.peakMemory = 0;
    }

    private updatePeakMemory(): void {
        const current = this.getTotalModelMemory();
        this.peakMemory = Math.max(this.peakMemory, current);
    }
}

// ============================================================================
// Token Streaming Optimization
// ============================================================================

interface TokenBatch {
    tokens: string[];
    timestamp: number;
    processingTime: number;
}

/**
 * Optimized token stream processor with backpressure handling
 */
export class TokenStreamOptimizer {
    private batchSize: number;
    private maxConcurrent: number;
    private activeBatches: number = 0;
    private pendingTokens: string[] = [];
    private batchQueue: TokenBatch[] = [];
    private lastBatchTime: number = 0;
    
    constructor(batchSize: number = PERFORMANCE_CONFIG.TOKEN_BATCH_SIZE) {
        this.batchSize = batchSize;
        this.maxConcurrent = PERFORMANCE_CONFIG.MAX_CONCURRENT_TOKENS;
    }

    /**
     * Add a token to be processed
     */
    addToken(token: string): void {
        this.pendingTokens.push(token);
    }

    /**
     * Process pending tokens in batches
     */
    async processTokens(
        processFn: (tokens: string[]) => Promise<string[]>
    ): Promise<string[]> {
        if (this.pendingTokens.length === 0) {
            return [];
        }

        // Wait if we have too many active batches
        while (this.activeBatches >= this.maxConcurrent) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        // Create a batch from pending tokens
        const batch: TokenBatch = {
            tokens: this.pendingTokens.slice(0, this.batchSize),
            timestamp: Date.now(),
            processingTime: 0,
        };
        
        this.pendingTokens = this.pendingTokens.slice(this.batchSize);
        this.activeBatches++;
        this.lastBatchTime = batch.timestamp;

        try {
            const startTime = Date.now();
            const results = await processFn(batch.tokens);
            batch.processingTime = Date.now() - startTime;
            
            this.batchQueue.push(batch);
            if (this.batchQueue.length > 10) {
                this.batchQueue.shift();
            }
            
            return results;
        } finally {
            this.activeBatches--;
        }
    }

    /**
     * Get average batch processing time
     */
    getAverageBatchTime(): number {
        if (this.batchQueue.length === 0) return 0;
        return this.batchQueue.reduce((sum, batch) => sum + batch.processingTime, 0) 
            / this.batchQueue.length;
    }

    /**
     * Get estimated tokens per second
     */
    getTokensPerSecond(): number {
        const avgTime = this.getAverageBatchTime();
        if (avgTime <= 0) return 0;
        return (this.batchSize / avgTime) * 1000;
    }

    /**
     * Clear all pending and queued batches
     */
    clear(): void {
        this.pendingTokens = [];
        this.batchQueue = [];
        this.activeBatches = 0;
    }

    /**
     * Adjust batch size based on performance
     */
    adjustBatchSize(tokensPerSecond: number): void {
        // Increase batch size if we're doing well
        if (tokensPerSecond > 50) {
            this.batchSize = Math.min(this.batchSize + 2, 16);
        } else if (tokensPerSecond < 20) {
            // Decrease batch size if we're struggling
            this.batchSize = Math.max(this.batchSize - 1, 4);
        }
        debug(`Adjusted batch size to ${this.batchSize} based on performance`);
    }
}

// ============================================================================
// Model Preloading and Warmup
// ============================================================================

interface PreloadConfig {
    modelId: string;
    priority: number; // 1-10, higher = preload sooner
    lastUsed: number;
    preloadStarted: boolean;
    preloadCompleted: boolean;
}

/**
 * Model preloading manager for faster inference startup
 */
export class ModelPreloader {
    private preloadConfigs: Map<string, PreloadConfig> = new Map();
    private activePreloads: Set<string> = new Set();
    private maxConcurrentPreloads: number = 1; // Only preload one model at a time
    
    /**
     * Add a model to the preload queue
     */
    addModel(modelId: string, priority: number = 5): void {
        this.preloadConfigs.set(modelId, {
            modelId,
            priority,
            lastUsed: Date.now(),
            preloadStarted: false,
            preloadCompleted: false,
        });
        debug(`Added model ${modelId} to preload queue with priority ${priority}`);
    }

    /**
     * Get next model to preload based on priority and last usage
     */
    getNextModelToPreload(): PreloadConfig | null {
        const configs = Array.from(this.preloadConfigs.values())
            .filter(c => !c.preloadStarted && !c.preloadCompleted && !this.activePreloads.has(c.modelId))
            .sort((a, b) => {
                // Higher priority first
                if (b.priority !== a.priority) return b.priority - a.priority;
                // More recently used first
                return b.lastUsed - a.lastUsed;
            });
        
        return configs[0] || null;
    }

    /**
     * Start preloading models in the background
     */
    async startPreloading(preloadFn: (modelId: string) => Promise<void>): Promise<void> {
        while (this.activePreloads.size < this.maxConcurrentPreloads) {
            const nextModel = this.getNextModelToPreload();
            if (!nextModel) break;

            const config = this.preloadConfigs.get(nextModel.modelId);
            if (!config) continue;

            config.preloadStarted = true;
            this.activePreloads.add(nextModel.modelId);

            try {
                await preloadFn(nextModel.modelId);
                config.preloadCompleted = true;
                log(`✓ Preloaded model: ${nextModel.modelId}`);
            } catch (error) {
                warn(`⚠️ Failed to preload model ${nextModel.modelId}:`, error);
                // Reset so we can try again later
                config.preloadStarted = false;
            } finally {
                this.activePreloads.delete(nextModel.modelId);
            }
        }
    }

    /**
     * Mark a model as used (updates lastUsed timestamp)
     */
    markAsUsed(modelId: string): void {
        const config = this.preloadConfigs.get(modelId);
        if (config) {
            config.lastUsed = Date.now();
        }
    }

    /**
     * Clear preload queue
     */
    clear(): void {
        this.preloadConfigs.clear();
        this.activePreloads.clear();
    }
}

// ============================================================================
// Performance Metrics
// ============================================================================

interface PerformanceMetrics {
    totalTokensGenerated: number;
    totalProcessingTime: number;
    averageTokensPerSecond: number;
    modelLoadTimes: Map<string, { total: number; count: number }>;
    inferenceTimes: number[];
    memoryUsage: number[];
}

/**
 * Performance metrics collector for monitoring and optimization
 */
export class PerformanceMetricsCollector {
    private metrics: PerformanceMetrics = {
        totalTokensGenerated: 0,
        totalProcessingTime: 0,
        averageTokensPerSecond: 0,
        modelLoadTimes: new Map(),
        inferenceTimes: [],
        memoryUsage: [],
    };
    
    private startTime: number = Date.now();

    /**
     * Record token generation
     */
    recordTokens(count: number, processingTime: number): void {
        this.metrics.totalTokensGenerated += count;
        this.metrics.totalProcessingTime += processingTime;
        this.metrics.inferenceTimes.push(processingTime);
        
        if (this.metrics.inferenceTimes.length > 100) {
            this.metrics.inferenceTimes.shift();
        }
    }

    /**
     * Record model load time
     */
    recordModelLoad(modelId: string, loadTime: number): void {
        const existing = this.metrics.modelLoadTimes.get(modelId);
        if (existing) {
            existing.total += loadTime;
            existing.count++;
        } else {
            this.metrics.modelLoadTimes.set(modelId, { total: loadTime, count: 1 });
        }
    }

    /**
     * Record memory usage
     */
    recordMemoryUsage(usageMB: number): void {
        this.metrics.memoryUsage.push(usageMB);
        if (this.metrics.memoryUsage.length > 100) {
            this.metrics.memoryUsage.shift();
        }
    }

    /**
     * Get current performance metrics
     */
    getMetrics(): PerformanceMetrics & { uptime: number } {
        const uptime = Date.now() - this.startTime;
        
        // Calculate average tokens per second
        if (uptime > 0) {
            this.metrics.averageTokensPerSecond = 
                (this.metrics.totalTokensGenerated / (uptime / 1000)) || 0;
        }

        return {
            ...this.metrics,
            uptime,
        };
    }

    /**
     * Get average inference time
     */
    getAverageInferenceTime(): number {
        if (this.metrics.inferenceTimes.length === 0) return 0;
        return this.metrics.inferenceTimes.reduce((a, b) => a + b, 0) 
            / this.metrics.inferenceTimes.length;
    }

    /**
     * Get average model load time for a specific model
     */
    getAverageModelLoadTime(modelId: string): number {
        const stats = this.metrics.modelLoadTimes.get(modelId);
        if (!stats || stats.count === 0) return 0;
        return stats.total / stats.count;
    }

    /**
     * Clear all metrics
     */
    clear(): void {
        this.metrics = {
            totalTokensGenerated: 0,
            totalProcessingTime: 0,
            averageTokensPerSecond: 0,
            modelLoadTimes: new Map(),
            inferenceTimes: [],
            memoryUsage: [],
        };
        this.startTime = Date.now();
    }
}

// ============================================================================
// Exports
// ============================================================================

export const memoryManager = MemoryManager.getInstance();
export const metricsCollector = new PerformanceMetricsCollector();
export const modelPreloader = new ModelPreloader();

export type { PerformanceMetrics };

// Initialize adaptive configuration on module load
applyAdaptiveConfiguration().catch(err => {
    warn('Failed to apply adaptive configuration:', err);
});
