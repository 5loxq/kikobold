import { useState, useCallback, useEffect } from 'react';
import { Chat, Message, UseChatReturn } from '../types';
import * as ChatStorage from '../services/storage/ChatStorage';


export const useChat = (): UseChatReturn => {
  const [chat, setChat] = useState<Chat | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);

  const loadChats = useCallback(async () => {
    try {
      const allChats = await ChatStorage.getAllChats();
      if (Array.isArray(allChats)) {
        setChats(allChats.sort((a, b) => b.updatedAt - a.updatedAt));
      }
    } catch (error) {
      console.error('Failed to load chats:', error instanceof Error ? error : new Error(String(error)));
    }
  }, []);

  useEffect(() => {
    const initDB = async () => {
      try {
        await ChatStorage.initChatDB();
        await loadChats();
      } catch (error) {
        console.error('Failed to initialize chat database:', error instanceof Error ? error : new Error(String(error)));
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
      console.error('Failed to load chat:', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLoading(false);
    }
  }, []);

  const addMessage = useCallback(async (role: 'user' | 'assistant', content: string) => {
    try {
      if (!chat) {
        throw new Error('No active chat');
      }

      if (role !== 'user' && role !== 'assistant') {
        throw new Error('Invalid message role');
      }

      if (typeof content !== 'string' || content.trim().length === 0) {
        throw new Error('Message content must be a non-empty string');
      }

      const newMessage: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role,
        content,
        timestamp: Date.now(),
      };

      // Use functional state update to avoid stale closure issues
      setChat(prevChat => {
        if (!prevChat) return prevChat;
        const updatedMessages = [...prevChat.messages, newMessage];
        // Save to storage asynchronously
        ChatStorage.updateChatMessages(prevChat.id, updatedMessages);
        return {
          ...prevChat,
          messages: updatedMessages,
          updatedAt: Date.now(),
        };
      });

      await loadChats();
    } catch (error) {
      console.error('Failed to add message:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }, [chat, loadChats]);

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
      console.error('Failed to delete chat:', error instanceof Error ? error : new Error(String(error)));
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

      const chatToUpdate = await ChatStorage.getChat(id);
      if (chatToUpdate) {
        chatToUpdate.title = newTitle;
        chatToUpdate.updatedAt = Date.now();
        await ChatStorage.saveChat(chatToUpdate);
        if (chat?.id === id) {
          setChat(chatToUpdate);
        }
        await loadChats();
      }
    } catch (error) {
      console.error('Failed to rename chat:', error instanceof Error ? error : new Error(String(error)));
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
      console.error('Failed to create new chat:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }, [loadChats]);

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
  };
};