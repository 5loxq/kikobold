/**
 * LLM Inference Service
 * 
 * Inspired by ente-io/ensu's llm/inference.ts
 * Unified inference service that works across different providers
 */

import { pipeline, TextGenerationPipeline } from '@xenova-transformers-stub';
import { log, warn } from '../logging';
import { checkWebGPUSupport, isWASMSupported } from '../security';
import { isTauriRuntime } from '../tauri-runtime';
import { createError, ErrorCodes } from '../../utils/errors';
import type { BackendKind } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Chat message interface
 */
export interface LlmMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * Generate chat request interface
 */
export interface GenerateChatRequest {
    messages: LlmMessage[];
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    repeatPenalty?: number;
    templateOverride?: string;
}

/**
 * Generate event types
 */
export type GenerateEvent = 
    | { type: 'text'; job_id: number; text: string; token_id?: number | null }
    | { type: 'done'; summary: GenerateSummary }
    | { type: 'error'; job_id: number; message: string };

/**
 * Generation summary
 */
export interface GenerateSummary {
    job_id: number;
    prompt_tokens: number | null;
    generated_tokens: number | null;
    total_time_ms: number | null;
}

/**
 * Load model parameters
 */
export interface LoadModelParams {
    modelPath: string;
    nGpuLayers?: number | null;
    useMmap?: boolean | null;
    useMlock?: boolean | null;
}

/**
 * Context parameters
 */
export interface ContextParams {
    contextSize?: number | null;
    nThreads?: number | null;
    nBatch?: number | null;
}

/**
 * Inference backend interface
 */
export interface InferenceBackend {
    readonly kind: BackendKind;
    initBackend(): Promise<void>;
    loadModel(params: LoadModelParams): Promise<void>;
    unloadModel(): Promise<void>;
    createContext(model: { modelPath: string }, params?: ContextParams): Promise<void>;
    freeContext(): Promise<void>;
    generateChatStream(
        request: GenerateChatRequest,
        onEvent?: (event: GenerateEvent) => void,
    ): Promise<GenerateSummary>;
    generate(request: {
        prompt: string;
        maxTokens?: number;
        temperature?: number;
        topP?: number;
        topK?: number;
    }): Promise<string>;
    cancel(jobId: number): void;
    isModelAvailable(modelPath: string): Promise<boolean>;
}

// ============================================================================
// Inference Session
// ============================================================================

class InferenceSession {
    private modelPath: string;
    private pipeline: TextGenerationPipeline | null = null;
    private jobId: number = 0;
    
    constructor(modelPath: string) {
        this.modelPath = modelPath;
    }
    
    async init(): Promise<void> {
        try {
            await checkWebGPUSupport();
            
            this.pipeline = await pipeline('text-generation', this.modelPath, {
                dtype: 'auto',
            } as any);
            
            log(`Inference session initialized: ${this.modelPath}`);
        } catch (err) {
            warn('Failed to initialize inference session:', err);
            throw createError(
                'Failed to initialize inference session',
                ErrorCodes.MODEL_LOAD_FAILED,
                { error: err }
            );
        }
    }
    
