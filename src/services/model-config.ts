/**
 * Model Configuration Service
 * 
 * Provides per-model settings and metadata management including:
 * - Model-specific inference parameters
 * - Model favorites and custom names
 * - Model metadata (author, license, etc.)
 * - Model search and filtering
 */

import { Model, Profile, LocalModel } from '../types';
import { ModelSettings, ModelMetadata } from '../types/ensu-types';
import { MODELS } from './models/model-registry';
import { secureLocalStorage } from './security';

// ============================================================================
// Constants
// ============================================================================

const MODEL_SETTINGS_KEY = 'webgui.model.settings';
const MODEL_METADATA_KEY = 'webgui.model.metadata';
const FAVORITE_MODELS_KEY = 'webgui.model.favorites';

// Default model settings
const DEFAULT_MODEL_SETTINGS: Omit<ModelSettings, 'id'> = {
  temperature: 0.7,
  topP: 0.9,
  topK: 50,
  maxTokens: 512,
  contextLength: 2048,
  repeatPenalty: 1.1,
  frequencyPenalty: 0.1,
  presencePenalty: 0.1,
  isFavorite: false,
  customName: '',
  notes: '',
};

// ============================================================================
// State
// ============================================================================

let modelSettingsCache: Record<string, ModelSettings> = {};
let modelMetadataCache: Record<string, ModelMetadata> = {};
let favoriteModelsCache: Set<string> = new Set();
let initialized = false;

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize model configuration service
 */
export const initModelConfigService = async (): Promise<void> => {
  if (initialized) return;

  // Load saved settings
  loadModelSettings();
  loadModelMetadata();
  loadFavoriteModels();

  initialized = true;
};

// ============================================================================
// Loading Functions
// ============================================================================

/**
 * Load model settings from storage
 */
const loadModelSettings = (): void => {
  try {
    const saved = secureLocalStorage.getItem(MODEL_SETTINGS_KEY);
    if (saved) {
      modelSettingsCache = JSON.parse(saved);
    }
  } catch {
    modelSettingsCache = {};
  }
};

/**
 * Load model metadata from storage
 */
const loadModelMetadata = (): void => {
  try {
    const saved = secureLocalStorage.getItem(MODEL_METADATA_KEY);
    if (saved) {
      modelMetadataCache = JSON.parse(saved);
    }
  } catch {
    modelMetadataCache = {};
  }
};

/**
 * Load favorite models from storage
 */
const loadFavoriteModels = (): void => {
  try {
    const saved = secureLocalStorage.getItem(FAVORITE_MODELS_KEY);
    if (saved) {
      favoriteModelsCache = new Set(JSON.parse(saved));
    }
  } catch {
    favoriteModelsCache = new Set();
  }
};

// ============================================================================
// Saving Functions
// ============================================================================

/**
 * Save model settings to storage
 */
const saveModelSettings = (): void => {
  try {
    secureLocalStorage.setItem(MODEL_SETTINGS_KEY, JSON.stringify(modelSettingsCache));
  } catch {
    console.warn('Failed to save model settings');
  }
};

/**
 * Save model metadata to storage
 */
const saveModelMetadata = (): void => {
  try {
    secureLocalStorage.setItem(MODEL_METADATA_KEY, JSON.stringify(modelMetadataCache));
  } catch {
    console.warn('Failed to save model metadata');
  }
};

/**
 * Save favorite models to storage
 */
const saveFavoriteModels = (): void => {
  try {
    secureLocalStorage.setItem(FAVORITE_MODELS_KEY, JSON.stringify(Array.from(favoriteModelsCache)));
  } catch {
    console.warn('Failed to save favorite models');
  }
};

// ============================================================================
// Model Settings Management
// ============================================================================

/**
 * Get settings for a specific model
 */
export const getModelSettings = (modelId: string): ModelSettings => {
  if (!modelId) {
    throw new Error('Model ID is required');
  }

  // Check cache first
  if (modelSettingsCache[modelId]) {
    return { ...DEFAULT_MODEL_SETTINGS, id: modelId, ...modelSettingsCache[modelId] };
  }

  // Return defaults
  return { ...DEFAULT_MODEL_SETTINGS, id: modelId };
};

