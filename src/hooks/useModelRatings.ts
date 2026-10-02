/**
 * useModelRatings Hook
 * 
 * Provides easy access to model rating functionality in React components
 */

import { useCallback, useEffect, useState } from 'react';
import {
  getAllModelRatings,
  getCommunityRecommendations,
  getRatingStatistics,
  getSystemRecommendedModels,
  getTopRatedModels,
  rateModel,
  removeModelRating,
} from '../services/model-config';
import { Model } from '../types';

interface UseModelRatingsReturn {
  // Individual model rating
  getRating: (modelId: string) => number | null;
  rateModel: (modelId: string, rating: number) => void;
  removeRating: (modelId: string) => void;
  
  // Statistics
  averageRating: number | null;
  totalRatings: number;
  ratingDistribution: Record<number, number>;
  
  // Top rated models
  topRatedModels: Array<{ model: Model; rating: number }>;
  
  // Community recommendations
  communityRecommendations: Array<{
    useCase: string;
    description: string;
    models: Model[];
  }>;
  
  // System recommendations
  systemRecommendedModels: Array<{ model: Model; reason: string }>;
  
  // Loading state
  isLoading: boolean;
  error: Error | null;
  
  // Refresh functions
  refreshRatings: () => void;
  refreshRecommendations: () => void;
}

/**
 * Hook for managing model ratings and recommendations
 */
export const useModelRatings = (): UseModelRatingsReturn => {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [statistics, setStatistics] = useState<{
    averageRating: number | null;
    totalRatings: number;
    ratingDistribution: Record<number, number>;
  }>({
    averageRating: null,
    totalRatings: 0,
    ratingDistribution: {},
  });
  const [topRated, setTopRated] = useState<Array<{ model: Model; rating: number }>>([]);
  const [communityRecs, setCommunityRecs] = useState<Array<{
    useCase: string;
    description: string;
    models: Model[];
  }>>([]);
  const [systemRecs, setSystemRecs] = useState<Array<{ model: Model; reason: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load all data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Load ratings
        const allRatings = getAllModelRatings();
        setRatings(allRatings);
        
        // Load statistics
        const stats = getRatingStatistics();
        setStatistics(stats);
        
        // Load top rated
        const top = getTopRatedModels(10);
        setTopRated(top);
        
        // Load community recommendations
        const community = getCommunityRecommendations();
        setCommunityRecs(community);
        
        // Load system recommendations (will use cached system info)
        const system = getSystemRecommendedModels();
        setSystemRecs(system);
        
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Get rating for a specific model
  const getRating = useCallback(
    (modelId: string): number | null => {
      return ratings[modelId] || null;
    },
    [ratings]
  );

  // Rate a model
  const handleRateModel = useCallback(
    (modelId: string, rating: number) => {
      try {
        rateModel(modelId, rating);
        // Update local state
        setRatings(prev => ({ ...prev, [modelId]: rating }));
        
        // Update statistics
        const stats = getRatingStatistics();
        setStatistics(stats);
        
        // Update top rated
        const top = getTopRatedModels(10);
        setTopRated(top);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    []
  );

  // Remove a rating
  const handleRemoveRating = useCallback(
    (modelId: string) => {
      try {
        removeModelRating(modelId);
        // Update local state
        setRatings(prev => {
          const newRatings = { ...prev };
          delete newRatings[modelId];
          return newRatings;
        });
        
        // Update statistics
        const stats = getRatingStatistics();
        setStatistics(stats);
        
        // Update top rated
        const top = getTopRatedModels(10);
        setTopRated(top);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    []
  );

  // Refresh ratings
  const refreshRatings = useCallback(() => {
    const allRatings = getAllModelRatings();
    setRatings(allRatings);
    
    const stats = getRatingStatistics();
    setStatistics(stats);
    
    const top = getTopRatedModels(10);
    setTopRated(top);
  }, []);

  // Refresh recommendations
  const refreshRecommendations = useCallback(() => {
    const community = getCommunityRecommendations();
    setCommunityRecs(community);
    
    const system = getSystemRecommendedModels();
    setSystemRecs(system);
  }, []);

  return {
    // Individual model rating
    getRating,
    rateModel: handleRateModel,
    removeRating: handleRemoveRating,
    
    // Statistics
    averageRating: statistics.averageRating,
    totalRatings: statistics.totalRatings,
    ratingDistribution: statistics.ratingDistribution,
    
    // Top rated models
    topRatedModels: topRated,
    
    // Community recommendations
    communityRecommendations: communityRecs,
    
    // System recommendations
    systemRecommendedModels: systemRecs,
    
    // Loading state
    isLoading,
    error,
    
    // Refresh functions
    refreshRatings,
    refreshRecommendations,
  };
};

export default useModelRatings;
