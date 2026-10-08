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
  activeTab: 'chat' | 'profiles' | 'memory' | 'library' | 'models' | 'data' | 'settings' | 'help' | 'roadmap' | 'wiki' | 'contact';
  onTabChange: (tab: 'chat' | 'profiles' | 'memory' | 'library' | 'models' | 'data' | 'settings' | 'help' | 'roadmap' | 'wiki' | 'contact') => void;
  darkMode: boolean;
  onToggleTheme: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  chats,
  activeChat,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  activeTab,
  onTabChange,
  darkMode,
  onToggleTheme,
}) => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  type TabId = 'chat' | 'profiles' | 'memory' | 'library' | 'models' | 'data' | 'settings' | 'help' | 'roadmap' | 'wiki' | 'contact';
  const tabs: Array<{ id: TabId; icon: string; label: string }> = [
    { id: 'chat', icon: '💬', label: t('sidebar.chat') },

    { id: 'profiles', icon: '👤', label: t('sidebar.profiles') },
    { id: 'memory', icon: '🧠', label: t('sidebar.memory') },
    { id: 'library', icon: '📚', label: t('sidebar.library') },
    { id: 'models', icon: '🤖', label: t('sidebar.models') },
    { id: 'data', icon: '💾', label: t('sidebar.data') },
    { id: 'settings', icon: '⚙️', label: t('sidebar.settings') },
    { id: 'help', icon: '❓', label: t('sidebar.help') },
    { id: 'roadmap', icon: '🗺️', label: t('sidebar.roadmap') },
    { id: 'wiki', icon: '📖', label: t('sidebar.wiki') },
    { id: 'contact', icon: '✉️', label: t('sidebar.contact') },
  ];

  return (
    <div
      className={`${
        isCollapsed ? 'w-16' : 'w-64'
      } bg-zinc-950 text-white h-screen flex flex-col transition-all duration-300 border-r border-zinc-800/60`}
    >
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-4 flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-sm font-bold shadow-lg shadow-indigo-500/20">
              AI
            </div>
            <h1 className="text-base font-semibold tracking-tight">{t('sidebar.title')}</h1>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
          aria-label={t("sidebar.toggle")}
        >
          {isCollapsed ? '→' : '←'}
        </button>
      </div>

      {/* New Chat Button */}
      <div className="flex-shrink-0 px-3 pt-1 pb-3">
        <button
          onClick={onNewChat}
          className={`w-full py-2.5 rounded-xl font-medium text-sm text-center truncate transition-all duration-200 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 shadow-lg shadow-indigo-500/25 ${
            isCollapsed ? 'px-0' : 'px-4'
          }`}
          title={t('sidebar.newChat')}
        >
          {isCollapsed ? '+' : `+ ${t('sidebar.newChat')}`}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-shrink-0 flex flex-col gap-1 px-3 pb-3 border-b border-zinc-800/60" data-tour="sidebar-nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors text-sm whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
            title={tab.label}
          >
            <span className="text-base leading-none">{tab.icon}</span>
            {!isCollapsed && <span className="truncate">{tab.label}</span>}
          </button>
        ))}
      </nav>

      {/* Chat History */}
      {!isCollapsed && activeTab === 'chat' && (
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <h3 className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-2 px-2">
            {t('sidebar.history')}
          </h3>
          {chats.length === 0 ? (
            <p className="text-sm text-zinc-500 px-2">{t('sidebar.noChatYet')}</p>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                className={`group flex items-center gap-1 rounded-xl mb-1 cursor-pointer transition-colors ${
                  activeChat?.id === chat.id
                    ? 'bg-zinc-800'
                    : 'hover:bg-zinc-900'
                }`}
              >
                <div
                  onClick={() => onSelectChat(chat)}
                  className="flex-1 px-3 py-2.5 truncate text-sm text-zinc-300"
                >
                  {chat.title}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteChat(chat.id);
                  }}
                  className="mr-1.5 opacity-0 group-hover:opacity-100 text-xs text-zinc-500 hover:text-red-400 transition-all p-1.5"
                  aria-label={t('common.delete')}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Footer: theme toggle + language */}
      <div className="flex-shrink-0 flex items-center gap-1 px-3 py-3 border-t border-zinc-800/60">
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          title={darkMode ? 'Light mode' : 'Dark mode'}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
        <div className="flex-1 min-w-0">
          <LanguageSwitcher isCollapsed={isCollapsed} />
        </div>
      </div>
    </div>
  );
};
