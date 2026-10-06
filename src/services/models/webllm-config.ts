import { type AppConfig } from '@mlc-ai/web-llm';
import { getModelConfig } from './model-registry';

/**
 * App config for WebLLM: keep the official prebuilt model list (HF CDN sources)
 * and only switch the cache backend to OPFS. For models that we host on our
 * own webspace, the model URL is rewritten to the same-origin copy (no CDN
 * dependency); everything else (model_lib, metadata) stays untouched.
 *
 * The same config must be used for loading AND for cache operations
 * (e.g. deleteModelAllInfoInCache), because the cache is keyed by the model
 * URL it contains.
 *
 * @mlc-ai/web-llm is imported dynamically so the (large) engine bundle is
 * only fetched when a model is actually being loaded or its cache managed -
 * it never lands in the initial app chunk.
 */
export const getCustomAppConfig = async (useSelfHosted = true): Promise<AppConfig> => {
  const { prebuiltAppConfig } = await import('@mlc-ai/web-llm');
  const model_list = (prebuiltAppConfig.model_list ?? []).map((record) => {
    if (!useSelfHosted) {
      return record;
    }
    const config = getModelConfig(record.model_id);
    if (config?.selfHostedPath) {
      return {
        ...record,
        model: new URL(config.selfHostedPath, window.location.origin).href,
      };
    }
    return record;
  });
  return {
    cacheBackend: 'opfs', // Use Origin Private File System for best caching
    model_list,
  };
};
