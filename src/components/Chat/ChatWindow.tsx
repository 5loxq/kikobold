import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chat, LocalModel, MemoryEntry, Profile } from '../../types';
import { MessageList } from './MessageList';
import { InputBox } from './InputBox';
import { ChatExportImport } from './chat-export-import';
import { getModelConfig, MODELS } from '../../services/models/model-registry';
import { supportsWllamaJspi } from '../../services/inference/wllama-engine';


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
  /** Download size/speed while a model is being fetched */
  loadStats?: { loadedMB: number; totalMB: number; speedMBps: number } | null;
  darkMode?: boolean;
  isModelDownloaded?: (modelId: string) => boolean;
  isGenerating?: boolean;
  streamingMessage?: string | null;
  onStopGeneration?: () => void;
  onSendMessage: (message: string) => void;
  onSendMessageWithDocuments?: (message: string, attachments: import('../../services/attachments').DocumentAttachment[]) => void;
  supportsImageInput?: boolean;
  onSendMessageWithImages?: (message: string, images: import('../../services/attachments').ImageAttachment[]) => void;
  onSelectModel: (modelId: string) => void;
  onSelectProfile?: (profileId: string) => void;
  onRenameChat?: (chatId: string, newTitle: string) => void;
  onImportChats?: (chats: Chat[], memories: MemoryEntry[]) => Promise<void>;
  memories?: MemoryEntry[];
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
  darkMode = false,
  loadStats = null,
  isModelDownloaded,
  isGenerating = false,
  streamingMessage = null,
  onStopGeneration,
  onSendMessage,
  onSendMessageWithDocuments,
  supportsImageInput = false,
  onSendMessageWithImages,
  onSelectModel,
  onSelectProfile,
  onRenameChat,
  onImportChats,
  memories = [],
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
  }, [chat?.messages, streamingMessage]);

  useEffect(() => {
    if (_activeModel?.id) {
      setSelectedModelId(_activeModel.id);
    }
  }, [_activeModel?.id]);

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-zinc-50 dark:bg-zinc-900">
        <div className="text-center max-w-md">
          {webgpuAvailable === false && (
            <div className="mb-8 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl p-4">
              <p className="text-amber-700 dark:text-amber-400 font-semibold">⚠️ {t('chat.webgpuNotSupported')}</p>
              <p className="text-amber-600 dark:text-amber-500 text-sm mt-2">
                {t('chat.webgpuRequiredBrowsers')}
              </p>
            </div>
          )}
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-2xl shadow-xl shadow-indigo-500/25">
            💬
          </div>
          <h2 className="text-3xl font-bold mb-3 text-zinc-800 dark:text-zinc-100">{t('chat.welcome')}</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-8">
            {t('chat.step3')}
          </p>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-left shadow-sm">
            <h3 className="font-semibold mb-3 text-zinc-800 dark:text-zinc-100">{t('chat.quickStart')}:</h3>
            <ol className="text-zinc-600 dark:text-zinc-400 space-y-2 list-decimal list-inside">
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
    <div className="flex-1 flex flex-col bg-zinc-50 dark:bg-zinc-900 min-h-0">
      {/* WebGPU Warning */}
      {webgpuAvailable === false && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 px-4 py-3">
          <p className="text-amber-700 dark:text-amber-400 text-sm font-medium flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            {t('chat.webgpuNotSupported')} - {t('chat.webgpuRequiredBrowsers')}
          </p>
        </div>
      )}
      {/* Header */}
      <div className="border-b border-zinc-200/80 dark:border-zinc-800/80 px-4 py-3 bg-white/70 dark:bg-zinc-950/60 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1 min-w-0">
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
                  className="flex-1 px-4 py-2 border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 rounded-xl text-lg font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white shadow-sm"
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (editedTitle.trim() && onRenameChat) {
                      onRenameChat(chat.id, editedTitle.trim());
                      setIsEditingTitle(false);
                    }
                  }}
                  className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/40 rounded-lg transition-colors"
                >
                  ✓
                </button>
                <button
                  onClick={() => setIsEditingTitle(false)}
                  className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 truncate">{chat.title}</h2>
                <button
                  onClick={() => {
                    setEditedTitle(chat.title);
                    setIsEditingTitle(true);
                  }}
                  className="p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-sm"
                  title="Rename chat"
                >
                  ✏️
                </button>
              </div>
            )}
            {activeProfile && (
              <div className="flex items-center gap-2 mt-2">
                <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{t('profiles.activeProfile')}:</label>
                <select
                  value={activeProfile.id}
                  onChange={(e) => onSelectProfile && onSelectProfile(e.target.value)}
                  data-tour="profile-select"
                  className="max-w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/40 px-4 py-2 rounded-xl border border-red-100 dark:border-red-900 max-w-sm">
              {error}
            </div>
          )}
        </div>

        {/* Model Selector */}
        <div className="flex gap-3 items-center flex-wrap mt-3">
          <select
            value={selectedModelId}
            onChange={(e) => {
              setSelectedModelId(e.target.value);
              onSelectModel(e.target.value);
            }}
            disabled={isLoading}
            data-tour="model-select"
            className="w-full sm:w-auto px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 shadow-sm"
          >
            <option value="">{t('chat.selectModel')}...</option>
            {MODELS.map((model) => {
              const isDownloaded = isModelDownloaded?.(model.id) ?? false;
              return (
                <option key={model.id} value={model.id}>
                  {isDownloaded ? '✅' : '📥'} {model.name} · {Math.round(model.fileSizeMB ?? 0)} MB{model.provider === 'gguf-hf' ? ' · läuft überall' : ' · WebGPU'}
                </option>
              );
            })}
          </select>

          {selectedModelId && getModelConfig(selectedModelId)?.description && !isLoading && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md leading-relaxed">
              {getModelConfig(selectedModelId)?.description}
            </p>
          )}

          {selectedModelId && getModelConfig(selectedModelId)?.engine === 'wllama' && !supportsWllamaJspi() && !isLoading && (
            <p className="text-xs text-amber-600 dark:text-amber-400 max-w-md leading-relaxed">
              ⚠️ {t('chat.jspiHint')}
            </p>
          )}

          {selectedModelId && (
            <>
              {isLoading && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">🌀 {t('chat.loading')}</span>
                  <div className="w-32 h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
                      style={{ width: `${Math.max(2, loadingProgress)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium tabular-nums">
                    {loadStats
                      ? t('chat.downloadStats', {
                          loaded: Math.round(loadStats.loadedMB),
                          total: Math.round(loadStats.totalMB),
                          speed: loadStats.speedMBps.toFixed(1),
                        })
                      : `${Math.round(loadingProgress)}%`}
                  </span>
                </div>
              )}
              {isModelLoaded && !isLoading && (
                <span className="text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                  ✅ {t('chat.modelLoaded')}
                </span>
              )}
              {error && !isLoading && (
                <span className="text-sm text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                  ❌ {error}
                </span>
              )}
            </>
          )}
        </div>

        {/* Search in chat */}
        {isSearchOpen && (
          <div className="flex items-center gap-2 mt-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('chat.searchPlaceholder')}
              autoFocus
              className="flex-1 max-w-sm px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 shadow-sm"
            />
            <span className="text-xs text-zinc-500 dark:text-zinc-500">
              {normalizedSearch ? `${visibleMessages.length}` : ''}
            </span>
            <button
              onClick={() => { setSearchQuery(''); setIsSearchOpen(false); }}
              className="p-2 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              title={t('chat.searchClose')}
            >
              ✕
            </button>
          </div>
        )}
        {/* Export/Import Section */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/60">
          <ChatExportImport
            chat={chat}
            allChats={chats}
            memories={memories}
            onImportChats={onImportChats ?? (async (): Promise<void> => {})}
          />
          <button
            onClick={() => setIsSearchOpen((v) => !v)}
            data-tour="search"
            className="p-2 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-sm flex items-center gap-1"
            title={t('chat.searchInChat')}
          >
            🔍 <span className="hidden sm:inline">{t('chat.searchInChat')}</span>
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <MessageList
        messages={visibleMessages}
        isLoading={isGenerating}
        isModelLoading={isLoading}
        streamingMessage={streamingMessage}
        messagesEndRef={messagesEndRef}
        isDarkMode={darkMode}
        searchQuery={searchQuery}
      />

      {/* Input Area */}
      <InputBox
        onSendMessage={onSendMessage}
        onSendMessageWithDocuments={onSendMessageWithDocuments}
        supportsImageInput={supportsImageInput}
        onSendMessageWithImages={onSendMessageWithImages}
        isLoading={isLoading}
        isModelLoaded={isModelLoaded}
        isGenerating={isGenerating}
        onStopGeneration={onStopGeneration}
      />
    </div>
  );
};
