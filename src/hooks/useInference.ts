import { useState, useCallback, useEffect } from 'react';
import { InferenceOptions, InferenceResult, UseInferenceReturn } from '../types';
import * as InferenceEngine from '../services/inference/inference-engine';


export const useInference = (): UseInferenceReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [webgpuAvailable, setWebgpuAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    const checkWebGPU = async () => {
      try {
        const available = await InferenceEngine.checkWebGPUAvailable();
        setWebgpuAvailable(available);
      } catch (error) {
        console.error('WebGPU check failed:', error instanceof Error ? error : new Error(String(error)));
        setWebgpuAvailable(false);
      }
    };
    checkWebGPU();
  }, []);

  const loadModel = useCallback(async (modelId: string) => {
    try {
      // Validate modelId
      if (typeof modelId !== 'string' || modelId.trim().length === 0) {
        throw new Error('Invalid model ID');
      }

      setError(null);
      setLoadingProgress(0);
      setIsLoading(true);

      // Simulate progress updates
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += Math.random() * 20;
        if (progress > 95) progress = 95;
        setLoadingProgress(Math.floor(progress));
      }, 500);

      await InferenceEngine.loadModel(modelId);

      clearInterval(progressInterval);
      setLoadingProgress(100);
      setIsModelLoaded(true);
      setIsLoading(false);
    } catch (err) {
      console.error('Model loading error:', err instanceof Error ? err : new Error(String(err)));
      const errorMessage = err instanceof Error ? err.message : 'Failed to load model';
      setError(errorMessage);
      setIsModelLoaded(false);
      setIsLoading(false);
      setLoadingProgress(0);
    }
  }, []);

  const unloadModel = useCallback(() => {
    InferenceEngine.unloadModel();
    setIsModelLoaded(false);
  }, []);

  const generate = useCallback(
    async (prompt: string, options: InferenceOptions): Promise<InferenceResult | null> => {
      if (!InferenceEngine.isModelLoaded()) {
        setError('No model loaded');
        return null;
      }

      // Validate input
      if (typeof prompt !== 'string' || prompt.trim().length === 0) {
        setError('Prompt must be a non-empty string');
        return null;
      }

      if (!options || typeof options !== 'object') {
        setError('Options must be an object');
        return null;
      }

      try {
        setIsLoading(true);
        setError(null);
        const result = await InferenceEngine.generate(prompt, options);
        return result;
      } catch (err) {
        console.error('Generation error:', err instanceof Error ? err : new Error(String(err)));
        const errorMessage = err instanceof Error ? err.message : 'Inference failed';
        setError(errorMessage);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    loadModel,
    unloadModel,
    generate,
    isLoading,
    isModelLoaded,
    loadingProgress,
    error,
    webgpuAvailable,
  };
};
