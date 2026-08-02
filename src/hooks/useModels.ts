import { useState, useCallback, useEffect } from 'react';
import { Model, LocalModel, UseModelsReturn } from '../types';
import { MODELS } from '../services/models/model-registry';
import { info } from '../services/logging';

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
    '7B': 1800 * 1024 * 1024,   // ~1.8GB (MLC Mistral)
    '8B': 1500 * 1024 * 1024,   // ~1.5GB (MLC Llama 8B)
  };
  return sizeMap[modelSize] || 500 * 1024 * 1024; // Default 500MB
};

// Helper functions for LocalStorage
const getDownloadedModelsFromStorage = (): LocalModel[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DOWNLOADED_MODELS);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveDownloadedModelsToStorage = (models: LocalModel[]) => {
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

const setActiveModelToStorage = (modelId: string | null) => {
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
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});

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
    setActiveModelToStorage(activeModel?.id || null);
  }, [activeModel?.id]);

  const downloadModel = useCallback(
    async (model: Model): Promise<boolean> => {
      try {
        setDownloadingModelId(model.id);
        setDownloadProgress(prev => ({ ...prev, [model.id]: 0 }));

        // With WebLLM, models are loaded automatically from HuggingFace
        // We just register the model as "downloaded" for UI purposes
        // The actual download happens transparently when the model is used
        
        // For better UX, simulate a quick progress to indicate registration
        await new Promise(resolve => setTimeout(resolve, 500));
        setDownloadProgress(prev => ({ ...prev, [model.id]: 100 }));

        // Estimate model size based on fileSizeMB or modelSize
        const estSize = model.fileSizeMB 
          ? model.fileSizeMB * 1024 * 1024 
          : getEstimatedSizeFromModelSize(model.modelSize);

        const localModel: LocalModel = {
          id: model.id,
          name: model.name,
          path: `webllm:${model.id}`,
          size: estSize,
          downloadedAt: Date.now(),
        };

        setDownloadedModels(prev => [...prev, localModel]);

        await new Promise(resolve => setTimeout(resolve, 300));

        setDownloadingModelId(null);
        setDownloadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[model.id];
          return newProgress;
        });

        info(`✓ Model ${model.name} registered for WebLLM`);
        return true;
      } catch (error) {
        console.error('Model registration failed:', error);
        setDownloadingModelId(null);
        setDownloadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[model.id];
          return newProgress;
        });
        return false;
      }
    },
    [downloadedModels]
  );

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
    downloadingModelId,
    downloadProgress,
    downloadModel,
    deleteModel,
    selectModel,
    getModelInfo,
    getTotalSize,
    getTotalSizeGB,
    isModelDownloaded,
  };
};
