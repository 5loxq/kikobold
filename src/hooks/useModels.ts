import { useCallback, useEffect, useState } from 'react';
import { LocalModel, Model, UseModelsReturn } from '../types';
import { MODELS } from '../services/models/model-registry';

// LocalStorage keys for model persistence
const STORAGE_KEYS = {
  DOWNLOADED_MODELS: 'webllm_downloaded_models',
  ACTIVE_MODEL: 'webllm_active_model',
};

// Helper function to estimate model size from modelSize string
const getEstimatedSizeFromModelSize = (modelSize: string): number => {
  const sizeMap: Record<string, number> = {
    '82M': 120 * 1024 * 1024,    // ~120MB
    '124M': 500 * 1024 * 1024,   // ~500MB
    '0.5B': 400 * 1024 * 1024,   // ~400MB (MLC models are larger)
    '1.1B': 300 * 1024 * 1024,   // ~300MB (MLC TinyLlama)
    '1.8B': 1200 * 1024 * 1024,  // ~1.2GB
    '2.7B': 700 * 1024 * 1024,   // ~700MB (MLC Phi-2)
    '7B': 1800 * 1024 * 1024,   // ~1.8GB
    '8B': 1500 * 1024 * 1024,   // ~1.5GB (MLC Llama 8B)
  };
  return sizeMap[modelSize] || 500 * 1024 * 1024; // Default 500MB
};

// Helper functions for LocalStorage
const getDownloadedModelsFromStorage = (): LocalModel[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DOWNLOADED_MODELS);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }
    // Drop entries for models that are no longer in the registry (e.g. after
    // a model ID was fixed/removed) so stale IDs cannot trigger load errors.
    const knownIds = new Set(MODELS.map(m => m.id));
    return parsed.filter(m => knownIds.has(m.id));
  } catch {
    return [];
  }
};

const saveDownloadedModelsToStorage = (models: LocalModel[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.DOWNLOADED_MODELS, JSON.stringify(models));
  } catch {
    // Ignore errors (e.g., quota exceeded)
  }
};

const getActiveModelFromStorage = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_MODEL);
  } catch {
    return null;
  }
};

const setActiveModelToStorage = (modelId: string | null): void => {
  try {
    if (modelId) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_MODEL, modelId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_MODEL);
    }
  } catch {
    // Ignore errors
  }
};

export const useModels = (): UseModelsReturn => {
  const [availableModels] = useState<Model[]>(MODELS);
  const [downloadedModels, setDownloadedModels] = useState<LocalModel[]>(getDownloadedModelsFromStorage());
  const [activeModel, setActiveModel] = useState<LocalModel | null>(null);

  // Load active model on mount
  useEffect(() => {
    try {
      const activeId = getActiveModelFromStorage();
      if (activeId && typeof activeId === 'string') {
        const active = downloadedModels.find(m => m.id === activeId);
        if (active) {
          setActiveModel(active);
        }
      }
    } catch (error) {
      console.error('Failed to load active model:', error);
    }
  }, [downloadedModels]);

  // Save downloaded models to storage when they change
  useEffect(() => {
    saveDownloadedModelsToStorage(downloadedModels);
  }, [downloadedModels]);

  // Save active model to storage when it changes
  useEffect(() => {
    setActiveModelToStorage(activeModel?.id ?? null);
  }, [activeModel?.id]);

  const deleteModel = useCallback(
    (modelId: string) => {
      setDownloadedModels(prev => prev.filter(m => m.id !== modelId));

      if (activeModel?.id === modelId) {
        setActiveModel(null);
      }
    },
    [activeModel]
  );

  const selectModel = useCallback(
    (modelId: string) => {
      let model = downloadedModels.find(m => m.id === modelId);

      // If model not yet registered as downloaded, create and register it now
      if (!model) {
        const modelInfo = availableModels.find(m => m.id === modelId);
        if (modelInfo) {
          const estSize = modelInfo.fileSizeMB 
            ? modelInfo.fileSizeMB * 1024 * 1024 
            : getEstimatedSizeFromModelSize(modelInfo.modelSize);
          
          model = {
            id: modelId,
            name: modelInfo.name,
            path: `webllm:${modelId}`,
            size: estSize,
            downloadedAt: Date.now(),
          };
          // Update local state
          setDownloadedModels(prev => [...prev, model].filter(Boolean) as LocalModel[]);
        }
      }

      if (model) {
        setActiveModel(model);
      }
    },
    [downloadedModels, availableModels]
  );

  const getModelInfo = useCallback(
    (modelId: string): Model | undefined => {
      return availableModels.find(m => m.id === modelId);
    },
    [availableModels]
  );

  const getTotalSize = useCallback(() => {
    return downloadedModels.reduce((sum, m) => sum + m.size, 0);
  }, [downloadedModels]);

  const getTotalSizeGB = useCallback(() => {
    return getTotalSize() / (1024 * 1024 * 1024);
  }, [getTotalSize]);

  const isModelDownloaded = useCallback(
    (modelId: string): boolean => {
      return downloadedModels.some(m => m.id === modelId);
    },
    [downloadedModels]
  );

  return {
    availableModels,
    downloadedModels,
    activeModel,
    deleteModel,
    selectModel,
    getModelInfo,
    getTotalSize,
    getTotalSizeGB,
    isModelDownloaded,
  };
};
