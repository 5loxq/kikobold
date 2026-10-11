import { error as logError, warn } from '../logging';
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
  dbReadyPromise ??= openLibraryDB().catch((err: unknown) => {
    // Do not cache the rejection: a transient failure would otherwise
    // block every later operation until the page is reloaded.
    dbReadyPromise = null;
    throw err;
  });
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
        logError('IndexedDB error:', request.error);
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
          logError('Library database upgrade error:', error);
          reject(error);
        }
      };
    } catch (error) {
      logError('Library database initialization error:', error);
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
        logError('Failed to load library files:', request.error);
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
      logError('Error loading library files:', error);
      reject(error);
    }
  });
};

/**
 * Insert-or-replace by NAME: any existing file with the same name is
 * deleted in the SAME transaction. saveLibraryFile alone would create a
 * second row with a new id (the React state filters the duplicate until
 * the next reload, the database keeps both forever).
 */
export const upsertLibraryFileByName = async (entry: LibraryFile): Promise<void> => {
  await initLibraryDB();
  if (!db) {throw new Error('Database not initialized');}
  const database = db;

  if (!validateFileEntry(entry) || entry.name.trim().length === 0 || entry.content.length === 0) {
    throw new Error('Invalid library file');
  }

  const sanitized: LibraryFile = {
    ...entry,
    name: sanitizeInputLight(entry.name.trim()),
  };

  return new Promise((resolve, reject) => {
    try {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getAllRequest = store.getAll();

      getAllRequest.onerror = (): void => {
        logError('Failed to read library for upsert:', getAllRequest.error);
        reject(getAllRequest.error ?? new Error('Failed to save library file'));
      };

      getAllRequest.onsuccess = (): void => {
        try {
          const existing = Array.isArray(getAllRequest.result)
            ? getAllRequest.result as Array<{ id?: unknown; name?: unknown }>
            : [];
          for (const row of existing) {
            if (row.name === sanitized.name && row.id !== sanitized.id && typeof row.id === 'string') {
              store.delete(row.id);
            }
          }
          const putRequest = store.put(sanitized);
          putRequest.onerror = (): void => {
            logError('Failed to save library file:', putRequest.error);
            reject(putRequest.error ?? new Error('Failed to save library file'));
          };
          putRequest.onsuccess = (): void => resolve();
        } catch (error) {
          reject(error);
        }
      };
    } catch (error) {
      logError('Error saving library file:', error);
      reject(error);
    }
  });
};

export const saveLibraryFile = async (entry: LibraryFile): Promise<void> => {  await initLibraryDB();
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
        logError('Failed to save library file:', request.error);
        reject(request.error ?? new Error('Failed to save library file'));
      };
      request.onsuccess = (): void => resolve();
    } catch (error) {
      logError('Error saving library file:', error);
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
        logError('Failed to delete library file:', request.error);
        reject(request.error ?? new Error('Failed to delete library file'));
      };
      request.onsuccess = (): void => resolve();
    } catch (error) {
      logError('Error deleting library file:', error);
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
        logError('Failed to clear library:', request.error);
        reject(request.error ?? new Error('Failed to clear library'));
      };
      request.onsuccess = (): void => resolve();
    } catch (error) {
      logError('Error clearing library:', error);
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
    id: `libfile_${now}_${Math.random().toString(36).slice(2, 11)}`,
    name: name.trim(),
    content,
    size: content.length,
    createdAt: now,
    updatedAt: now,
  };
};

/**
 * Resolve "@name" references in a chat message: for every reference that
 * matches a library file (with or without extension), the file's content is
 * appended to the prompt. Unknown references are left untouched.
 *
 * A reference is matched by longest-name comparison against the text after
 * the "@" (case-insensitive), so file names with spaces ("BB SYSTEM.txt")
 * work without quoting. The "@" must start the text or follow whitespace;
 * the reference must end at the end of the text, whitespace or punctuation.
 */
export const resolveLibraryReferences = (message: string, files: LibraryFile[]): string => {
  if (files.length === 0 || !message.includes('@')) {
    return message;
  }

  const lowerMessage = message.toLowerCase();
  const matched = new Map<string, LibraryFile>();

  // An "@" starts a reference at the beginning of the text, after
  // whitespace, or after an opening bracket/quote - but never mid-word
  // (so "max@AUFGABEN" in an e-mail address does not match).
  const isAtTokenStart = (at: number): boolean =>
    at === 0 || /[\s([{"']/.test(message[at - 1] ?? '');

  const isReferenceEnd = (after: number): boolean => {
    const char = message[after];
    return char === undefined || /[.,;:!?)"'…]/.test(char) || /\s/.test(char);
  };

  // Longest names first: "BB SYSTEM extra.txt" must win over "BB SYSTEM.txt".
  const candidates = [...files]
    .filter((f) => f.name.length > 0 && !f.name.includes('@'))
    .sort((a, b) => b.name.length - a.name.length);

  for (const file of candidates) {
    if (matched.has(file.id)) {
      continue;
    }
    const name = file.name.toLowerCase();
    const stem = name.replace(/\.[^.]+$/, '');
    const variants = stem !== name ? [name, stem] : [name];

    for (const variant of variants) {
      const needle = `@${variant}`;
      let at = lowerMessage.indexOf(needle);
      while (at !== -1) {
        if (isAtTokenStart(at) && isReferenceEnd(at + needle.length)) {
          matched.set(file.id, file);
          break;
        }
        at = lowerMessage.indexOf(needle, at + 1);
      }
      if (matched.has(file.id)) {
        break;
      }
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
