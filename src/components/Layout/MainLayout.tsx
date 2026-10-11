import { FC, lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sidebar } from './Sidebar';
import { ChatWindow } from '../Chat/ChatWindow';
import { hasSeenWelcome, markWelcomeSeen, WelcomeScreen } from './WelcomeScreen';
import { GuidedTour, hasSeenTour, resetTourSeen } from './GuidedTour';
import { ALL_WHATS_NEW_ENTRIES, WhatsNewDialog } from './WhatsNewDialog';
import { getLastSeenVersion, getWhatsNewSince, setLastSeenVersion, type WhatsNewEntry } from '../../services/whats-new';
const ProfileManager = lazy(() => import('../Profiles/ProfileManager').then(m => ({ default: m.ProfileManager })));
const HelpPage = lazy(() => import('../Help/HelpPage').then(m => ({ default: m.HelpPage })));
const RoadmapPage = lazy(() => import('../Help/RoadmapPage').then(m => ({ default: m.RoadmapPage })));
const WikiPage = lazy(() => import('../Help/WikiPage').then(m => ({ default: m.WikiPage })));
const ModelsPage = lazy(() => import('../Models/ModelsPage').then(m => ({ default: m.ModelsPage })));
const MemoryManager = lazy(() => import('../Memory/MemoryManager').then(m => ({ default: m.MemoryManager })));
const ContactPage = lazy(() => import('../Contact/ContactPage').then(m => ({ default: m.ContactPage })));
const PrivacyPage = lazy(() => import('../Privacy/PrivacyPage').then(m => ({ default: m.PrivacyPage })));
const ImprintPage = lazy(() => import('../Imprint/ImprintPage').then(m => ({ default: m.ImprintPage })));
const SettingsPage = lazy(() => import('../Settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const LibraryManager = lazy(() => import('../Library/LibraryManager').then(m => ({ default: m.LibraryManager })));
const DataManager = lazy(() => import('../Data/DataManager').then(m => ({ default: m.DataManager })));
const ImageStudio = lazy(() => import('../Images/ImageStudio').then(m => ({ default: m.ImageStudio })));
import { BrowserWarning } from './BrowserWarning';
import { InstallPrompt } from './InstallPrompt';
import { type AppSettings, loadSettings, saveSettings } from '../../services/settings';
import { applyAccessibilityClasses } from '../../services/accessibility';
import { useLibrary } from '../../hooks/useLibrary';
import { type LibraryFile, resolveLibraryReferences } from '../../services/storage/LibraryStorage';
import * as ChatExport from '../../services/storage/chat-export-import';
import { Chat, ChatFolder, ChatMetadata, MemoryEntry } from '../../types';
import { version as appVersion } from '../../../package.json';
import { useChat } from '../../hooks/useChat';
import { useModels } from '../../hooks/useModels';
import { useProfiles } from '../../hooks/useProfiles';
import { useMemories } from '../../hooks/useMemories';
import { useEnhancedInference } from '../../hooks/useEnhancedInference';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import { getModelConfig } from '../../services/models/model-registry';
import * as ChatStorage from '../../services/storage/ChatStorage';
import { DEFAULT_CHAT_TITLE } from '../../services/storage/ChatStorage';
import {
  clearFolders as clearChatFolders,
  createFolder as createChatFolder,
  deleteFolder as deleteChatFolder,
  getFolders,
  importFolders as importChatFolders,
  renameFolder as renameChatFolder,
} from '../../services/storage/FolderStorage';
import { buildMemoryPromptBlock } from '../../services/storage/MemoryStorage';
import { isDarkMode as checkDarkMode, setThemeMode } from '../../services/theme';
import { error as logError } from '../../services/logging';
import { buildPromptWithDocuments, type DocumentAttachment, type ImageAttachment } from '../../services/attachments';
import { stripHiddenPartsText, trimHistoryToCharBudget } from '../../services/llm/text-processing';
import { localStorageGet, localStorageSet } from '../../services/storage/local-storage';
import { ttsSpeak } from '../../services/tts';


type ActiveTab = 'chat' | 'profiles' | 'memory' | 'library' | 'models' | 'images' | 'data' | 'settings' | 'help' | 'roadmap' | 'wiki' | 'contact' | 'privacy' | 'imprint';

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

export const MainLayout: FC = () => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  // Apply settings changes: persist them and update the theme
  const handleSettingsChange = (next: AppSettings): void => {
    setSettings(next);
    saveSettings(next);
    applyAccessibilityClasses(next);
    setThemeMode(next.theme);
  };
  const handleToggleTheme = (): void => {
    const next = !checkDarkMode();
    handleSettingsChange({ ...settings, theme: next ? 'dark' : 'light' });
  };
  const isOffline = useOfflineStatus();
  const { chat, chats, loadChats, loadChat, createNewChat, deleteChat, addMessage, renameChat, moveChatToFolder } = useChat();
  // Chat folders (localStorage) - chats reference them via folderId
  const [folders, setFolders] = useState<ChatFolder[]>(() => getFolders());
  const handleCreateFolder = useCallback((name: string): ChatFolder => {
    const folder = createChatFolder(name);
    setFolders((prev) => [...prev, folder]);
    return folder;
  }, []);
  const handleRenameFolder = useCallback((id: string, name: string): void => {
    renameChatFolder(id, name);
    setFolders(getFolders());
  }, []);
  const handleDeleteFolder = useCallback((id: string): void => {
    // Chats in the folder become ungrouped (their folderId simply no
    // longer matches a known folder)
    deleteChatFolder(id);
    setFolders(getFolders());
  }, []);
  const handleMoveChat = useCallback((chatId: string, folderId: string | null): void => {
    void moveChatToFolder(chatId, folderId).catch(() => undefined);
  }, [moveChatToFolder]);
  // deleteChat logs and re-throws DB errors; swallow them here so a failed
  // delete does not surface as an unhandled promise rejection in the onClick handler.
  const handleDeleteChat = useCallback((chatId: string): void => {
    void deleteChat(chatId).catch(() => undefined);
  }, [deleteChat]);
  const { profiles, activeProfile, selectProfile, createProfile, updateProfile, deleteProfile, exportProfiles, importProfiles } = useProfiles();
  const { memories, addMemory, setMemoryField, updateMemory, deleteMemory, clearAllMemories, importMemories } = useMemories();
  const { libraryFiles, addLibraryFile, deleteLibraryFile, clearAllLibraryFiles, importLibraryFiles } = useLibrary();
  const { downloadedModels, activeModel, deleteModel: deleteDownloadedModel, selectModel, isModelDownloaded, getModelInfo } = useModels();
  const {
    loadModel,
    generateStream,
    streamText,
    cancel: stopGeneration,
    isGenerating,
    isLoading,
    activeEngine,
    webgpuAvailable,
    currentModelId,
    refreshStatus,
    error,
    supportsImageInput,
    progress: modelLoadProgress,
    progressStats: modelLoadStats,
    modelLoadPhase,
  } = useEnhancedInference();
  const [localError, setLocalError] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  // Welcome page (first visit) and guided tour (shown right after it)
  const [welcomeDone, setWelcomeDone] = useState<boolean>(hasSeenWelcome());
  const [tourDone, setTourDone] = useState<boolean>(hasSeenTour());
  const handleTourComplete = useCallback((): void => {
    setTourDone(true);
  }, []);
  // Model that is currently being downloaded/loaded (may differ from the
  // still-active model while a new one is being fetched)
  const [pendingModelId, setPendingModelId] = useState<string | null>(null);
  // "What's new" entries to show (auto on version change, or opened from help)
  const [whatsNewEntries, setWhatsNewEntries] = useState<WhatsNewEntry[]>([]);
  // While a modal dialog is open (welcome, tour, what's new) the app content
  // becomes inert: focus, screen readers and clicks cannot reach the covered
  // elements anymore (WCAG 2.4.11 - focus not obscured). The <main> element
  // itself stays focusable - it is the skip link target and must remain so.
  const sidebarShellRef = useRef<HTMLDivElement>(null);
  const mainShellRef = useRef<HTMLDivElement>(null);
  const modalOpen = !welcomeDone || whatsNewEntries.length > 0 || (welcomeDone && !tourDone && chat !== null);
  useEffect(() => {
    if (sidebarShellRef.current) {
      sidebarShellRef.current.inert = modalOpen;
    }
    if (mainShellRef.current) {
      mainShellRef.current.inert = modalOpen;
    }
  }, [modalOpen]);
  // Thinking mode of the loaded model (Qwen 3: soft switch /no_think in the
  // prompt). Persisted so the choice survives a reload; default is on.
  const [thinkingEnabled, setThinkingEnabled] = useState<boolean>(() => {
    try {
      return localStorageGet('webgui_thinking_enabled_v1') !== '0';
    } catch {
      return true;
    }
  });
  const handleToggleThinking = useCallback((): void => {
    setThinkingEnabled((prev) => {
      const next = !prev;
      try {
        localStorageSet('webgui_thinking_enabled_v1', next ? '1' : '0');
      } catch {
        // Ignore storage errors - the toggle just resets on reload
      }
      return next;
    });
  }, []);
  // Only models with a thinking mode get the toggle
  const thinkingAvailable = getModelConfig(activeModel?.id ?? '')?.thinking === true;

  // Returning users get a summary of changes since their last visit.
  // First-time visitors get nothing here - they see the welcome page and
  // the guided tour instead. The current version is stored either way.
  useEffect(() => {
    const lastSeen = getLastSeenVersion();
    if (lastSeen) {
      const entries = getWhatsNewSince(lastSeen);
      if (entries.length > 0) {
        setWhatsNewEntries(entries);
      }
    } else if (hasSeenWelcome()) {
      // Returning visitor from before the version tracking existed (v2.4.0):
      // no stored version, but the welcome page was already seen. Treat them
      // as "last seen 2.3.0" so they catch up on everything they missed.
      const entries = getWhatsNewSince('2.3.0');
      if (entries.length > 0) {
        setWhatsNewEntries(entries);
      }
    }
    setLastSeenVersion(appVersion);
     
  }, []);

  const isModelLoaded = currentModelId === activeModel?.id;

  // Refresh inference status when active model changes
  useEffect(() => {
    refreshStatus();
  }, [activeModel?.id, refreshStatus]);

  // Dynamic tab title: shows what is happening - useful when the app runs
  // in several tabs next to each other.
  useEffect(() => {
    const base = 'KI Kobold';
    if (isGenerating) {
      document.title = `${t('tab.generating')} · ${base}`;
    } else if (isLoading) {
      document.title = `${t('tab.loading')} · ${base}`;
    } else if (activeModel) {
      document.title = `${activeModel.name} · ${base}`;
    } else {
      document.title = base;
    }
  }, [isGenerating, isLoading, activeModel, t]);

  // Keyboard shortcut: Escape cancels a running generation. Events that a
  // component already handled (e.g. closing the @-mention popup) are
  // prevented and ignored here.
  useEffect(() => {
    if (!isGenerating) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || e.defaultPrevented) {
        return;
      }
      stopGeneration();
    };
    window.addEventListener('keydown', onKeyDown);
    return (): void => window.removeEventListener('keydown', onKeyDown);
  }, [isGenerating, stopGeneration]);

  // Keyboard: Escape closes the mobile sidebar overlay (the ✕ button stays
  // the visible path; this covers keyboard-only users).
  useEffect(() => {
    if (!showMobileSidebar) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        setShowMobileSidebar(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return (): void => window.removeEventListener('keydown', onKeyDown);
  }, [showMobileSidebar]);

  // Apply the persisted theme from the app settings on startup
  useEffect(() => {
    setThemeMode(settings.theme);
    applyAccessibilityClasses(settings);
    // Run once on mount - settings are loaded synchronously above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply the default profile from settings once profiles are loaded
  const defaultProfileAppliedRef = useRef(false);
  useEffect(() => {
    if (defaultProfileAppliedRef.current || profiles.length === 0) {
      return;
    }
    defaultProfileAppliedRef.current = true;
    const target = settings.defaultProfileId
      ? profiles.find((p) => p.id === settings.defaultProfileId)
      : null;
    if (target) {
      selectProfile(target);
    }
  }, [profiles, settings.defaultProfileId, selectProfile]);

  // Pre-select the default model from settings. Only applied when the model
  // is already downloaded - otherwise the auto-load effect would start a
  // download without the user confirming it.
  useEffect(() => {
    const modelId = settings.defaultModelId;
    if (!modelId || activeModel !== null || !isModelDownloaded(modelId)) {
      return;
    }
    selectModel(modelId);
  }, [settings.defaultModelId, activeModel, isModelDownloaded, selectModel]);

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

      // A stale send error belongs to the chat it happened in - do not
      // carry it across chats.
      setLocalError(null);
      await createNewChat(activeProfile.id);
      setActiveTab('chat');
    } catch (err) {
      logError('Failed to create new chat:', err);
      // Show error to user
      setLocalError(err instanceof Error ? err.message : 'Failed to create new chat');
    }
  };

  const handleSelectChat = async (selectedChat: ChatMetadata): Promise<void> => {
    try {
      if (!selectedChat?.id) {
        throw new Error('Invalid chat selected');
      }

      // A stale send error belongs to the chat it happened in - do not
      // carry it across chats.
      setLocalError(null);
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
    // Defense in depth: InputBox already blocks this, but a second send
    // while generating would abort the running stream.
    if (isGenerating) {
      return;
    }
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

      // Auto-rename chat on first message if still the default title
      if (chat.messages.length === 0 && chat.title === DEFAULT_CHAT_TITLE) {
        // Extract first meaningful words (remove common prefixes)
        const words = message.split(/\s+/).filter((word) => word.length > 0);
        const title = words.slice(0, 5).join(' ').substring(0, 50); // First 5 words, max 50 chars
        if (title) {
          await renameChat(chat.id, title);
        }
      }

      // Pin the chat this exchange belongs to: the user may switch or
      // create chats while the response streams in - the answer must land
      // in the chat the question was asked in, not in the active one.
      const chatId = chat.id;

      // Add user message
      await addMessage('user', message, chatId);

      // Generate response with language setting and correct system prompt
      // Note: WebLLM uses top_p and max_tokens (snake_case)
      const prompt = attachments && attachments.length > 0
        ? buildPromptWithDocuments(message, attachments)
        : message;
      // "@name" references to library files are resolved into the prompt
      const promptWithLibrary = resolveLibraryReferences(prompt, libraryFiles);
      // Memory entries are prepended to the system prompt so the model knows
      // the stored facts in every chat, not just the current conversation.
      // Predefined fields are rendered as "Label: value" lines.
      const memoryFieldLabels: Record<string, string> = {
        name: t('memory.fieldName'),
        work: t('memory.fieldWork'),
        hobbies: t('memory.fieldHobbies'),
        location: t('memory.fieldLocation'),
      };
      const memoryBlock = settings.memoryEnabled
        ? buildMemoryPromptBlock(memories, t('memory.systemPromptHeader'), memoryFieldLabels)
        : null;
      const systemPrompt = [memoryBlock, activeProfile.systemPrompt]
        .filter(Boolean)
        .join('\n\n');
      // Thinking models (Qwen 3) accept the soft switch "/no_think" in the
      // system prompt - the model then answers directly without its
      // visible reasoning, which is faster for simple questions.
      const effectiveSystemPrompt = thinkingAvailable && !thinkingEnabled
        ? [systemPrompt, '/no_think'].filter(Boolean).join('\n\n')
        : systemPrompt;
      // The prompt must fit the model's context window together with the
      // generated answer - drop the oldest history messages if needed.
      // Hidden reasoning blocks (imd/think tags) are stripped from the
      // history: they are display metadata, not conversation - fed back,
      // they make thinking models emit new broken thinking blocks.
      const history = trimHistoryToCharBudget(
        chat.messages.slice(-10).map((m) => ({
          role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
          content: stripHiddenPartsText(m.content),
        })),
        effectiveSystemPrompt,
        promptWithLibrary
      );
      setStreamingMessage('start');
      const result = await generateStream(promptWithLibrary, {
        temperature: activeProfile.temperature,
        top_p: activeProfile.topP,
        max_tokens: activeProfile.maxTokens,
        systemPrompt: effectiveSystemPrompt,
        history,
        images,
      });

      if (result && result.trim().length > 0) {
        await addMessage('assistant', result, chatId);

        // Auto-speak the response (can be disabled in the settings)
        if (settings.autoSpeak) {
          speakResponse(result);
        }
      }
    } catch (err) {
      logError('Failed to send message:', err);
      setLocalError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setStreamingMessage(null);
    }
  };

  const speakResponse = (text: string): void => {
    ttsSpeak(text, i18n.language === 'de' ? 'de-DE' : 'en-US', settings.speechRate);
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

        // Very large models are a poor fit for phones: the download eats
        // mobile data and WASM inference on a phone is painfully slow or
        // fails outright on the memory limit. Warn explicitly before the
        // regular download confirmation.
        const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
          || (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches);
        const isLargeModel = (getModelConfig(modelId)?.fileSizeMB ?? 0) >= 2000;
        if (isMobileDevice && isLargeModel) {
          const mobileConfirmed = window.confirm(
            t('chat.downloadConfirmMobileBigModel', { name: info?.name ?? modelId, size: sizeMB })
          );
          if (!mobileConfirmed) {
            return;
          }
        }

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

  const handleImportChats = async (importedChats: Chat[], importedMemories: MemoryEntry[], importedLibrary: LibraryFile[], importedFolders?: ChatFolder[]): Promise<void> => {
    // Import each chat into the database
    for (const importedChat of importedChats) {
      await ChatStorage.saveChat(importedChat);
    }
    // Restore memory entries contained in the export file (if any)
    if (importedMemories.length > 0) {
      await importMemories(importedMemories);
    }
    // Restore library files contained in the export file (if any)
    if (importedLibrary.length > 0) {
      await importLibraryFiles(importedLibrary);
    }
    // Restore chat folders contained in the export file (if any)
    if (importedFolders && importedFolders.length > 0) {
      importChatFolders(importedFolders);
      setFolders(getFolders());
    }
    // Reload chats to reflect the imported ones
    await loadChats();
    // Open the most recently updated imported chat so the result is visible
    const latest = [...importedChats].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (latest) {
      await loadChat(latest.id);
    }
  };

  const handleSelectProfile = (profileId: string): void => {
    const selectedProfile = profiles.find(p => p.id === profileId);
    if (selectedProfile) {
      selectProfile(selectedProfile);
    }
  };

  // Restart the guided tour from the help page
  const handleRestartTour = (): void => {
    resetTourSeen();
    setTourDone(false);
    setActiveTab('chat');
  };

  // Show the full "what's new" list from the help page
  const handleShowWhatsNew = (): void => {
    setWhatsNewEntries(ALL_WHATS_NEW_ENTRIES);
  };

  // Data page: full backup of chats + memories + library files
  const handleExportAllData = async (): Promise<void> => {
    try {
      // The chats state is metadata-only (no messages) - the export needs
      // the full conversations, so read them fresh from the database.
      const fullChats = await ChatStorage.getAllChats();
      ChatExport.exportChats(fullChats, memories, libraryFiles, folders);
    } catch (err) {
      // e.g. "no chats to export": the user must see WHY nothing happened
      logError('Failed to export data:', err);
      setLocalError(err instanceof Error ? err.message : 'Failed to export data');
    }
  };

  // Data page: restore a backup file (chats + memories + library). Stay on
  // the data page so the success message stays visible.
  const handleImportBackup = async (file: File): Promise<void> => {
    const result = await ChatExport.importChats(file);
    await handleImportChats(result.chats, result.memories, result.library, result.folders);
  };

  // Data page: delete all chats, memories and library files. A fresh chat
  // is created right away so the app stays usable.
  const handleDeleteAllData = async (): Promise<void> => {
    await ChatStorage.clearAllChats();
    await clearAllMemories();
    await clearAllLibraryFiles();
    // Chat folders are part of "all data" too (they are in the backup
    // export as well) - leaving them behind would show empty folders.
    clearChatFolders();
    setFolders([]);
    if (activeProfile) {
      await createNewChat(activeProfile.id);
    }
    setLocalError(null);
  };

  return (
    <div className="relative isolate flex h-screen overflow-hidden bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900">
      {/* Skip link: first tab stop, jumps keyboard users to the chat */}
      <a href="#main-content" className="skip-link">
        {t('a11y.skipToContent')}
      </a>

      {/* Subtle ambient glow - negative z-index keeps it clearly BELOW all
          content (accessibility tools evaluate stacking order; without this
          the blurred circles read as "overlapping" the text) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10" aria-hidden="true">
        <div className="absolute -top-32 -left-24 w-96 h-96 rounded-full bg-indigo-400/10 dark:bg-indigo-600/10 blur-3xl"></div>
        <div className="absolute -bottom-40 -right-24 w-[28rem] h-[28rem] rounded-full bg-violet-400/10 dark:bg-violet-600/10 blur-3xl"></div>
      </div>

      {/* Sidebar shell: display:contents keeps the flex layout intact; the
          ref makes the sidebar inert while a modal is open. */}
      <div className="contents" ref={sidebarShellRef}>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0 relative z-10">
        <Sidebar
          chats={chats}
          activeChat={chat}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onDeleteChat={handleDeleteChat}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onToggleTheme={handleToggleTheme}
          folders={folders}
          onCreateFolder={handleCreateFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
          onMoveChat={handleMoveChat}
          onShowWhatsNew={handleShowWhatsNew}
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
                aria-label={t('common.close')}
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
                onDeleteChat={handleDeleteChat}
                activeTab={activeTab}
                onTabChange={(tab) => {
                  setActiveTab(tab);
                  setShowMobileSidebar(false);
                }}
                onToggleTheme={handleToggleTheme}
                folders={folders}
                onCreateFolder={handleCreateFolder}
                onRenameFolder={handleRenameFolder}
                onDeleteFolder={handleDeleteFolder}
                onMoveChat={handleMoveChat}
                onShowWhatsNew={handleShowWhatsNew}
              />
            </div>
          </div>
        </div>
      )}

      </div>

      <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col overflow-hidden min-w-0 focus:outline-none">
      {/* Main content shell: inert while a modal is open - main itself
          stays focusable as the skip link target */}
      <div className="contents" ref={mainShellRef}>
        {/* Mobile Header */}
        <div className="lg:hidden bg-zinc-950 text-white px-4 py-3 flex items-center gap-3 border-b border-zinc-800">
          <button
            onClick={() => setShowMobileSidebar(true)}
            data-tour="mobile-menu"
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label={t("sidebar.openMenu")}
          >
            ☰
          </button>
          <h1 className="font-semibold flex-1">{t('sidebar.title')}</h1>
        </div>

        {/* Offline banner: downloads need the internet, loaded models keep working */}
        {isOffline && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 px-4 py-2">
            <p className="text-amber-700 dark:text-amber-400 text-sm font-medium flex items-center gap-2">
              <span className="text-base">📡</span>
              {t('offline.banner')}
            </p>
          </div>
        )}

        {/* Performance warning for Firefox users (dismissible) */}
        <BrowserWarning />

        {/* PWA install hint for returning visitors (dismissible) */}
        {welcomeDone && <InstallPrompt />}

        {/* Model Download Overlay - shows while a model is loading/downloading */}
        {isLoading && activeTab === 'chat' && (
          <div className="fixed inset-0 bg-zinc-950/20 dark:bg-black/40 flex items-center justify-center z-50 pointer-events-none backdrop-blur-[2px]">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-2xl max-w-md w-full mx-4 border border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin flex-shrink-0" aria-hidden="true"></div>
                <div className="flex-1">
                  {/* role=status announces the download start and phase
                      change to screen readers; the percentage below stays
                      outside so it does not fire on every progress tick */}
                  <div role="status">
                    <h3 className="font-semibold text-zinc-800 dark:text-zinc-100">
                    {modelLoadPhase === 'preparing'
                      ? t('chat.preparingModel')
                      : t('chat.downloadingModel')}
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                    {getModelInfo(pendingModelId ?? activeModel?.id ?? '')?.name
                      ?? activeModel?.name
                      ?? t('chat.processingRequest')}
                  </p>
                  </div>
                  {modelLoadPhase === 'preparing' ? (
                    <>
                      {/* Indeterminate bar: the files are complete, the model
                          is being initialized in memory without progress events */}
                      <div className="mt-3 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                        <div className="h-2 w-1/3 bg-indigo-700 rounded-full animate-progress-slide"></div>
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1.5">
                        {t('chat.preparingNote')}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="mt-3 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-indigo-700 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(2, Math.round(modelLoadProgress))}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1.5 tabular-nums">
                        {Math.round(modelLoadProgress)}%
                        {modelLoadStats
                          ? ` · ${t('chat.downloadStats', {
                              loaded: Math.round(modelLoadStats.loadedMB),
                              total: Math.round(modelLoadStats.totalMB),
                              speed: modelLoadStats.speedMBps.toFixed(1),
                            })}`
                          : ''}
                      </p>
                      {((): JSX.Element | null => {
                        const eta = downloadEta(modelLoadStats);
                        return eta ? (
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                            {t('chat.downloadEta', { time: eta })}
                          </p>
                        ) : null;
                      })()}
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
                        {t('chat.downloadLocalNote')}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'chat' && (
          <ChatWindow
            chat={chat}
            activeProfile={activeProfile}
            profiles={profiles}
            activeModel={activeModel}
            isLoading={isLoading}
            isModelLoaded={isModelLoaded}
            error={localError ?? error}
            webgpuAvailable={webgpuAvailable}
            loadingProgress={modelLoadProgress}
            loadStats={modelLoadStats}
            loadingPhase={modelLoadPhase}
            isModelDownloaded={isModelDownloaded}
            isGenerating={isGenerating}
            streamingMessage={streamingMessage ? streamText : null}
            onStopGeneration={stopGeneration}
            thinkingAvailable={thinkingAvailable}
            thinkingEnabled={thinkingEnabled}
            onToggleThinking={handleToggleThinking}
            activeEngine={activeEngine}
            onSendMessage={handleSendMessage}
            onSendMessageWithDocuments={handleSendMessageWithDocuments}
            supportsImageInput={supportsImageInput}
            onSendMessageWithImages={handleSendMessageWithImages}
            onSelectModel={handleModelSelect}
            onSelectProfile={handleSelectProfile}
            onRenameChat={(id, title) => {
              // renameChat logs and re-throws DB errors; swallow them here
              // so a failed rename does not become an unhandled rejection.
              void renameChat(id, title).catch(() => undefined);
            }}
            memories={memories}
            library={libraryFiles}
            textScale={settings.textScale}
            onTextScaleChange={(scale) => handleSettingsChange({ ...settings, textScale: scale })}
            speechRate={settings.speechRate}
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

        {activeTab === 'memory' && (
          <Suspense fallback={<div className='flex-1 p-8 text-gray-400'>{t('common.loading')}</div>}>
            <MemoryManager
              memories={memories}
              onAddMemory={addMemory}
              onSetMemoryField={setMemoryField}
              onUpdateMemory={updateMemory}
              onDeleteMemory={deleteMemory}
            />
          </Suspense>
        )}

        {activeTab === 'library' && (
          <Suspense fallback={<div className='flex-1 p-8 text-gray-400'>{t('common.loading')}</div>}>
            <LibraryManager
              files={libraryFiles}
              onAddFile={addLibraryFile}
              onDeleteFile={deleteLibraryFile}
            />
          </Suspense>
        )}

        {activeTab === 'data' && (
          <Suspense fallback={<div className='flex-1 p-8 text-gray-400'>{t('common.loading')}</div>}>
            <DataManager
              chats={chats}
              memories={memories}
              libraryFiles={libraryFiles}
              downloadedModels={downloadedModels}
              onExportAll={handleExportAllData}
              onImportBackup={handleImportBackup}
              onDeleteAll={handleDeleteAllData}
            />
          </Suspense>
        )}

        {activeTab === 'settings' && (
          <Suspense fallback={<div className='flex-1 p-8 text-gray-400'>{t('common.loading')}</div>}>
            <SettingsPage
              settings={settings}
              onChange={handleSettingsChange}
              profiles={profiles}
              downloadedModels={downloadedModels}
              onDeleteModel={deleteDownloadedModel}
            />
          </Suspense>
        )}

        {activeTab === 'help' && (
          <Suspense fallback={<div className='flex-1 p-8 text-gray-400'>{t('common.loading')}</div>}>
            <HelpPage
              onNavigateBack={() => setActiveTab('chat')}
              onRestartTour={handleRestartTour}
              onShowWhatsNew={handleShowWhatsNew}
            />
          </Suspense>
        )}

        {activeTab === 'models' && (
          <Suspense fallback={<div className='flex-1 p-8 text-gray-400'>{t('common.loading')}</div>}>
            <ModelsPage onNavigateBack={() => setActiveTab('chat')} />
          </Suspense>
        )}

        {activeTab === 'images' && (
          <Suspense fallback={<div className='flex-1 p-8 text-gray-400'>{t('common.loading')}</div>}>
            <ImageStudio onNavigateBack={() => setActiveTab('chat')} />
          </Suspense>
        )}

        {activeTab === 'roadmap' && (
          <Suspense fallback={<div className='flex-1 p-8 text-gray-400'>{t('common.loading')}</div>}>
            <RoadmapPage onNavigateBack={() => setActiveTab('chat')} />
          </Suspense>
        )}

        {activeTab === 'wiki' && (
          <Suspense fallback={<div className='flex-1 p-8 text-gray-400'>{t('common.loading')}</div>}>
            <WikiPage onNavigateBack={() => setActiveTab('chat')} />
          </Suspense>
        )}

        {activeTab === 'contact' && (
          <Suspense fallback={<div className='flex-1 p-8 text-gray-400'>{t('common.loading')}</div>}>
            <ContactPage onNavigateBack={() => setActiveTab('chat')} />
          </Suspense>
        )}

        {activeTab === 'privacy' && (
          <Suspense fallback={<div className='flex-1 p-8 text-gray-400'>{t('common.loading')}</div>}>
            <PrivacyPage onNavigateBack={() => setActiveTab('chat')} />
          </Suspense>
        )}

        {activeTab === 'imprint' && (
          <Suspense fallback={<div className='flex-1 p-8 text-gray-400'>{t('common.loading')}</div>}>
            <ImprintPage onNavigateBack={() => setActiveTab('chat')} />
          </Suspense>
        )}
      </div>
      </main>

      {/* Welcome page with short guide - shown on the very first visit */}
      {!welcomeDone && (
        <WelcomeScreen
          onDismiss={() => {
            markWelcomeSeen();
            setWelcomeDone(true);
          }}
        />
      )}

      {/* Guided tour through the chat UI - starts after the welcome page.
          Waits for the initial chat so the tour targets exist. */}
      {welcomeDone && !tourDone && chat && (
        <GuidedTour onComplete={handleTourComplete} />
      )}

      {/* "What's new" summary for returning users (or opened from the help page) */}
      {whatsNewEntries.length > 0 && (
        <WhatsNewDialog
          entries={whatsNewEntries}
          onClose={() => setWhatsNewEntries([])}
        />
      )}
    </div>
  );
};
