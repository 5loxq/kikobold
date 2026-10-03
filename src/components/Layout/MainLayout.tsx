import { FC, lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sidebar } from './Sidebar';
import { ChatWindow } from '../Chat/ChatWindow';
const ModelManager = lazy(() => import('../Models/ModelManager').then(m => ({ default: m.ModelManager })));
const ProfileManager = lazy(() => import('../Profiles/ProfileManager').then(m => ({ default: m.ProfileManager })));
const HelpPage = lazy(() => import('../Help/HelpPage').then(m => ({ default: m.HelpPage })));
import { Chat } from '../../types';
import { useChat } from '../../hooks/useChat';
import { useModels } from '../../hooks/useModels';
import { useProfiles } from '../../hooks/useProfiles';
import { useEnhancedInference } from '../../hooks/useEnhancedInference';
import * as ChatStorage from '../../services/storage/ChatStorage';
import { error as logError } from '../../services/logging';
import { buildPromptWithDocuments, type DocumentAttachment, type ImageAttachment } from '../../services/attachments';


type ActiveTab = 'chat' | 'models' | 'profiles' | 'settings' | 'help';

export const MainLayout: FC = () => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const { chat, chats, loadChats, loadChat, createNewChat, deleteChat, addMessage, renameChat } = useChat();
  const { profiles, activeProfile, selectProfile, createProfile, updateProfile, deleteProfile, exportProfiles, importProfiles } = useProfiles();
  const { downloadedModels, activeModel, downloadModel, deleteModel: deleteDownloadedModel, selectModel, isModelDownloaded } = useModels();
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
    supportsImageInput
  } = useEnhancedInference({ modelId: activeModel?.id ?? '' });
  const [localError, setLocalError] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const isModelLoaded = currentModelId === activeModel?.id;

  // Refresh inference status when active model changes
  useEffect(() => {
    refreshStatus();
  }, [activeModel?.id, refreshStatus]);

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
      setLoadingProgress(0);
      // Clear previous errors
      setLocalError(null);
      
      // Load the model via unified inference engine
      const success = await loadModel(modelId);
      
      if (success) {
        setLoadingProgress(100);
        // Select and register the model (will save to storage if not already saved)
        selectModel(modelId);
      } else {
        setLoadingProgress(0);
        // Error is already set by loadModel via inferenceError state
      }
    } catch (err) {
      logError('Model selection failed:', err);
      setLocalError(err instanceof Error ? err.message : 'Model selection failed');
      setLoadingProgress(0);
    }
  };

  const handleImportChats = async (importedChats: Chat[]): Promise<void> => {
    // Import each chat into the database
    for (const importedChat of importedChats) {
      await ChatStorage.saveChat(importedChat);
    }
    // Reload chats to reflect the imported ones
    await loadChats();
  };

  const handleSelectProfile = (profileId: string): void => {
    const selectedProfile = profiles.find(p => p.id === profileId);
    if (selectedProfile) {
      selectProfile(selectedProfile);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <Sidebar
          chats={chats}
          activeChat={chat}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onDeleteChat={deleteChat}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-40"
          onClick={() => setShowMobileSidebar(false)}
        >
          <div
            className="fixed top-0 left-0 h-screen w-64 bg-gray-900 shadow-lg z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h1 className="text-lg font-bold text-white">Local LLM</h1>
              <button
                onClick={() => setShowMobileSidebar(false)}
                className="text-white p-2 hover:bg-gray-800 rounded"
              >
                ✕
              </button>
            </div>
            <div className="text-white p-4">
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
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile Header */}
        <div className="lg:hidden bg-gray-900 text-white p-4 flex items-center gap-2">
          <button
            onClick={() => setShowMobileSidebar(true)}
            className="p-2 hover:bg-gray-800 rounded"
          >
            ☰
          </button>
          <h1 className="font-bold flex-1">{t('sidebar.title')}</h1>
        </div>

        {/* LLM Thinking Animation - shows when model is generating response */}
        {isLoading && activeTab === 'chat' && (
          <div className="fixed inset-0 bg-black bg-opacity-10 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-white rounded-lg p-6 shadow-xl max-w-md w-full mx-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <div>
                  <h3 className="font-semibold text-gray-800">{t('chat.llmThinking')}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {activeModel ? `${activeModel.name} ${t('chat.isProcessing')}` : t('chat.processingRequest')}
                  </p>
                  <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{width: '75%'}}></div>
                  </div>
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
            loadingProgress={loadingProgress}
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

        {activeTab === 'models' && (
          <Suspense fallback={<div className='flex-1 p-8 text-gray-400'>{t('common.loading')}</div>}>
          <ModelManager
            downloadedModels={downloadedModels}
            activeModel={activeModel}
            onDownloadModel={downloadModel}
            onDeleteModel={deleteDownloadedModel}
            onSelectModel={selectModel}
          />
          </Suspense>
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
            <h2 className="text-2xl font-bold mb-4">{t('settings.title')}</h2>
            <div className="bg-white rounded-lg p-6 shadow">
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-lg mb-2">{t('settings.storage')}</h3>
                  <p className="text-gray-600">
                    {t('settings.downloadedModels')}: {downloadedModels.length}
                  </p>
                  <p className="text-gray-600">
                    {t('settings.totalSize')}: {(downloadedModels.reduce((sum, m) => sum + m.size, 0) / (1024 * 1024 * 1024)).toFixed(2)} GB
                  </p>
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-2">{t('settings.about')}</h3>
                  <p className="text-gray-600">
                    Local LLM Chat v1.4.0
                  </p>
                  <p className="text-gray-600">
                    {t('settings.description')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'help' && (
          <Suspense fallback={<div className='flex-1 p-8 text-gray-400'>{t('common.loading')}</div>}>
            <HelpPage />
          </Suspense>
        )}
      </div>
    </div>
  );
};
