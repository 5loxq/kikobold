import React from 'react';
import { useTranslation } from 'react-i18next';
import { Model } from '../../types';
import { StarRating } from './ModelRating';

interface ModelCardProps {
  model: Model;
  isDownloaded: boolean;
  isDownloading: boolean;
  downloadProgress: number; // 0-100
  onDownload: () => void;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  model,
  isDownloaded,
  isDownloading,
  downloadProgress,
  onDownload,
}) => {
  const { t } = useTranslation();
  
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow bg-white">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h4 className="font-bold text-gray-800">{model.name}</h4>
          {model.provider === 'gguf-hf' && (
            <span className="inline-block mt-1 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded font-medium">
              GGUF · WASM
            </span>
          )}
          {model.provider === 'webllm-hf-cdn' && (
            <span className="inline-block mt-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded font-medium">
              WebGPU
            </span>
          )}
          {model.recommended && (
            <span className="inline-block mt-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded font-medium">
              {t('models.recommended')}
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
        {model.description}
      </p>

      <div className="space-y-1 mb-4 text-xs text-gray-500">
        <p>{t('models.model')}: {model.modelSize} parameters</p>
        <p>{t('models.downloadSize')}: {model.fileSizeMB ? `${(model.fileSizeMB / 1024).toFixed(2)} GB` : 'N/A'}</p>
        <p>{t('models.contextLength')}: {model.contextLength} tokens</p>
        {model.quantized && <p>{t('models.quantized')}</p>}
      </div>

      {/* Rating */}
      <div className="mb-3">
        <StarRating modelId={model.id} size="small" />
      </div>

      {/* Progress Bar */}
      {isDownloading && (
        <div className="mb-3">
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-500 h-full transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
          <p className="text-xs text-blue-600 mt-1 text-center font-medium">
            {downloadProgress}%
          </p>
        </div>
      )}

      <button
        onClick={onDownload}
        disabled={isDownloading || isDownloaded}
        className={`w-full px-3 py-2 rounded font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
          isDownloaded
            ? 'bg-green-100 text-green-700 cursor-default'
            : isDownloading
            ? 'bg-blue-100 text-blue-700 cursor-wait'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {isDownloaded ? (
          <>
            <span>✓</span>
            <span>{t('models.downloadedStatus')}</span>
          </>
        ) : isDownloading ? (
          <>
            <span className="animate-spin">⟳</span>
            <span>{t('models.downloading')}</span>
          </>
        ) : (
          <>
            <span>⬇️</span>
            <span>{t('models.download')}</span>
          </>
        )}
      </button>
    </div>
  );
};
