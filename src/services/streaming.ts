/**
 * Streaming Inference Service
 * 
 * Provides streaming response generation with:
 * - Token-by-token streaming
 * - Cancelable generation
 * - Progress tracking
 * - Error handling
 * 
 * Inspired by ente-io/ensu streaming implementation
 */

import { InferenceOptions, InferenceResult } from '../types';
import { StreamingOptions, CancelablePromise } from '../types/ensu-types';
import { createAppError, ErrorCode, isRetryableError, withRetry } from '../utils/errors';
import { createInferenceBackend, type GenerateChatRequest, type GenerateEvent, type GenerateSummary } from './inference/llm-inference-engine';

// Export all functions
// ============================================================================

export default {
  streamMessage,
  streamWithRetry,
  streamWithEvents,
  cancelStream,
  isStreaming,
  getCurrentStreamText,
  getTokenCount,
  getDurationMs,
  getStreamError,
  clearStreamState,
  getStreamProgress,
  useStreaming,
  addStreamEventListener,
  removeStreamEventListener,
};
=======
// ============================================================================
// New Streaming Implementation using LLM Backend
// ============================================================================

/**
 * Stream using the new LLM inference backend
 * This provides real streaming with the actual inference engine
 */
export const streamWithLLMBackend = (
  prompt: string,
  inferenceOptions: InferenceOptions,
  streamingOptions: StreamingOptions
): CancelablePromise<string> => {
  let isCanceled = false;
  let fullText = '';
  let startTime = Date.now();
  let tokenCount = 0;

  const promise = new Promise<string>(async (resolve, reject) => {
    try {
      const backend = createInferenceBackend();
      await backend.initBackend();

      // Convert to GenerateChatRequest format
      const messages = [
        { role: 'user' as const, content: prompt }
      ];
      
      if (inferenceOptions.systemPrompt) {
        messages.unshift({ role: 'system' as const, content: inferenceOptions.systemPrompt });
      }

      const request: GenerateChatRequest = {
        messages,
        maxTokens: inferenceOptions.maxTokens,
        temperature: inferenceOptions.temperature,
        topP: inferenceOptions.topP,
        topK: inferenceOptions.topK,
        repeatPenalty: inferenceOptions.repeatPenalty,
        frequencyPenalty: inferenceOptions.frequencyPenalty,
        presencePenalty: inferenceOptions.presencePenalty,
        seed: inferenceOptions.seed,
        stopSequences: inferenceOptions.stopSequences,
        addAssistant: true,
      };

      await backend.generateChatStream(request, (event: GenerateEvent) => {
        if (isCanceled) return;

        switch (event.type) {
          case 'text':
            fullText += event.text;
            tokenCount++;
            
            // Update state
            streamState = {
              isStreaming: true,
              currentText: fullText,
              tokenCount,
              durationMs: Date.now() - startTime,
              error: null,
              controller: streamState.controller,
            };
            
            streamingOptions.callback?.(event.text, fullText);
            emitStreamEvent({ type: 'token', token: event.text, fullText });
            emitStreamEvent({ type: 'progress', progress: getStreamProgress() });
            break;

          case 'done':
            streamState = {
              isStreaming: false,
              currentText: fullText,
              tokenCount,
              durationMs: Date.now() - startTime,
              error: null,
              controller: null,
            };
            
            emitStreamEvent({ type: 'complete', fullText });
            streamingOptions.onComplete?.(fullText);
            resolve(fullText);
            break;

          case 'error':
            streamState = {
              isStreaming: false,
              currentText: fullText,
              tokenCount,
              durationMs: Date.now() - startTime,
              error: new Error(event.message),
              controller: null,
            };
            
            emitStreamEvent({ type: 'error', error: new Error(event.message) });
            streamingOptions.onError?.(event.message);
            reject(new Error(event.message));
            break;
        }
      });

    } catch (err) {
      if (!isCanceled) {
        const errorMessage = err instanceof Error ? err.message : 'Streaming failed';
        streamState = {
          isStreaming: false,
          currentText: fullText,
          tokenCount,
          durationMs: Date.now() - startTime,
          error: err instanceof Error ? err : new Error(errorMessage),
          controller: null,
        };
        
        emitStreamEvent({ type: 'error', error: streamState.error });
        streamingOptions.onError?.(errorMessage);
        reject(new Error(errorMessage));
      }
    }
  }) as CancelablePromise<string>;

  promise.cancel = () => {
    isCanceled = true;
    cancelStream();
  };

  promise.isCanceled = false;

  return promise;
};

