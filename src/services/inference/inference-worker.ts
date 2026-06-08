/**
 * Inference Web Worker
 * 
 * Runs inference in a separate thread to prevent UI blocking
 * Communicates with main thread via message passing
 */

import { pipeline, TextGenerationPipeline, env, AutoTokenizer } from '@xenova/transformers';
import { validateModelPath } from '../security';
import { getModelConfig, ModelConfig } from '../models/model-registry';

// ============================================================================
// Types
// ============================================================================

interface WorkerMessage {
    type: 'INIT' | 'LOAD_MODEL' | 'GENERATE' | 'UNLOAD_MODEL' | 'CLEANUP' | 'GET_STATUS';
    modelId?: string;
    modelPath?: string;
    request?: {
        prompt: string;
        options: {
            temperature: number;
            topP: number;
            maxTokens: number;
            topK?: number;
            repeatPenalty?: number;
            systemPrompt?: string;
            language?: string;
        };
        streamCallback?: boolean;
    };
    messageId?: number;
    config?: any;
}

interface WorkerResult {
    type: 'RESULT' | 'TOKEN' | 'PROGRESS' | 'STATUS' | 'ERROR';
    data?: any;
    error?: string;
    messageId?: number;
}

// ============================================================================
// State
// ============================================================================

let currentPipeline: TextGenerationPipeline | null = null;
let currentModelId: string | null = null;
let modelCache: Map<string, { pipeline: TextGenerationPipeline; timestamp: number }> = new Map();
let isLoading = false;

// ============================================================================
// Model Management
// ============================================================================

const loadModel = async (modelId: string, modelPath: string, config: ModelConfig): Promise<{ success: boolean; error?: string; memoryUsed?: number }> => {
    try {
        isLoading = true;
        
        // Check if already loaded
        if (currentModelId === modelId && currentPipeline) {
            return { success: true };
        }

        // Estimate memory usage
        const memoryUsed = estimateModelMemory(config);

        // Load the model
        const task = config.type === 'chat' ? 'text-generation' : 'text2text-generation';
        
        const pipelineInstance = await pipeline(task, {
            model: validateModelPath(modelPath),
            dtype: config.quantized ? 'q4' : undefined,
            progress_callback: (progress: { progress: number; status: string }) => {
                postMessage({
                    type: 'PROGRESS',
                    data: { progress: progress.progress * 100, status: progress.status },
                } as WorkerResult);
            },
        });

        // Store in cache
        modelCache.set(modelId, {
            pipeline: pipelineInstance,
            timestamp: Date.now(),
        });

        // Set as current
        currentModelId = modelId;
        currentPipeline = pipelineInstance;
        isLoading = false;

        return { success: true, memoryUsed };
    } catch (err) {
        isLoading = false;
        const errorMessage = err instanceof Error ? err.message : String(err);
        return { success: false, error: errorMessage };
    }
};

const unloadModel = (modelId: string): boolean => {
    const entry = modelCache.get(modelId);
    if (entry) {
        try {
            if (typeof (entry.pipeline as any).dispose === 'function') {
                (entry.pipeline as any).dispose();
            }
            modelCache.delete(modelId);
            if (currentModelId === modelId) {
                currentModelId = null;
                currentPipeline = null;
            }
            return true;
        } catch (err) {
            return false;
        }
    }
    return false;
};

const cleanup = (): void => {
    Array.from(modelCache.keys()).forEach(modelId => unloadModel(modelId));
    currentModelId = null;
    currentPipeline = null;
    isLoading = false;
};

// ============================================================================
// Inference
// ============================================================================

const formatPrompt = (modelId: string, userPrompt: string, systemPrompt?: string, language: string = 'en'): string => {
    const config = getModelConfig(modelId);
    if (!config) return userPrompt;

    const languageInstruction = language === 'de'
        ? 'Antworte immer auf Deutsch.'
        : 'Always respond in English.';

    const enhancedSystemPrompt = systemPrompt
        ? `${systemPrompt} ${languageInstruction}`
        : languageInstruction;

    if (config.type === 'chat') {
        let prompt = '';
        prompt += `<|im_start|>system\n${enhancedSystemPrompt}<|im_end|>\n`;
        prompt += `<|im_start|>user\n${userPrompt}<|im_end|>\n<|im_start|>assistant\n`;
        return prompt;
    }

    return `${enhancedSystemPrompt}\n\nQ: ${userPrompt}\nA:`;
};

