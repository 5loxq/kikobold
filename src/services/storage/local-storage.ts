/**
 * Central localStorage adapter: every localStorage access in the app goes
 * through here so quota and private-mode errors are handled in ONE place
 * instead of try/catch blocks scattered over a dozen files.
 *
 * Storage that silently fails (private mode, quota exceeded, disabled) is
 * not an error for the app: settings just don't persist, defaults apply.
 */

export const localStorageGet = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const localStorageSet = (key: string, value: string): boolean => {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

export const localStorageRemove = (key: string): void => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore - nothing to clean up then
  }
};

/** Read a JSON value; null when missing or unparsable */
export const localStorageGetJson = <T>(key: string): T | null => {
  const raw = localStorageGet(key);
  if (raw === null) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

/** Write a JSON value; false when it could not be stored */
export const localStorageSetJson = (key: string, value: unknown): boolean => {
  try {
    return localStorageSet(key, JSON.stringify(value));
  } catch {
    // JSON.stringify can throw on circular structures
    return false;
  }
};
