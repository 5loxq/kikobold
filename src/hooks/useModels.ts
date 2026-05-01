import { useState, useCallback, useEffect } from 'react';
import { Model, LocalModel } from '../types';
import { MODELS } from '../services/models/modelRegistry';
import * as ModelStorage from '../services/storage/ModelStorage';
import { info } from '../services/logging';

export const useModels = () => {
  const [availableModels] = useState<Model[]>(MODELS);
  const [downloadedModels, setDownloadedModels] = useState<LocalModel[]>([]);
  const [activeModel, setActiveModel] = useState<LocalModel | null>(null);
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

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
        setDownloadProgress(0);

        // Transformers.js downloads models automatically from HuggingFace
        // when they are loaded. This tracks that process in localStorage.

        // Estimate model size based on parameter count
        const modelSizeEstimates: Record<string, number> = {
          '1.1B': 2.5e9,   // ~2.5 GB
          '2.7B': 5e9,     // ~5 GB
          '7B': 10e9,      // ~10 GB
        };

        const estSize = Object.entries(modelSizeEstimates).find(([key]) =>
          model.modelSize.includes(key)
        )?.[1] ?? 5e9;

        // Simulate gradual download progress
        for (let i = 0; i <= 90; i += 10) {
          await new Promise(resolve => setTimeout(resolve, 300));
          setDownloadProgress(i);
        }

        const localModel: LocalModel = {
          id: model.id,
          name: model.name,
          path: `huggingface:${model.downloadUrl}`,
          size: estSize,
          downloadedAt: Date.now(),
        };

        ModelStorage.saveModel(localModel);
        setDownloadedModels([...downloadedModels, localModel]);

        setDownloadProgress(100);
        await new Promise(resolve => setTimeout(resolve, 300));

        setDownloadingModelId(null);
        setDownloadProgress(0);

        info(`✓ Model ${model.name} registered`);
        return true;
      } catch (error) {
        console.error('Model registration failed:', error);
        setDownloadingModelId(null);
        setDownloadProgress(0);
        return false;
      }
    },
    [downloadedModels]
  );

  const deleteModel = useCallback(
    (modelId: string) => {
      ModelStorage.deleteModel(modelId);
      setDownloadedModels(downloadedModels.filter(m => m.id !== modelId));

      if (activeModel?.id === modelId) {
        setActiveModel(null);
      }
    },
    [downloadedModels, activeModel]
  );

  const selectModel = useCallback(
    (modelId: string) => {
      let model = downloadedModels.find(m => m.id === modelId);

      // If model not yet registered as downloaded, create and register it now
      if (!model) {
        const modelInfo = availableModels.find(m => m.id === modelId);
        if (modelInfo) {
          model = {
            id: modelId,
            name: modelInfo.name,
            path: modelInfo.downloadUrl,
            size: (modelInfo.fileSizeMB ?? 1000) * 1024 * 1024, // Convert MB to bytes, default 1000MB
            downloadedAt: Date.now(),
          };
          // Save to storage so it's marked as downloaded
          ModelStorage.saveModel(model);
          // Update local state
          setDownloadedModels([...downloadedModels, model]);
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
