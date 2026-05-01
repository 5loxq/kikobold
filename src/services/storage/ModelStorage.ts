import { LocalModel } from '../../types';
import { warn } from '../logging';
import { secureLocalStorage } from '../security';

const MODEL_STORAGE_KEY = 'llm_downloaded_models';
const ACTIVE_MODEL_KEY = 'llm_active_model';

// Validate local model object
function validateLocalModel(model: any): model is LocalModel {
  return model &&
    typeof model.id === 'string' &&
    typeof model.name === 'string' &&
    typeof model.path === 'string' &&
    typeof model.size === 'number' &&
    typeof model.downloadedAt === 'number' &&
    model.size > 0 &&
    model.downloadedAt > 0;
}

export const getDownloadedModels = (): LocalModel[] => {
  try {
    const data = secureLocalStorage.getItem(MODEL_STORAGE_KEY);
    if (!data) {
      return [];
    }
    
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      warn('Invalid models data format, returning empty array');
      return [];
    }
    
    // Filter out invalid models
    const validModels = parsed.filter(model => validateLocalModel(model));
    
    if (validModels.length !== parsed.length) {
      warn('Some invalid models were filtered out');
    }
    
    return validModels;
  } catch (error) {
    console.error('Failed to load downloaded models:', error);
    return [];
  }
};

export const saveModel = (model: LocalModel): void => {
  try {
    // Validate model before saving
    if (!validateLocalModel(model)) {
      throw new Error('Invalid model object');
    }

    const models = getDownloadedModels();
    const index = models.findIndex(m => m.id === model.id);

    if (index >= 0) {
      models[index] = model;
    } else {
      models.push(model);
    }

    secureLocalStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(models));
  } catch (error) {
    console.error('Failed to save model:', error);
    throw error;
  }
};

export const deleteModel = (id: string): void => {
  try {
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new Error('Invalid model ID');
    }

    const models = getDownloadedModels().filter(m => m.id !== id);
    secureLocalStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(models));
  } catch (error) {
    console.error('Failed to delete model:', error);
    throw error;
  }
};

export const getModel = (id: string): LocalModel | undefined => {
  try {
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new Error('Invalid model ID');
    }

    const model = getDownloadedModels().find(m => m.id === id);
    return model && validateLocalModel(model) ? model : undefined;
  } catch (error) {
    console.error('Failed to get model:', error);
    return undefined;
  }
};

export const getActiveModel = (): string | null => {
  try {
    const modelId = secureLocalStorage.getItem(ACTIVE_MODEL_KEY);
    return modelId && typeof modelId === 'string' ? modelId : null;
  } catch (error) {
    console.error('Failed to get active model:', error);
    return null;
  }
};

export const setActiveModel = (modelId: string): void => {
  try {
    if (typeof modelId !== 'string' || modelId.trim().length === 0) {
      throw new Error('Invalid model ID');
    }

    secureLocalStorage.setItem(ACTIVE_MODEL_KEY, modelId);
  } catch (error) {
    console.error('Failed to set active model:', error);
    throw error;
  }
};

export const getTotalDownloadedSize = (): number => {
  try {
    const models = getDownloadedModels();
    return models.reduce((sum, m) => sum + m.size, 0);
  } catch (error) {
    console.error('Failed to calculate total downloaded size:', error);
    return 0;
  }
};

export const getTotalDownloadedSizeInGB = (): number => {
  try {
    const sizeInBytes = getTotalDownloadedSize();
    return sizeInBytes / (1024 * 1024 * 1024);
  } catch (error) {
    console.error('Failed to calculate total downloaded size in GB:', error);
    return 0;
  }
};
