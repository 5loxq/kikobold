import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LocalModel, Model } from '../../types';
import { MODELS } from '../../services/models/model-registry';
import { ModelCard } from './ModelCard';
import { info } from '../../services/logging';

interface ModelManagerProps {
  downloadedModels: LocalModel[];
  activeModel: LocalModel | null;
  onDownloadModel: (model: Model) => Promise<boolean>;
  onDeleteModel: (modelId: string) => void;
  onSelectModel: (modelId: string) => void;
}

export const ModelManager: React.FC<ModelManagerProps> = ({
  downloadedModels,
  activeModel,
  onDownloadModel,
  onDeleteModel,
  onSelectModel,
}) => {
  const { t } = useTranslation();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});

  const handleDownload = async (model: Model) => {
    setDownloading(model.id);
    setDownloadProgress(prev => ({ ...prev, [model.id]: 0 }));

    // Simulate progress updates
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress > 90) progress = 90;
      setDownloadProgress(prev => ({ ...prev, [model.id]: Math.floor(progress) }));
    }, 500);

    try {
      const success = await onDownloadModel(model);
      clearInterval(progressInterval);

      if (success) {
        setDownloadProgress(prev => ({ ...prev, [model.id]: 100 }));
        info(`${model.name} downloaded successfully`);
        setTimeout(() => {
          setDownloading(null);
          setDownloadProgress(prev => ({ ...prev, [model.id]: 0 }));
        }, 1000);
      } else {
        setDownloading(null);
        setDownloadProgress(prev => ({ ...prev, [model.id]: 0 }));
      }
    } catch (error) {
      clearInterval(progressInterval);
      setDownloading(null);
      setDownloadProgress(prev => ({ ...prev, [model.id]: 0 }));
      console.error('Download failed:', error instanceof Error ? error : new Error(String(error)));
    }
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
                onDownload={() => handleDownload(model)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