const extractResponse = (modelId: string, generatedText: string): string => {
    const config = getModelConfig(modelId);
    let responseText = generatedText || '';

    if (config?.type === 'chat') {
        const assistantStart = '<|im_start|>assistant\n';
        const assistantIndex = responseText.indexOf(assistantStart);

        if (assistantIndex !== -1) {
            responseText = responseText.substring(assistantIndex + assistantStart.length);
        }

        const endIndex = responseText.indexOf('<|im_end|>');
        if (endIndex !== -1) {
            responseText = responseText.substring(0, endIndex);
        }
    } else {
        const answerIndex = responseText.indexOf('A:');
        if (answerIndex !== -1) {
            responseText = responseText.substring(answerIndex + 2).trim();
        }
    }

    return responseText;
};

const estimateModelMemory = (config: ModelConfig): number => {
    const sizeMap: Record<string, number> = {
        '70M': 70,
        '140M': 140,
        '280M': 280,
        '560M': 560,
        '1.3B': 1300,
        '2.7B': 2700,
        '7B': 7000,
        '14B': 14000,
    };

    const match = config.modelPath.match(/(\d+[MB]|\d+\.\d+B|\d+B)/i);
    if (match) {
        const sizeStr = match[1].toUpperCase();
        if (sizeStr in sizeMap) {
            return sizeMap[sizeStr as keyof typeof sizeMap];
        }
    }

    return Math.max(100, config.contextLength * 0.1);
};

const generate = async (
    request: WorkerMessage['request'],
    messageId: number
): Promise<void> => {
    try {
        if (!currentPipeline || !currentModelId) {
            postMessage({
                type: 'ERROR',
                error: 'No model loaded',
                messageId,
            } as WorkerResult);
            return;
        }

        const formattedPrompt = formatPrompt(
            currentModelId,
            request?.prompt || '',
            request?.options?.systemPrompt,
            request?.options?.language || 'en'
        );

        const result = await currentPipeline(formattedPrompt, {
            max_new_tokens: request?.options?.maxTokens || 512,
            temperature: request?.options?.temperature || 0.7,
            top_p: request?.options?.topP || 0.9,
            top_k: request?.options?.topK,
            repetition_penalty: request?.options?.repeatPenalty,
            num_return_sequences: 1,
        });

        const responseText = extractResponse(currentModelId, (result as any).generated_text || '');

        postMessage({
            type: 'RESULT',
            data: {
                text: responseText,
                tokens: Math.ceil(responseText.length / 4),
                messageId,
            },
            messageId,
        } as WorkerResult);
    } catch (err) {
        postMessage({
            type: 'ERROR',
            error: err instanceof Error ? err.message : String(err),
            messageId,
        } as WorkerResult);
    }
};

const generateStream = async (
    request: WorkerMessage['request'],
    messageId: number
): Promise<void> => {
    try {
        if (!currentPipeline || !currentModelId) {
            postMessage({
                type: 'ERROR',
                error: 'No model loaded',
                messageId,
            } as WorkerResult);
            return;
        }

        const modelConfig = getModelConfig(currentModelId);
        if (!modelConfig) {
            postMessage({
                type: 'ERROR',
                error: 'Model config not found',
                messageId,
            } as WorkerResult);
            return;
        }

        const tokenizer = await AutoTokenizer.fromPretrained(modelConfig.modelPath);
        
        const formattedPrompt = formatPrompt(
            currentModelId,
            request?.prompt || '',
            request?.options?.systemPrompt,
            request?.options?.language || 'en'
        );

        const inputIds = await tokenizer.encode(formattedPrompt);

        const generator = await currentPipeline.createTextGenerationPipeline({
            max_new_tokens: request?.options?.maxTokens || 512,
            temperature: request?.options?.temperature || 0.7,
            top_p: request?.options?.topP || 0.9,
            top_k: request?.options?.topK,
            repetition_penalty: request?.options?.repeatPenalty,
        });

        let fullText = '';
        
        for await (const output of generator.generate({
            input_ids: inputIds,
            stream: true,
        })) {
            const decoded = tokenizer.decode([output.token]);
            fullText += decoded;
            
            postMessage({
                type: 'TOKEN',
                data: {
                    token: decoded,
                    fullText,
                    messageId,
                },
                messageId,
            } as WorkerResult);
        }

        postMessage({
            type: 'RESULT',
            data: {
                text: fullText,
                tokens: Math.ceil(fullText.length / 4),
                messageId,
            },
            messageId,
        } as WorkerResult);
    } catch (err) {
        postMessage({
            type: 'ERROR',
            error: err instanceof Error ? err.message : String(err),
            messageId,
        } as WorkerResult);
    }
};

