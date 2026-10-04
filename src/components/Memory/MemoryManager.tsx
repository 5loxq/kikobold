import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MemoryEntry } from '../../types';
import { MEMORY_ENTRY_MAX_CHARS, MEMORY_TOTAL_MAX_CHARS, totalMemoryChars } from '../../services/storage/MemoryStorage';

interface MemoryManagerProps {
  memories: MemoryEntry[];
  onAddMemory: (content: string) => Promise<void>;
  onUpdateMemory: (entry: MemoryEntry) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
}

export const MemoryManager: React.FC<MemoryManagerProps> = ({
  memories,
  onAddMemory,
  onUpdateMemory,
  onDeleteMemory,
}) => {
  const { t } = useTranslation();
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const totalChars = totalMemoryChars(memories);
  const totalLimitReached = totalChars >= MEMORY_TOTAL_MAX_CHARS;

  const handleAdd = async (): Promise<void> => {
    const content = newContent.trim();
    if (!content) {
      setError(t('memory.errorEmpty'));
      return;
    }
    try {
      await onAddMemory(content);
      setNewContent('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const handleSaveEdit = async (entry: MemoryEntry): Promise<void> => {
    const content = editContent.trim();
    if (!content) {
      setError(t('memory.errorEmpty'));
      return;
    }
    try {
      await onUpdateMemory({ ...entry, content });
      setEditingId(null);
      setEditContent('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 sm:p-8 max-w-3xl mx-auto" data-tour="memory-page">
        <h2 className="text-2xl font-bold mb-2 text-zinc-800 dark:text-zinc-100">
          🧠 {t('memory.title')}
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
          {t('memory.introText')}
        </p>

        {/* Add form */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <label htmlFor="memory-new" className="block text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-2">
            {t('memory.newEntry')}
          </label>
          <textarea
            id="memory-new"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value.slice(0, MEMORY_ENTRY_MAX_CHARS))}
            placeholder={t('memory.placeholder')}
            rows={3}
            className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
              {newContent.length}/{MEMORY_ENTRY_MAX_CHARS}
              {totalLimitReached && ` · ${t('memory.totalLimitReached')}`}
            </span>
            <button
              onClick={() => void handleAdd()}
              disabled={!newContent.trim() || totalLimitReached}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + {t('memory.add')}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-sm px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60">
            {error}
          </div>
        )}

        {/* Entry list */}
        {memories.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 text-center">
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">{t('memory.empty')}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {memories.map((entry) => (
              <li
                key={entry.id}
                className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800"
              >
                {editingId === entry.id ? (
                  <div>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value.slice(0, MEMORY_ENTRY_MAX_CHARS))}
                      rows={3}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                    />
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                        {editContent.length}/{MEMORY_ENTRY_MAX_CHARS}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditContent('');
                            setError(null);
                          }}
                          className="px-3 py-1.5 text-sm rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          onClick={() => void handleSaveEdit(entry)}
                          className="px-3 py-1.5 text-sm rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
                        >
                          {t('memory.save')}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <p className="flex-1 text-sm text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap break-words">
                      {entry.content}
                    </p>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => {
                          setEditingId(entry.id);
                          setEditContent(entry.content);
                        }}
                        className="p-2 text-sm rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                        aria-label={t('common.edit')}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => void onDeleteMemory(entry.id)}
                        className="p-2 text-sm rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        aria-label={t('common.delete')}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Usage indicator */}
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          {t('memory.usage', { current: totalChars, max: MEMORY_TOTAL_MAX_CHARS })}
        </p>
      </div>
    </div>
  );
};
