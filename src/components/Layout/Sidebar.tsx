import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chat, ChatFolder } from '../../types';
import { LanguageSwitcher } from './LanguageSwitcher';

type TabId = 'chat' | 'profiles' | 'memory' | 'library' | 'models' | 'data' | 'settings' | 'help' | 'roadmap' | 'wiki' | 'contact' | 'privacy' | 'imprint';

interface SidebarProps {
  chats: Chat[];
  activeChat: Chat | null;
  onSelectChat: (chat: Chat) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  darkMode: boolean;
  onToggleTheme: () => void;
  folders: ChatFolder[];
  onCreateFolder: (name: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onMoveChat: (chatId: string, folderId: string | null) => void;
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
  folders,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveChat,
}) => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const // Collapsed folder sections in the chat history
    [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  // Chat whose "move to folder" popover is open
  const [moveMenuChatId, setMoveMenuChatId] = useState<string | null>(null);
  // Collapsed menu groups
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['manage']));

  const toggleFolder = (folderId: string): void => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const toggleGroup = (groupId: string): void => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleCreateFolder = (): void => {
    const name = window.prompt(t('sidebar.folderNamePrompt'));
    if (name?.trim()) {
      onCreateFolder(name.trim());
    }
  };

  const handleRenameFolder = (folder: ChatFolder): void => {
    const name = window.prompt(t('sidebar.renameFolderPrompt'), folder.name);
    if (name?.trim() && name.trim() !== folder.name) {
      onRenameFolder(folder.id, name.trim());
    }
  };

  const handleDeleteFolder = (folder: ChatFolder): void => {
    const confirmed = window.confirm(t('sidebar.deleteFolderConfirm', { name: folder.name }));
    if (confirmed) {
      onDeleteFolder(folder.id);
    }
  };

  // Primary tabs are always visible as single buttons
  const primaryTabs: Array<{ id: TabId; icon: string; label: string }> = [
    { id: 'chat', icon: '💬', label: t('sidebar.chat') },
    { id: 'settings', icon: '⚙️', label: t('sidebar.settings') },
  ];

  // Management pages are grouped (and collapsed by default)
  const manageTabs: Array<{ id: TabId; icon: string; label: string }> = [
    { id: 'profiles', icon: '👤', label: t('sidebar.profiles') },
    { id: 'memory', icon: '🧠', label: t('sidebar.memory') },
    { id: 'library', icon: '📚', label: t('sidebar.library') },
    { id: 'models', icon: '🤖', label: t('sidebar.models') },
    { id: 'data', icon: '💾', label: t('sidebar.data') },
  ];

  // Help + legal pages are grouped (and collapsed by default)
  const helpTabs: Array<{ id: TabId; icon: string; label: string }> = [
    { id: 'help', icon: '❓', label: t('sidebar.help') },
    { id: 'roadmap', icon: '🗺️', label: t('sidebar.roadmap') },
    { id: 'wiki', icon: '📖', label: t('sidebar.wiki') },
    { id: 'contact', icon: '✉️', label: t('sidebar.contact') },
    { id: 'privacy', icon: '🔒', label: t('sidebar.privacy') },
    { id: 'imprint', icon: '📋', label: t('sidebar.imprint') },
  ];

  const groups: Array<{ id: string; label: string; tabs: Array<{ id: TabId; icon: string; label: string }> }> = [
    { id: 'manage', label: t('sidebar.groupManage'), tabs: manageTabs },
    { id: 'help', label: t('sidebar.groupHelp'), tabs: helpTabs },
  ];

  const chatsInFolder = (folderId: string): Chat[] => chats.filter((c) => c.folderId === folderId);
  const ungroupedChats = chats.filter((c) => !c.folderId || !folders.some((f) => f.id === c.folderId));

  const renderChatRow = (chat: Chat): React.ReactNode => (
    <div
      key={chat.id}
      className={`group relative flex items-center gap-1 rounded-xl mb-1 transition-colors ${
        activeChat?.id === chat.id
          ? 'bg-zinc-800'
          : 'hover:bg-zinc-900'
      }`}
    >
      <button
        type="button"
        onClick={() => onSelectChat(chat)}
        className={`flex-1 px-3 py-2.5 truncate text-sm text-left rounded-xl ${
          activeChat?.id === chat.id ? 'text-white' : 'text-zinc-300'
        }`}
      >
        {chat.title}
      </button>
      <button
        type="button"
        onClick={() => setMoveMenuChatId((prev) => (prev === chat.id ? null : chat.id))}
        aria-label={t('sidebar.moveChat')}
        title={t('sidebar.moveChat')}
        className="mr-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-xs text-zinc-500 hover:text-indigo-300 transition-all p-1.5"
      >
        📁
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDeleteChat(chat.id);
        }}
        className="mr-1.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-xs text-zinc-500 hover:text-red-400 transition-all p-1.5"
        aria-label={t('common.delete')}
      >
        ✕
      </button>
      {moveMenuChatId === chat.id && (
        <div
          className="absolute right-1 top-8 z-50 min-w-40 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-900 shadow-xl p-1.5"
          role="menu"
          aria-label={t('sidebar.moveChat')}
        >
          {folders.map((folder) => (
            <button
              key={folder.id}
              role="menuitem"
              onClick={() => {
                onMoveChat(chat.id, chat.folderId === folder.id ? null : folder.id);
                setMoveMenuChatId(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              📁 <span className="truncate">{folder.name}</span>
              {chat.folderId === folder.id && <span className="ml-auto text-indigo-400">✓</span>}
            </button>
          ))}
          <div className="border-t border-zinc-800 my-1" />
          <button
            role="menuitem"
            onClick={() => {
              handleCreateFolder();
              setMoveMenuChatId(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            ➕ <span>{t('sidebar.newFolder')}</span>
          </button>
          {chat.folderId && (
            <button
              role="menuitem"
              onClick={() => {
                onMoveChat(chat.id, null);
                setMoveMenuChatId(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              ↩ <span>{t('sidebar.removeFromFolder')}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );

  const navButton = (tab: { id: TabId; icon: string; label: string }): React.ReactNode => (
    <button
      key={tab.id}
      onClick={() => onTabChange(tab.id)}
      aria-current={activeTab === tab.id ? 'page' : undefined}
      className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors text-sm whitespace-nowrap ${
        activeTab === tab.id
          ? 'bg-zinc-800 text-white'
          : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
      }`}
      title={tab.label}
    >
      <span className="text-base leading-none" aria-hidden="true">{tab.icon}</span>
      {!isCollapsed && <span className="truncate">{tab.label}</span>}
    </button>
  );

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
            <div className="w-8 h-8 rounded-xl bg-indigo-700 flex items-center justify-center text-sm font-bold shadow-lg shadow-indigo-500/20">
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
          className={`w-full py-2.5 rounded-xl font-medium text-sm text-center truncate transition-all duration-200 bg-indigo-700 hover:bg-indigo-600 shadow-lg ${
            isCollapsed ? 'px-0' : 'px-4'
          }`}
          title={t('sidebar.newChat')}
        >
          {isCollapsed ? '+' : `+ ${t('sidebar.newChat')}`}
        </button>
      </div>

      {/* Navigation */}
      <nav
        className="flex-shrink-0 flex flex-col gap-1 px-3 pb-3 border-b border-zinc-800/60"
        data-tour="sidebar-nav"
        aria-label={t('sidebar.navigation')}
      >
        {primaryTabs.map(navButton)}
        {groups.map((group) => (
          <div key={group.id} className="relative">
            <button
              onClick={() => {
                if (isCollapsed) {
                  setIsCollapsed(false);
                  setOpenGroups((prev) => new Set(prev).add(group.id));
                } else {
                  toggleGroup(group.id);
                }
              }}
              aria-expanded={!isCollapsed && openGroups.has(group.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors text-sm whitespace-nowrap ${
                group.tabs.some((tab) => tab.id === activeTab)
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
              }`}
              title={isCollapsed ? group.tabs.map((tab) => tab.label).join(', ') : group.label}
            >
              <span className="text-base leading-none" aria-hidden="true">
                {group.id === 'manage' ? '🗂️' : '❓'}
              </span>
              {!isCollapsed && (
                <>
                  <span className="truncate flex-1 text-left">{group.label}</span>
                  <span
                    className={`text-xs transition-transform ${openGroups.has(group.id) ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  >
                    ▾
                  </span>
                </>
              )}
            </button>
            {!isCollapsed && openGroups.has(group.id) && (
              <div className="flex flex-col gap-1 pl-3 mt-1 border-l border-zinc-800/60 ml-4">
                {group.tabs.map(navButton)}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Chat History - always visible, gets the remaining space */}
      {!isCollapsed && (
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 relative">
          <div className="flex items-center justify-between mb-2 px-2">
            <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
              {t('sidebar.history')}
            </h3>
            <button
              onClick={handleCreateFolder}
              className="text-xs text-zinc-400 hover:text-white transition-colors p-1 rounded"
              title={t('sidebar.newFolder')}
              aria-label={t('sidebar.newFolder')}
            >
              📁+
            </button>
          </div>

          {chats.length === 0 && (
            <p className="text-sm text-zinc-400 px-2">{t('sidebar.noChatYet')}</p>
          )}

          {/* Folders */}
          {folders.map((folder) => {
            const folderChats = chatsInFolder(folder.id);
            const isCollapsedFolder = collapsedFolders.has(folder.id);
            return (
              <div key={folder.id} className="mb-1">
                <div
                  className={`group flex items-center gap-1 rounded-xl transition-colors ${
                    folderChats.length > 0 && !isCollapsedFolder ? 'bg-zinc-900/60' : 'hover:bg-zinc-900'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleFolder(folder.id)}
                    aria-expanded={!isCollapsedFolder}
                    className="flex-1 flex items-center gap-2 px-2.5 py-2 text-left text-sm text-zinc-300 rounded-xl"
                  >
                    <span
                      className={`text-xs transition-transform ${isCollapsedFolder ? '' : 'rotate-90'}`}
                      aria-hidden="true"
                    >
                      ▸
                    </span>
                    <span aria-hidden="true">📁</span>
                    <span className="truncate">{folder.name}</span>
                    <span className="text-xs text-zinc-500 ml-auto tabular-nums">{folderChats.length}</span>
                  </button>
                  <button
                    onClick={() => handleRenameFolder(folder)}
                    className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-xs text-zinc-500 hover:text-indigo-300 transition-all p-1"
                    aria-label={t('sidebar.renameFolder')}
                    title={t('sidebar.renameFolder')}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteFolder(folder)}
                    className="mr-1.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-xs text-zinc-500 hover:text-red-400 transition-all p-1"
                    aria-label={t('sidebar.deleteFolder')}
                    title={t('sidebar.deleteFolder')}
                  >
                    ✕
                  </button>
                </div>
                {!isCollapsedFolder && (
                  <div className="pl-3 mt-0.5">
                    {folderChats.length === 0 ? (
                      <p className="text-xs text-zinc-600 px-3 py-1.5">{t('sidebar.emptyFolder')}</p>
                    ) : (
                      folderChats.map(renderChatRow)
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Ungrouped chats */}
          {ungroupedChats.length > 0 && (
            <div className={folders.length > 0 ? 'mt-2 pt-2 border-t border-zinc-800/60' : ''}>
              {folders.length > 0 && (
                <p className="text-xs text-zinc-600 px-2 mb-1">{t('sidebar.withoutFolder')}</p>
              )}
              {ungroupedChats.map(renderChatRow)}
            </div>
          )}
        </div>
      )}

      {/* Footer: theme toggle + language */}
      <div className="flex-shrink-0 flex items-center gap-1 px-3 py-3 border-t border-zinc-800/60">
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          title={darkMode ? t('sidebar.switchToLightMode') : t('sidebar.switchToDarkMode')}
          aria-label={darkMode ? t('sidebar.switchToLightMode') : t('sidebar.switchToDarkMode')}
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