// ============================================================================
// Export all functions
// ============================================================================

export default {
  streamMessage,
  streamWithRetry,
  streamWithEvents,
  streamWithLLMBackend,
  cancelStream,
  isStreaming,
  getCurrentStreamText,
  getTokenCount,
  getDurationMs,
  getStreamError,
  clearStreamState,
  getStreamProgress,
  useStreaming,
  addStreamEventListener,
  removeStreamEventListener,
};============================================================================
// Types
// ============================================================================

interface StreamController {
  abortController: AbortController;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
  fullText: string;
  tokenCount: number;
  startTime: number;
}

interface StreamState {
  isStreaming: boolean;
  currentText: string;
  tokenCount: number;
  durationMs: number;
  error: Error | null;
  controller: StreamController | null;
}

// ============================================================================
// State
// ============================================================================

let streamState: StreamState = {
  isStreaming: false,
  currentText: '',
  tokenCount: 0,
  durationMs: 0,
  error: null,
  controller: null,
};

// ============================================================================
// Streaming Implementation
// ============================================================================

/**
 * Create a cancelable promise for streaming
 */
const createCancelablePromise = <T>(
  executor: (
    resolve: (value: T) => void,
    reject: (error: Error) => void,
    signal: AbortSignal
  ) => void
): CancelablePromise<T> => {
  let isCanceled = false;
  const abortController = new AbortController();
  
  const promise = new Promise<T>((resolve, reject) => {
    executor(
      (value) => {
        if (isCanceled) {
          reject(new Error('Stream canceled'));
        } else {
          resolve(value);
        }
      },
      (error) => {
        if (isCanceled) {
          reject(new Error('Stream canceled'));
        } else {
          reject(error);
        }
      },
      abortController.signal
    );
  }) as CancelablePromise<T>;
  
  promise.cancel = () => {
    isCanceled = true;
    abortController.abort();
  };
  
  promise.isCanceled = isCanceled;
  
  return promise;
};

/**
 * Simulate streaming by splitting text into tokens
 * In a real implementation, this would use the actual LLM's streaming API
 */
const simulateStreaming = (
  text: string,
  options: StreamingOptions,
  signal: AbortSignal
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const tokens = text.split(/(\s+|\p{P}|\p{S})/gu).filter(Boolean);
    let currentIndex = 0;
    let fullText = '';
    
    const streamToken = () => {
      if (signal.aborted) {
        reject(new Error('Stream canceled'));
        return;
      }
      
      if (currentIndex >= tokens.length) {
        options.onComplete?.(fullText);
        resolve(fullText);
        return;
      }
      
      const token = tokens[currentIndex];
      currentIndex++;
      fullText += token;
      
      // Call the callback with the new token and full text
      options.callback?.(token, fullText);
      
      // Schedule next token with a small delay to simulate streaming
      const delay = Math.random() * 50 + 10; // 10-60ms delay
      setTimeout(streamToken, delay);
    };
    
    // Start streaming
    streamToken();
  });
};

/**
 * Stream a message using the inference engine
 * This is a wrapper that simulates streaming for the current implementation
 */
