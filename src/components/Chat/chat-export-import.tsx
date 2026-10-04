import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Chat, MemoryEntry } from '../../types';
import type { LibraryFile } from '../../services/storage/LibraryStorage';
import * as ChatExport from '../../services/storage/chat-export-import';

interface ChatExportImportProps {
  chat: Chat | null;
  allChats: Chat[];
  memories: MemoryEntry[];
  library: LibraryFile[];
  onImportChats: (chats: Chat[], memories: MemoryEntry[], library: LibraryFile[]) => Promise<void>;
}

export const ChatExportImport: React.FC<ChatExportImportProps> = ({
  chat,
  allChats,
  memories,
  library,
  onImportChats,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importingStatus, setImportingStatus] = React.useState<string | null>(null);
  const [shareStatus, setShareStatus] = React.useState<string | null>(null);

  const handleExportCurrentChat = (): void => {
    if (!chat) {return;}
    // Export as JSON (same format as "export all") so the file can be
    // re-imported later. Markdown output is available via the share button.
    ChatExport.exportChats([chat], memories, library);
  };

  const handleExportAllChats = (): void => {
    if (allChats.length === 0) {return;}
    ChatExport.exportChats(allChats, memories, library);
  };

  const handleShareCurrentChat = async (): Promise<void> => {
    if (!chat) {return;}
    try {
      setShareStatus('sharing');
      await ChatExport.shareChatToClipboard(chat);
      setShareStatus('success');
      setTimeout(() => setShareStatus(null), 3000);
    } catch (err) {
      setShareStatus(`error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTimeout(() => setShareStatus(null), 5000);
    }
  };

  const handleImportClick = (): void => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) {return;}

    try {
      setImportingStatus('importing');
      const result = await ChatExport.importChats(file);
      await onImportChats(result.chats, result.memories, result.library);
      setImportingStatus('success');
      setTimeout(() => setImportingStatus(null), 3000);
    } catch (error) {
      setImportingStatus(
        `error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      setTimeout(() => setImportingStatus(null), 5000);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex gap-2" data-tour="export-import">
      {/* Export Current Chat */}
      <button
        onClick={handleExportCurrentChat}
        disabled={!chat}
        title={chat ? t('chat.export') : t('chat.noChat')}
        className={`px-2.5 sm:px-3 py-2 text-sm rounded font-medium transition-colors whitespace-nowrap ${
          !chat
            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
            : 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-950/70'
        }`}
      >
        ⬇️ <span className="hidden sm:inline">{t('chat.exportChat')}</span>
      </button>

      {/* Export All Chats */}
      <button
        onClick={handleExportAllChats}
        disabled={allChats.length === 0}
        title={allChats.length > 0 ? t('chat.exportAll') : t('chat.noChats')}
        className={`px-2.5 sm:px-3 py-2 text-sm rounded font-medium transition-colors whitespace-nowrap ${
          allChats.length === 0
            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
            : 'bg-blue-100 text-indigo-700 dark:text-indigo-300 hover:bg-blue-200'
        }`}
      >
        ⬇️ <span className="hidden sm:inline">{t('chat.exportAll')}</span>
      </button>

      {/* Share Current Chat as Markdown */}
      <button
        onClick={() => void handleShareCurrentChat()}
        disabled={!chat || shareStatus === 'sharing'}
        title={chat ? t('chat.share') : t('chat.noChat')}
        className={`px-2.5 sm:px-3 py-2 text-sm rounded font-medium transition-colors whitespace-nowrap ${
          !chat || shareStatus === 'sharing'
            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
            : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
        }`}
      >
        {shareStatus === 'success' ? '✅' : '🔗'}{' '}
        <span className="hidden sm:inline">
          {shareStatus === 'success' ? t('chat.shareSuccess') : t('chat.share')}
        </span>
      </button>

      {/* Import Chats */}
      <button
        onClick={handleImportClick}
        title={t('chat.import')}
        className="px-2.5 sm:px-3 py-2 text-sm rounded font-medium transition-colors bg-purple-100 text-purple-700 hover:bg-purple-200 whitespace-nowrap"
      >
        ⬆️ <span className="hidden sm:inline">{t('chat.import')}</span>
      </button>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileSelected}
        style={{ display: 'none' }}
      />

      {shareStatus && shareStatus !== 'success' && (
        <div
          className={`text-xs px-2 py-1 rounded ${
            shareStatus === 'sharing'
              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
              : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
          }`}
        >
          {shareStatus === 'sharing' ? t('chat.shareSharing') : shareStatus}
        </div>
      )}

      {/* Status Messages */}
      {importingStatus && (
        <div
          className={`text-xs px-2 py-1 rounded ${
            importingStatus === 'importing'
              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
              : importingStatus === 'success'
              ? 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
          }`}
        >
          {importingStatus === 'importing'
            ? t('chat.importing')
            : importingStatus === 'success'
            ? t('chat.importSuccess')
            : importingStatus}
        </div>
      )}
    </div>
  );
};
