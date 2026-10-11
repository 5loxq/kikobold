import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chat, LocalModel, MemoryEntry, Profile } from '../../types';
import { MessageList } from './MessageList';
import { InputBox } from './InputBox';
import { ChatExportImport } from './chat-export-import';
import { FileDropWarning } from './FileDropWarning';
import { ShortcutsDialog } from './ShortcutsDialog';
import type { LibraryFile } from '../../services/storage/LibraryStorage';
import { getModelConfig, MODELS } from '../../services/models/model-registry';
import { supportsWllamaJspi } from '../../services/inference/wllama-engine';
import { TEXT_SCALES } from '../../services/accessibility';
import type { TextScale } from '../../services/settings';
import { ttsSpeak, ttsStop } from '../../services/tts';


interface ChatWindowProps {
  chat: Chat | null;
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
  /** 'downloading' = fetching files, 'preparing' = initializing in memory */
  loadingPhase?: 'downloading' | 'preparing';
  isModelDownloaded?: (modelId: string) => boolean;
  isGenerating?: boolean;
  streamingMessage?: string | null;
  onStopGeneration?: () => void;
  /** True when the active model has a thinking mode (Qwen 3) */
  thinkingAvailable?: boolean;
  /** Whether thinking mode is currently enabled */
  thinkingEnabled?: boolean;
  /** Toggle thinking mode on/off */
  onToggleThinking?: () => void;
  /** Which engine runs the active model ('webllm' = WebGPU, 'wllama' = WASM) */
  activeEngine?: 'webllm' | 'wllama' | null;
  onSendMessage: (message: string) => void;
  onSendMessageWithDocuments?: (message: string, attachments: import('../../services/attachments').DocumentAttachment[]) => void;
  supportsImageInput?: boolean;
  onSendMessageWithImages?: (message: string, images: import('../../services/attachments').ImageAttachment[]) => void;
  onSelectModel: (modelId: string) => void;
  onSelectProfile?: (profileId: string) => void;
  onRenameChat?: (chatId: string, newTitle: string) => void;
  memories?: MemoryEntry[];
  library?: LibraryFile[];
  /** Current text size level - controlled by the quick control in the header */
  textScale?: TextScale;
  onTextScaleChange?: (scale: TextScale) => void;
  /** Speech rate for the per-message read-aloud button (0.5 - 1.5) */
  speechRate?: number;
}

// The model dropdown, shared between the chat header and the welcome
// screen (no chat open yet) - the model selection must be reachable in
// both states, otherwise the app looks broken on a fresh visit.
const ModelSelect: React.FC<{
  selectedModelId: string;
  onSelect: (modelId: string) => void;
  isModelDownloaded?: (modelId: string) => boolean;
  isLoading: boolean;
  label: string;
}> = ({ selectedModelId, onSelect, isModelDownloaded, isLoading, label }) => (
  <select
    value={selectedModelId}
    onChange={(e) => onSelect(e.target.value)}
    disabled={isLoading}
    data-tour="model-select"
    aria-label={label}
    className="w-full sm:w-auto px-4 py-2 border border-zinc-500 rounded-xl text-sm disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 shadow-sm"
  >
    <option value="">{label}...</option>
    {MODELS.map((model) => {
      const isDownloaded = isModelDownloaded?.(model.id) ?? false;
      return (
        <option key={model.id} value={model.id}>
          {isDownloaded ? '✅' : '📥'} {model.name} · {Math.round(model.fileSizeMB ?? 0)} MB{model.provider === 'gguf-hf' ? ' · läuft überall' : ' · WebGPU'}
        </option>
      );
    })}
  </select>
);