/**
 * Get all model settings
 */
export const getAllModelSettings = (): Record<string, ModelSettings> => {
  const allSettings: Record<string, ModelSettings> = {};
  
  for (const [modelId, settings] of Object.entries(modelSettingsCache)) {
    allSettings[modelId] = { ...DEFAULT_MODEL_SETTINGS, id: modelId, ...settings };
  }
  
  return allSettings;
};

/**
 * Update settings for a specific model
 */
export const updateModelSettings = (modelId: string, settings: Partial<ModelSettings>): void => {
  if (!modelId) {
    throw new Error('Model ID is required');
  }

  // Get existing settings or create new
  const existing = modelSettingsCache[modelId] || {};
  modelSettingsCache[modelId] = { ...existing, ...settings };
  
  saveModelSettings();
};

/**
 * Reset settings for a specific model to defaults
 */
export const resetModelSettings = (modelId: string): void => {
  if (!modelId) {
    throw new Error('Model ID is required');
  }

  delete modelSettingsCache[modelId];
  saveModelSettings();
};

/**
 * Reset all model settings to defaults
 */
export const resetAllModelSettings = (): void => {
  modelSettingsCache = {};
  saveModelSettings();
};

// ============================================================================
// Model Metadata Management
// ============================================================================

/**
 * Get metadata for a specific model
 */
export const getModelMetadata = (modelId: string): ModelMetadata | null => {
  if (!modelId) return null;

  // Check cache first
  if (modelMetadataCache[modelId]) {
    return { ...modelMetadataCache[modelId] };
  }

  // Try to get from built-in models
  const builtInModel = MODELS.find(m => m.id === modelId);
  if (builtInModel) {
    const metadata: ModelMetadata = {
      id: builtInModel.id,
      name: builtInModel.name,
      description: builtInModel.description || '',
      author: 'HuggingFace',
      license: 'Apache-2.0',
      sizeBytes: (builtInModel.fileSizeMB || 0) * 1024 * 1024,
      parameterCount: parseParameterCount(builtInModel.modelSize),
      quantized: builtInModel.quantized,
      quantizationMethod: builtInModel.quantized ? 'GGUF' : undefined,
      contextLength: builtInModel.contextLength,
      recommended: builtInModel.recommended,
      tags: [],
      downloadUrl: builtInModel.downloadUrl,
      homepageUrl: `https://huggingface.co/${builtInModel.downloadUrl.split('/')[1]}`,
    };
    
    // Cache it
    modelMetadataCache[modelId] = metadata;
    saveModelMetadata();
    
    return { ...metadata };
  }

  return null;
};

/**
 * Update metadata for a specific model
 */
export const updateModelMetadata = (modelId: string, metadata: Partial<ModelMetadata>): void => {
  if (!modelId) {
    throw new Error('Model ID is required');
  }

  const existing = modelMetadataCache[modelId] || {};
  modelMetadataCache[modelId] = { ...existing, ...metadata, id: modelId };
  
  saveModelMetadata();
};

/**
 * Get all model metadata
 */
export const getAllModelMetadata = (): Record<string, ModelMetadata> => {
  return { ...modelMetadataCache };
};

// ============================================================================
// Favorite Models Management
// ============================================================================

/**
 * Check if a model is a favorite
 */
export const isModelFavorite = (modelId: string): boolean => {
  if (!modelId) return false;
  return favoriteModelsCache.has(modelId);
};

/**
 * Set a model as favorite
 */
export const setModelFavorite = (modelId: string, isFavorite: boolean): void => {
  if (!modelId) {
    throw new Error('Model ID is required');
  }

  if (isFavorite) {
    favoriteModelsCache.add(modelId);
  } else {
    favoriteModelsCache.delete(modelId);
  }
  
  // Also update in model settings
  if (modelSettingsCache[modelId]) {
    modelSettingsCache[modelId].isFavorite = isFavorite;
    saveModelSettings();
  }
  
  saveFavoriteModels();
};

