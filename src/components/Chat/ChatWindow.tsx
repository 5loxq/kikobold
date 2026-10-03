import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chat, LocalModel, Profile } from '../../types';
import { MessageList } from './MessageList';
import { InputBox } from './InputBox';
import { ChatExportImport } from './chat-export-import';
import { MODELS } from '../../services/models/model-registry';
import { isDarkMode as checkDarkMode } from '../../services/theme';

interface ChatWindowProps {
  chat: Chat | null;
  chats: Chat[];
  activeProfile: Profile | null;
  profiles: Profile[];
  activeModel: LocalModel | null;
  isLoading: boolean;
  isModelLoaded: boolean;
  error: string | null;
  webgpuAvailable: boolean | null;
  loadingProgress?: number;
  isModelDownloaded?: (modelId: string) => boolean;
  isGenerating?: boolean;
  onStopGeneration?: () => void;
  onSendMessage: (message: string) => void;
  onSendMessageWithDocuments?: (message: string, attachments: import('../../services/attachments').DocumentAttachment[]) => void;
  onSelectModel: (modelId: string) => void;
  onSelectProfile?: (profileId: string) => void;
  onRenameChat?: (chatId: string, newTitle: string) => void;
  onImportChats?: (chats: Chat[]) => Promise<void>;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  chat,
  chats,
  activeProfile,
  profiles,
  activeModel: _activeModel,
  isLoading,
  isModelLoaded,
  error,
  webgpuAvailable,
  loadingProgress = 0,
  isModelDownloaded,
  isGenerating = false,
  onStopGeneration,
  onSendMessage,
  onSendMessageWithDocuments,
  onSelectModel,
  onSelectProfile,
  onRenameChat,
  onImportChats,
}) => {
  const { t } = useTranslation();
  const [selectedModelId, setSelectedModelId] = useState<string>(_activeModel?.id ?? '');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleMessages = React.useMemo(
    () =>
      normalizedSearch
        ? chat?.messages.filter((m) => m.content.toLowerCase().includes(normalizedSearch)) ?? []
        : chat?.messages ?? [],
    [chat?.messages, normalizedSearch]
  );

  const scrollToBottom = (): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chat?.messages]);

  useEffect(() => {
    if (_activeModel?.id) {
      setSelectedModelId(_activeModel.id);
    }
  }, [_activeModel?.id]);

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          {webgpuAvailable === false && (
            <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700 font-bold">⚠️ {t('chat.webgpuNotSupported')}</p>
              <p className="text-red-600 text-sm mt-2">
                {t('chat.webgpuRequiredBrowsers')}
              </p>
            </div>
          )}
          <h2 className="text-2xl font-bold mb-4 text-gray-800">{t('chat.welcome')}</h2>
          <p className="text-gray-600 mb-8">
            {t('chat.step3')}
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-bold mb-2 text-gray-800">{t('chat.quickStart')}:</h3>
            <ol className="text-left text-gray-600 space-y-2">
              <li>{t('chat.step1')}</li>
              <li>{t('chat.step2')}</li>
              <li>{t('chat.step3')}</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* WebGPU Warning */}
      {webgpuAvailable === false && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border-b border-red-200 px-4 py-3 shadow-sm">
          <p className="text-red-700 text-sm font-medium flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            {t('chat.webgpuNotSupported')} - {t('chat.webgpuRequiredBrowsers')}
          </p>
        </div>
      )}
      {/* Header */}
      <div className="border-b border-gray-100 p-4 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            {isEditingTitle ? (
              <div className="flex gap-2 items-center mb-2">
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (editedTitle.trim() && onRenameChat) {
                        onRenameChat(chat.id, editedTitle.trim());
                        setIsEditingTitle(false);
                      }
                    } else if (e.key === 'Escape') {
                      setIsEditingTitle(false);
                    }
                  }}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (editedTitle.trim() && onRenameChat) {
                      onRenameChat(chat.id, editedTitle.trim());
                      setIsEditingTitle(false);
                    }
                  }}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                >
                  ✓
                </button>
                <button
                  onClick={() => setIsEditingTitle(false)}
                  className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-800">{chat.title}</h2>
                <button
                  onClick={() => {
                    setEditedTitle(chat.title);
                    setIsEditingTitle(true);
                  }}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                  title="Rename chat"
                >
                  ✏️
                </button>
              </div>
            )}
            {activeProfile && (
              <div className="flex items-center gap-2 mt-2">
                <label className="text-sm font-medium text-gray-600">{t('profiles.activeProfile')}:</label>
                <select
                  value={activeProfile.id}
                  onChange={(e) => onSelectProfile && onSelectProfile(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                >
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {error && (
            <div className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg shadow-sm border border-red-100">
              {error}
            </div>
          )}
        </div>

        {/* Model Selector */}
        <div className="flex gap-4 items-center flex-wrap mt-4">
          <label className="text-sm font-medium text-gray-700">{t('chat.selectModel')}:</label>
          <select
            value={selectedModelId}
            onChange={(e) => {
              setSelectedModelId(e.target.value);
              onSelectModel(e.target.value);
            }}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
          >
            <option value="">{t('chat.selectModel')}...</option>
            {MODELS.map((model) => {
              const isDownloaded = isModelDownloaded?.(model.id) ?? false;
              return (
                <option key={model.id} value={model.id}>
                  {isDownloaded ? '✅' : '📥'} {model.name} ({model.modelSize}){model.provider === 'gguf-hf' ? ' · WASM' : ' · WebGPU'}
                </option>
              );
            })}
          </select>

          {selectedModelId && (
            <>
              {isLoading && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-blue-600 font-medium">🌀 {t('chat.loading')}</span>
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-blue-500 transition-all duration-300"
                      style={{ width: `${loadingProgress}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-blue-600 font-medium">{loadingProgress}%</span>
                </div>
              )}
              {isModelLoaded && !isLoading && (
                <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                  ✅ {t('chat.modelLoaded')}
                </span>
              )}
              {error && !isLoading && (
                <span className="text-sm text-red-600 font-medium flex items-center gap-1">
                  ❌ {error}
                </span>
              )}
            </>
          )}
        </div>

        {/* Search in chat */}
        {isSearchOpen && (
          <div className="flex items-center gap-2 mt-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('chat.searchPlaceholder')}
              autoFocus
              className="flex-1 max-w-sm px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
            />
            <span className="text-xs text-gray-500">
              {normalizedSearch ? `${visibleMessages.length}` : ''}
            </span>
            <button
              onClick={() => { setSearchQuery(''); setIsSearchOpen(false); }}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              title={t('chat.searchClose')}
            >
              ✕
            </button>
          </div>
        )}
        {/* Export/Import Section */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <ChatExportImport
            chat={chat}
            allChats={chats}
            onImportChats={onImportChats ?? (async (): Promise<void> => {})}
          />
          <button
            onClick={() => setIsSearchOpen((v) => !v)}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors text-sm flex items-center gap-1"
            title={t('chat.searchInChat')}
          >
            🔍 {t('chat.searchInChat')}
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <MessageList messages={visibleMessages} isLoading={isLoading} messagesEndRef={messagesEndRef} isDarkMode={checkDarkMode()} searchQuery={searchQuery} />

      {/* Input Area */}
      <InputBox
        onSendMessage={onSendMessage}
        onSendMessageWithDocuments={onSendMessageWithDocuments}
        isLoading={isLoading}
        isModelLoaded={isModelLoaded}
        isGenerating={isGenerating}
        onStopGeneration={onStopGeneration}
      />
    </div>
  );
};
