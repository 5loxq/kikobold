import { Chat, Message } from '../../types';
import { error as logError, warn } from '../logging';
import { sanitizeInputLight } from '../security';

const DB_NAME = 'LocalLLMDB';
const STORE_NAME = 'chats';
// Schema version. MUST be raised whenever the object stores or indexes
// change. Migrations run in onupgradeneeded below, ordered by oldVersion:
// existing data survives because IndexedDB keeps stores that the migration
// does not touch. Pattern for future schema changes:
//   if (event.oldVersion < 2) { /* v1 -> v2: e.g. new index */ }
//   if (event.oldVersion < 3) { /* v2 -> v3: ... */ }
const DB_VERSION = 1;

let db: IDBDatabase | null = null;
// Resolved once the database connection is established. All storage helpers
// await this so callers can never race ahead of the async initialization
// (previously e.g. the initial chat creation failed with "Database not
// initialized" when it ran before initChatDB had completed).
let dbReadyPromise: Promise<void> | null = null;

// Validate chat object
function validateChat(chat: unknown): chat is Chat {
  return (
    typeof chat === 'object' &&
    chat !== null &&
    typeof (chat as Chat).id === 'string' && 
    typeof (chat as Chat).title === 'string' &&
    Array.isArray((chat as Chat).messages) &&
    typeof (chat as Chat).profileId === 'string' &&
    typeof (chat as Chat).createdAt === 'number' &&
    typeof (chat as Chat).updatedAt === 'number'
  );
}

// Validate message object
function validateMessage(message: unknown): message is Message {
  return (
    typeof message === 'object' &&
    message !== null &&
    typeof (message as Message).id === 'string' && 
    ((message as Message).role === 'user' || (message as Message).role === 'assistant') &&
    typeof (message as Message).content === 'string' &&
    typeof (message as Message).timestamp === 'number'
  );
}

export const initChatDB = (): Promise<void> => {
  dbReadyPromise ??= openChatDB();
  return dbReadyPromise;
};

const openChatDB = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      if (!window.indexedDB) {
        throw new Error('IndexedDB is not supported in this browser');
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (): void => {
        logError('IndexedDB error:', request.error);
        reject(request.error ?? new Error('Failed to open database'));
      };

      request.onsuccess = (): void => {
        db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event): void => {
        try {
          const database = (event.target as IDBOpenDBRequest).result;
          const oldVersion = event.oldVersion;
          // v0 -> v1: initial schema (fresh database)
          if (oldVersion < 1 && !database.objectStoreNames.contains(STORE_NAME)) {
            const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('createdAt', 'createdAt', { unique: false });
            store.createIndex('profileId', 'profileId', { unique: false });
          }
          // Future migrations go here, guarded by `oldVersion < N` so
          // existing users walk through every step exactly once.
        } catch (error) {
          logError('Database upgrade error:', error);
          reject(error);
        }
      };
    } catch (error) {
      logError('Database initialization error:', error);
      reject(error);
    }
  });
};

export const saveChat = async (chat: Chat): Promise<void> => {
  await initChatDB();
  if (!db) {throw new Error('Database not initialized');}
  const database = db;

  // Validate chat object
  if (!validateChat(chat)) {
    throw new Error('Invalid chat object');
  }

  // Validate all messages and sanitize content
  const sanitizedMessages = chat.messages.map(message => {
    if (!validateMessage(message)) {
      throw new Error('Invalid message in chat');
    }
    // Message content is data: it is rendered as escaped text by React (the
    // markdown renderer never injects raw HTML). The full sanitizeInput()
    // would mangle everyday text and code answers (it strips "data:",
    // "on x =", "javascript:" etc. from normal words), so only HTML tags are
    // stripped here - same policy as the memory and the library.
    return {
      ...message,
      content: sanitizeInputLight(message.content),
    };
  });

  const sanitizedChat = {
    ...chat,
    messages: sanitizedMessages,
  };

  return new Promise((resolve, reject) => {
    try {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(sanitizedChat);

      request.onerror = (): void => {
        logError('Failed to save chat:', request.error);
        reject(request.error ?? new Error('Failed to save chat'));
      };

      request.onsuccess = (): void => resolve();
    } catch (error) {
      logError('Error saving chat:', error);
      reject(error);
    }
  });
};