/**
 * Toggle favorite status for a model
 */
export const toggleModelFavorite = (modelId: string): void => {
  setModelFavorite(modelId, !isModelFavorite(modelId));
};

/**
 * Get all favorite model IDs
 */
export const getFavoriteModelIds = (): string[] => {
  return Array.from(favoriteModelsCache);
};

/**
 * Get all favorite models
 */
export const getFavoriteModels = (): Model[] => {
  return MODELS.filter(model => favoriteModelsCache.has(model.id));
};

// ============================================================================
// Model Search and Filtering
// ============================================================================

/**
 * Search models by name, description, or tags
 */
export const searchModels = (query: string, models: Model[] = MODELS): Model[] => {
  if (!query || query.trim().length === 0) {
    return models;
  }

  const searchQuery = query.toLowerCase().trim();
  
  return models.filter(model => {
    const nameMatch = model.name.toLowerCase().includes(searchQuery);
    const descriptionMatch = model.description?.toLowerCase().includes(searchQuery) || false;
    const idMatch = model.id.toLowerCase().includes(searchQuery);
    const sizeMatch = model.modelSize.toLowerCase().includes(searchQuery);
    
    return nameMatch || descriptionMatch || idMatch || sizeMatch;
  });
};

/**
 * Filter models by various criteria
 */
export const filterModels = (
  models: Model[] = MODELS,
  options: {
    recommendedOnly?: boolean;
    quantizedOnly?: boolean;
    maxSizeMB?: number;
    minContextLength?: number;
    searchQuery?: string;
  } = {}
): Model[] => {
  let filtered = models;

  // Filter by recommended
  if (options.recommendedOnly) {
    filtered = filtered.filter(model => model.recommended);
  }

  // Filter by quantized
  if (options.quantizedOnly) {
    filtered = filtered.filter(model => model.quantized);
  }

  // Filter by max size
  if (options.maxSizeMB) {
    filtered = filtered.filter(model => (model.fileSizeMB || 0) <= options.maxSizeMB);
  }

  // Filter by min context length
  if (options.minContextLength) {
    filtered = filtered.filter(model => model.contextLength >= options.minContextLength);
  }

  // Filter by search query
  if (options.searchQuery) {
    filtered = searchModels(options.searchQuery, filtered);
  }

  return filtered;
};

/**
 * Sort models by various criteria
 */
export const sortModels = (
  models: Model[] = MODELS,
  sortBy: 'name' | 'size' | 'contextLength' | 'recommended' = 'name',
  sortOrder: 'asc' | 'desc' = 'asc'
): Model[] => {
  const sorted = [...models];
  
  sorted.sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'size':
        comparison = (a.fileSizeMB || 0) - (b.fileSizeMB || 0);
        break;
      case 'contextLength':
        comparison = a.contextLength - b.contextLength;
        break;
      case 'recommended':
        comparison = (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0);
        break;
    }
    
    return sortOrder === 'desc' ? -comparison : comparison;
  });
  
  return sorted;
};

// ============================================================================
// Model Customization
// ============================================================================

/**
 * Set a custom name for a model
 */
export const setModelCustomName = (modelId: string, customName: string): void => {
  updateModelSettings(modelId, { customName });
};

/**
 * Get the display name for a model (custom name or original name)
 */
export const getModelDisplayName = (modelId: string): string => {
  const settings = getModelSettings(modelId);
  return settings.customName || MODELS.find(m => m.id === modelId)?.name || modelId;
};

/**
 * Set notes for a model
 */
export const setModelNotes = (modelId: string, notes: string): void => {
  updateModelSettings(modelId, { notes });
};

/**
 * Get notes for a model
 */
export const getModelNotes = (modelId: string): string => {
  const settings = getModelSettings(modelId);
  return settings.notes || '';
};

// ============================================================================
// Model Tags
// ============================================================================

/**
 * Add a tag to a model
 */
export const addModelTag = (modelId: string, tag: string): void => {
  const settings = getModelSettings(modelId);
  const tags = settings.tags || [];
  
  if (!tags.includes(tag)) {
    tags.push(tag);
    updateModelSettings(modelId, { tags });
  }
};

