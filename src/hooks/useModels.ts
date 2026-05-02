import { useState, useCallback, useEffect } from 'react';
import { Model, LocalModel, UseModelsReturn } from '../types';
import { MODELS } from '../services/models/model-registry';
import * as ModelStorage from '../services/storage/ModelStorage';
import { info } from '../services/logging';

export const useModels = (): UseModelsReturn => {
  const [availableModels] = useState<Model[]>(MODELS);
  const [downloadedModels, setDownloadedModels] = useState<LocalModel[]>([]);
  const [activeModel, setActiveModel] = useState<LocalModel | null>(null);
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const loaded = ModelStorage.getDownloadedModels();
      if (Array.isArray(loaded)) {
        setDownloadedModels(loaded);

        const activeId = ModelStorage.getActiveModel();
        if (activeId && typeof activeId === 'string') {
          const active = loaded.find(m => m.id === activeId);
          if (active) {
            setActiveModel(active);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  }, []);

  const downloadModel = useCallback(
    async (model: Model): Promise<boolean> => {
      try {
        setDownloadingModelId(model.id);
        setDownloadProgress(prev => ({ ...prev, [model.id]: 0 }));

        // Transformers.js downloads models automatically from HuggingFace
        // when they are loaded. We just register the model as "downloaded"
        // since the actual download happens transparently when loadModel is called.
        
        // For better UX, we'll simulate a quick progress to indicate registration
        // This is not a real download progress, just a visual feedback
        await new Promise(resolve => setTimeout(resolve, 500));
        setDownloadProgress(prev => ({ ...prev, [model.id]: 100 }));

        // Estimate model size based on fileSizeMB or modelSize
        const estSize = model.fileSizeMB 
          ? model.fileSizeMB * 1024 * 1024 
          : getEstimatedSizeFromModelSize(model.modelSize);

        const localModel: LocalModel = {
          id: model.id,
          name: model.name,
          path: `huggingface:${model.downloadUrl}`,
          size: estSize,
          downloadedAt: Date.now(),
        };

        ModelStorage.saveModel(localModel);
        setDownloadedModels(prev => [...prev, localModel]);

        await new Promise(resolve => setTimeout(resolve, 300));

        setDownloadingModelId(null);
        setDownloadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[model.id];
          return newProgress;
        });

        info(`✓ Model ${model.name} registered`);
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

  // Helper function to estimate model size from modelSize string
  const getEstimatedSizeFromModelSize = (modelSize: string): number => {
    const sizeMap: Record<string, number> = {
      '82M': 120 * 1024 * 1024,    // ~120MB
      '124M': 500 * 1024 * 1024,   // ~500MB
      '0.5B': 350 * 1024 * 1024,   // ~350MB
      '1.1B': 637 * 1024 * 1024,   // ~637MB
      '1.8B': 1200 * 1024 * 1024,  // ~1.2GB
      '2.7B': 1400 * 1024 * 1024,  // ~1.4GB
      '7B': 10000 * 1024 * 1024,   // ~10GB
    };
    return sizeMap[modelSize] || 500 * 1024 * 1024; // Default 500MB
  };

  const deleteModel = useCallback(
    (modelId: string) => {
      ModelStorage.deleteModel(modelId);
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
            path: modelInfo.downloadUrl,
            size: estSize,
            downloadedAt: Date.now(),
          };
          // Save to storage so it's marked as downloaded
          ModelStorage.saveModel(model);
          // Update local state
          setDownloadedModels(prev => [...prev, model].filter(Boolean) as LocalModel[]);
        }
      }

      if (model) {
        ModelStorage.setActiveModel(modelId);
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
    return ModelStorage.getTotalDownloadedSize();
  }, []);

  const getTotalSizeGB = useCallback(() => {
    return ModelStorage.getTotalDownloadedSizeInGB();
  }, []);

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
