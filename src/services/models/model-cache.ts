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
      const { deleteModelAllInfoInCache, prebuiltAppConfig } = await import('@mlc-ai/web-llm');
      // The cache is keyed by the URL the model was downloaded from. A load
      // may have fallen back from the self-hosted copy to HuggingFace, so
      // try both locations - otherwise the cache survives the "delete".
      const prebuilt = (prebuiltAppConfig.model_list ?? []).find(
        (record) => record.model_id === model.id
      );
      const baseConfig = await getCustomAppConfig();
      const candidateUrls = [
        new URL(`/models/${model.id}`, window.location.origin).href,
        prebuilt?.model,
      ].filter((url): url is string => typeof url === 'string' && url.length > 0);

      for (const modelUrl of [...new Set(candidateUrls)]) {
        try {
          await deleteModelAllInfoInCache(model.id, {
            ...baseConfig,
            model_list: [
              {
                model: modelUrl,
                model_id: model.id,
                model_lib: prebuilt?.model_lib ?? '',
              },
            ],
          });
        } catch (err) {
          warn(`Could not delete cache of model ${model.id} (${modelUrl}):`, err);
        }
      }
    }
    log(`Model cache deleted: ${model.id}`);
  } catch (err) {
    warn(`Failed to delete cached files of model ${model.id}:`, err);
    throw err;
  }
};

/**
 * Best-effort removal of cached files for models that are no longer in the
 * registry (e.g. after a model was replaced). The cache is keyed by the URL
 * the model was downloaded from, so both known locations are tried: our own
 * webspace (/models/<id>) and the official HuggingFace record from the
 * web-llm prebuilt list. A failing deletion (nothing cached, API change)
 * is logged but never thrown - orphaned cache data is not worth breaking
 * the app start for.
 */
export const purgeRemovedModelCaches = async (removedIds: string[]): Promise<void> => {
  if (removedIds.length === 0) {
    return;
  }
  const { prebuiltAppConfig, deleteModelAllInfoInCache } = await import('@mlc-ai/web-llm');
  const baseConfig = await getCustomAppConfig();

  for (const id of removedIds) {
    const prebuilt = (prebuiltAppConfig.model_list ?? []).find(
      (record) => record.model_id === id
    );
    const candidateUrls = [
      new URL(`/models/${id}`, window.location.origin).href,
      prebuilt?.model,
    ].filter((url): url is string => typeof url === 'string' && url.length > 0);
    const uniqueUrls = [...new Set(candidateUrls)];

    for (const modelUrl of uniqueUrls) {
      try {
        await deleteModelAllInfoInCache(id, {
          ...baseConfig,
          model_list: [
            {
              model: modelUrl,
              model_id: id,
              model_lib: prebuilt?.model_lib ?? '',
            },
          ],
        });
        log(`Purged cache of removed model: ${id} (${modelUrl})`);
      } catch (err) {
        warn(`Could not purge cache of removed model ${id} (${modelUrl}):`, err);
      }
    }
  }
};
