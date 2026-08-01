/**
 * LLM Provider Types
 * 
 * Inspired by ente-io/ensu's llm provider types
 * Comprehensive types for LLM inference and provider management
 */

// ============================================================================
// Provider Types
// ============================================================================

/**
 * Supported LLM providers
 */
export type ProviderType = 
    | 'local'
    | 'huggingface'
    | 'openai'
    | 'anthropic'
    | 'google'
    | 'mistral'
    | 'cohere'
    | 'groq'
    | 'ollama'
    | 'lmstudio';

/**
 * Backend kind for inference
 */
export type BackendKind = 'wasm' | 'webgpu' | 'native';

/**
 * Base provider configuration
 */
export interface BaseProviderConfig {
    id: string;
    name: string;
    type: ProviderType;
    enabled: boolean;
    description?: string;
    apiUrl?: string;
    documentationUrl?: string;
}

/**
 * OpenAI-compatible provider configuration
 */
export interface OpenAIProviderConfig extends BaseProviderConfig {
    type: 'openai' | 'anthropic' | 'google' | 'mistral' | 'cohere' | 'groq';
    apiKey: string;
    baseUrl?: string;
    modelsUrl?: string;
    defaultModel?: string;
    maxTokens?: number;
    timeout?: number;
}

/**
 * HuggingFace provider configuration
 */
export interface HuggingFaceProviderConfig extends BaseProviderConfig {
    type: 'huggingface';
    apiKey?: string;
    baseUrl?: string;
    useInferenceApi?: boolean;
    useTransformers?: boolean;
    defaultModel?: string;
}

/**
 * Local provider configuration
 */
export interface LocalProviderConfig extends BaseProviderConfig {
    type: 'local' | 'ollama' | 'lmstudio';
    baseUrl?: string;
    modelPath?: string;
    maxContextLength?: number;
    useGpu?: boolean;
    useWebGPU?: boolean;
    useWASM?: boolean;
}

/**
 * Provider configuration union type
 */
export type ProviderConfig = 
    | BaseProviderConfig
    | OpenAIProviderConfig
    | HuggingFaceProviderConfig
    | LocalProviderConfig;

/**
 * Provider capabilities
 */
export interface ProviderCapabilities {
    chat: boolean;
    completion: boolean;
    embedding: boolean;
    streaming: boolean;
    imageGeneration: boolean;
    supportsFunctions: boolean;
    supportsTools: boolean;
    maxTokens: number;
    maxContextLength: number;
    supportsSystemMessages: boolean;
    supportsToolChoice: boolean;
}

/**
 * Provider model information
 */
export interface ProviderModel {
    id: string;
    name: string;
    provider: string;
    description?: string;
    contextLength: number;
    maxTokens: number;
    pricing?: {
        prompt: number; // Price per 1K tokens for prompt
        completion: number; // Price per 1K tokens for completion
        currency: string;
    };
    supports: ProviderCapabilities;
    tags: string[];
    recommended: boolean;
    available: boolean;
}

/**
 * Provider authentication
 */
export interface ProviderAuth {
    type: 'none' | 'api_key' | 'oauth' | 'bearer';
    key?: string;
    token?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
}

/**
 * Provider rate limiting information
 */
export interface ProviderRateLimit {
    requests: number;
    tokens: number;
    resetAt: number;
    remaining: number;
}

// ============================================================================
// Provider Manager Types
// ============================================================================

/**
 * Provider manager configuration
 */
export interface ProviderManagerConfig {
    providers: ProviderConfig[];
    defaultProvider: string;
    autoCheckModels: boolean;
    cacheModels: boolean;
}

/**
 * Provider status
 */
export interface ProviderStatus {
    provider: string;
    connected: boolean;
    lastChecked: number;
    latency?: number;
    error?: string;
    modelsAvailable: number;
}

/**
 * Provider health check result
 */
export interface ProviderHealthCheck {
    provider: string;
    healthy: boolean;
    latency: number;
    error?: string;
    timestamp: number;
}

/**
 * Model filtering options
 */
export interface ModelFilterOptions {
    provider?: string;
    search?: string;
    tags?: string[];
    minParameters?: number;
    maxParameters?: number;
    quantized?: boolean;
    minContextLength?: number;
    limit?: number;
    offset?: number;
}

/**
 * Model sort options
 */
export type ModelSortBy = 
    | 'name'
    | 'parameters'
    | 'size'
    | 'downloads'
    | 'createdAt'
    | 'updatedAt';

export type ModelSortOrder = 'asc' | 'desc';

export interface ModelSortOptions {
    by: ModelSortBy;
    order: ModelSortOrder;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Model file information
 */
export interface ModelFile {
    filename: string;
    size: number;
    modifiedAt: number;
    modelType?: string;
    parameters?: number;
    quantized?: boolean;
    quantizationMethod?: string;
}

/**
 * Model metadata
 */
export interface ModelMetadata {
    id: string;
    name: string;
    description: string;
    author?: string;
    license?: string;
    repository?: string;
    parameters: number;
    quantized: boolean;
    quantizationMethod?: string;
    fileSize: number;
    downloadSize: number;
    contextLength: number;
    tags: string[];
    createdAt: number;
    updatedAt?: number;
}

/**
 * Model download progress
 */
export interface ModelDownloadProgress {
    modelId: string;
    status: 'pending' | 'downloading' | 'completed' | 'failed';
    progress: number; // 0-100
    downloadedBytes: number;
    totalBytes: number;
    speed?: number; // bytes per second
    eta?: number; // estimated time remaining in seconds
}

// Note: Only export types, not values. The default export was removed
// to avoid "only refers to a type, but is being used as a value" errors.
// All types are available as named exports above.
