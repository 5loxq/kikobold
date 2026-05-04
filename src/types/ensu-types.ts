/**
 * Enhanced types for Ensu-inspired features
 */

import { Chat, Message, Model, Profile, LocalModel } from './index';

// ============================================================================
// Conversation Management Types
// ============================================================================

export interface ChatMetadata {
  id: string;
  title: string;
  profileId: string;
  createdAt: number;
  updatedAt: number;
  isFavorite?: boolean;
  tags?: string[];
  customName?: string; // User-defined name for the chat
}

export interface ChatExportOptions {
  format: 'json' | 'markdown';
  includeMetadata?: boolean;
  includeTimestamps?: boolean;
}

export interface ChatImportResult {
  success: boolean;
  importedCount: number;
  errors: string[];
  chats: Chat[];
}

// ============================================================================
// Model Configuration Types
// ============================================================================

export interface ModelSettings {
  id: string; // Model ID
  temperature?: number; // 0.1-2.0
  topP?: number; // 0.1-1.0
  topK?: number; // 1-100
  maxTokens?: number; // Maximum tokens to generate
  contextLength?: number; // Context window size
  repeatPenalty?: number; // 1.0-2.0
  frequencyPenalty?: number; // 0.0-1.0
  presencePenalty?: number; // 0.0-1.0
  seed?: number; // Random seed for reproducibility
  stopSequences?: string[]; // Stop sequences for generation
  isFavorite?: boolean; // Mark as favorite
  customName?: string; // User-defined name
  notes?: string; // User notes about this model
}

export interface ModelMetadata {
  id: string;
  name: string;
  description: string;
  author?: string;
  license?: string;
  sizeBytes: number;
  parameterCount: number;
  quantized: boolean;
  quantizationMethod?: string;
  contextLength: number;
  recommended: boolean;
  tags?: string[];
  createdAt?: number;
  updatedAt?: number;
  downloadUrl: string;
  homepageUrl?: string;
  repositoryUrl?: string;
}

// ============================================================================
// Inference Types
// ============================================================================

