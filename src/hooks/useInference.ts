import { useState, useCallback, useEffect } from 'react';
import { InferenceOptions, InferenceResult, UseInferenceReturn } from '../types';
import * as InferenceEngine from '../services/inference/inference-engine';
import { createInferenceBackend, type LlmMessage, type GenerateChatRequest, type GenerateEvent } from '../services/inference/llm-inference-engine';


export const useInference = (): UseInferenceReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [webgpuAvailable, setWebgpuAvailable] = useState<boolean | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamText, setCurrentStreamText] = useState('');

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
    setCurrentStreamText('');
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

  // New streaming method inspired by ente-io
  const generateStream = useCallback(
    async (
      prompt: string,
      options: InferenceOptions,
      onText?: (text: string) => void,
      onComplete?: (result: InferenceResult) => void,
      onError?: (error: string) => void
    ): Promise<void> => {
      if (!InferenceEngine.isModelLoaded()) {
        const errorMsg = 'No model loaded';
        setError(errorMsg);
        onError?.(errorMsg);
        return;
      }

      // Validate input
      if (typeof prompt !== 'string' || prompt.trim().length === 0) {
        const errorMsg = 'Prompt must be a non-empty string';
        setError(errorMsg);
        onError?.(errorMsg);
        return;
      }

      if (!options || typeof options !== 'object') {
        const errorMsg = 'Options must be an object';
        setError(errorMsg);
        onError?.(errorMsg);
        return;
      }

      try {
        setIsLoading(true);
        setIsStreaming(true);
        setCurrentStreamText('');
        setError(null);

        // Use the new backend for streaming
        const backend = createInferenceBackend();
        await backend.initBackend();

        const messages: LlmMessage[] = [
          { role: 'user', content: prompt }
        ];
        
        if (options.systemPrompt) {
          messages.unshift({ role: 'system', content: options.systemPrompt });
        }

        const request: GenerateChatRequest = {
          messages,
          maxTokens: options.maxTokens,
          temperature: options.temperature,
          topP: options.topP,
          topK: options.topK,
          repeatPenalty: options.repeatPenalty,
          frequencyPenalty: options.frequencyPenalty,
          presencePenalty: options.presencePenalty,
          addAssistant: true,
        };

        let fullText = '';
        let startTime = Date.now();

        await backend.generateChatStream(request, (event: GenerateEvent) => {
          switch (event.type) {
            case 'text':
              fullText += event.text;
              setCurrentStreamText(fullText);
              onText?.(event.text);
              break;
            case 'done':
              const duration = Date.now() - startTime;
              const tokenCount = Math.ceil(fullText.split(/\s+/).length * 1.3);
              const result: InferenceResult = {
                text: fullText,
                tokens: tokenCount,
                duration,
              };
              setCurrentStreamText(fullText);
              onComplete?.(result);
              break;
            case 'error':
              setError(event.message);
              onError?.(event.message);
              break;
          }
        });

      } catch (err) {
        console.error('Streaming generation error:', err instanceof Error ? err : new Error(String(err)));
        const errorMessage = err instanceof Error ? err.message : 'Streaming inference failed';
        setError(errorMessage);
        onError?.(errorMessage);
      } finally {
        setIsLoading(false);
        setIsStreaming(false);
      }
    },
    []
  );

  // Cancel current streaming operation
  const cancelStream = useCallback(() => {
    // This would be implemented with the backend's cancel method
    // For now, we'll just reset the streaming state
    setIsStreaming(false);
    setCurrentStreamText('');
  }, []);

  return {
    loadModel,
    unloadModel,
    generate,
    generateStream,
    cancelStream,
    isLoading,
    isModelLoaded,
    isStreaming,
    currentStreamText,
    loadingProgress,
    error,
    webgpuAvailable,
  };
};
