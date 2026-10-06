// Message types
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export type ChatTag = 'work' | 'personal' | 'idea' | 'archive';

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  profileId: string;
  createdAt: number;
  updatedAt: number;
  /** Optional color tag shown in the sidebar for orientation */
  tag?: ChatTag;
  /** Survives a reload during generation: the partial assistant text
   *  streamed so far. Cleared when the message is finished and saved. */
  streamingDraft?: string;
}

// Memory types
export interface MemoryEntry {
  id: string;
  content: string;
  /** Optional predefined field key (e.g. 'name', 'work') - entries with a
   *  field are rendered as "Label: value" in the injected memory block */
  field?: string;
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

// Re-export hook types
export type {
  UseModelsReturn,
  UseChatReturn,
  UseProfilesReturn,
} from './hooks';
