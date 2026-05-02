/**
 * Type definitions for custom React hooks
 */

import { InferenceOptions, InferenceResult, Chat, Message, Profile, Model, LocalModel } from '.';

// useInference hook return type
export interface UseInferenceReturn {
  loadModel: (modelId: string) => Promise<void>;
  unloadModel: () => void;
  generate: (prompt: string, options: InferenceOptions) => Promise<InferenceResult | null>;
  isLoading: boolean;
  isModelLoaded: boolean;
  loadingProgress: number;
  error: string | null;
  webgpuAvailable: boolean | null;
}

// useModels hook return type
export interface UseModelsReturn {
  availableModels: Model[];
  downloadedModels: LocalModel[];
  activeModel: LocalModel | null;
  downloadingModelId: string | null;
  downloadProgress: Record<string, number>;
  downloadModel: (model: Model) => Promise<boolean>;
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
  chats: Chat[];
  loading: boolean;
  loadChats: () => Promise<void>;
  loadChat: (id: string) => Promise<void>;
  addMessage: (role: 'user' | 'assistant', content: string) => Promise<void>;
  deleteChat: (id: string) => Promise<void>;
  renameChat: (id: string, newTitle: string) => Promise<void>;
  createNewChat: (profileId: string, title?: string) => Promise<Chat>;
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