export const streamMessage = (
  prompt: string,
  inferenceOptions: InferenceOptions,
  streamingOptions: StreamingOptions
): CancelablePromise<string> => {
  // Clear previous error
  streamState.error = null;
  
  // Create abort controller
  const abortController = new AbortController();
  
  const promise = createCancelablePromise<string>((resolve, reject, signal) => {
    // Update state
    streamState = {
      isStreaming: true,
      currentText: '',
      tokenCount: 0,
      durationMs: 0,
      error: null,
      controller: {
        abortController,
        resolve,
        reject,
        fullText: '',
        tokenCount: 0,
        startTime: Date.now(),
      },
    };
    
    // In a real implementation, we would call the actual LLM's streaming API
    // For now, we'll simulate it
    try {
      // First, we need to generate the full response
      // This is where we would call the actual inference engine
      // For simulation, we'll use a placeholder
      const fullResponse = `This is a simulated streaming response to: "${prompt}". ` +
        `The model is generating text token by token. ` +
        `Streaming allows for real-time interaction with the AI. ` +
        `You can see the text appearing as it's generated.`;
      
      // Simulate streaming
      simulateStreaming(fullResponse, {
        ...streamingOptions,
        callback: (token, fullText) => {
          streamState.currentText = fullText;
          streamState.tokenCount++;
          streamState.durationMs = Date.now() - streamState.controller!.startTime;
          
          // Call the user's callback
          streamingOptions.callback?.(token, fullText);
        },
        onComplete: (fullText) => {
          streamState.isStreaming = false;
          streamState.durationMs = Date.now() - streamState.controller!.startTime;
          resolve(fullText);
        },
      }, signal).then(resolve).catch(reject);
      
    } catch (error) {
      const appError = createAppError(
        error instanceof Error ? error.message : 'Streaming failed',
        ErrorCode.INFERENCE_FAILED,
        { prompt, options: inferenceOptions },
        isRetryableError(error)
      );
      streamState.error = appError;
      streamState.isStreaming = false;
      reject(appError);
    }
  });
  
  return promise;
};

/**
 * Cancel the current stream
 */
export const cancelStream = (): void => {
  if (streamState.controller) {
    streamState.controller.abortController.abort();
    streamState.controller.reject(new Error('Stream canceled'));
    streamState.isStreaming = false;
    streamState.error = new Error('Stream canceled');
  }
};

/**
 * Check if currently streaming
 */
export const isStreaming = (): boolean => {
  return streamState.isStreaming;
};

/**
 * Get current stream text
 */
export const getCurrentStreamText = (): string => {
  return streamState.currentText;
};

/**
 * Get current token count
 */
export const getTokenCount = (): number => {
  return streamState.tokenCount;
};

/**
 * Get current duration
 */
export const getDurationMs = (): number => {
  return streamState.durationMs;
};

/**
 * Get current error
 */
export const getStreamError = (): Error | null => {
  return streamState.error;
};

/**
 * Clear stream state
 */
export const clearStreamState = (): void => {
  streamState = {
    isStreaming: false,
    currentText: '',
    tokenCount: 0,
    durationMs: 0,
    error: null,
    controller: null,
  };
};

// ============================================================================
// Streaming with Retry
// ============================================================================

/**
 * Stream with automatic retry on failure
 */