export const getChat = async (id: string): Promise<Chat | null> => {
  await initChatDB();
  if (!db) {throw new Error('Database not initialized');}
  const database = db;

  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('Invalid chat ID');
  }

  return new Promise((resolve, reject) => {
    try {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onerror = (): void => {
        logError('Failed to get chat:', request.error);
        reject(request.error ?? new Error('Failed to get chat'));
      };

      request.onsuccess = (): void => {
        const result = request.result;
        if (result && !validateChat(result)) {
          warn('Retrieved invalid chat from database');
          resolve(null);
        } else {
          resolve(result ?? null);
        }
      };
    } catch (error) {
      logError('Error getting chat:', error);
      reject(error);
    }
  });
};

export const getAllChats = async (): Promise<Chat[]> => {
  await initChatDB();
  if (!db) {throw new Error('Database not initialized');}
  const database = db;

  return new Promise((resolve, reject) => {
    try {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = (): void => {
        logError('Failed to get all chats:', request.error);
        reject(request.error ?? new Error('Failed to get all chats'));
      };

      request.onsuccess = (): void => {
        const chats = request.result;
        // Filter out invalid chats
        const validChats = Array.isArray(chats) 
          ? chats.filter(chat => validateChat(chat))
          : [];
        resolve(validChats);
      };
    } catch (error) {
      logError('Error getting all chats:', error);
      reject(error);
    }
  });
};

export const deleteChat = async (id: string): Promise<void> => {
  await initChatDB();
  if (!db) {throw new Error('Database not initialized');}
  const database = db;

  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('Invalid chat ID');
  }

  return new Promise((resolve, reject) => {
    try {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onerror = (): void => {
        logError('Failed to delete chat:', request.error);
        reject(request.error ?? new Error('Failed to delete chat'));
      };

      request.onsuccess = (): void => resolve();
    } catch (error) {
      logError('Error deleting chat:', error);
      reject(error);
    }
  });
};

/** Delete ALL chats (used by the "delete everything" action in the data page) */
export const clearAllChats = async (): Promise<void> => {
  await initChatDB();
  if (!db) {throw new Error('Database not initialized');}
  const database = db;

  return new Promise((resolve, reject) => {
    try {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const request = transaction.objectStore(STORE_NAME).clear();

      request.onerror = (): void => {
        logError('Failed to clear chats:', request.error);
        reject(request.error ?? new Error('Failed to clear chats'));
      };

      request.onsuccess = (): void => resolve();
    } catch (error) {
      logError('Error clearing chats:', error);
      reject(error);
    }
  });
};

export const updateChatMessages = async (chatId: string, messages: Message[]): Promise<void> => {
  if (typeof chatId !== 'string' || chatId.trim().length === 0) {
    throw new Error('Invalid chat ID');
  }

  if (!Array.isArray(messages)) {
    throw new Error('Invalid messages array');
  }

  // Validate and sanitize messages (see saveChat for the sanitizer choice)
  const sanitizedMessages = messages.map(message => {
    if (!validateMessage(message)) {
      throw new Error('Invalid message in array');
    }
    return {
      ...message,
      content: sanitizeInputLight(message.content),
    };
  });

  const chat = await getChat(chatId);
  if (!chat) {throw new Error('Chat not found');}

  chat.messages = sanitizedMessages;
  chat.updatedAt = Date.now();
  await saveChat(chat);
};

// Default title for new chats; also used to detect "not yet renamed" chats
export const DEFAULT_CHAT_TITLE = 'New Chat';

export const createChat = (profileId: string, title: string = DEFAULT_CHAT_TITLE): Chat => {
  if (typeof profileId !== 'string' || profileId.trim().length === 0) {
    throw new Error('Invalid profile ID');
  }

  if (typeof title !== 'string' || title.trim().length === 0) {
    title = DEFAULT_CHAT_TITLE;
  }

  const now = Date.now();
  return {
    id: `chat_${now}_${Math.random().toString(36).slice(2, 11)}`,
    title: title.trim(),
    messages: [],
    profileId: profileId.trim(),
    createdAt: now,
    updatedAt: now,
  };
};
