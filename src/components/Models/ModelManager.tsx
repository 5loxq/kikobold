import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LocalModel, Model } from '../../types';
import { MODELS } from '../../services/models/model-registry';
import { ModelCard } from './ModelCard';
import { info, error } from '../../services/logging';
import {
    downloadModel,
    getDownloadProgress,
    cancelDownload,
    hasActiveDownloads,
    getAllDownloadStates,
    type DownloadProgress,
} from '../../services/storage/ModelStorage';

interface ModelManagerProps {
  downloadedModels: LocalModel[];
  activeModel: LocalModel | null;
  onDeleteModel: (modelId: string) => void;
  onSelectModel: (modelId: string) => void;
}

export const ModelManager: React.FC<ModelManagerProps> = ({
  downloadedModels,
  activeModel,
  onDeleteModel,
  onSelectModel,
}) => {
  const { t } = useTranslation();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [downloadStatus, setDownloadStatus] = useState<Record<string, string>>({});

  // Sync download progress from storage
  useEffect(() => {
    const interval = setInterval(() => {
      const states = getAllDownloadStates();
      const newProgress: Record<string, number> = {};
      const newStatus: Record<string, string> = {};
      
      states.forEach((state, modelId) => {
        newProgress[modelId] = state.progress;
        newStatus[modelId] = state.status === 'error' ? state.error || 'Error' :
                            state.status === 'cancelled' ? 'Cancelled' :
                            state.status === 'completed' ? 'Complete' :
                            state.status === 'paused' ? 'Paused' : 'Downloading...';
      });
      
      setDownloadProgress(newProgress);
      setDownloadStatus(newStatus);
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const handleDownload = async (model: Model) => {
    setDownloading(model.id);
    setDownloadProgress(prev => ({ ...prev, [model.id]: 0 }));
    setDownloadStatus(prev => ({ ...prev, [model.id]: 'Starting...' }));

    try {
      await downloadModel(
        model,
        (progress: DownloadProgress) => {
          setDownloadProgress(prev => ({ ...prev, [progress.modelId]: progress.percent }));
          setDownloadStatus(prev => ({ ...prev, [progress.modelId]: progress.status }));
        },
        (localModel) => {
          info(`${model.name} downloaded successfully`);
          // Model will be added to downloadedModels via parent component
        },
        (err) => {
          error(`Download failed for ${model.name}: ${err.message}`);
          setDownloadStatus(prev => ({ ...prev, [model.id]: `Error: ${err.message}` }));
        }
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      error(`Download failed for ${model.name}: ${err.message}`);
      setDownloadStatus(prev => ({ ...prev, [model.id]: `Error: ${err.message}` }));
    } finally {
      setTimeout(() => {
        setDownloading(null);
      }, 1000);
    }
  };

  const handleCancelDownload = (modelId: string) => {
    cancelDownload(modelId);
    setDownloading(null);
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold mb-2 text-gray-800">{t('sidebar.models')}</h2>
        <p className="text-gray-600 mb-8">
          {t('models.downloadModel')}
        </p>

        {/* Downloaded Models Section */}
        {downloadedModels.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xl font-bold mb-4 text-gray-800">{t('models.downloaded')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {downloadedModels.map((localModel) => {
                const modelInfo = MODELS.find(m => m.id === localModel.id);
                return (
                  <div
                    key={localModel.id}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      activeModel?.id === localModel.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => onSelectModel(localModel.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-800">{localModel.name}</h4>
                        {modelInfo && (
                          <p className="text-xs text-gray-600">{modelInfo.modelSize}</p>
                        )}
                      </div>
                      {activeModel?.id === localModel.id && (
                        <span className="text-green-600 font-bold">✓</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                      {(localModel.size / (1024 * 1024 * 1024)).toFixed(2)} GB •{' '}
                      {new Date(localModel.downloadedAt).toLocaleDateString()}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteModel(localModel.id);
                      }}
                      className="w-full px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                    >
                      {t('models.delete')}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Available Models Section */}
        <div>
          <h3 className="text-xl font-bold mb-4 text-gray-800">{t('models.available')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MODELS.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                isDownloaded={downloadedModels.some(m => m.id === model.id)}
                isDownloading={downloading === model.id}
                downloadProgress={downloadProgress[model.id] || 0}
                downloadStatus={downloadStatus[model.id]}
                onDownload={() => handleDownload(model)}
                onCancel={() => handleCancelDownload(model.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
