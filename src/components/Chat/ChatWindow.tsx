import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Chat, Profile, LocalModel } from '../../types';
import { MessageList } from './MessageList';
import { InputBox } from './InputBox';
import { ChatExportImport } from './chat-export-import';
import { MODELS } from '../../services/models/model-registry';

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
  onSendMessage: (message: string) => void;
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
  onSendMessage,
  onSelectModel,
  onSelectProfile,
  onRenameChat,
  onImportChats,
}) => {
  const { t } = useTranslation();
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chat?.messages]);

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
    <div className="flex-1 flex flex-col bg-white">
      {/* WebGPU Warning */}
      {webgpuAvailable === false && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2">
          <p className="text-red-700 text-sm font-medium">
            ⚠️ {t('chat.webgpuNotSupported')} - {t('chat.webgpuRequiredBrowsers')}
          </p>
        </div>
      )}
      {/* Header */}
      <div className="border-b border-gray-200 p-4 bg-gray-50">
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
                  className="flex-1 px-3 py-1 border border-gray-300 rounded text-lg font-bold"
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (editedTitle.trim() && onRenameChat) {
                      onRenameChat(chat.id, editedTitle.trim());
                      setIsEditingTitle(false);
                    }
                  }}
                  className="text-green-600 hover:text-green-700 font-bold text-sm"
                >
                  ✓
                </button>
                <button
                  onClick={() => setIsEditingTitle(false)}
                  className="text-gray-600 hover:text-gray-700 font-bold text-sm"
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
                  className="text-gray-500 hover:text-gray-700 text-sm"
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
                  className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-700 bg-white"
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
            <div className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded">
              {error}
            </div>
          )}
        </div>

        {/* Model Selector */}
        <div className="flex gap-4 items-center flex-wrap">
          <label className="text-sm font-medium text-gray-700">{t('chat.selectModel')}:</label>
          <select
            value={selectedModelId}
            onChange={(e) => {
              setSelectedModelId(e.target.value);
              onSelectModel(e.target.value);
            }}
            disabled={isLoading}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
          >
            <option value="">{t('chat.selectModel')}...</option>
            {MODELS.map((model) => {
              const isDownloaded = isModelDownloaded?.(model.id) ?? false;
              return (
                <option key={model.id} value={model.id}>
                  {isDownloaded ? '✓' : '📥'} {model.name} ({model.modelSize})
                </option>
              );
            })}
          </select>

          {selectedModelId && (
            <>
              {isLoading && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-blue-600 font-medium">⟳ {t('chat.loading')}</span>
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all"
                      style={{ width: `${loadingProgress}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-blue-600">{loadingProgress}%</span>
                </div>
              )}
              {isModelLoaded && !isLoading && (
                <span className="text-sm text-green-600 font-medium">✓ {t('chat.modelLoaded')}</span>
              )}
              {error && !isLoading && (
                <span className="text-sm text-red-600 font-medium">❌ {t('chat.loadingError')}</span>
              )}
            </>
          )}
        </div>

        {/* Export/Import Section */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
          <ChatExportImport
            chat={chat}
            allChats={chats}
            onImportChats={onImportChats || (async () => {})}
          />
        </div>
      </div>

      {/* Messages Area */}
      <MessageList messages={chat.messages} isLoading={isLoading} messagesEndRef={messagesEndRef} />

      {/* Input Area */}
      <InputBox
        onSendMessage={onSendMessage}
        isLoading={isLoading}
        isModelLoaded={isModelLoaded}
      />
    </div>
  );
};