    async generateChatStream(
        request: GenerateChatRequest,
        onEvent?: (event: GenerateEvent) => void
    ): Promise<GenerateSummary> {
        if (!this.pipeline) {
            throw createError('Pipeline not initialized', ErrorCodes.INTERNAL_ERROR);
        }
        
        const jobId = ++this.jobId;
        const startTime = Date.now();
        
        try {
            const prompt = this.messagesToPrompt(request.messages);
            
            const result = await this.pipeline(prompt, {
                max_new_tokens: request.maxTokens ?? 512,
                temperature: request.temperature ?? 0.7,
                top_p: request.topP ?? 0.9,
                top_k: request.topK ?? 50,
                repetition_penalty: request.repeatPenalty ?? 1.1,
                num_return_sequences: 1,
            });
            
            let generatedText: string;
            let generatedTokens = 0;
            
            if (Array.isArray(result)) {
                generatedText = result.map(r => (r as any).generated_text || '').join('');
                generatedTokens = result.length;
            } else if (result && typeof result === 'object' && 'generated_text' in result) {
                generatedText = (result as any).generated_text as string;
                generatedTokens = 1;
            } else {
                generatedText = String(result);
                generatedTokens = 1;
            }
            
            const totalTime = Date.now() - startTime;
            const promptTokens = Math.ceil(prompt.length / 4);
            
            if (onEvent) {
                onEvent({
                    type: 'text',
                    job_id: jobId,
                    text: generatedText,
                });
                onEvent({
                    type: 'done',
                    summary: {
                        job_id: jobId,
                        prompt_tokens: promptTokens,
                        generated_tokens: generatedTokens,
                        total_time_ms: totalTime,
                    },
                });
            }
            
            return {
                job_id: jobId,
                prompt_tokens: promptTokens,
                generated_tokens: generatedTokens,
                total_time_ms: totalTime,
            };
            
        } catch (err) {
            warn('Stream generation failed:', err);
            
            if (onEvent) {
                onEvent({
                    type: 'error',
                    job_id: jobId,
                    message: err instanceof Error ? err.message : 'Unknown error',
                });
            }
            
            throw createError(
                err instanceof Error ? err.message : 'Stream generation failed',
                ErrorCodes.MODEL_INFERENCE_FAILED,
                { error: err }
            );
        }
    }
    
    async generate(prompt: string, options: {
        maxTokens?: number;
        temperature?: number;
        topP?: number;
        topK?: number;
    } = {}): Promise<string> {
        if (!this.pipeline) {
            throw createError('Pipeline not initialized', ErrorCodes.INTERNAL_ERROR);
        }
        
        try {
            const result = await this.pipeline(prompt, {
                max_new_tokens: options.maxTokens ?? 512,
                temperature: options.temperature ?? 0.7,
                top_p: options.topP ?? 0.9,
                top_k: options.topK ?? 50,
                num_return_sequences: 1,
            });
            
            if (Array.isArray(result)) {
                return (result[0] as any)?.generated_text || '';
            }
            
            if (result && typeof result === 'object' && 'generated_text' in result) {
                return (result as any).generated_text as string;
            }
            
            return String(result);
            
        } catch (err) {
            warn('Generation failed:', err);
            throw createError(
                err instanceof Error ? err.message : 'Generation failed',
                ErrorCodes.MODEL_INFERENCE_FAILED,
                { error: err }
            );
        }
    }
    
    cleanup(): void {
        if (this.pipeline) {
            try {
                if (typeof (this.pipeline as any).dispose === 'function') {
                    (this.pipeline as any).dispose();
                }
            } catch {
                // Ignore cleanup errors
            }
            this.pipeline = null;
        }
    }
    
    private messagesToPrompt(messages: LlmMessage[]): string {
        let prompt = '';
        
        for (const message of messages) {
            if (message.role === 'system') {
                prompt += `\n\n### System:\n${  message.content}`;
            } else if (message.role === 'user') {
                prompt += `\n\n### User:\n${  message.content}`;
            } else if (message.role === 'assistant') {
                prompt += `\n\n### Assistant:\n${  message.content}`;
            }
        }
        
        prompt += '\n\n### Assistant:\n';
        return prompt;
    }
}

// ============================================================================
// Backend Implementations
// ============================================================================

class WasmBackend implements InferenceBackend {
    readonly kind: BackendKind = 'wasm';
    private session: InferenceSession | null = null;
    private initialized: boolean = false;
    
    async initBackend(): Promise<void> {
        if (this.initialized) {return;}
        if (!isWASMSupported()) {
            throw createError(
                'WebAssembly not supported',
                ErrorCodes.WASM_NOT_SUPPORTED
            );
        }
        this.initialized = true;
        log('WASM backend initialized');
    }
    
    async loadModel(params: LoadModelParams): Promise<void> {
        this.session = new InferenceSession(params.modelPath);
        await this.session.init();
    }
    
    async unloadModel(): Promise<void> {
        if (this.session) {
            this.session.cleanup();
            this.session = null;
        }
    }
    
    async createContext(
        model: { modelPath: string },
        _params?: ContextParams
    ): Promise<void> {
        this.session = new InferenceSession(model.modelPath);
        await this.session.init();
    }
    
