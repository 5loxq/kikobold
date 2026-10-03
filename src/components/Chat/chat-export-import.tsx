import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Chat } from '../../types';
import * as ChatExport from '../../services/storage/chat-export-import';

interface ChatExportImportProps {
  chat: Chat | null;
  allChats: Chat[];
  onImportChats: (chats: Chat[]) => Promise<void>;
}

export const ChatExportImport: React.FC<ChatExportImportProps> = ({
  chat,
  allChats,
  onImportChats,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importingStatus, setImportingStatus] = React.useState<string | null>(null);
  const [shareStatus, setShareStatus] = React.useState<string | null>(null);

  const handleExportCurrentChat = (): void => {
    if (!chat) {return;}
    ChatExport.exportChatAsMarkdown(chat);
  };

  const handleExportAllChats = (): void => {
    if (allChats.length === 0) {return;}
    ChatExport.exportChats(allChats);
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
      const importedChats = await ChatExport.importChats(file);
      await onImportChats(importedChats);
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
    <div className="flex gap-2">
      {/* Export Current Chat */}
      <button
        onClick={handleExportCurrentChat}
        disabled={!chat}
        title={chat ? t('chat.export') : t('chat.noChat')}
        className={`px-3 py-2 text-sm rounded font-medium transition-colors ${
          !chat
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-green-100 text-green-700 hover:bg-green-200'
        }`}
      >
        ⬇️ {t('chat.exportChat')}
      </button>

      {/* Export All Chats */}
      <button
        onClick={handleExportAllChats}
        disabled={allChats.length === 0}
        title={allChats.length > 0 ? t('chat.exportAll') : t('chat.noChats')}
        className={`px-3 py-2 text-sm rounded font-medium transition-colors ${
          allChats.length === 0
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
        }`}
      >
        ⬇️ {t('chat.exportAll')}
      </button>

      {/* Share Current Chat as Markdown */}
      <button
        onClick={() => void handleShareCurrentChat()}
        disabled={!chat || shareStatus === 'sharing'}
        title={chat ? t('chat.share') : t('chat.noChat')}
        className={`px-3 py-2 text-sm rounded font-medium transition-colors ${
          !chat || shareStatus === 'sharing'
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
        }`}
      >
        {shareStatus === 'success' ? '✅' : '🔗'} {shareStatus === 'success' ? t('chat.shareSuccess') : t('chat.share')}
      </button>

      {/* Import Chats */}
      <button
        onClick={handleImportClick}
        className="px-3 py-2 text-sm rounded font-medium transition-colors bg-purple-100 text-purple-700 hover:bg-purple-200"
      >
        ⬆️ {t('chat.import')}
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
              ? 'bg-amber-50 text-amber-600'
              : 'bg-red-50 text-red-600'
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
              ? 'bg-blue-50 text-blue-600'
              : importingStatus === 'success'
              ? 'bg-green-50 text-green-600'
              : 'bg-red-50 text-red-600'
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
