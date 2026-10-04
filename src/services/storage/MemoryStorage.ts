import { MemoryEntry } from '../../types';
import { warn } from '../logging';
import { sanitizeInputLight } from '../security';

// Separate database (not the chat DB) so no version migration of the
// existing stores is needed. Memories are a small, independent data set.
const DB_NAME = 'LocalLLMMemoryDB';
const STORE_NAME = 'memories';

// Hard limits: the memory is injected into every request, so it must stay
// small enough to not eat the context window of the small local models.
export const MEMORY_ENTRY_MAX_CHARS = 300;
export const MEMORY_TOTAL_MAX_CHARS = 1000;

/** Predefined memory fields the user can fill in (Name, Work, ...).
 *  Each field is a singleton entry with a deterministic id. */
export const MEMORY_FIELDS: Array<{ key: string; labelKey: string; placeholderKey: string }> = [
  { key: 'name', labelKey: 'memory.fieldName', placeholderKey: 'memory.fieldNamePlaceholder' },
  { key: 'work', labelKey: 'memory.fieldWork', placeholderKey: 'memory.fieldWorkPlaceholder' },
  { key: 'hobbies', labelKey: 'memory.fieldHobbies', placeholderKey: 'memory.fieldHobbiesPlaceholder' },
  { key: 'location', labelKey: 'memory.fieldLocation', placeholderKey: 'memory.fieldLocationPlaceholder' },
];

export const memoryFieldEntryId = (fieldKey: string): string => `memory_field_${fieldKey}`;

let db: IDBDatabase | null = null;
let dbReadyPromise: Promise<void> | null = null;

function validateEntry(entry: unknown): entry is MemoryEntry {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    typeof (entry as MemoryEntry).id === 'string' &&
    typeof (entry as MemoryEntry).content === 'string' &&
    typeof (entry as MemoryEntry).createdAt === 'number' &&
    typeof (entry as MemoryEntry).updatedAt === 'number'
  );
}

export const initMemoryDB = (): Promise<void> => {
  if (!dbReadyPromise) {
    dbReadyPromise = openMemoryDB();
  }
  return dbReadyPromise;
};

const openMemoryDB = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      if (!window.indexedDB) {
        throw new Error('IndexedDB is not supported in this browser');
      }

      const request = indexedDB.open(DB_NAME, 1);

      request.onerror = (): void => {
        console.error('IndexedDB error:', request.error);
        reject(request.error ?? new Error('Failed to open memory database'));
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
          console.error('Memory database upgrade error:', error);
          reject(error);
        }
      };
    } catch (error) {
      console.error('Memory database initialization error:', error);
      reject(error);
    }
  });
};

export const getAllMemories = async (): Promise<MemoryEntry[]> => {
  await initMemoryDB();
  if (!db) {throw new Error('Database not initialized');}
  const database = db;

  return new Promise((resolve, reject) => {
    try {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const request = transaction.objectStore(STORE_NAME).getAll();

      request.onerror = (): void => {
        console.error('Failed to load memories:', request.error);
        reject(request.error ?? new Error('Failed to load memories'));
      };

      request.onsuccess = (): void => {
        const entries = request.result;
        const valid = Array.isArray(entries)
          ? entries.filter((entry): entry is MemoryEntry => validateEntry(entry))
          : [];
        // Oldest first so the injected block keeps a stable order
        valid.sort((a, b) => a.createdAt - b.createdAt);
        resolve(valid);
      };
    } catch (error) {
      console.error('Error loading memories:', error);
      reject(error);
    }
  });
};