    async freeContext(): Promise<void> {
        if (this.session) {
            this.session.cleanup();
            this.session = null;
        }
    }
    
    async generateChatStream(
        request: GenerateChatRequest,
        onEvent?: (event: GenerateEvent) => void
    ): Promise<GenerateSummary> {
        if (!this.session) {
            throw createError('No session available', ErrorCodes.INTERNAL_ERROR);
        }
        return this.session.generateChatStream(request, onEvent);
    }
    
    async generate(request: {
        prompt: string;
        maxTokens?: number;
        temperature?: number;
        topP?: number;
        topK?: number;
    }): Promise<string> {
        if (!this.session) {
            throw createError('No session available', ErrorCodes.INTERNAL_ERROR);
        }
        return this.session.generate(request.prompt, request);
    }
    
    cancel(jobId: number): void {
        warn(`Job ${jobId} cancellation requested (not yet implemented)`);
    }
    
    async isModelAvailable(modelPath: string): Promise<boolean> {
        try {
            const session = new InferenceSession(modelPath);
            await session.init();
            session.cleanup();
            return true;
        } catch {
            return false;
        }
    }
}

class WebGPUBackend implements InferenceBackend {
    readonly kind: BackendKind = 'webgpu';
    private session: InferenceSession | null = null;
    private initialized: boolean = false;
    
    async initBackend(): Promise<void> {
        if (this.initialized) {return;}
        if (!await checkWebGPUSupport()) {
            throw createError(
                'WebGPU not supported',
                ErrorCodes.WEBGPU_NOT_SUPPORTED
            );
        }
        this.initialized = true;
        log('WebGPU backend initialized');
    }
    
    async loadModel(params: LoadModelParams): Promise<void> {
        this.session = new InferenceSession(params.modelPath);
        await this.session.init();
    }
    
    async unloadModel(): Promise<void> {
        if (this.session) {
            this.session.cleanup();
            this.session = null;
        }
    }
    
    async createContext(
        model: { modelPath: string },
        _params?: ContextParams
    ): Promise<void> {
        this.session = new InferenceSession(model.modelPath);
        await this.session.init();
    }
    
    async freeContext(): Promise<void> {
        if (this.session) {
            this.session.cleanup();
            this.session = null;
        }
    }
    
    async generateChatStream(
        request: GenerateChatRequest,
        onEvent?: (event: GenerateEvent) => void
    ): Promise<GenerateSummary> {
        if (!this.session) {
            throw createError('No session available', ErrorCodes.INTERNAL_ERROR);
        }
        return this.session.generateChatStream(request, onEvent);
    }
    
    async generate(request: {
        prompt: string;
        maxTokens?: number;
        temperature?: number;
        topP?: number;
        topK?: number;
    }): Promise<string> {
        if (!this.session) {
            throw createError('No session available', ErrorCodes.INTERNAL_ERROR);
        }
        return this.session.generate(request.prompt, request);
    }
    
    cancel(jobId: number): void {
        warn(`Job ${jobId} cancellation requested (not yet implemented)`);
    }
    
    async isModelAvailable(modelPath: string): Promise<boolean> {
        try {
            const session = new InferenceSession(modelPath);
            await session.init();
            session.cleanup();
            return true;
        } catch {
            return false;
        }
    }
}

class NativeBackend implements InferenceBackend {
    readonly kind: BackendKind = 'native';
    private jobId: number = 0;
    
    async initBackend(): Promise<void> {
        if (!isTauriRuntime()) {
            throw createError(
                'Native backend only available in Tauri',
                ErrorCodes.NOT_SUPPORTED
            );
        }
        log('Native backend initialized');
    }
    
