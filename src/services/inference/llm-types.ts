/**
 * Enhanced LLM types inspired by ente-io/ensu
 * These types provide better type safety and more comprehensive inference capabilities
 */

// Message types for chat
export type LlmRole = "system" | "user" | "assistant";

export interface LlmMessage {
    role: LlmRole;
    content: string;
}

// Model information
export interface ModelInfo {
    id: string;
    name: string;
    url: string;
    mmprojUrl?: string;
    sizeHuman?: string;
    sizeBytes?: number;
    mmprojSizeBytes?: number;
    contextLength?: number;
    maxTokens?: number;
    description?: string;
    author?: string;
    license?: string;
    quantized?: boolean;
    quantizationMethod?: string;
    recommended?: boolean;
    tags?: string[];
}

// Model settings for runtime configuration
export interface ModelSettings {
    useCustomModel: boolean;
    modelUrl?: string;
    mmprojUrl?: string;
    contextLength?: number;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    repeatPenalty?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
}

// Download progress tracking
export interface DownloadProgress {
    percent: number;
    status?: string;
    bytesDownloaded?: number;
    totalBytes?: number;
}

// Generation summary
export interface GenerateSummary {
    job_id: number;
    prompt_tokens: number | null;
    generated_tokens: number | null;
    total_time_ms: number | null;
}

// Generation events for streaming
export type GenerateEvent =
    | { type: "text"; job_id: number; text: string; token_id?: number | null }
    | { type: "done"; summary: GenerateSummary }
    | { type: "error"; job_id: number; message: string };

// Generation request
export interface GenerateChatRequest {
    messages: LlmMessage[];
    templateOverride?: string;
    addAssistant?: boolean;
    imagePaths?: string[];
    mmprojPath?: string;
    mediaMarker?: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    repeatPenalty?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    seed?: number;
    stopSequences?: string[];
    grammar?: string;
}

// Inference backend types
export type BackendType = "wasm" | "webgpu";

export interface InferenceBackend {
    readonly kind: BackendType;
    initBackend(): Promise<void>;
    loadModel(params: LoadModelParams): Promise<void>;
    createContext(
        model: { modelPath: string },
        params?: ContextParams,
    ): Promise<void>;
    generateChatStream(
        request: GenerateChatRequest,
        onEvent?: (event: GenerateEvent) => void,
    ): Promise<GenerateSummary>;
    cancel(jobId: number): void;
    freeContext(): Promise<void>;
    freeModel(): Promise<void>;
    isModelAvailable(modelPath: string): Promise<boolean>;
    applyChatTemplate?(
        messages: LlmMessage[],
        templateOverride?: string,
    ): Promise<string>;
}

// Load model parameters
export interface LoadModelParams {
    modelPath: string;
    nGpuLayers?: number | null;
    useMmap?: boolean | null;
    useMlock?: boolean | null;
}

// Context parameters
export interface ContextParams {
    contextSize?: number | null;
    nThreads?: number | null;
    nBatch?: number | null;
}

// WASM progress callback
export type WasmProgressCallback = (event: {
    loaded: number;
    total?: number;
    status?: string;
}) => void;

// Inference options
export interface InferenceOptions {
    backend?: "auto" | BackendType;
    wasm?: {
        wasmPaths?: Partial<Record<string, string>>;
        wllamaConfig?: Record<string, unknown>;
        progressCallback?: WasmProgressCallback;
    };
}


