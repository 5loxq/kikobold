import { Chat, Message } from '../../types';
import { warn } from '../logging';
import { sanitizeInput } from '../security';

const DB_NAME = 'LocalLLMDB';
const STORE_NAME = 'chats';

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
  if (!dbReadyPromise) {
    dbReadyPromise = openChatDB();
  }
  return dbReadyPromise;
};

const openChatDB = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      if (!window.indexedDB) {
        throw new Error('IndexedDB is not supported in this browser');
      }

      const request = indexedDB.open(DB_NAME, 1);

      request.onerror = (): void => {
        console.error('IndexedDB error:', request.error);
        reject(request.error ?? new Error('Failed to open database'));
      };

      request.onsuccess = (): void => {
        db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event): void => {
        try {
          const database = (event.target as IDBOpenDBRequest).result;
          if (!database.objectStoreNames.contains(STORE_NAME)) {
            const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('createdAt', 'createdAt', { unique: false });
            store.createIndex('profileId', 'profileId', { unique: false });
          }
        } catch (error) {
          console.error('Database upgrade error:', error);
          reject(error);
        }
      };
    } catch (error) {
      console.error('Database initialization error:', error);
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
    // Sanitize message content before saving
    return {
      ...message,
      content: sanitizeInput(message.content),
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
        console.error('Failed to save chat:', request.error);
        reject(request.error ?? new Error('Failed to save chat'));
      };

      request.onsuccess = (): void => resolve();
    } catch (error) {
      console.error('Error saving chat:', error);
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
        console.error('Failed to get chat:', request.error);
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
      console.error('Error getting chat:', error);
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
        console.error('Failed to get all chats:', request.error);
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
      console.error('Error getting all chats:', error);
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
        console.error('Failed to delete chat:', request.error);
        reject(request.error ?? new Error('Failed to delete chat'));
      };

      request.onsuccess = (): void => resolve();
    } catch (error) {
      console.error('Error deleting chat:', error);
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
        console.error('Failed to clear chats:', request.error);
        reject(request.error ?? new Error('Failed to clear chats'));
      };

      request.onsuccess = (): void => resolve();
    } catch (error) {
      console.error('Error clearing chats:', error);
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

  // Validate and sanitize messages
  const sanitizedMessages = messages.map(message => {
    if (!validateMessage(message)) {
      throw new Error('Invalid message in array');
    }
    return {
      ...message,
      content: sanitizeInput(message.content),
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
    id: `chat_${now}_${Math.random().toString(36).substr(2, 9)}`,
    title: title.trim(),
    messages: [],
    profileId: profileId.trim(),
    createdAt: now,
    updatedAt: now,
  };
};