export const streamWithRetry = (
  prompt: string,
  inferenceOptions: InferenceOptions,
  streamingOptions: StreamingOptions,
  retryOptions?: {
    maxRetries?: number;
    delay?: number;
  }
): CancelablePromise<string> => {
  const maxRetries = retryOptions?.maxRetries || 3;
  const delay = retryOptions?.delay || 1000;
  
  let attempt = 0;
  let lastError: Error | null = null;
  
  const tryStream = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const stream = streamMessage(prompt, inferenceOptions, {
        ...streamingOptions,
        callback: (token, fullText) => {
          if (attempt === 0) {
            // Only call callback on first attempt
            streamingOptions.callback?.(token, fullText);
          }
        },
        onComplete: (fullText) => {
          if (attempt === 0) {
            streamingOptions.onComplete?.(fullText);
          }
          resolve(fullText);
        },
        onError: (error) => {
          if (attempt === 0) {
            streamingOptions.onError?.(error);
          }
          reject(error);
        },
      });
      
      stream.then(resolve).catch(reject);
    });
  };
  
  const promise = new Promise<string>(async (resolve, reject) => {
    while (attempt < maxRetries) {
      attempt++;
      
      try {
        const result = await tryStream();
        resolve(result);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt >= maxRetries) {
          reject(lastError);
          return;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    reject(lastError || new Error('Streaming failed after retries'));
  }) as CancelablePromise<string>;
  
  promise.cancel = () => {
    cancelStream();
  };
  
  promise.isCanceled = false;
  
  return promise;
};

// ============================================================================
// Stream State Hook (for React components)
// ============================================================================

/**
 * Hook to use streaming state in React components
 */
export const useStreaming = () => {
  return {
    streamMessage,
    cancelStream,
    isStreaming: isStreaming(),
    currentStreamText: getCurrentStreamText(),
    tokenCount: getTokenCount(),
    durationMs: getDurationMs(),
    error: getStreamError(),
    clearStreamState,
  };
};

// ============================================================================
// Stream Progress Tracking
// ============================================================================

interface StreamProgress {
  percent: number;
  tokensGenerated: number;
  estimatedTotalTokens: number;
  timeElapsedMs: number;
  estimatedTimeRemainingMs: number;
  tokensPerSecond: number;
}

/**
 * Calculate stream progress
 */
export const getStreamProgress = (): StreamProgress => {
  const tokenCount = getTokenCount();
  const durationMs = getDurationMs();
  
  // Estimate based on average response length
  // This is a rough estimate - in a real implementation, the model would provide this
  const estimatedTotalTokens = Math.max(tokenCount * 2, 50);
  const percent = tokenCount / estimatedTotalTokens;
  const tokensPerSecond = durationMs > 0 ? tokenCount / (durationMs / 1000) : 0;
  const estimatedTimeRemainingMs = tokensPerSecond > 0 
    ? (estimatedTotalTokens - tokenCount) / tokensPerSecond * 1000 
    : 0;
  
  return {
    percent: Math.min(percent, 1),
    tokensGenerated: tokenCount,
    estimatedTotalTokens,
    timeElapsedMs: durationMs,
    estimatedTimeRemainingMs,
    tokensPerSecond,
  };
};

// ============================================================================
// Stream Events
// ============================================================================

type StreamEventListener = (event: {
  type: 'start' | 'token' | 'progress' | 'complete' | 'error' | 'cancel';
  token?: string;
  fullText?: string;
  progress?: StreamProgress;
  error?: Error;
}) => void;

const streamEventListeners: Set<StreamEventListener> = new Set();

/**
 * Add a stream event listener
 */
export const addStreamEventListener = (listener: StreamEventListener): () => void => {
  streamEventListeners.add(listener);
  return () => streamEventListeners.delete(listener);
};

/**
 * Remove a stream event listener
 */
export const removeStreamEventListener = (listener: StreamEventListener): void => {
  streamEventListeners.delete(listener);
};

/**
 * Emit a stream event
 */
const emitStreamEvent = (event: {
  type: 'start' | 'token' | 'progress' | 'complete' | 'error' | 'cancel';
  token?: string;
  fullText?: string;
  progress?: StreamProgress;
  error?: Error;
}): void => {
  streamEventListeners.forEach(listener => {
    try {
      listener(event);
    } catch (error) {
      console.error('Error in stream event listener:', error);
    }
  });
};

// ============================================================================
// Enhanced Streaming with Events
// ============================================================================

/**
 * Stream with event emission
 */
export const streamWithEvents = (
  prompt: string,
  inferenceOptions: InferenceOptions,
  streamingOptions: StreamingOptions
): CancelablePromise<string> => {
  const stream = streamMessage(prompt, inferenceOptions, {
    ...streamingOptions,
    callback: (token, fullText) => {
      emitStreamEvent({ type: 'token', token, fullText });
      emitStreamEvent({ type: 'progress', progress: getStreamProgress() });
      streamingOptions.callback?.(token, fullText);
    },
    onComplete: (fullText) => {
      emitStreamEvent({ type: 'complete', fullText });
      streamingOptions.onComplete?.(fullText);
    },
    onError: (error) => {
      emitStreamEvent({ type: 'error', error });
      streamingOptions.onError?.(error);
    },
  });
  
  // Emit start event
  emitStreamEvent({ type: 'start' });
  
  // Handle cancellation
  const originalCancel = stream.cancel.bind(stream);
  stream.cancel = () => {
    originalCancel();
    emitStreamEvent({ type: 'cancel' });
  };
  
  return stream;
};

// ============================================================================
// Export all functions
// ============================================================================

export default {
  streamMessage,
  streamWithRetry,
  streamWithEvents,
  cancelStream,
  isStreaming,
  getCurrentStreamText,
  getTokenCount,
  getDurationMs,
  getStreamError,
  clearStreamState,
  getStreamProgress,
  useStreaming,
  addStreamEventListener,
  removeStreamEventListener,
};