/**
 * Remove a tag from a model
 */
export const removeModelTag = (modelId: string, tag: string): void => {
  const settings = getModelSettings(modelId);
  const tags = settings.tags || [];
  
  const updatedTags = tags.filter(t => t !== tag);
  updateModelSettings(modelId, { tags: updatedTags });
};

/**
 * Get all tags for a model
 */
export const getModelTags = (modelId: string): string[] => {
  const settings = getModelSettings(modelId);
  return settings.tags || [];
};

/**
 * Get all unique tags across all models
 */
export const getAllModelTags = (): string[] => {
  const allTags: Set<string> = new Set();
  
  for (const settings of Object.values(modelSettingsCache)) {
    if (settings.tags) {
      settings.tags.forEach(tag => allTags.add(tag));
    }
  }
  
  return Array.from(allTags).sort();
};

// ============================================================================
// Model Recommendations
// ============================================================================

/**
 * Get recommended models for a specific use case
 */
export const getRecommendedModels = (useCase: string): Model[] => {
  const useCaseModels: Record<string, string[]> = {
    'general': ['qwen-0.5b', 'phi-2', 'tinyllama-1.1b'],
    'coding': ['code-llama-7b', 'phi-2', 'qwen-1.8b'],
    'creative': ['qwen-1.8b', 'neural-chat-7b', 'mistral-7b'],
    'analysis': ['mistral-7b', 'neural-chat-7b'],
    'small': ['qwen-0.5b', 'gpt-2', 'distilgpt2'],
    'medium': ['phi-2', 'qwen-1.8b'],
    'large': ['neural-chat-7b', 'mistral-7b', 'llama-2-7b'],
  };

  const recommendedIds = useCaseModels[useCase.toLowerCase()] || [];
  return MODELS.filter(model => recommendedIds.includes(model.id));
};

/**
 * Get models suitable for the current device
 */
export const getModelsForDevice = (): Model[] => {
  // Check if we're on a mobile device
  if (typeof navigator !== 'undefined') {
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    if (isMobile) {
      // For mobile, recommend smaller models
      return filterModels(MODELS, {
        maxSizeMB: 5000, // 5GB max for mobile
        recommendedOnly: false,
      });
    }
  }
  
  // For desktop or if navigator is not available, return all models but sort by recommended first
  return sortModels(MODELS, 'recommended', 'desc');
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse parameter count from model size string (e.g., "7B" -> 7000000000)
 */
function parseParameterCount(sizeStr: string): number {
  const match = sizeStr.match(/(\d+(?:\.\d+)?)\s*B/i);
  if (!match) return 0;
  
  const num = parseFloat(match[1]);
  return Math.round(num * 1000000000);
}

/**
 * Format parameter count for display (e.g., 7000000000 -> "7B")
 */
export const formatParameterCount = (count: number): string => {
  if (count >= 1000000000) {
    return `${(count / 1000000000).toFixed(1)}B`;
  }
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${bytes} B`;
};

// ============================================================================
// Export all functions
// ============================================================================

export default {
  // Initialization
  initModelConfigService,
  
  // Model Settings
  getModelSettings,
  getAllModelSettings,
  updateModelSettings,
  resetModelSettings,
  resetAllModelSettings,
  
  // Model Metadata
  getModelMetadata,
  updateModelMetadata,
  getAllModelMetadata,
  
  // Favorites
  isModelFavorite,
  setModelFavorite,
  toggleModelFavorite,
  getFavoriteModelIds,
  getFavoriteModels,
  
  // Search and Filter
  searchModels,
  filterModels,
  sortModels,
  
  // Customization
  setModelCustomName,
  getModelDisplayName,
  setModelNotes,
  getModelNotes,
  
  // Tags
  addModelTag,
  removeModelTag,
  getModelTags,
  getAllModelTags,
  
  // Recommendations
  getRecommendedModels,
  getModelsForDevice,
  
  // Utilities
  formatParameterCount,
  formatFileSize,
};
