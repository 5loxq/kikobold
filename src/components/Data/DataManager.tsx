import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chat, LocalModel, MemoryEntry } from '../../types';
import type { LibraryFile } from '../../services/storage/LibraryStorage';
import { formatBytes } from '../../services/attachments';

interface DataManagerProps {
  chats: Chat[];
  memories: MemoryEntry[];
  libraryFiles: LibraryFile[];
  downloadedModels: LocalModel[];
  onExportAll: () => void;
  onImportBackup: (file: File) => Promise<void>;
  onDeleteAll: () => Promise<void>;
}

interface StorageEstimate {
  usage: number;
  quota: number;
}

export const DataManager: React.FC<DataManagerProps> = ({
  chats,
  memories,
  libraryFiles,
  downloadedModels,
  onExportAll,
  onImportBackup,
  onDeleteAll,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [storageEstimate, setStorageEstimate] = useState<StorageEstimate | null>(null);

  useEffect(() => {
    // Best-effort storage usage display (not supported in all browsers)
    navigator.storage?.estimate?.().then((estimate) => {
      setStorageEstimate({ usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 });
    }).catch(() => {
      // Ignore - the overview just shows no storage numbers then
    });
  }, []);

  const messageCount = chats.reduce((sum, chat) => sum + chat.messages.length, 0);

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) {return;}
    try {
      setImportStatus('importing');
      await onImportBackup(file);
      setImportStatus('success');
      window.setTimeout(() => setImportStatus(null), 3000);
    } catch (err) {
      setImportStatus(`error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      window.setTimeout(() => setImportStatus(null), 5000);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteAll = (): void => {
    const first = window.confirm(t('data.deleteAllConfirm'));
    if (!first) {return;}
    const second = window.confirm(t('data.deleteAllConfirm2'));
    if (!second) {return;}
    void onDeleteAll().catch((err) => {
      console.error('Failed to delete all data:', err);
    });
  };

  const overview = [
    { icon: '💬', label: t('sidebar.chat'), value: t('data.chatsCount', { count: chats.length, messages: messageCount }) },
    { icon: '🧠', label: t('sidebar.memory'), value: t('data.memoriesCount', { count: memories.length }) },
    { icon: '📚', label: t('sidebar.library'), value: t('data.filesCount', { count: libraryFiles.length }) },
    { icon: '📥', label: t('settings.downloadedModels'), value: t('data.modelsCount', { count: downloadedModels.length, size: formatBytes(downloadedModels.reduce((sum, m) => sum + m.size, 0)) }) },
  ];

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 sm:p-8 max-w-3xl mx-auto" data-tour="data-page">
        <h2 className="text-2xl font-bold mb-2 text-zinc-800 dark:text-zinc-100">
          💾 {t('data.title')}
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
          {t('data.introText')}
        </p>

        {/* Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {overview.map((item) => (
            <div
              key={item.label}
              className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800"
            >
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                {item.icon} {item.label}
              </p>
              <p className="text-sm text-zinc-700 dark:text-zinc-200">{item.value}</p>
            </div>
          ))}
        </div>
        {storageEstimate && storageEstimate.quota > 0 && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 -mt-3 mb-6">
            {t('data.storageUsage', {
              used: formatBytes(storageEstimate.usage),
              total: formatBytes(storageEstimate.quota),
            })}
          </p>
        )}

        {/* Backup */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h3 className="font-bold text-lg mb-2 text-zinc-800 dark:text-zinc-100">
            {t('data.backupTitle')}
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
            {t('data.backupText')}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onExportAll}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:opacity-90 transition-opacity"
            >
              ⬇️ {t('data.exportAll')}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 text-sm rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              ⬆️ {t('data.importBackup')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={(e) => void handleFileSelected(e)}
              style={{ display: 'none' }}
            />
          </div>
          {importStatus && (
            <div
              className={`mt-3 text-sm px-3 py-2 rounded-xl ${
                importStatus === 'importing'
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                  : importStatus === 'success'
                  ? 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400'
                  : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
              }`}
            >
              {importStatus === 'importing'
                ? t('chat.importing')
                : importStatus === 'success'
                ? t('data.importSuccess')
                : importStatus}
            </div>
          )}
        </section>

        {/* Danger zone */}
        <section className="rounded-2xl p-6 shadow-sm border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20">
          <h3 className="font-bold text-lg mb-2 text-red-700 dark:text-red-400">
            {t('data.dangerTitle')}
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
            {t('data.dangerText')}
          </p>
          <button
            onClick={handleDeleteAll}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-red-600 text-white hover:bg-red-500 transition-colors"
          >
            🗑️ {t('data.deleteAll')}
          </button>
        </section>
      </div>
    </div>
  );
};