export interface StreamingOptions {
  enabled: boolean;
  callback?: (token: string, fullText: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

export interface InferenceStreamResult {
  token: string;
  fullText: string;
  tokensGenerated: number;
  isComplete: boolean;
  durationMs: number;
}

export interface CancelablePromise<T> extends Promise<T> {
  cancel: () => void;
  isCanceled: boolean;
}

// ============================================================================
// System Information Types
// ============================================================================

export interface SystemInfo {
  browser: {
    name: string;
    version: string;
    userAgent: string;
  };
  os: {
    name: string;
    version: string;
    architecture: string;
  };
  hardware: {
    cpu: {
      cores: number;
      name: string;
    };
    gpu: {
      available: boolean;
      name: string;
      vendor: string;
      memoryMB: number;
      webgpuSupport: boolean;
    };
    memory: {
      totalMB: number;
      availableMB: number;
      usedMB: number;
    };
  };
  features: {
    webgpu: boolean;
    wasm: boolean;
    webAssembly: boolean;
    serviceWorker: boolean;
    indexedDB: boolean;
    cacheAPI: boolean;
    offline: boolean;
    webWorkers: boolean;
    sharedWorkers: boolean;
    broadcastChannel: boolean;
    fileSystemAccess: boolean;
    clipboard: boolean;
  };
  storage: {
    indexedDB: boolean;
    localStorage: boolean;
    sessionStorage: boolean;
    cacheAPI: boolean;
    maxStorageMB: number;
    usedStorageMB: number;
  };
}

export interface GPUInfo {
  name: string;
  vendor: string;
  memoryMB: number;
  webgpuSupport: boolean;
  canUseForInference: boolean;
}

export interface MemoryInfo {
  totalMB: number;
  availableMB: number;
  usedMB: number;
  usagePercent: number;
}

// ============================================================================
// Theme and Customization Types
// ============================================================================

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeSettings {
  mode: ThemeMode;
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  borderRadius?: number;
  fontFamily?: string;
  fontSize?: number;
}

export interface CustomizationSettings {
  theme: ThemeSettings;
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  animationEnabled: boolean;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
}

// ============================================================================
// Security Types
// ============================================================================

export interface EncryptionSettings {
  enabled: boolean;
  algorithm: 'AES-GCM' | 'AES-CBC' | 'none';
  keyDerivation: 'PBKDF2' | 'Argon2' | 'none';
  keyLength: number;
  iterations: number;
}

export interface EncryptedChat {
  id: string;
  encryptedData: Uint8Array;
  iv: Uint8Array;
  salt: Uint8Array;
  timestamp: number;
  version: string;
}

export interface SecuritySettings {
  encryption: EncryptionSettings;
  sandboxing: {
    enabled: boolean;
    useWebWorkers: boolean;
    isolateInference: boolean;
  };
  inputValidation: {
    enabled: boolean;
    maxLength: number;
    blockPatterns: string[];
  };
  network: {
    httpsOnly: boolean;
    trustedDomains: string[];
    blockInternalIPs: boolean;
  };
}

// ============================================================================
// Error Handling Types
// ============================================================================

export enum ErrorCode {
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  OFFLINE = 'OFFLINE',
  
  // Model errors
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  MODEL_LOAD_FAILED = 'MODEL_LOAD_FAILED',
  MODEL_TOO_LARGE = 'MODEL_TOO_LARGE',
  MODEL_INVALID = 'MODEL_INVALID',
  MODEL_DOWNLOAD_FAILED = 'MODEL_DOWNLOAD_FAILED',
  
  // Inference errors
  INFERENCE_FAILED = 'INFERENCE_FAILED',
  INFERENCE_TIMEOUT = 'INFERENCE_TIMEOUT',
  INFERENCE_CANCELED = 'INFERENCE_CANCELED',
  GPU_UNAVAILABLE = 'GPU_UNAVAILABLE',
  OUT_OF_MEMORY = 'OUT_OF_MEMORY',
  
  // Storage errors
  STORAGE_ERROR = 'STORAGE_ERROR',
  STORAGE_FULL = 'STORAGE_FULL',
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',
  
  // Security errors
  SECURITY_ERROR = 'SECURITY_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  XSS_DETECTED = 'XSS_DETECTED',
  UNTRUSTED_SOURCE = 'UNTRUSTED_SOURCE',
  
  // Chat errors
  CHAT_NOT_FOUND = 'CHAT_NOT_FOUND',
  CHAT_EXPORT_FAILED = 'CHAT_EXPORT_FAILED',
  CHAT_IMPORT_FAILED = 'CHAT_IMPORT_FAILED',
  
  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  UNSUPPORTED_BROWSER = 'UNSUPPORTED_BROWSER',
}

export interface AppError extends Error {
  code: ErrorCode;
  context?: Record<string, unknown>;
  userMessage: string;
  isRetryable: boolean;
  timestamp: number;
  stack?: string;
}

export interface ErrorAction {
  type: 'retry' | 'refresh' | 'clear_cache' | 'restart' | 'report' | 'ignore';
  label: string;
  description: string;
}

// ============================================================================
// Community Features Types
// ============================================================================

export interface ModelRating {
  modelId: string;
  rating: number; // 1-5 stars
  comment?: string;
  userId: string;
  timestamp: number;
}

export interface ModelRecommendation {
  modelId: string;
  useCase: string; // e.g., "coding", "creative writing", "analysis"
  reason: string;
  priority: number; // 1-10
}

export interface CommunitySettings {
  showRecommendations: boolean;
  showRatings: boolean;
  allowUserRatings: boolean;
  syncWithCommunity: boolean;
}

// ============================================================================
// Notification Types
// ============================================================================

export interface AppNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  duration?: number; // Auto-dismiss after X ms
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  onClick: () => void;
  variant: 'primary' | 'secondary' | 'danger';
}

// ============================================================================
// Hook Return Types
// ============================================================================

export interface UseConversationManagementReturn {
  chats: ChatMetadata[];
  activeChat: Chat | null;
  createChat: (profileId: string, title?: string) => Promise<Chat>;
  renameChat: (chatId: string, newTitle: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  exportChat: (chatId: string, options?: ChatExportOptions) => Promise<void>;
  exportAllChats: (options?: ChatExportOptions) => Promise<void>;
  importChats: (file: File) => Promise<ChatImportResult>;
  setChatFavorite: (chatId: string, isFavorite: boolean) => Promise<void>;
  addChatTag: (chatId: string, tag: string) => Promise<void>;
  removeChatTag: (chatId: string, tag: string) => Promise<void>;
  searchChats: (query: string) => Promise<ChatMetadata[]>;
  getChatMetadata: (chatId: string) => Promise<ChatMetadata | null>;
}

export interface UseModelConfigurationReturn {
  modelSettings: Record<string, ModelSettings>;
  getModelSettings: (modelId: string) => ModelSettings | null;
  updateModelSettings: (modelId: string, settings: Partial<ModelSettings>) => Promise<void>;
  resetModelSettings: (modelId: string) => Promise<void>;
  getModelMetadata: (modelId: string) => Promise<ModelMetadata | null>;
  setModelFavorite: (modelId: string, isFavorite: boolean) => Promise<void>;
  getFavoriteModels: () => Promise<Model[]>;
  searchModels: (query: string) => Promise<Model[]>;
}

export interface UseSystemInfoReturn {
  systemInfo: SystemInfo | null;
  gpuInfo: GPUInfo | null;
  memoryInfo: MemoryInfo | null;
  webgpuAvailable: boolean;
  wasmAvailable: boolean;
  offline: boolean;
  storageAvailable: boolean;
  refresh: () => Promise<void>;
}

export interface UseThemeReturn {
  themeMode: ThemeMode;
  themeSettings: ThemeSettings;
  setThemeMode: (mode: ThemeMode) => void;
  setThemeSettings: (settings: Partial<ThemeSettings>) => void;
  toggleTheme: () => void;
  isDarkMode: boolean;
}

export interface UseStreamingReturn {
  streamMessage: (
    prompt: string,
    options: InferenceOptions,
    streamingOptions: StreamingOptions
  ) => CancelablePromise<string>;
  cancelStream: () => void;
  isStreaming: boolean;
  currentStreamText: string;
}