export const saveMemory = async (entry: MemoryEntry): Promise<void> => {
  await initMemoryDB();
  if (!db) {throw new Error('Database not initialized');}
  const database = db;

  if (!validateEntry(entry)) {
    throw new Error('Invalid memory entry');
  }

  // Memory text is only ever used as plain LLM context and rendered as text
  // by React (auto-escaped). The light sanitizer strips HTML tags so no
  // markup is stored, but keeps normal sentences intact - the full
  // sanitizeInput() would mangle everyday text (e.g. "data:", "on x =").
  const sanitized: MemoryEntry = {
    ...entry,
    content: sanitizeInputLight(entry.content.trim()).slice(0, MEMORY_ENTRY_MAX_CHARS),
  };
  if (sanitized.content.length === 0) {
    throw new Error('Memory content is empty');
  }

  return new Promise((resolve, reject) => {
    try {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const request = transaction.objectStore(STORE_NAME).put(sanitized);

      request.onerror = (): void => {
        console.error('Failed to save memory:', request.error);
        reject(request.error ?? new Error('Failed to save memory'));
      };
      request.onsuccess = (): void => resolve();
    } catch (error) {
      console.error('Error saving memory:', error);
      reject(error);
    }
  });
};

export const deleteMemory = async (id: string): Promise<void> => {
  await initMemoryDB();
  if (!db) {throw new Error('Database not initialized');}
  const database = db;

  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('Invalid memory ID');
  }

  return new Promise((resolve, reject) => {
    try {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const request = transaction.objectStore(STORE_NAME).delete(id);

      request.onerror = (): void => {
        console.error('Failed to delete memory:', request.error);
        reject(request.error ?? new Error('Failed to delete memory'));
      };
      request.onsuccess = (): void => resolve();
    } catch (error) {
      console.error('Error deleting memory:', error);
      reject(error);
    }
  });
};

/** Delete ALL memory entries (used by the "delete everything" action) */
export const clearAllMemories = async (): Promise<void> => {
  await initMemoryDB();
  if (!db) {throw new Error('Database not initialized');}
  const database = db;

  return new Promise((resolve, reject) => {
    try {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const request = transaction.objectStore(STORE_NAME).clear();

      request.onerror = (): void => {
        console.error('Failed to clear memories:', request.error);
        reject(request.error ?? new Error('Failed to clear memories'));
      };
      request.onsuccess = (): void => resolve();
    } catch (error) {
      console.error('Error clearing memories:', error);
      reject(error);
    }
  });
};

export const createMemoryEntry = (content: string, field?: string): MemoryEntry => {
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('Memory content must be a non-empty string');
  }
  const now = Date.now();
  return {
    // Field entries use a deterministic id so re-saving overwrites them
    id: field ? memoryFieldEntryId(field) : `memory_${now}_${Math.random().toString(36).substr(2, 9)}`,
    content: content.trim().slice(0, MEMORY_ENTRY_MAX_CHARS),
    ...(field ? { field } : {}),
    createdAt: now,
    updatedAt: now,
  };
};

/** Total characters of all entries, used for the UI limit indicator */
export const totalMemoryChars = (entries: MemoryEntry[]): number =>
  entries.reduce((sum, entry) => sum + entry.content.length, 0);

/** Build the text block that is prepended to the system prompt, or null if
 *  there is nothing to inject. Honors the total character limit. Field
 *  entries are rendered as "Label: value" using the passed label map. */
export const buildMemoryPromptBlock = (
  entries: MemoryEntry[],
  header: string,
  fieldLabels: Record<string, string> = {}
): string | null => {
  const usable = entries.filter((entry) => entry.content.trim().length > 0);
  if (usable.length === 0) {
    return null;
  }

  const lines: string[] = [];
  let total = 0;
  for (const entry of usable) {
    const label = entry.field ? fieldLabels[entry.field] : undefined;
    const line = `- ${label ? `${label}: ` : ''}${entry.content.trim()}`;
    if (total + line.length > MEMORY_TOTAL_MAX_CHARS) {
      warn('Memory limit reached - older entries were cut off for this request');
      break;
    }
    lines.push(line);
    total += line.length;
  }

  if (lines.length === 0) {
    return null;
  }
  return `${header}\n${lines.join('\n')}`;
};
