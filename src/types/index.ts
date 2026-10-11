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
  /** Optional folder the chat is sorted into (see ChatFolder) */
  folderId?: string | null;
}

/**
 * Chat without its messages, plus the message count. The sidebar and the
 * data page only need this - loading every message of every chat into
 * memory just to render the chat list is wasteful with long histories.
 */
export type ChatMetadata = Omit<Chat, 'messages'> & { messageCount: number };

// Chat folder types
export interface ChatFolder {
  id: string;
  name: string;
  createdAt: number;
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
