import { FC, lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sidebar } from './Sidebar';
import { ChatWindow } from '../Chat/ChatWindow';
import { WelcomeScreen } from './WelcomeScreen';
const ProfileManager = lazy(() => import('../Profiles/ProfileManager').then(m => ({ default: m.ProfileManager })));
const HelpPage = lazy(() => import('../Help/HelpPage').then(m => ({ default: m.HelpPage })));
import { Chat } from '../../types';
import { useChat } from '../../hooks/useChat';
import { useModels } from '../../hooks/useModels';
import { useProfiles } from '../../hooks/useProfiles';
import { useEnhancedInference } from '../../hooks/useEnhancedInference';
import * as ChatStorage from '../../services/storage/ChatStorage';
import { isDarkMode as checkDarkMode, setThemeMode } from '../../services/theme';
import { error as logError } from '../../services/logging';
import { buildPromptWithDocuments, type DocumentAttachment, type ImageAttachment } from '../../services/attachments';


type ActiveTab = 'chat' | 'profiles' | 'settings' | 'help';

export const MainLayout: FC = () => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(checkDarkMode());
  const handleToggleTheme = (): void => {
    const next = !darkMode;
    setThemeMode(next ? 'dark' : 'light');
    setDarkMode(next);
  };
  const { chat, chats, loadChats, loadChat, createNewChat, deleteChat, addMessage, renameChat } = useChat();
  const { profiles, activeProfile, selectProfile, createProfile, updateProfile, deleteProfile, exportProfiles, importProfiles } = useProfiles();
  const { downloadedModels, activeModel, deleteModel: deleteDownloadedModel, selectModel, isModelDownloaded, getModelInfo } = useModels();
  const {
    loadModel,
    generateStream,
    streamText,
    cancel: stopGeneration,
    isGenerating,
    isLoading,
    webgpuAvailable,
    currentModelId,
    refreshStatus,
    error,
    supportsImageInput,
    progress: modelLoadProgress,
    progressStats: modelLoadStats,
  } = useEnhancedInference({ modelId: activeModel?.id ?? '', autoLoad: false });
  const [localError, setLocalError] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  // Model that is currently being downloaded/loaded (may differ from the
  // still-active model while a new one is being fetched)
  const [pendingModelId, setPendingModelId] = useState<string | null>(null);

  const isModelLoaded = currentModelId === activeModel?.id;

  // Remaining time for the current download, derived from size/speed stats
  const downloadEta = (stats: { loadedMB: number; totalMB: number; speedMBps: number } | null): string | null => {
    if (!stats || stats.speedMBps <= 0 || stats.totalMB <= stats.loadedMB) {
      return null;
    }
    const remainingSec = Math.max(0, (stats.totalMB - stats.loadedMB) / stats.speedMBps);
    const min = Math.floor(remainingSec / 60);
    const sec = Math.round(remainingSec % 60);
    return min > 0 ? `${min} min ${sec} s` : `${sec} s`;
  };

  // Refresh inference status when active model changes
  useEffect(() => {
    refreshStatus();
  }, [activeModel?.id, refreshStatus]);

  // Automatically reload a previously downloaded model on revisit (served
  // from the browser cache). New models always require an explicit download
  // confirmation via handleModelSelect.
  const autoLoadedModelRef = useRef<string | null>(null);
  useEffect(() => {
    const modelId = activeModel?.id;
    if (!modelId || isLoading || currentModelId === modelId || autoLoadedModelRef.current === modelId) {
      return;
    }
    if (!isModelDownloaded(modelId)) {
      return;
    }
    autoLoadedModelRef.current = modelId;
    setPendingModelId(modelId);
    loadModel(modelId).finally(() => setPendingModelId(null));
  }, [activeModel?.id, isLoading, currentModelId, isModelDownloaded, loadModel]);

  // Start directly in a fresh chat on first visit (or when the last chat was
  // deleted) so the model selector is immediately visible and usable.
  useEffect(() => {
    if (!chat && chats.length === 0 && activeProfile) {
      createNewChat(activeProfile.id).catch((err) => {
        logError('Failed to create initial chat:', err);
      });
    }
  }, [chat, chats.length, activeProfile, createNewChat]);

  // Chat DB initialization and loading is now handled in useChat hook

  const handleNewChat = async (): Promise<void> => {
    try {
      if (!activeProfile) {
        throw new Error('No active profile selected');
      }

      await createNewChat(activeProfile.id);
      setActiveTab('chat');
    } catch (err) {
      logError('Failed to create new chat:', err);
      // Show error to user
      setLocalError(err instanceof Error ? err.message : 'Failed to create new chat');
    }
  };

  const handleSelectChat = async (selectedChat: Chat): Promise<void> => {
    try {
      if (!selectedChat?.id) {
        throw new Error('Invalid chat selected');
      }

      await loadChat(selectedChat.id);
      setActiveTab('chat');
    } catch (err) {
      logError('Failed to select chat:', err);
      setLocalError(err instanceof Error ? err.message : 'Failed to select chat');
    }
  };

  const handleSendMessageWithDocuments = async (message: string, attachments: DocumentAttachment[]): Promise<void> => {
    await handleSendMessage(message, attachments);
  };

  const handleSendMessageWithImages = async (message: string, images: ImageAttachment[]): Promise<void> => {
    await handleSendMessage(message, undefined, images);
  };

  const handleSendMessage = async (message: string, attachments?: DocumentAttachment[], images?: ImageAttachment[]): Promise<void> => {
    try {
      if (!chat) {
        throw new Error('No active chat');
      }

      if (!activeProfile) {
        throw new Error('No active profile selected');
      }

      if (!activeModel) {
        throw new Error('No model selected');
      }

      if (typeof message !== 'string' || message.trim().length === 0) {
        throw new Error('Message cannot be empty');
      }

      // Auto-rename chat on first message if still "New Chat"
      if (chat.messages.length === 0 && chat.title === 'New Chat') {
        // Extract first meaningful words (remove common prefixes)
        const words = message.split(/\s+/).filter((word) => word.length > 0);
        const title = words.slice(0, 5).join(' ').substring(0, 50); // First 5 words, max 50 chars
        if (title) {
          await renameChat(chat.id, title);
        }
      }

      // Add user message
      await addMessage('user', message);

      // Generate response with language setting and correct system prompt
      // Note: WebLLM uses top_p and max_tokens (snake_case)
      const prompt = attachments && attachments.length > 0
        ? buildPromptWithDocuments(message, attachments)
        : message;
      const history = chat.messages.slice(-10).map((m) => ({
        role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: m.content,
      }));
      setStreamingMessage('start');
      const result = await generateStream(prompt, {
        temperature: activeProfile.temperature,
        top_p: activeProfile.topP,
        max_tokens: activeProfile.maxTokens,
        systemPrompt: activeProfile.systemPrompt,
        history,
        images,
      });

      if (result && result.trim().length > 0) {
        await addMessage('assistant', result);

        // Auto-speak the response
        speakResponse(result);
      }
    } catch (err) {
      logError('Failed to send message:', err);
      setLocalError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setStreamingMessage(null);
    }
  };

  const speakResponse = (text: string): void => {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    // Use current i18n language instead of hardcoded de-DE
    utterance.lang = i18n.language === 'de' ? 'de-DE' : 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    window.speechSynthesis.speak(utterance);
  };

  const handleModelSelect = async (modelId: string): Promise<void> => {
    try {
      // Clear previous errors
      setLocalError(null);

      // A model that has not been downloaded yet must be fetched from the
      // HuggingFace CDN first - ask the user before starting the download.
      if (!isModelDownloaded(modelId)) {
        const info = getModelInfo(modelId);
        const sizeMB = info?.fileSizeMB ? Math.round(info.fileSizeMB) : 0;
        const confirmed = window.confirm(
          t('chat.downloadConfirm', { name: info?.name ?? modelId, size: sizeMB })
        );
        if (!confirmed) {
          return;
        }
      }

      // Load the model via unified inference engine (real download with progress)
      setPendingModelId(modelId);
      const success = await loadModel(modelId);
      setPendingModelId(null);

      if (success) {
        // Select and register the model (will save to storage if not already saved)
        selectModel(modelId);
      }
    } catch (err) {
      setPendingModelId(null);
      logError('Model selection failed:', err);
      setLocalError(err instanceof Error ? err.message : 'Model selection failed');
    }
  };

  const handleImportChats = async (importedChats: Chat[]): Promise<void> => {
    // Import each chat into the database
    for (const importedChat of importedChats) {
      await ChatStorage.saveChat(importedChat);
    }
    // Reload chats to reflect the imported ones
    await loadChats();
    // Open the most recently updated imported chat so the result is visible
    const latest = [...importedChats].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (latest) {
      await loadChat(latest.id);
      setActiveTab('chat');
    }
  };

  const handleSelectProfile = (profileId: string): void => {
    const selectedProfile = profiles.find(p => p.id === profileId);
    if (selectedProfile) {
      selectProfile(selectedProfile);
    }
  };

  return (
    <div className="relative flex h-screen overflow-hidden bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900">
      {/* Subtle ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -left-24 w-96 h-96 rounded-full bg-indigo-400/10 dark:bg-indigo-600/10 blur-3xl"></div>
        <div className="absolute -bottom-40 -right-24 w-[28rem] h-[28rem] rounded-full bg-violet-400/10 dark:bg-violet-600/10 blur-3xl"></div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0 relative z-10">
        <Sidebar
          chats={chats}
          activeChat={chat}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onDeleteChat={deleteChat}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          darkMode={darkMode}
          onToggleTheme={handleToggleTheme}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm lg:hidden z-40"
          onClick={() => setShowMobileSidebar(false)}
        >
          <div
            className="fixed top-0 left-0 h-screen w-72 bg-zinc-950 shadow-2xl z-50 animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-800">
              <h1 className="text-lg font-semibold text-white">KI Kobold</h1>
              <button
                onClick={() => setShowMobileSidebar(false)}
                className="text-zinc-400 p-2 hover:bg-zinc-800 hover:text-white rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="text-white">
              <Sidebar
                chats={chats}
                activeChat={chat}
                onSelectChat={(selectedChat) => {
                  handleSelectChat(selectedChat);
                  setShowMobileSidebar(false);
                }}
                onNewChat={() => {
                  handleNewChat();
                  setShowMobileSidebar(false);
                }}
                onDeleteChat={deleteChat}
                activeTab={activeTab}
                onTabChange={(tab) => {
                  setActiveTab(tab);
                  setShowMobileSidebar(false);
                }}
                darkMode={darkMode}
                onToggleTheme={handleToggleTheme}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile Header */}
        <div className="lg:hidden bg-zinc-950 text-white px-4 py-3 flex items-center gap-3 border-b border-zinc-800">
          <button
            onClick={() => setShowMobileSidebar(true)}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            ☰
          </button>
          <h1 className="font-semibold flex-1">{t('sidebar.title')}</h1>
        </div>

        {/* Model Download Overlay - shows while a model is loading/downloading */}
        {isLoading && activeTab === 'chat' && (
          <div className="fixed inset-0 bg-zinc-950/20 dark:bg-black/40 flex items-center justify-center z-50 pointer-events-none backdrop-blur-[2px]">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-2xl max-w-md w-full mx-4 border border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                <div className="flex-1">
                  <h3 className="font-semibold text-zinc-800 dark:text-zinc-100">{t('chat.downloadingModel')}</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    {getModelInfo(pendingModelId ?? activeModel?.id ?? '')?.name
                      ?? activeModel?.name
                      ?? t('chat.processingRequest')}
                  </p>
                  <div className="mt-3 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-violet-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(2, Math.round(modelLoadProgress))}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1.5 tabular-nums">
                    {Math.round(modelLoadProgress)}%
                    {modelLoadStats
                      ? ` · ${t('chat.downloadStats', {
                          loaded: Math.round(modelLoadStats.loadedMB),
                          total: Math.round(modelLoadStats.totalMB),
                          speed: modelLoadStats.speedMBps.toFixed(1),
                        })}`
                      : ''}
                  </p>
                  {(() => {
                    const eta = downloadEta(modelLoadStats);
                    return eta ? (
                      <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-0.5">
                        {t('chat.downloadEta', { time: eta })}
                      </p>
                    ) : null;
                  })()}
                  <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-2 leading-relaxed">
                    {t('chat.downloadLocalNote')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'chat' && (
          <ChatWindow
            chat={chat}
            chats={chats}
            activeProfile={activeProfile}
            profiles={profiles}
            activeModel={activeModel}
            isLoading={isLoading}
            isModelLoaded={isModelLoaded}
            error={localError ?? error}
            webgpuAvailable={webgpuAvailable}
            loadingProgress={modelLoadProgress}
            loadStats={modelLoadStats}
            darkMode={darkMode}
            isModelDownloaded={isModelDownloaded}
            isGenerating={isGenerating}
            streamingMessage={streamingMessage ? streamText : null}
            onStopGeneration={stopGeneration}
            onSendMessage={handleSendMessage}
            onSendMessageWithDocuments={handleSendMessageWithDocuments}
            supportsImageInput={supportsImageInput}
            onSendMessageWithImages={handleSendMessageWithImages}
            onSelectModel={handleModelSelect}
            onSelectProfile={handleSelectProfile}
            onRenameChat={renameChat}
            onImportChats={handleImportChats}
          />
        )}

        {activeTab === 'profiles' && (
          <Suspense fallback={<div className='flex-1 p-8 text-gray-400'>{t('common.loading')}</div>}>
          <ProfileManager
            profiles={profiles}
            activeProfile={activeProfile}
            onSelectProfile={selectProfile}
            onCreateProfile={createProfile}
            onUpdateProfile={updateProfile}
            onDeleteProfile={deleteProfile}
            onExportProfiles={exportProfiles}
            onImportProfiles={importProfiles}
          />
          </Suspense>
        )}

        {activeTab === 'settings' && (
          <div className="flex-1 p-8 overflow-auto">
            <h2 className="text-2xl font-bold mb-6 text-zinc-800 dark:text-zinc-100">{t('settings.title')}</h2>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 max-w-2xl">
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-lg mb-2 text-zinc-800 dark:text-zinc-100">{t('settings.storage')}</h3>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    {t('settings.downloadedModels')}: {downloadedModels.length}
                  </p>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    {t('settings.totalSize')}: {(downloadedModels.reduce((sum, m) => sum + m.size, 0) / (1024 * 1024 * 1024)).toFixed(2)} GB
                  </p>
                  {downloadedModels.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {downloadedModels.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700"
                        >
                          <span className="text-sm text-zinc-700 dark:text-zinc-200 truncate">
                            {m.name} · {(m.size / (1024 * 1024 * 1024)).toFixed(2)} GB
                          </span>
                          <button
                            onClick={() => deleteDownloadedModel(m.id)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/70 transition-colors whitespace-nowrap"
                          >
                            {t('models.delete')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-2 text-zinc-800 dark:text-zinc-100">{t('settings.about')}</h3>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    KI Kobold v2.0.0
                  </p>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    {t('settings.description')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'help' && (
          <Suspense fallback={<div className='flex-1 p-8 text-gray-400'>{t('common.loading')}</div>}>
            <HelpPage onNavigateBack={() => setActiveTab('chat')} />
          </Suspense>
        )}
      </div>

      {/* Welcome page with short guide - shown on the very first visit */}
      <WelcomeScreen />
    </div>
  );
};
