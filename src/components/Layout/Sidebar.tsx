import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chat } from '../../types';
import { LanguageSwitcher } from './LanguageSwitcher';

interface SidebarProps {
  chats: Chat[];
  activeChat: Chat | null;
  onSelectChat: (chat: Chat) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  activeTab: 'chat' | 'models' | 'profiles' | 'settings' | 'help';
  onTabChange: (tab: 'chat' | 'models' | 'profiles' | 'settings' | 'help') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  chats,
  activeChat,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  activeTab,
  onTabChange,
}) => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const tabs = [
    { id: 'chat', icon: '💬', label: t('sidebar.chat') },
    { id: 'models', icon: '🤖', label: t('sidebar.models') },
    { id: 'profiles', icon: '👤', label: t('sidebar.profiles') },
    { id: 'settings', icon: '⚙️', label: t('sidebar.settings') },
    { id: 'help', icon: '❓', label: t('sidebar.help') },
  ];

  return (
    <div
      className={`${
        isCollapsed ? 'w-16' : 'w-64'
      } bg-gray-900 text-white h-screen flex flex-col transition-all duration-300`}
    >
      {/* Header - Fixed */}
      <div className="flex-shrink-0 p-4 border-b border-gray-700 flex items-center justify-between">
        {!isCollapsed && <h1 className="text-lg font-bold">{t('sidebar.title')}</h1>}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 hover:bg-gray-800 rounded"
        >
          {isCollapsed ? '→' : '←'}
        </button>
      </div>

      {/* New Chat Button - Fixed */}
      {!isCollapsed && (
        <div className="flex-shrink-0 px-4 py-2">
          <button
            onClick={onNewChat}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg w-full font-medium transition-colors text-center truncate"
          >
            {t('sidebar.newChat')}
          </button>
        </div>
      )}

      {/* Navigation Tabs - Fixed */}
      <div className={`flex-shrink-0 flex ${isCollapsed ? 'flex-col' : 'flex-wrap'} gap-2 px-2 py-4 border-b border-gray-700 min-w-0`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id as any)}
            className={`p-2 rounded transition-colors whitespace-nowrap text-sm ${
              activeTab === tab.id
                ? 'bg-blue-600'
                : 'hover:bg-gray-800'
            }`}
            title={tab.label}
          >
            {isCollapsed ? tab.icon : `${tab.icon} ${tab.label}`}
          </button>
        ))}
      </div>

      {/* Chat History - Scrollable */}
      {!isCollapsed && activeTab === 'chat' && (
        <div className="flex-1 overflow-y-auto px-2 py-4">
          <h3 className="text-xs uppercase text-gray-400 font-bold mb-2 px-2">{t('sidebar.history')}</h3>
          {chats.length === 0 ? (
            <p className="text-sm text-gray-400 px-2">{t('sidebar.noChatYet')}</p>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                className={`p-2 rounded mb-2 cursor-pointer group transition-colors ${
                  activeChat?.id === chat.id
                    ? 'bg-gray-700'
                    : 'hover:bg-gray-800'
                }`}
              >
                <div
                  onClick={() => onSelectChat(chat)}
                  className="flex-1 truncate text-sm"
                >
                  {chat.title}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteChat(chat.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 transition-opacity"
                >
                  {t('common.delete')}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Language Switcher - Fixed at Bottom */}
      <div className="flex-shrink-0">
        <LanguageSwitcher isCollapsed={isCollapsed} />
      </div>
    </div>
  );
};
