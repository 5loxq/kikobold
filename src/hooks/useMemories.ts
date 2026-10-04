import { useCallback, useEffect, useState } from 'react';
import { MemoryEntry } from '../types';
import * as MemoryStorage from '../services/storage/MemoryStorage';
import { error as logError } from '../services/logging';


export const useMemories = (): {
  memories: MemoryEntry[];
  addMemory: (content: string) => Promise<void>;
  setMemoryField: (fieldKey: string, content: string) => Promise<void>;
  updateMemory: (entry: MemoryEntry) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  clearAllMemories: () => Promise<void>;
  importMemories: (entries: MemoryEntry[]) => Promise<void>;
} => {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);

  useEffect(() => {
    MemoryStorage.getAllMemories().then(setMemories).catch((err) => {
      logError('Failed to load memories:', err);
    });
  }, []);

  const addMemory = useCallback(async (content: string): Promise<void> => {
    const entry = MemoryStorage.createMemoryEntry(content);
    await MemoryStorage.saveMemory(entry);
    setMemories((prev) => [...prev, entry]);
  }, []);

  /** Set (or clear, when content is empty) one of the predefined fields */
  const setMemoryField = useCallback(async (fieldKey: string, content: string): Promise<void> => {
    const entryId = MemoryStorage.memoryFieldEntryId(fieldKey);
    const trimmed = content.trim();
    if (!trimmed) {
      await MemoryStorage.deleteMemory(entryId);
      setMemories((prev) => prev.filter((m) => m.id !== entryId));
      return;
    }
    const entry = MemoryStorage.createMemoryEntry(trimmed, fieldKey);
    await MemoryStorage.saveMemory(entry);
    setMemories((prev) => [...prev.filter((m) => m.id !== entryId), entry]);
  }, []);

  const updateMemory = useCallback(async (entry: MemoryEntry): Promise<void> => {
    const updated = { ...entry, updatedAt: Date.now() };
    await MemoryStorage.saveMemory(updated);
    setMemories((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }, []);

  const deleteMemory = useCallback(async (id: string): Promise<void> => {
    await MemoryStorage.deleteMemory(id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }, []);

  /** Delete all memory entries (data page: "delete everything") */
  const clearAllMemories = useCallback(async (): Promise<void> => {
    await MemoryStorage.clearAllMemories();
    setMemories([]);
  }, []);

  const importMemories = useCallback(async (entries: MemoryEntry[]): Promise<void> => {
    for (const entry of entries) {
      await MemoryStorage.saveMemory(entry);
    }
    const all = await MemoryStorage.getAllMemories();
    setMemories(all);
  }, []);

  return {
    memories,
    addMemory,
    setMemoryField,
    updateMemory,
    deleteMemory,
    clearAllMemories,
    importMemories,
  };
};
