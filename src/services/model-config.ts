/**
 * Model Configuration Service
 * 
 * Provides per-model settings and metadata management including:
 * - Model-specific inference parameters
 * - Model favorites and custom names
 * - Model metadata (author, license, etc.)
 * - Model search and filtering
 */

import type { Model } from '../types';
import type { ModelSettings, ModelMetadata } from '../types/ensu-types';
export type { ModelRatingSummary } from '../types/ensu-types';
import { MODELS } from './models/model-registry';
import { secureLocalStorage } from './security';

// ============================================================================
// Constants
// ============================================================================

const MODEL_SETTINGS_KEY = 'webgui.model.settings';
const MODEL_METADATA_KEY = 'webgui.model.metadata';
const FAVORITE_MODELS_KEY = 'webgui.model.favorites';
const MODEL_RATINGS_KEY = 'webgui.model.ratings';
const MIN_RATING = 1;
const MAX_RATING = 5;

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
  tags: [],
};

// ============================================================================
// State
// ============================================================================

let modelSettingsCache: Record<string, ModelSettings> = {};
let modelMetadataCache: Record<string, ModelMetadata> = {};
let favoriteModelsCache: Set<string> = new Set();
let modelRatingsCache: Record<string, number> = {};
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
  loadModelRatings();

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
    return { ...DEFAULT_MODEL_SETTINGS, ...modelSettingsCache[modelId], id: modelId };
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
    allSettings[modelId] = { ...DEFAULT_MODEL_SETTINGS, ...settings, id: modelId };
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
    filtered = filtered.filter(model => (model.fileSizeMB || 0) <= (options.maxSizeMB || 0));
  }

  // Filter by min context length
  if (options.minContextLength) {
    filtered = filtered.filter(model => model.contextLength >= (options.minContextLength || 0));
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
 * Get community recommendations with descriptions
 * @returns {Array<{useCase: string, description: string, models: Model[]}>} Community recommendations
 */
export const getCommunityRecommendations = (): Array<{
  useCase: string;
  description: string;
  models: Model[];
}> => {
  const recommendations = [
    {
      useCase: 'general',
      description: 'All-purpose models for everyday conversations and Q&A',
      modelIds: ['qwen-0.5b', 'phi-2', 'tinyllama-1.1b'],
    },
    {
      useCase: 'coding',
      description: 'Models optimized for code generation, explanation, and debugging',
      modelIds: ['code-llama-7b', 'phi-2', 'qwen-1.8b'],
    },
    {
      useCase: 'creative',
      description: 'Models for creative writing, storytelling, and brainstorming',
      modelIds: ['qwen-1.8b', 'neural-chat-7b', 'mistral-7b'],
    },
    {
      useCase: 'analysis',
      description: 'Models for data analysis, reasoning, and complex tasks',
      modelIds: ['mistral-7b', 'neural-chat-7b'],
    },
    {
      useCase: 'small',
      description: 'Lightweight models for devices with limited resources',
      modelIds: ['qwen-0.5b', 'gpt-2', 'distilgpt2'],
    },
    {
      useCase: 'medium',
      description: 'Balanced models offering good performance and quality',
      modelIds: ['phi-2', 'qwen-1.8b'],
    },
    {
      useCase: 'large',
      description: 'Powerful models for complex tasks (require more resources)',
      modelIds: ['neural-chat-7b', 'mistral-7b', 'llama-2-7b'],
    },
    {
      useCase: 'beginner',
      description: 'Easy-to-use models for getting started with AI',
      modelIds: ['qwen-0.5b', 'gpt-2', 'tinyllama-1.1b'],
    },
    {
      useCase: 'expert',
      description: 'Advanced models for experienced users',
      modelIds: ['mistral-7b', 'neural-chat-7b', 'llama-2-7b'],
    },
  ];

  return recommendations.map(rec => ({
    useCase: rec.useCase,
    description: rec.description,
    models: MODELS.filter(model => rec.modelIds.includes(model.id)),
  }));
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

/**
 * Get models recommended for the current system based on hardware capabilities
 * @param systemInfo - Optional system information for more accurate recommendations
 * @returns {Array<{model: Model, reason: string}>} Recommended models with reasons
 */
export const getSystemRecommendedModels = (
  systemInfo?: Partial<{
    hardware?: {
      memory?: { totalMB?: number };
      gpu?: { available: boolean };
    };
    browser?: { name: string };
  }>
): Array<{ model: Model; reason: string }> => {
  const recommendations: Array<{ model: Model; reason: string }> = [];
  
  // Check if we have system info
  const hasGPU = systemInfo?.hardware?.gpu?.available;
  const totalMemoryMB = systemInfo?.hardware?.memory?.totalMB || 0;
  const browserName = systemInfo?.browser?.name;
  
  // Always recommend small models for compatibility
  const smallModels = ['qwen-0.5b', 'gpt-2', 'distilgpt2'];
  smallModels.forEach(modelId => {
    const model = MODELS.find(m => m.id === modelId);
    if (model) {
      recommendations.push({
        model,
        reason: 'Small size, works on all devices',
      });
    }
  });
  
  // If we have GPU support, recommend larger models
  if (hasGPU) {
    const gpuModels = ['phi-2', 'qwen-1.8b'];
    gpuModels.forEach(modelId => {
      const model = MODELS.find(m => m.id === modelId);
      if (model) {
        recommendations.push({
          model,
          reason: 'GPU acceleration available, can handle larger models',
        });
      }
    });
  }
  
  // If we have enough memory, recommend even larger models
  if (totalMemoryMB >= 16000) { // 16GB+
    const largeModels = ['neural-chat-7b', 'mistral-7b', 'llama-2-7b'];
    largeModels.forEach(modelId => {
      const model = MODELS.find(m => m.id === modelId);
      if (model) {
        recommendations.push({
          model,
          reason: 'High memory available, can handle large models',
        });
      }
    });
  } else if (totalMemoryMB >= 8000) { // 8GB+
    const mediumModels = ['phi-2', 'qwen-1.8b'];
    mediumModels.forEach(modelId => {
      const model = MODELS.find(m => m.id === modelId);
      if (model && !recommendations.some(r => r.model.id === modelId)) {
        recommendations.push({
          model,
          reason: 'Good memory available, can handle medium models',
        });
      }
    });
  }
  
  // Browser-specific recommendations
  if (browserName === 'Firefox') {
    // Firefox has good WebGPU support
    const firefoxModels = ['qwen-0.5b', 'phi-2'];
    firefoxModels.forEach(modelId => {
      const model = MODELS.find(m => m.id === modelId);
      if (model && !recommendations.some(r => r.model.id === modelId)) {
        recommendations.push({
          model,
          reason: 'Optimized for Firefox WebGPU implementation',
        });
      }
    });
  }
  
  // Remove duplicates and sort by model size
  const uniqueRecommendations = recommendations.filter(
    (rec, index, self) => index === self.findIndex(r => r.model.id === rec.model.id)
  );
  
  // Sort by model size (smallest first)
  uniqueRecommendations.sort((a, b) => {
    const sizeA = a.model.fileSizeMB || 0;
    const sizeB = b.model.fileSizeMB || 0;
    return sizeA - sizeB;
  });
  
  return uniqueRecommendations;
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
// Model Ratings System
// ============================================================================

/**
 * Load model ratings from storage
 */
const loadModelRatings = (): void => {
  try {
    const saved = secureLocalStorage.getItem(MODEL_RATINGS_KEY);
    if (saved) {
      modelRatingsCache = JSON.parse(saved);
    }
  } catch {
    modelRatingsCache = {};
  }
};

/**
 * Save model ratings to storage
 */
const saveModelRatings = (): void => {
  try {
    secureLocalStorage.setItem(MODEL_RATINGS_KEY, JSON.stringify(modelRatingsCache));
  } catch (error) {
    console.error('Failed to save model ratings:', error);
  }
};

/**
 * Rate a model (1-5 stars)
 * @param modelId - The ID of the model to rate
 * @param rating - The rating (1-5)
 * @throws {Error} If rating is invalid
 */
export const rateModel = (modelId: string, rating: number): void => {
  // Validate model ID
  if (!modelId || typeof modelId !== 'string') {
    throw new Error('Invalid model ID');
  }
  
  // Validate rating
  if (typeof rating !== 'number' || rating < MIN_RATING || rating > MAX_RATING) {
    throw new Error(`Rating must be between ${MIN_RATING} and ${MAX_RATING}`);
  }
  
  // Check if model exists
  if (!MODELS.some(m => m.id === modelId)) {
    throw new Error(`Model '${modelId}' not found`);
  }
  
  // Update rating
  modelRatingsCache[modelId] = rating;
  saveModelRatings();
};

/**
 * Get the rating for a specific model
 * @param modelId - The ID of the model
 * @returns {number | null} The rating (1-5) or null if not rated
 */
export const getModelRating = (modelId: string): number | null => {
  if (!modelId || typeof modelId !== 'string') {
    return null;
  }
  return modelRatingsCache[modelId] || null;
};

/**
 * Remove a rating for a model
 * @param modelId - The ID of the model
 */
export const removeModelRating = (modelId: string): void => {
  if (!modelId || typeof modelId !== 'string') {
    return;
  }
  delete modelRatingsCache[modelId];
  saveModelRatings();
};

/**
 * Get all model ratings
 * @returns {Record<string, number>} All model ratings
 */
export const getAllModelRatings = (): Record<string, number> => {
  return { ...modelRatingsCache };
};

/**
 * Get the average rating across all rated models
 * @returns {number | null} Average rating or null if no ratings
 */
export const getAverageRating = (): number | null => {
  const ratings = Object.values(modelRatingsCache);
  if (ratings.length === 0) {
    return null;
  }
  const sum = ratings.reduce((acc, rating) => acc + rating, 0);
  return sum / ratings.length;
};

/**
 * Get rating statistics
 * @returns {RatingStatistics} Statistics about all ratings
 */
export const getRatingStatistics = (): {
  averageRating: number | null;
  totalRatings: number;
  ratingDistribution: Record<number, number>;
} => {
  const ratings = Object.values(modelRatingsCache);
  const totalRatings = ratings.length;
  
  if (totalRatings === 0) {
    return {
      averageRating: null,
      totalRatings: 0,
      ratingDistribution: {},
    };
  }
  
  // Calculate average
  const sum = ratings.reduce((acc, rating) => acc + rating, 0);
  const averageRating = sum / totalRatings;
  
  // Calculate distribution
  const ratingDistribution: Record<number, number> = {};
  for (let i = MIN_RATING; i <= MAX_RATING; i++) {
    ratingDistribution[i] = ratings.filter(r => r === i).length;
  }
  
  return {
    averageRating,
    totalRatings,
    ratingDistribution,
  };
};

/**
 * Get models sorted by rating (highest first)
 * @param limit - Maximum number of models to return
 * @returns {Array<{model: Model, rating: number}>} Top rated models with their ratings
 */
export const getTopRatedModels = (limit: number = 5): Array<{model: Model, rating: number}> => {
  const ratedModels = Object.entries(modelRatingsCache)
    .map(([modelId, rating]) => {
      const model = MODELS.find(m => m.id === modelId);
      return model ? { model, rating } : null;
    })
    .filter(Boolean) as Array<{model: Model, rating: number}>;
  
  // Sort by rating (descending), then by model name
  ratedModels.sort((a, b) => b.rating - a.rating || a.model.name.localeCompare(b.model.name));
  
  return ratedModels.slice(0, limit);
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
  getCommunityRecommendations,
  getModelsForDevice,
  getSystemRecommendedModels,
  
  // Utilities
  formatParameterCount,
  formatFileSize,
  
  // Ratings
  rateModel,
  getModelRating,
  removeModelRating,
  getAllModelRatings,
  getAverageRating,
  getRatingStatistics,
  getTopRatedModels,
};
