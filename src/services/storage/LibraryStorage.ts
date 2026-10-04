import { warn } from '../logging';
import { sanitizeInputLight } from '../security';
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE } from '../attachments';

export interface LibraryFile {
  id: string;
  name: string;
  content: string;
  size: number;
  createdAt: number;
  updatedAt: number;
}

// Separate IndexedDB database for the user's reference library
const DB_NAME = 'LocalLLMLibraryDB';
const STORE_NAME = 'files';

/** How much of a file's content is included in a single request */
export const LIBRARY_INJECT_MAX_CHARS = 4000;
/** Upper bound for all injected library content per request */
export const LIBRARY_INJECT_TOTAL_MAX_CHARS = 12000;

let db: IDBDatabase | null = null;
let dbReadyPromise: Promise<void> | null = null;

function validateFileEntry(entry: unknown): entry is LibraryFile {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    typeof (entry as LibraryFile).id === 'string' &&
    typeof (entry as LibraryFile).name === 'string' &&
    typeof (entry as LibraryFile).content === 'string' &&
    typeof (entry as LibraryFile).size === 'number' &&
    typeof (entry as LibraryFile).createdAt === 'number' &&
    typeof (entry as LibraryFile).updatedAt === 'number'
  );
}

export const isAllowedLibraryFile = (file: File): boolean => {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ALLOWED_EXTENSIONS.includes(ext) && file.size <= MAX_FILE_SIZE;
};

export const initLibraryDB = (): Promise<void> => {
  if (!dbReadyPromise) {
    dbReadyPromise = openLibraryDB();
  }
  return dbReadyPromise;
};

const openLibraryDB = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      if (!window.indexedDB) {
        throw new Error('IndexedDB is not supported in this browser');
      }

      const request = indexedDB.open(DB_NAME, 1);

      request.onerror = (): void => {
        console.error('IndexedDB error:', request.error);
        reject(request.error ?? new Error('Failed to open library database'));
      };

      request.onsuccess = (): void => {
        db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event): void => {
        try {
          const database = (event.target as IDBOpenDBRequest).result;
          if (!database.objectStoreNames.contains(STORE_NAME)) {
            database.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        } catch (error) {
          console.error('Library database upgrade error:', error);
          reject(error);
        }
      };
    } catch (error) {
      console.error('Library database initialization error:', error);
      reject(error);
    }
  });
};

export const getAllLibraryFiles = async (): Promise<LibraryFile[]> => {
  await initLibraryDB();
  if (!db) {throw new Error('Database not initialized');}
  const database = db;

  return new Promise((resolve, reject) => {
    try {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const request = transaction.objectStore(STORE_NAME).getAll();

      request.onerror = (): void => {
        console.error('Failed to load library files:', request.error);
        reject(request.error ?? new Error('Failed to load library files'));
      };

      request.onsuccess = (): void => {
        const entries = request.result;
        const valid = Array.isArray(entries)
          ? entries.filter((entry): entry is LibraryFile => validateFileEntry(entry))
          : [];
        valid.sort((a, b) => a.name.localeCompare(b.name));
        resolve(valid);
      };
    } catch (error) {
      console.error('Error loading library files:', error);
      reject(error);
    }
  });
};

export const saveLibraryFile = async (entry: LibraryFile): Promise<void> => {
  await initLibraryDB();
  if (!db) {throw new Error('Database not initialized');}
  const database = db;

  if (!validateFileEntry(entry) || entry.name.trim().length === 0 || entry.content.length === 0) {
    throw new Error('Invalid library file');
  }

  // Only the file NAME is sanitized lightly (HTML tags stripped): the name is
  // rendered as text by React and used for @references. The full
  // sanitizeInput() would mangle names containing e.g. "data:".
  const sanitized: LibraryFile = {
    ...entry,
    name: sanitizeInputLight(entry.name.trim()),
  };

  return new Promise((resolve, reject) => {
    try {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const request = transaction.objectStore(STORE_NAME).put(sanitized);

      request.onerror = (): void => {
        console.error('Failed to save library file:', request.error);
        reject(request.error ?? new Error('Failed to save library file'));
      };
      request.onsuccess = (): void => resolve();
    } catch (error) {
      console.error('Error saving library file:', error);
      reject(error);
    }
  });
};

export const deleteLibraryFile = async (id: string): Promise<void> => {
  await initLibraryDB();
  if (!db) {throw new Error('Database not initialized');}
  const database = db;

  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('Invalid library file ID');
  }

  return new Promise((resolve, reject) => {
    try {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const request = transaction.objectStore(STORE_NAME).delete(id);

      request.onerror = (): void => {
        console.error('Failed to delete library file:', request.error);
        reject(request.error ?? new Error('Failed to delete library file'));
      };
      request.onsuccess = (): void => resolve();
    } catch (error) {
      console.error('Error deleting library file:', error);
      reject(error);
    }
  });
};

/** Delete ALL library files (used by the "delete everything" action) */
export const clearAllLibraryFiles = async (): Promise<void> => {
  await initLibraryDB();
  if (!db) {throw new Error('Database not initialized');}
  const database = db;

  return new Promise((resolve, reject) => {
    try {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const request = transaction.objectStore(STORE_NAME).clear();

      request.onerror = (): void => {
        console.error('Failed to clear library:', request.error);
        reject(request.error ?? new Error('Failed to clear library'));
      };
      request.onsuccess = (): void => resolve();
    } catch (error) {
      console.error('Error clearing library:', error);
      reject(error);
    }
  });
};

export const createLibraryFile = (name: string, content: string): LibraryFile => {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Library file name must be non-empty');
  }
  if (typeof content !== 'string' || content.length === 0) {
    throw new Error('Library file content must be non-empty');
  }
  const now = Date.now();
  return {
    id: `libfile_${now}_${Math.random().toString(36).substr(2, 9)}`,
    name: name.trim(),
    content,
    size: content.length,
    createdAt: now,
    updatedAt: now,
  };
};

/**
 * Resolve "@name" references in a chat message: for every token that matches
 * a library file (with or without extension), the file's content is appended
 * to the prompt. Unknown tokens are left untouched.
 */
export const resolveLibraryReferences = (message: string, files: LibraryFile[]): string => {
  if (files.length === 0 || !message.includes('@')) {
    return message;
  }

  const tokens = message.match(/@([\w.-]+)/g) ?? [];
  const matched = new Map<string, LibraryFile>();

  for (const token of tokens) {
    const needle = token.slice(1).toLowerCase();
    const file = files.find(
      (f) => f.name.toLowerCase() === needle || f.name.toLowerCase().replace(/\.[^.]+$/, '') === needle
    );
    if (file && !matched.has(file.id)) {
      matched.set(file.id, file);
    }
  }

  if (matched.size === 0) {
    return message;
  }

  const blocks: string[] = [];
  let total = 0;
  for (const file of matched.values()) {
    const content = file.content.slice(0, LIBRARY_INJECT_MAX_CHARS);
    if (total + content.length > LIBRARY_INJECT_TOTAL_MAX_CHARS) {
      warn(`Library limit reached - '${file.name}' was cut off for this request`);
      break;
    }
    blocks.push(`--- File: ${file.name} ---\n${content}\n--- End of file ---`);
    total += content.length;
  }

  if (blocks.length === 0) {
    return message;
  }

  return `${message}\n\nThe user referenced the following files from their library. Use them as context:\n\n${blocks.join('\n\n')}`;
};
