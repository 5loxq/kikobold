import React from 'react';
import { useTranslation } from 'react-i18next';
import { Chat, MemoryEntry } from '../../types';
import type { LibraryFile } from '../../services/storage/LibraryStorage';
import * as ChatExport from '../../services/storage/chat-export-import';

interface ChatExportImportProps {
  chat: Chat | null;
  memories: MemoryEntry[];
  library: LibraryFile[];
}

export const ChatExportImport: React.FC<ChatExportImportProps> = ({
  chat,
  memories,
  library,
}) => {
  const { t } = useTranslation();
  const [shareStatus, setShareStatus] = React.useState<string | null>(null);

  const handleExportCurrentChat = (): void => {
    if (!chat) {return;}
    // Export as JSON (same format as the full backup on the data page) so
    // the file can be re-imported later. Markdown output is available via
    // the share button.
    ChatExport.exportChats([chat], memories, library);
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
    </div>
  );
};
