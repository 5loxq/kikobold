/**
 * ModelRating Component
 * 
 * Provides star rating functionality for models with:
 * - Interactive star rating (1-5 stars)
 * - Rating display
 * - Rating statistics
 * - Community recommendations
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Model } from '../../types';
import {
  getCommunityRecommendations,
  getModelRating,
  getRatingStatistics,
  getTopRatedModels,
  rateModel,
  removeModelRating,
} from '../../services/model-config';

interface StarRatingProps {
  modelId: string;
  modelName?: string;
  editable?: boolean;
  size?: 'small' | 'medium' | 'large';
  onRatingChange?: (modelId: string, rating: number | null) => void;
}

/**
 * Star rating component for individual model rating
 */
export const StarRating: React.FC<StarRatingProps> = ({
  modelId,
  modelName,
  editable = true,
  size = 'medium',
  onRatingChange,
}) => {
  const { t } = useTranslation();
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load current rating on mount
  useEffect(() => {
    const currentRating = getModelRating(modelId);
    setRating(currentRating);
  }, [modelId]);

  const handleRatingChange = async (newRating: number | null) => {
    if (!editable || isLoading) {return;}

    setIsLoading(true);
    try {
      if (newRating !== null) {
        rateModel(modelId, newRating);
      } else {
        removeModelRating(modelId);
      }
      setRating(newRating);
      onRatingChange?.(modelId, newRating);
    } catch (error) {
      console.error('Failed to update rating:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStarSize = () => {
    switch (size) {
      case 'small':
        return 'text-lg';
      case 'large':
        return 'text-3xl';
      default:
        return 'text-2xl';
    }
  };

  const renderStar = (starIndex: number) => {
    const filled = (hoverRating ?? rating ?? 0) >= starIndex + 1;
    const starColor = filled ? 'text-yellow-400' : 'text-gray-300';
    const starSize = getStarSize();

    return (
      <button
        key={starIndex}
        type="button"
        onClick={() => handleRatingChange(filled ? null : starIndex + 1)}
        onMouseEnter={() => editable && setHoverRating(starIndex + 1)}
        onMouseLeave={() => editable && setHoverRating(null)}
        disabled={isLoading || !editable}
        className={`transition-colors ${starColor} ${starSize} ${editable ? 'cursor-pointer' : 'cursor-default'}`}
        aria-label={filled ? t('models.rated', { rating: starIndex + 1 }) : t('models.rate', { rating: starIndex + 1 })}
        title={filled ? t('models.rated', { rating: starIndex + 1 }) : t('models.rate', { rating: starIndex + 1 })}
      >
        {filled ? '★' : '☆'}
      </button>
    );
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex">
        {[0, 1, 2, 3, 4].map(renderStar)}
      </div>
      {modelName && (
        <span className="text-sm text-gray-500">{modelName}</span>
      )}
    </div>
  );
};

interface RatingDisplayProps {
  modelId: string;
  showText?: boolean;
}

/**
 * Display the current rating for a model
 */
export const RatingDisplay: React.FC<RatingDisplayProps> = ({
  modelId,
  showText = true,
}) => {
  const { t } = useTranslation();
  const [rating, setRating] = useState<number | null>(null);

  useEffect(() => {
    setRating(getModelRating(modelId));
  }, [modelId]);

  if (rating === null) {
    return showText ? (
      <span className="text-sm text-gray-400">{t('models.notRated')}</span>
    ) : null;
  }

  return (
    <div className="flex items-center gap-1">
      <div className="flex text-yellow-400">
        {'★'.repeat(rating)}
        {'☆'.repeat(5 - rating)}
      </div>
      {showText && (
        <span className="text-sm text-gray-500">
          {t('models.rating', { rating })}
        </span>
      )}
    </div>
  );
};

interface RatingStatisticsProps {
  className?: string;
}

/**
 * Display rating statistics across all models
 */
export const RatingStatistics: React.FC<RatingStatisticsProps> = ({
  className = '',
}) => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<{
    averageRating: number | null;
    totalRatings: number;
    ratingDistribution: Record<number, number>;
  }>({
    averageRating: null,
    totalRatings: 0,
    ratingDistribution: {},
  });

  useEffect(() => {
    setStats(getRatingStatistics());
  }, []);

  if (stats.totalRatings === 0) {
    return (
      <div className={`bg-gray-50 rounded-lg p-4 ${className}`}>
        <h3 className="font-semibold text-gray-700 mb-2">{t('models.ratingStatistics')}</h3>
        <p className="text-sm text-gray-500">{t('models.noRatingsYet')}</p>
      </div>
    );
  }

  return (
    <div className={`bg-gray-50 rounded-lg p-4 ${className}`}>
      <h3 className="font-semibold text-gray-700 mb-2">{t('models.ratingStatistics')}</h3>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>{t('models.averageRating')}:</span>
          <span className="font-medium">
            {stats.averageRating?.toFixed(1) ?? 'N/A'}
          </span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span>{t('models.totalRatings')}:</span>
          <span className="font-medium">{stats.totalRatings}</span>
        </div>

        <div className="mt-3">
          <h4 className="text-sm font-medium text-gray-600 mb-1">{t('models.ratingDistribution')}</h4>
          <div className="space-y-1">
            {Array.from({ length: 5 }, (_, i) => i + 1).map((star) => {
              const count = stats.ratingDistribution[star] || 0;
              const percentage = stats.totalRatings > 0 ? (count / stats.totalRatings) * 100 : 0;

              return (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-xs w-4">{star}★</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-yellow-400 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

interface TopRatedModelsProps {
  limit?: number;
  className?: string;
}

/**
 * Display top rated models
 */
export const TopRatedModels: React.FC<TopRatedModelsProps> = ({
  limit = 5,
  className = '',
}) => {
  const { t } = useTranslation();
  const [topModels, setTopModels] = useState<Array<{ model: Model; rating: number }>>([]);

  useEffect(() => {
    setTopModels(getTopRatedModels(limit));
  }, [limit]);

  if (topModels.length === 0) {
    return (
      <div className={`bg-gray-50 rounded-lg p-4 ${className}`}>
        <h3 className="font-semibold text-gray-700 mb-2">{t('models.topRated')}</h3>
        <p className="text-sm text-gray-500">{t('models.noRatedModelsYet')}</p>
      </div>
    );
  }

  return (
    <div className={`bg-gray-50 rounded-lg p-4 ${className}`}>
      <h3 className="font-semibold text-gray-700 mb-3">{t('models.topRated')}</h3>
      <div className="space-y-2">
        {topModels.map(({ model, rating }, index) => (
          <div
            key={model.id}
            className="flex items-center justify-between p-2 bg-white rounded border border-gray-200"
          >
            <div className="flex-1">
              <div className="font-medium text-sm">{model.name}</div>
              <div className="text-xs text-gray-500">{model.modelSize}</div>
            </div>
            <div className="flex items-center gap-1">
              <div className="flex text-yellow-400 text-sm">
                {'★'.repeat(rating)}
                {'☆'.repeat(5 - rating)}
              </div>
              <span className="text-xs text-gray-500">#{index + 1}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface CommunityRecommendationsProps {
  className?: string;
}

/**
 * Display community recommendations
 */
export const CommunityRecommendations: React.FC<CommunityRecommendationsProps> = ({
  className = '',
}) => {
  const { t } = useTranslation();
  const [recommendations, setRecommendations] = useState<Array<{
    useCase: string;
    description: string;
    models: Model[];
  }>>([]);

  useEffect(() => {
    setRecommendations(getCommunityRecommendations());
  }, []);

  return (
    <div className={`bg-gray-50 rounded-lg p-4 ${className}`}>
      <h3 className="font-semibold text-gray-700 mb-3">{t('models.communityRecommendations')}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {recommendations.map((rec) => (
          <div
            key={rec.useCase}
            className="bg-white rounded-lg p-3 border border-gray-200"
          >
            <h4 className="font-medium text-sm capitalize mb-1">{rec.useCase}</h4>
            <p className="text-xs text-gray-600 mb-2">{rec.description}</p>
            <div className="flex flex-wrap gap-1">
              {rec.models.slice(0, 3).map((model) => (
                <span
                  key={model.id}
                  className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                >
                  {model.name}
                </span>
              ))}
              {rec.models.length > 3 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                  +{rec.models.length - 3} more
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Export all components
export default {
  StarRating,
  RatingDisplay,
  RatingStatistics,
  TopRatedModels,
  CommunityRecommendations,
};