// ============================================================================
// Message Handler
// ============================================================================

self.onmessage = async (event: MessageEvent) => {
    const message: WorkerMessage = event.data;
    const messageId = message.messageId || 0;

    try {
        switch (message.type) {
            case 'INIT':
                // Initialize worker with configuration
                if (message.config) {
                    Object.assign(env.backends.onnx.wasm, message.config);
                }
                postMessage({
                    type: 'STATUS',
                    data: { ready: true },
                    messageId,
                } as WorkerResult);
                break;

            case 'LOAD_MODEL':
                if (!message.modelId || !message.modelPath) {
                    postMessage({
                        type: 'ERROR',
                        error: 'Missing modelId or modelPath',
                        messageId,
                    } as WorkerResult);
                    break;
                }

                const modelConfig = getModelConfig(message.modelId);
                if (!modelConfig) {
                    postMessage({
                        type: 'ERROR',
                        error: 'Model config not found',
                        messageId,
                    } as WorkerResult);
                    break;
                }

                const result = await loadModel(message.modelId, message.modelPath, modelConfig);
                if (result.success) {
                    postMessage({
                        type: 'RESULT',
                        data: {
                            success: true,
                            modelId: message.modelId,
                            memoryUsed: result.memoryUsed,
                            messageId,
                        },
                        messageId,
                    } as WorkerResult);
                } else {
                    postMessage({
                        type: 'ERROR',
                        error: result.error,
                        messageId,
                    } as WorkerResult);
                }
                break;

            case 'UNLOAD_MODEL':
                if (!message.modelId) {
                    postMessage({
                        type: 'ERROR',
                        error: 'Missing modelId',
                        messageId,
                    } as WorkerResult);
                    break;
                }

                const success = unloadModel(message.modelId);
                postMessage({
                    type: 'RESULT',
                    data: { success, modelId: message.modelId, messageId },
                    messageId,
                } as WorkerResult);
                break;

            case 'GENERATE':
                if (!message.request) {
                    postMessage({
                        type: 'ERROR',
                        error: 'Missing request',
                        messageId,
                    } as WorkerResult);
                    break;
                }

                if (message.request.streamCallback) {
                    await generateStream(message.request, messageId);
                } else {
                    await generate(message.request, messageId);
                }
                break;

            case 'CLEANUP':
                cleanup();
                postMessage({
                    type: 'RESULT',
                    data: { success: true, messageId },
                    messageId,
                } as WorkerResult);
                break;

            case 'GET_STATUS':
                postMessage({
                    type: 'STATUS',
                    data: {
                        currentModelId,
                        isLoading,
                        cachedModels: Array.from(modelCache.keys()),
                        messageId,
                    },
                    messageId,
                } as WorkerResult);
                break;

            default:
                postMessage({
                    type: 'ERROR',
                    error: `Unknown message type: ${(message as any).type}`,
                    messageId,
                } as WorkerResult);
        }
    } catch (err) {
        postMessage({
            type: 'ERROR',
            error: err instanceof Error ? err.message : String(err),
            messageId,
        } as WorkerResult);
    }
};

// Handle worker termination
self.onerror = (err) => {
    console.error('Inference worker error:', err);
};
