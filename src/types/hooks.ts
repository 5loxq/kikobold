/**
 * Type definitions for custom React hooks
 */

import { Chat, ChatMetadata, InferenceOptions, InferenceResult, LocalModel, Model, Profile } from '.';

// useInference hook return type
export interface UseInferenceReturn {
  loadModel: (modelId: string) => Promise<void>;
  unloadModel: () => void;
  generate: (prompt: string, options: InferenceOptions) => Promise<InferenceResult | null>;
  generateStream: (
    prompt: string,
    options: InferenceOptions,
    onText?: (text: string) => void,
    onComplete?: (result: InferenceResult) => void,
    onError?: (error: string) => void
  ) => Promise<void>;
  cancelStream: () => void;
  isLoading: boolean;
  isModelLoaded: boolean;
  isStreaming: boolean;
  currentStreamText: string;
  loadingProgress: number;
  error: string | null;
  webgpuAvailable: boolean | null;
}

// useModels hook return type
export interface UseModelsReturn {
  availableModels: Model[];
  downloadedModels: LocalModel[];
  activeModel: LocalModel | null;
  deleteModel: (modelId: string) => void;
  selectModel: (modelId: string) => void;
  getModelInfo: (modelId: string) => Model | undefined;
  getTotalSize: () => number;
  getTotalSizeGB: () => number;
  isModelDownloaded: (modelId: string) => boolean;
}

// useChat hook return type
export interface UseChatReturn {
  chat: Chat | null;
  chats: ChatMetadata[];
  loading: boolean;
  loadChats: () => Promise<void>;
  loadChat: (id: string) => Promise<void>;
  addMessage: (role: 'user' | 'assistant', content: string, chatId?: string) => Promise<void>;
  deleteChat: (id: string) => Promise<void>;
  renameChat: (id: string, newTitle: string) => Promise<void>;
  createNewChat: (profileId: string, title?: string) => Promise<Chat>;
  /** Move a chat into a folder (null = ungrouped) */
  moveChatToFolder: (id: string, folderId: string | null) => Promise<void>;
}

// useProfiles hook return type
export interface UseProfilesReturn {
  profiles: Profile[];
  activeProfile: Profile | null;
  createProfile: (name: string, systemPrompt: string) => Profile;
  updateProfile: (profile: Profile) => void;
  deleteProfile: (id: string) => void;
  selectProfile: (profile: Profile) => void;
  exportProfiles: () => string;
  importProfiles: (jsonData: string) => boolean;
  loadProfiles: () => void;
}