    async loadModel(params: LoadModelParams): Promise<void> {
        if (!isTauriRuntime()) {
            throw createError(
                'Native backend only available in Tauri',
                ErrorCodes.NOT_SUPPORTED
            );
        }
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('load_model', { params });
            log('Model loaded via native backend');
        } catch (err) {
            warn('Failed to load model in native backend:', err);
            throw createError(
                'Failed to load model',
                ErrorCodes.MODEL_LOAD_FAILED,
                { error: err }
            );
        }
    }
    
    async unloadModel(): Promise<void> {
        if (!isTauriRuntime()) {return;}
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('unload_model');
        } catch {
            // Ignore unload errors
        }
    }
    
    async createContext(
        model: { modelPath: string },
        params?: ContextParams
    ): Promise<void> {
        if (!isTauriRuntime()) {
            throw createError(
                'Native backend only available in Tauri',
                ErrorCodes.NOT_SUPPORTED
            );
        }
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('create_context', { model, params });
        } catch (err) {
            warn('Failed to create context in native backend:', err);
            throw err;
        }
    }
    
    async freeContext(): Promise<void> {
        if (!isTauriRuntime()) {return;}
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('free_context');
        } catch {
            // Ignore
        }
    }
    
    async generateChatStream(
        request: GenerateChatRequest,
        onEvent?: (event: GenerateEvent) => void
    ): Promise<GenerateSummary> {
        if (!isTauriRuntime()) {
            throw createError(
                'Native backend only available in Tauri',
                ErrorCodes.NOT_SUPPORTED
            );
        }
        
        const jobId = ++this.jobId;
        
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const result = await invoke('generate_chat_stream', {
                request,
            }) as GenerateSummary;
            return result;
        } catch (err) {
            warn('Native generation failed:', err);
            if (onEvent) {
                onEvent({
                    type: 'error',
                    job_id: jobId,
                    message: err instanceof Error ? err.message : 'Unknown error',
                });
            }
            throw err;
        }
    }
    
    async generate(request: {
        prompt: string;
        maxTokens?: number;
        temperature?: number;
        topP?: number;
        topK?: number;
    }): Promise<string> {
        if (!isTauriRuntime()) {
            throw createError(
                'Native backend only available in Tauri',
                ErrorCodes.NOT_SUPPORTED
            );
        }
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            return await invoke('generate', { request }) as string;
        } catch (err) {
            warn('Native generation failed:', err);
            throw err;
        }
    }
    
    cancel(jobId: number): void {
        if (!isTauriRuntime()) {return;}
        // Fire and forget - Tauri invoke is async but we can't await in a sync method
        (async () => {
            try {
                const { invoke } = await import('@tauri-apps/api/core');
                await invoke('cancel_job', { jobId });
            } catch {
                // Ignore
            }
        })();
    }
    
    async isModelAvailable(modelPath: string): Promise<boolean> {
        if (!isTauriRuntime()) {return false;}
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            return await invoke('is_model_available', { modelPath }) as boolean;
        } catch {
            return false;
        }
    }
}

// ============================================================================
// Backend Factory
// ============================================================================

export const createInferenceBackend = async (
    preferredKind?: BackendKind
): Promise<InferenceBackend> => {
    const webgpuAvailable = await checkWebGPUSupport();
    const wasmAvailable = isWASMSupported();
    const isTauri = isTauriRuntime();
    
    if (preferredKind) {
        switch (preferredKind) {
            case 'webgpu':
                if (webgpuAvailable) {return new WebGPUBackend();}
                break;
            case 'wasm':
                if (wasmAvailable) {return new WasmBackend();}
                break;
            case 'native':
                if (isTauri) {return new NativeBackend();}
                break;
        }
    }
    
    if (isTauri) {
        log('Using native backend (Tauri)');
        return new NativeBackend();
    }
    
    if (webgpuAvailable) {
        log('Using WebGPU backend');
        return new WebGPUBackend();
    }
    
    if (wasmAvailable) {
        log('Using WASM backend');
        return new WasmBackend();
    }
    
    throw createError(
        'No suitable backend available',
        ErrorCodes.NOT_SUPPORTED
    );
};

export const getAvailableBackends = async (): Promise<BackendKind[]> => {
    const backends: BackendKind[] = [];
    
    const webgpuAvailable = await checkWebGPUSupport();
    const wasmAvailable = isWASMSupported();
    const isTauri = isTauriRuntime();
    
    if (isTauri) {backends.push('native');}
    if (webgpuAvailable) {backends.push('webgpu');}
    if (wasmAvailable) {backends.push('wasm');}
    
    return backends;
};

export { InferenceSession, WasmBackend, WebGPUBackend, NativeBackend };
