import { useCallback, useEffect, useRef, useState } from 'react';
import { Chat, Message, UseChatReturn } from '../types';
import * as ChatStorage from '../services/storage/ChatStorage';
import { error as logError } from '../services/logging';


export const useChat = (): UseChatReturn => {
  const [chat, setChat] = useState<Chat | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);

  // Always-current chat reference. Async flows (e.g. send message -> stream
  // response -> save response) must not rely on the `chat` state captured at
  // call time, otherwise the second write overwrites the first message.
  const chatRef = useRef<Chat | null>(null);
  useEffect(() => {
    chatRef.current = chat;
  }, [chat]);

  const loadChats = useCallback(async () => {
    try {
      const allChats = await ChatStorage.getAllChats();
      if (Array.isArray(allChats)) {
        setChats(allChats.sort((a, b) => b.updatedAt - a.updatedAt));
      }
    } catch (error) {
      logError('Failed to load chats:', error instanceof Error ? error : new Error(String(error)));
    }
  }, []);

  useEffect(() => {
    const initDB = async (): Promise<void> => {
      try {
        await ChatStorage.initChatDB();
        await loadChats();
      } catch (error) {
        logError('Failed to initialize chat database:', error instanceof Error ? error : new Error(String(error)));
      }
    };
    initDB();
  }, [loadChats]);

  const loadChat = useCallback(async (id: string) => {
    try {
      if (typeof id !== 'string' || id.trim().length === 0) {
        throw new Error('Invalid chat ID');
      }

      setLoading(true);
      const loadedChat = await ChatStorage.getChat(id);
      if (loadedChat) {
        setChat(loadedChat);
      }
    } catch (error) {
      logError('Failed to load chat:', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLoading(false);
    }
  }, []);

  const addMessage = useCallback(async (role: 'user' | 'assistant', content: string, chatId?: string) => {
    try {
      const currentChat = chatRef.current;
      // The message belongs to the chat the user was in when the send
      // started. `chatId` pins it: if the user switches chats while a
      // response is streaming, the answer must still land in the original
      // chat, not in whatever chat is active when the stream finishes.
      const targetId = chatId ?? currentChat?.id;
      if (!targetId) {
        throw new Error('No active chat');
      }

      if (role !== 'user' && role !== 'assistant') {
        throw new Error('Invalid message role');
      }

      if (typeof content !== 'string' || content.trim().length === 0) {
        throw new Error('Message content must be a non-empty string');
      }

      const newMessage: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        role,
        content,
        timestamp: Date.now(),
      };

      // The in-memory chat is the source of truth only while it is the
      // active one; for a background chat the stored copy is fresher.
      let targetChat: Chat | null = null;
      if (currentChat?.id === targetId) {
        targetChat = currentChat;
      } else {
        targetChat = await ChatStorage.getChat(targetId);
      }
      if (!targetChat) {
        throw new Error('Chat not found');
      }

      const updatedMessages = [...targetChat.messages, newMessage];
      // Persist outside of the state updater: React state updaters must be
      // pure (StrictMode invokes them twice), so no side effects inside.
      await ChatStorage.updateChatMessages(targetId, updatedMessages);
      const updatedChat: Chat = {
        ...targetChat,
        messages: updatedMessages,
        updatedAt: Date.now(),
      };
      // Keep the ref in sync immediately so consecutive calls within one
      // async flow (user message + streamed response) both see all messages.
      if (currentChat?.id === targetId) {
        chatRef.current = updatedChat;
        setChat(updatedChat);
      }

      // Patch the chat list locally instead of re-reading every chat with
      // all its messages from IndexedDB on every single message.
      setChats(prev => {
        const next = prev.map(c => (c.id === updatedChat.id ? updatedChat : c));
        return next.sort((a, b) => b.updatedAt - a.updatedAt);
      });
    } catch (error) {
      logError('Failed to add message:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }, []);

  const deleteChat = useCallback(async (id: string) => {
    try {
      if (typeof id !== 'string' || id.trim().length === 0) {
        throw new Error('Invalid chat ID');
      }

      await ChatStorage.deleteChat(id);
      if (chat?.id === id) {
        setChat(null);
      }
      await loadChats();
    } catch (error) {
      logError('Failed to delete chat:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }, [chat, loadChats]);

  const renameChat = useCallback(async (id: string, newTitle: string) => {
    try {
      if (typeof id !== 'string' || id.trim().length === 0) {
        throw new Error('Invalid chat ID');
      }

      if (typeof newTitle !== 'string' || newTitle.trim().length === 0) {
        throw new Error('Title must be a non-empty string');
      }

      // Single-transaction update (see updateChatMetadata): a get/put pair
      // across two transactions could lose messages written in between.
      await ChatStorage.updateChatMetadata(id, { title: newTitle });
      if (chat?.id === id) {
        const refreshed = await ChatStorage.getChat(id);
        if (refreshed) {
          setChat(refreshed);
        }
      }
      await loadChats();
    } catch (error) {
      logError('Failed to rename chat:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }, [chat, loadChats]);

  const createNewChat = useCallback(async (profileId: string, title?: string) => {
    try {
      if (typeof profileId !== 'string' || profileId.trim().length === 0) {
        throw new Error('Invalid profile ID');
      }

      const newChat = ChatStorage.createChat(profileId, title);
      await ChatStorage.saveChat(newChat);
      setChat(newChat);
      await loadChats();
      return newChat;
    } catch (error) {
      logError('Failed to create new chat:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }, [loadChats]);

  const moveChatToFolder = useCallback(async (id: string, folderId: string | null) => {
    try {
      if (typeof id !== 'string' || id.trim().length === 0) {
        throw new Error('Invalid chat ID');
      }

      // Single-transaction update (see updateChatMetadata): a get/put pair
      // across two transactions could lose messages written in between.
      await ChatStorage.updateChatMetadata(id, { folderId });
      if (chat?.id === id) {
        const refreshed = await ChatStorage.getChat(id);
        if (refreshed) {
          setChat(refreshed);
        }
      }
      await loadChats();
    } catch (error) {
      logError('Failed to move chat to folder:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }, [chat, loadChats]);

  return {
    chat,
    chats,
    loading,
    loadChats,
    loadChat,
    addMessage,
    deleteChat,
    renameChat,
    createNewChat,
    moveChatToFolder,
  };
};