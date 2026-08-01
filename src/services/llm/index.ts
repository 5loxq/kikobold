/**
 * LLM Services Index
 * 
 * Exports all LLM-related services and types
 */

export * from './inference';
export * from './types';

// Re-export types from inference file for compatibility
export type {
    LlmMessage,
    GenerateChatRequest,
    GenerateEvent,
    GenerateSummary,
    LoadModelParams,
    ContextParams,
    InferenceBackend,
} from './inference';

// Re-export classes from inference file
export {
    InferenceSession,
    WasmBackend,
    WebGPUBackend,
    NativeBackend,
} from './inference';

// Note: This module primarily uses named exports
// All types and functions are available as named exports above
