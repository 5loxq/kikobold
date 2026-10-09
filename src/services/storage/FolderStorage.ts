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
  const folder: ChatFolder = {
    id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    createdAt: Date.now(),
  };
  saveFolders([...getFolders(), folder]);
  return folder;
};

export const renameFolder = (id: string, name: string): void => {
  saveFolders(getFolders().map((f) => (f.id === id ? { ...f, name } : f)));
};

/** Deleting a folder does NOT delete its chats - they become ungrouped. */
export const deleteFolder = (id: string): void => {
  saveFolders(getFolders().filter((f) => f.id !== id));
};

export const importFolders = (folders: ChatFolder[]): void => {
  const existing = getFolders();
  const existingIds = new Set(existing.map((f) => f.id));
  const merged = [...existing, ...folders.filter((f) => isValidFolder(f) && !existingIds.has(f.id))];
  saveFolders(merged);
};
