import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chat, ChatFolder, ChatMetadata } from '../../types';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useDarkMode } from '../../hooks/useDarkMode';
import { version as appVersion } from '../../../package.json';

type TabId = 'chat' | 'profiles' | 'memory' | 'library' | 'models' | 'images' | 'data' | 'settings' | 'help' | 'roadmap' | 'wiki' | 'contact' | 'privacy' | 'imprint';

interface SidebarProps {
  chats: ChatMetadata[];
  activeChat: Chat | null;
  onSelectChat: (chat: ChatMetadata) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onToggleTheme: () => void;
  folders: ChatFolder[];
  onCreateFolder: (name: string) => ChatFolder;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onMoveChat: (chatId: string, folderId: string | null) => void;
  /** Opens the "What's new" dialog (version button in the footer) */
  onShowWhatsNew?: () => void;
  /** Fill the parent container instead of the full viewport height. Used in
   * the mobile drawer, where the sidebar sits below the drawer header:
   * h-screen there would overflow the drawer by the header's height and
   * clip the sidebar bottom (unreachable nav items, no scrolling). */
  fillHeight?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  chats,
  activeChat,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  activeTab,
  onTabChange,
  onToggleTheme,
  folders,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveChat,
  onShowWhatsNew,
  fillHeight = false,
}) => {
  const { t } = useTranslation();
  const darkMode = useDarkMode();
  const [isCollapsed, setIsCollapsed] = useState(false);
  // Collapsed folder sections in the chat history
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  // Chat whose "move to folder" popover is open
  const [moveMenuChatId, setMoveMenuChatId] = useState<string | null>(null);
  // Collapsed menu groups
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['manage']));
  // Drag & drop: id of the dragged chat and the current drop target
  const [draggedChatId, setDraggedChatId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ type: 'folder' | 'ungrouped'; id?: string } | null>(null);
  // Inline folder creation (optionally moving a chat into the new folder)
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [createForChatId, setCreateForChatId] = useState<string | null>(null);
  // Inline folder rename
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

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

  const openCreateFolderForm = (chatId: string | null): void => {
    setCreateForChatId(chatId);
    setNewFolderName('');
    setCreatingFolder(true);
    setMoveMenuChatId(null);
  };

  const submitCreateFolder = (): void => {
    const name = newFolderName.trim();
    if (!name) {
      setCreatingFolder(false);
      setCreateForChatId(null);
      return;
    }
    const folder = onCreateFolder(name);
    // When the form was opened from a chat's move menu, move that chat
    // straight into the freshly created folder
    if (createForChatId) {
      onMoveChat(createForChatId, folder.id);
    }
    setCreatingFolder(false);
    setCreateForChatId(null);
    setNewFolderName('');
  };

  const startRenameFolder = (folder: ChatFolder): void => {
    setRenamingFolderId(folder.id);
    setRenameValue(folder.name);
  };

  const submitRenameFolder = (): void => {
    const name = renameValue.trim();
    if (renamingFolderId && name) {
      onRenameFolder(renamingFolderId, name);
    }
    setRenamingFolderId(null);
    setRenameValue('');
  };

  const handleDeleteFolder = (folder: ChatFolder): void => {
    const confirmed = window.confirm(t('sidebar.deleteFolderConfirm', { name: folder.name }));
    if (confirmed) {
      onDeleteFolder(folder.id);
    }
  };

  // ----- Drag & drop handlers (chats into folders / out via the
  // ungrouped zone). Touch devices have no HTML5 drag - the move menu
  // button stays as the fallback. -----
  const handleChatDragStart = (e: React.DragEvent, chatId: string): void => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', chatId);
    setDraggedChatId(chatId);
  };

  const handleChatDragEnd = (): void => {
    setDraggedChatId(null);
    setDropTarget(null);
  };

  const handleDropOnFolder = (e: React.DragEvent, folderId: string): void => {
    e.preventDefault();
    if (draggedChatId) {
      onMoveChat(draggedChatId, folderId);
    }
    handleChatDragEnd();
  };

  const handleDropOnUngrouped = (e: React.DragEvent): void => {
    e.preventDefault();
    if (draggedChatId) {
      onMoveChat(draggedChatId, null);
    }
    handleChatDragEnd();
  };

  // Primary tabs are always visible as single buttons
  const primaryTabs: Array<{ id: TabId; icon: string; label: string }> = [
    { id: 'chat', icon: '💬', label: t('sidebar.chat') },
    { id: 'images', icon: '🎨', label: t('sidebar.images') },
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

  // Group the chats by folder in ONE pass instead of filtering the full
  // list once per folder (O(chats + folders) instead of O(chats x folders)
  // on every render - and this component re-renders on every chat update).
  const { chatsByFolderId, ungroupedChats } = React.useMemo(() => {
    const map = new Map<string, ChatMetadata[]>();
    for (const folder of folders) {
      map.set(folder.id, []);
    }
    const ungrouped: ChatMetadata[] = [];
    for (const chat of chats) {
      const bucket = chat.folderId !== undefined && chat.folderId !== null ? map.get(chat.folderId) : undefined;
      if (bucket) {
        bucket.push(chat);
      } else {
        ungrouped.push(chat);
      }
    }
    return { chatsByFolderId: map, ungroupedChats: ungrouped };
  }, [chats, folders]);
  const chatsInFolder = (folderId: string): ChatMetadata[] => chatsByFolderId.get(folderId) ?? [];

  const renderChatRow = (chat: ChatMetadata): React.ReactNode => (
    <div
      key={chat.id}
      draggable
      onDragStart={(e) => handleChatDragStart(e, chat.id)}
      onDragEnd={handleChatDragEnd}
      className={`group relative flex items-center gap-1 rounded-xl mb-1 transition-all ${
        draggedChatId === chat.id ? 'opacity-40' : ''
      } ${
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
          // A mis-click on this hover-only button must not destroy a chat
          // irreversibly - ask first, like folders and profiles do.
          if (window.confirm(t('sidebar.deleteChatConfirm', { title: chat.title }))) {
            onDeleteChat(chat.id);
          }
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
            onClick={() => openCreateFolderForm(chat.id)}
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
      } bg-zinc-950 text-white ${fillHeight ? 'h-full' : 'h-screen'} flex flex-col transition-all duration-300 border-r border-zinc-800/60`}
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
              onClick={() => openCreateFolderForm(null)}
              className="text-xs text-zinc-400 hover:text-white transition-colors p-1 rounded"
              title={t('sidebar.newFolder')}
              aria-label={t('sidebar.newFolder')}
            >
              📁+
            </button>
          </div>

          {/* Inline form: create a new folder */}
          {creatingFolder && (
            <div className="flex items-center gap-1 px-2 mb-2">
              <span aria-hidden="true">📁</span>
              <input
                // Deliberate: the input IS the just-opened folder form -
                // the focus belongs here, there is nothing to steal it from.
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitCreateFolder();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setCreatingFolder(false);
                    setCreateForChatId(null);
                  }
                }}
                placeholder={t('sidebar.folderNamePrompt')}
                aria-label={t('sidebar.newFolder')}
                className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-zinc-600 bg-zinc-900 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={submitCreateFolder}
                className="p-1.5 text-green-400 hover:bg-zinc-800 rounded-lg transition-colors"
                aria-label={t('common.save')}
                title={t('common.save')}
              >
                ✓
              </button>
              <button
                onClick={() => {
                  setCreatingFolder(false);
                  setCreateForChatId(null);
                }}
                className="p-1.5 text-zinc-400 hover:bg-zinc-800 rounded-lg transition-colors"
                aria-label={t('common.cancel')}
                title={t('common.cancel')}
              >
                ✕
              </button>
            </div>
          )}

          {chats.length === 0 && folders.length === 0 && (
            <p className="text-sm text-zinc-400 px-2">{t('sidebar.noChatYet')}</p>
          )}

          {/* Folders - drop targets for chats */}
          {folders.map((folder) => {
            const folderChats = chatsInFolder(folder.id);
            const isCollapsedFolder = collapsedFolders.has(folder.id);
            const isDropTarget = dropTarget?.type === 'folder' && dropTarget.id === folder.id;
            const isRenaming = renamingFolderId === folder.id;
            return (
              <div
                key={folder.id}
                className="mb-1"
                onDragOver={(e) => {
                  if (draggedChatId) {
                    e.preventDefault();
                    setDropTarget({ type: 'folder', id: folder.id });
                  }
                }}
                onDragLeave={() => {
                  setDropTarget((prev) => (prev?.type === 'folder' && prev.id === folder.id ? null : prev));
                }}
                onDrop={(e) => handleDropOnFolder(e, folder.id)}
              >
                <div
                  className={`group flex items-center gap-1 rounded-xl transition-all ${
                    isDropTarget ? 'ring-2 ring-indigo-500 bg-zinc-900' : ''
                  } ${
                    folderChats.length > 0 && !isCollapsedFolder ? 'bg-zinc-900/60' : 'hover:bg-zinc-900'
                  }`}
                >
                  {isRenaming ? (
                    <div className="flex-1 flex items-center gap-1 px-2 py-1.5">
                      <span aria-hidden="true">📁</span>
                      <input
                        // Deliberate: the input IS the just-opened rename
                        // form - the focus belongs here.
                        // eslint-disable-next-line jsx-a11y/no-autofocus
                        autoFocus
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            submitRenameFolder();
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setRenamingFolderId(null);
                          }
                        }}
                        aria-label={t('sidebar.renameFolder')}
                        className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-zinc-600 bg-zinc-900 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        onClick={submitRenameFolder}
                        className="p-1 text-green-400 hover:bg-zinc-800 rounded-lg transition-colors"
                        aria-label={t('common.save')}
                        title={t('common.save')}
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setRenamingFolderId(null)}
                        className="p-1 text-zinc-400 hover:bg-zinc-800 rounded-lg transition-colors"
                        aria-label={t('common.cancel')}
                        title={t('common.cancel')}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
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
                        onClick={() => startRenameFolder(folder)}
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
                    </>
                  )}
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

          {/* Drop zone: drag a chat here to remove it from its folder */}
          {draggedChatId && chats.find((c) => c.id === draggedChatId)?.folderId && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDropTarget({ type: 'ungrouped' });
              }}
              onDragLeave={() => {
                setDropTarget((prev) => (prev?.type === 'ungrouped' ? null : prev));
              }}
              onDrop={handleDropOnUngrouped}
              className={`mb-1 px-3 py-2 rounded-xl text-xs text-center transition-all ${
                dropTarget?.type === 'ungrouped'
                  ? 'ring-2 ring-indigo-500 bg-zinc-900 text-zinc-200'
                  : 'border-2 border-dashed border-zinc-700 text-zinc-500'
              }`}
            >
              ↩ {t('sidebar.dropToRemove')}
            </div>
          )}

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

      {/* Footer: theme toggle + language, version underneath */}
      <div className="flex-shrink-0 px-3 py-3 border-t border-zinc-800/60">
        <div className="flex items-center gap-1">
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
        <button
          onClick={() => onShowWhatsNew?.()}
          disabled={!onShowWhatsNew}
          className="mt-2 w-full text-left text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:cursor-default"
          title={t('sidebar.whatsNewHint')}
          aria-label={t('sidebar.whatsNewHint')}
        >
          v{appVersion}
        </button>
      </div>
    </div>
  );
};
