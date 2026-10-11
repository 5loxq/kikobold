// Chat folders - a simple ordered list persisted in localStorage. The chats
// reference folders via their folderId (stored on the chat object in
// IndexedDB). Deleting a folder leaves the chats in place: they simply
// show up as ungrouped again.

import { ChatFolder } from '../../types';
import { localStorageGet, localStorageSetJson } from './local-storage';

const FOLDERS_KEY = 'webgui_chat_folders_v1';

const isValidFolder = (folder: unknown): folder is ChatFolder =>
  typeof folder === 'object' &&
  folder !== null &&
  typeof (folder as ChatFolder).id === 'string' &&
  typeof (folder as ChatFolder).name === 'string' &&
  typeof (folder as ChatFolder).createdAt === 'number';

export const getFolders = (): ChatFolder[] => {
  try {
    const raw = localStorageGet(FOLDERS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isValidFolder);
  } catch {
    return [];
  }
};

const saveFolders = (folders: ChatFolder[]): void => {
  try {
    localStorageSetJson(FOLDERS_KEY, folders);
  } catch {
    // Ignore storage errors - folders just don't persist
  }
};

export const createFolder = (name: string): ChatFolder => {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Folder name must be a non-empty string');
  }
  const folder: ChatFolder = {
    id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmed,
    createdAt: Date.now(),
  };
  saveFolders([...getFolders(), folder]);
  return folder;
};

export const renameFolder = (id: string, name: string): void => {
  // Same rule as createFolder: no empty or whitespace-only names.
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Folder name must be a non-empty string');
  }
  saveFolders(getFolders().map((f) => (f.id === id ? { ...f, name: trimmed } : f)));
};

/** Deleting a folder does NOT delete its chats - they become ungrouped. */
export const deleteFolder = (id: string): void => {
  saveFolders(getFolders().filter((f) => f.id !== id));
};

/** Delete ALL folders (used by the "delete everything" action in the data page). */
export const clearFolders = (): void => {
  saveFolders([]);
};

export const importFolders = (folders: ChatFolder[]): void => {
  const existing = getFolders();
  const existingIds = new Set(existing.map((f) => f.id));
  const merged = [...existing, ...folders.filter((f) => isValidFolder(f) && !existingIds.has(f.id))];
  saveFolders(merged);
};