export const ChatWindow: React.FC<ChatWindowProps> = ({
  chat,
  activeProfile,
  profiles,
  activeModel: _activeModel,
  isLoading,
  isModelLoaded,
  error,
  webgpuAvailable,
  loadingProgress = 0,
  loadStats = null,
  loadingPhase = 'downloading',
  isModelDownloaded,
  isGenerating = false,
  streamingMessage = null,
  onStopGeneration,
  thinkingAvailable = false,
  thinkingEnabled = true,
  onToggleThinking,
  activeEngine = null,
  onSendMessage,
  onSendMessageWithDocuments,
  supportsImageInput = false,
  onSendMessageWithImages,
  onSelectModel,
  onSelectProfile,
  onRenameChat,
  memories = [],
  library = [],
  textScale = 'standard',
  onTextScaleChange,
  speechRate = 1,
}) => {
  const { t, i18n } = useTranslation();
  const [selectedModelId, setSelectedModelId] = useState<string>(_activeModel?.id ?? '');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Quick text size control (popover in the header)
  const [isTextSizeOpen, setIsTextSizeOpen] = useState(false);
  // Keyboard message navigation (J/K focus, C copy, ? shortcuts, Esc clears)
  const [focusedMessageIndex, setFocusedMessageIndex] = useState<number | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  // Per-message read-aloud: id of the message currently being spoken
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  // Screen reader announcements (generation start/end). The streaming text
  // itself is NOT put in a live region - it changes on every token and would
  // flood assistive technology. Only the state transitions are announced.
  const [announcement, setAnnouncement] = useState('');

  // Announce only real state transitions: generation started, and
  // generation finished with an answer. Keyed off the isGenerating edge
  // (not the message count) so switching chats does not announce anything.
  const wasGeneratingRef = useRef(false);
  useEffect(() => {
    if (isGenerating) {
      wasGeneratingRef.current = true;
      setAnnouncement(t('a11y.generatingStarted'));
    } else if (wasGeneratingRef.current) {
      wasGeneratingRef.current = false;
      const last = chat?.messages[chat.messages.length - 1];
      if (last?.role === 'assistant') {
        setAnnouncement(t('a11y.responseReady'));
      }
    }
  }, [isGenerating, chat?.messages, t]);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleMessages = React.useMemo(
    () =>
      normalizedSearch
        ? chat?.messages.filter((m) => m.content.toLowerCase().includes(normalizedSearch)) ?? []
        : chat?.messages ?? [],
    [chat?.messages, normalizedSearch]
  );

  const scrollToBottom = (): void => {
    // Programmatic smooth scrolling ignores the CSS scroll-behavior
    // property - check the reduce-motion setting and OS preference here.
    const reduceMotion =
      document.documentElement.classList.contains('reduce-motion') ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    messagesEndRef.current?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'end',
    });
  };

  // True when the user has not scrolled away from the latest messages.
  const isNearBottom = (): boolean => {
    const container = messagesEndRef.current?.closest<HTMLElement>('.messages-scroll');
    if (!container) {
      return true;
    }
    return container.scrollTop + container.clientHeight >= container.scrollHeight - 80;
  };

  // Jump to the bottom when switching chats or when the user sends a
  // message - but while the model is streaming (or just finished), only
  // follow the output when the user is already near the bottom, so
  // reading older messages is not interrupted.
  const prevChatIdRef = useRef<string | null>(null);
  useEffect(() => {
    const chatId = chat?.id ?? null;
    const chatChanged = prevChatIdRef.current !== chatId;
    prevChatIdRef.current = chatId;
    if (chatChanged) {
      scrollToBottom();
      return;
    }
    const last = chat?.messages[chat.messages.length - 1];
    if ((streamingMessage || last?.role === 'assistant') && !isNearBottom()) {
      return;
    }
    scrollToBottom();
  }, [chat, streamingMessage]);

  useEffect(() => {
    if (_activeModel?.id) {
      setSelectedModelId(_activeModel.id);
    }
  }, [_activeModel?.id]);

  // Keyboard shortcut: Ctrl/Cmd+K opens and closes the chat search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return (): void => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Keyboard message navigation: J/K move the focus between messages, C
  // copies the focused one, ? opens the shortcut overview, Esc clears the
  // focus (and closes the text size popover). Ignored while typing.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (showShortcuts) {
        return;
      }
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts(true);
        return;
      }
      if (e.key === 'Escape') {
        setFocusedMessageIndex(null);
        setIsTextSizeOpen(false);
        return;
      }
      const count = visibleMessages.length;
      if (count === 0) {
        return;
      }
      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        setFocusedMessageIndex((i) => Math.min(count - 1, (i ?? -1) + 1));
        return;
      }
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        setFocusedMessageIndex((i) => Math.max(0, (i ?? count) - 1));
        return;
      }
      if (e.key === 'c' || e.key === 'C') {
        const message = focusedMessageIndex !== null ? visibleMessages[focusedMessageIndex] : undefined;
        if (message) {
          e.preventDefault();
          void navigator.clipboard.writeText(message.content);
          setAnnouncement(t('chat.copied'));
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return (): void => window.removeEventListener('keydown', onKeyDown);
  }, [showShortcuts, focusedMessageIndex, visibleMessages, t]);

  // Keep the keyboard-focused message in view
  useEffect(() => {
    if (focusedMessageIndex === null) {
      return;
    }
    const message = visibleMessages[focusedMessageIndex];
    if (!message) {
      return;
    }
    const el = document.querySelector(`[data-message-id="${message.id}"]`);
    const reduceMotion =
      document.documentElement.classList.contains('reduce-motion') ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el?.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [focusedMessageIndex, visibleMessages]);

  // Reset the keyboard focus when switching chats
  useEffect(() => {
    setFocusedMessageIndex(null);
  }, [chat?.id]);

  // Stop the speech when leaving the chat
  useEffect(() => {
    return (): void => ttsStop();
  }, []);

  // Per-message read-aloud: clicking the speaker button reads the message,
  // clicking again (or another message) switches/stops the speech.
  const handleToggleSpeak = (messageId: string, content: string): void => {
    if (speakingMessageId === messageId) {
      ttsStop();
      setSpeakingMessageId(null);
      return;
    }
    setSpeakingMessageId(messageId);
    ttsSpeak(
      content,
      i18n.language === 'de' ? 'de-DE' : 'en-US',
      speechRate,
      () => setSpeakingMessageId(null)
    );
  };

  // Stop read-aloud when switching to another chat: the spoken message is
  // no longer visible and speakingMessageId would point at a foreign chat.
  useEffect((): (() => void) => {
    return () => {
      ttsStop();
      setSpeakingMessageId(null);
    };
  }, [chat?.id]);

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-zinc-50 dark:bg-zinc-900">
        <div className="text-center max-w-md">
          {webgpuAvailable === false && (
            <div className="mb-8 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl p-4">
              <p className="text-amber-700 dark:text-amber-400 font-semibold">⚠️ {t('chat.webgpuNotSupported')}</p>
              <p className="text-amber-700 dark:text-amber-500 text-sm mt-2">
                {t('chat.webgpuRequiredBrowsers')}
              </p>
            </div>
          )}
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-2xl shadow-xl shadow-indigo-500/25">
            💬
          </div>
          <h2 className="text-3xl font-bold mb-3 text-zinc-800 dark:text-zinc-100">{t('chat.welcome')}</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-8">
            {t('chat.step3')}
          </p>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-left shadow-sm">
            <h3 className="font-semibold mb-3 text-zinc-800 dark:text-zinc-100">{t('chat.quickStart')}:</h3>
            <ol className="text-zinc-600 dark:text-zinc-400 space-y-2 list-decimal list-inside">
              <li>{t('chat.step1')}</li>
              <li>{t('chat.step2')}</li>
              <li>{t('chat.step3')}</li>
            </ol>
            {/* Model selection must be reachable even without an open chat */}
            <div className="mt-4">
              <ModelSelect
                selectedModelId={selectedModelId}
                onSelect={(modelId) => {
                  setSelectedModelId(modelId);
                  onSelectModel(modelId);
                }}
                isModelDownloaded={isModelDownloaded}
                isLoading={isLoading}
                label={t('chat.selectModel')}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-zinc-50 dark:bg-zinc-900 min-h-0">
      {/* Screen reader announcements for generation state changes */}
      <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
      {/* Drag & drop warning overlay (drop itself is not supported) */}
      <FileDropWarning />
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
                  className="flex-1 px-4 py-2 border border-zinc-500 dark:bg-zinc-900 dark:text-zinc-100 rounded-xl text-lg font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white shadow-sm"
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
                  aria-label={t('common.save')}
                >
                  ✓
                </button>
                <button
                  onClick={() => setIsEditingTitle(false)}
                  className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                  aria-label={t('common.cancel')}
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
                  className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-sm"
                  title={t("chat.renameChat")}
                  aria-label={t("chat.renameChat")}
                >
                  ✏️
                </button>
              </div>
            )}
            {activeProfile && (
              <div className="flex items-center gap-2 mt-2">
                <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{t('profiles.activeProfile')}:</label>
                <select
                  value={activeProfile.id}
                  onChange={(e) => onSelectProfile?.(e.target.value)}
                  data-tour="profile-select"
                  aria-label={t('profiles.activeProfile')}
                  className="max-w-full px-3 py-1.5 border border-zinc-500 rounded-lg text-sm text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            <div role="alert" className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/40 px-4 py-2 rounded-xl border border-red-100 dark:border-red-900 max-w-sm">
              {error}
            </div>
          )}
        </div>

        {/* Model Selector */}
        <div className="flex gap-3 items-center flex-wrap mt-3">
          <ModelSelect
            selectedModelId={selectedModelId}
            onSelect={(modelId) => {
              setSelectedModelId(modelId);
              onSelectModel(modelId);
            }}
            isModelDownloaded={isModelDownloaded}
            isLoading={isLoading}
            label={t('chat.selectModel')}
          />

          {thinkingAvailable && onToggleThinking && (
            <button
              type="button"
              onClick={onToggleThinking}
              aria-pressed={thinkingEnabled}
              title={t('chat.thinkingToggleHint')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                thinkingEnabled
                  ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                  : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              <span className={thinkingEnabled ? '' : 'opacity-50'}>💭</span>
              {t('chat.thinkingToggle')}
              <span className="text-xs font-normal opacity-70">
                {thinkingEnabled ? t('chat.thinkingOn') : t('chat.thinkingOff')}
              </span>
            </button>
          )}

          {isModelLoaded && !isLoading && activeEngine && (
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                activeEngine === 'webllm'
                  ? 'border-green-200 dark:border-green-900/60 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400'
                  : 'border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
              }`}
              title={activeEngine === 'webllm' ? t('chat.engineWebgpuHint') : t('chat.engineWasmHint')}
            >
              ⚙️ {activeEngine === 'webllm' ? t('chat.engineWebgpu') : t('chat.engineWasm')}
            </span>
          )}

          {selectedModelId && getModelConfig(selectedModelId)?.description && !isLoading && (
            <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-md leading-relaxed">
              {getModelConfig(selectedModelId)?.description}
            </p>
          )}

          {selectedModelId && getModelConfig(selectedModelId)?.engine === 'wllama' && !supportsWllamaJspi() && !isLoading && (
            <p className="text-xs text-amber-700 dark:text-amber-400 max-w-md leading-relaxed">
              ⚠️ {t('chat.jspiHint')}
            </p>
          )}

          {selectedModelId && (
            <>
              {isLoading && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">🌀 {t('chat.loading')}</span>
                  {loadingPhase === 'preparing' ? (
                    <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                      {t('chat.preparingModel')}
                    </span>
                  ) : (
                    <>
                      <div className="w-32 h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-700 transition-all duration-300"
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
                    </>
                  )}
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
              id="chat-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('chat.searchPlaceholder')}
              autoFocus
              aria-label={t('chat.searchInChat')}
              className="flex-1 max-w-sm px-4 py-2 border border-zinc-500 rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 shadow-sm"
            />
            <span className="text-xs text-zinc-600 dark:text-zinc-400" aria-live="polite">
              {normalizedSearch ? `${visibleMessages.length}` : ''}
            </span>
            <button
              onClick={() => { setSearchQuery(''); setIsSearchOpen(false); }}
              className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              title={t('chat.searchClose')}
              aria-label={t('chat.searchClose')}
            >
              ✕
            </button>
          </div>
        )}
        {/* Export/Import Section */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/60">
          <ChatExportImport
            chat={chat}
            memories={memories}
            library={library}
          />
          <div className="flex items-center gap-1">
            {/* Quick text size control - same four levels as the settings */}
            {onTextScaleChange && (
              <div className="relative">
                <button
                  onClick={() => setIsTextSizeOpen((v) => !v)}
                  aria-expanded={isTextSizeOpen}
                  aria-haspopup="true"
                  className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-sm font-semibold"
                  title={t('settings.textSize')}
                  aria-label={t('settings.textSize')}
                >
                  Aa
                </button>
                {isTextSizeOpen && (
                  <div
                    role="group"
                    aria-label={t('settings.textSize')}
                    className="absolute bottom-full right-0 mb-2 z-30 flex gap-1 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl"
                  >
                    {TEXT_SCALES.map((scale) => (
                      <button
                        key={scale.value}
                        onClick={() => {
                          onTextScaleChange(scale.value);
                          setIsTextSizeOpen(false);
                        }}
                        aria-pressed={textScale === scale.value}
                        title={t(scale.labelKey)}
                        aria-label={t(scale.labelKey)}
                        className={`w-9 h-9 rounded-xl text-sm font-semibold transition-colors ${
                          textScale === scale.value
                            ? 'bg-indigo-600 text-white'
                            : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <span aria-hidden="true">{scale.icon}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => setShowShortcuts(true)}
              className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-sm hidden sm:flex items-center gap-1"
              title={t('help.shortcutsTitle')}
              aria-label={t('help.shortcutsTitle')}
            >
              ⌨️
            </button>
            <button
              onClick={() => setIsSearchOpen((v) => !v)}
              data-tour="search"
              aria-expanded={isSearchOpen}
              aria-controls="chat-search-input"
              className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-sm flex items-center gap-1"
              title={t('chat.searchInChat')}
            >
              🔍 <span className="hidden sm:inline">{t('chat.searchInChat')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <MessageList
        messages={visibleMessages}
        isLoading={isGenerating}
        isModelLoading={isLoading}
        streamingMessage={streamingMessage}
        messagesEndRef={messagesEndRef}
        searchQuery={searchQuery}
        focusedMessageId={focusedMessageIndex !== null ? visibleMessages[focusedMessageIndex]?.id ?? null : null}
        speakingMessageId={speakingMessageId}
        onToggleSpeak={handleToggleSpeak}
      />

      {/* Input Area */}
      <InputBox
        onSendMessage={onSendMessage}
        onSendMessageWithDocuments={onSendMessageWithDocuments}
        supportsImageInput={supportsImageInput}
        onSendMessageWithImages={onSendMessageWithImages}
        libraryFiles={library}
        isLoading={isLoading}
        isModelLoaded={isModelLoaded}
        hasModelSelected={!!_activeModel}
        isGenerating={isGenerating}
        onStopGeneration={onStopGeneration}
      />

      {/* Keyboard shortcut overview - opened with ? or the header button */}
      {showShortcuts && (
        <ShortcutsDialog onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  );
};
