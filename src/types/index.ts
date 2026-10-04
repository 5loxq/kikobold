// Message types
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  profileId: string;
  createdAt: number;
  updatedAt: number;
}

// Memory types
export interface MemoryEntry {
  id: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

// Profile types
export interface Profile {
  id: string;
  name: string;
  systemPrompt: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  createdAt: number;
  updatedAt: number;
}

// Model types
export interface Model {
  id: string;
  name: string;
  description: string;
  modelSize: string; // e.g., "2.7B", "7B"
  fileSizeMB?: number; // file size in MB for display
  downloadUrl: string;
  quantized: boolean;
  recommended: boolean;
  contextLength: number;
  isLocal?: boolean; // true if model is pre-downloaded locally
  localPath?: string; // path to local model file (e.g., "/models/tinyllama.gguf")
  provider?: string; // e.g., "mlc-ai", "huggingface"
}

// Model configuration for inference engine
export interface ModelConfig {
  id: string;
  name: string;
  modelPath: string;
  type: 'chat' | 'base';
  description: string;
  modelSize: string;
  fileSizeMB?: number;
  quantized: boolean;
  recommended: boolean;
  contextLength: number;
  provider?: string; // e.g., "mlc-ai", "huggingface"
}

export interface LocalModel {
  id: string;
  name: string;
  path: string;
  size: number;
  downloadedAt: number;
}

// Inference types
export interface InferenceOptions {
  temperature: number;
  topP: number;
  maxTokens: number;
  systemPrompt?: string;
  language?: string;
  topK?: number;
  repeatPenalty?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  seed?: number;
  stopSequences?: string[];
}

export interface InferenceResult {
  text: string;
  tokens: number;
  duration: number;
}

// Re-export hook types
export type {
  UseInferenceReturn,
  UseModelsReturn,
  UseChatReturn,
  UseProfilesReturn,
} from './hooks';
