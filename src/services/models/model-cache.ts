import { Model } from '../../types';
import { getModelConfig } from './model-registry';
import { getCustomAppConfig } from './webllm-config';
import { log, warn } from '../logging';

/**
 * Delete the cached files of a model from browser storage.
 *
 * - wllama models (GGUF): the files live in the wllama CacheManager (OPFS by
 *   default). Entries are keyed by a hash of the download URL, but the file
 *   name is part of the key, so entries are matched by file name. This covers
 *   both the self-hosted and the HuggingFace download path.
 * - WebLLM models (MLC): `deleteModelAllInfoInCache` removes tensors, wasm and
 *   config from the WebLLM cache. It needs the same app config that was used
 *   to load the model (custom model URLs + OPFS backend).
 *
 * The model does not need to be (or have been) loaded; a missing cache is not
 * an error.
 */
export const deleteModelCacheFiles = async (model: Model): Promise<void> => {
  const config = getModelConfig(model.id);
  if (!config) {
    return;
  }

  try {
    if (config.engine === 'wllama') {
      const { CacheManager } = await import('@wllama/wllama');
      const cacheManager = new CacheManager();
      const fileNames = [config.gguf?.file, config.gguf?.mmprojFile].filter(
        (name): name is string => typeof name === 'string' && name.length > 0
      );
      if (fileNames.length === 0) {
        return;
      }
      const entries = await cacheManager.list();
      for (const entry of entries) {
        if (fileNames.some((fileName) => entry.name.endsWith(`_${fileName}`))) {
          await cacheManager.delete(entry.name);
        }
      }
    } else {
      const { deleteModelAllInfoInCache } = await import('@mlc-ai/web-llm');
      await deleteModelAllInfoInCache(model.id, getCustomAppConfig());
    }
    log(`Model cache deleted: ${model.id}`);
  } catch (err) {
    warn(`Failed to delete cached files of model ${model.id}:`, err);
    throw err;
  }
};
