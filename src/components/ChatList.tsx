import React, { useState, useEffect } from 'react';
import { Chat, User } from '../types';
import { chatStore } from '../services/chatService';
import { ChatThemeConfig, themeService } from '../services/themeService';
import { securityService } from '../services/securityService';
import {
  Search,
  Pin,
  VolumeX,
  Archive,
  Trash2,
  MessageSquarePlus,
  Users,
  CheckCheck,
  MoreVertical,
  X,
  MessageSquare,
  Megaphone,
  Lock,
  Unlock,
  Sun,
  Moon,
  Timer,
} from 'lucide-react';

interface ChatListProps {
  chats: Chat[];
  activeChatId: string | null;
  onSelectChat: (chat: Chat) => void;
  onSelectUserToChat: (user: User) => void;
  currentUser: User | null;
  onNewChat: () => void;
  onNewGroup: () => void;
  onOpenChannelsBroadcast: () => void;
}

type InboxFilter = 'all' | 'unread' | 'pinned' | 'groups' | 'channels' | 'locked' | 'archived';

export const ChatList: React.FC<ChatListProps> = ({
  chats,
  activeChatId,
  onSelectChat,
  onSelectUserToChat,
  currentUser,
  onNewChat,
  onNewGroup,
  onOpenChannelsBroadcast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [menuChatId, setMenuChatId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pinPromptChatId, setPinPromptChatId] = useState<string | null>(null);
  const [inlinePin, setInlinePin] = useState('');
  const [registeredUsers, setRegisteredUsers] = useState<User[]>(chatStore.getUsers());
  const [chatTheme, setChatTheme] = useState<ChatThemeConfig>(themeService.getTheme());
  const [lockedIds, setLockedIds] = useState<string[]>(securityService.getLockedChatIds());

  useEffect(() => {
    const syncUsers = () => setRegisteredUsers(chatStore.getUsers());
    syncUsers();
    return chatStore.subscribe(syncUsers);
  }, []);

  useEffect(() => {
    return themeService.subscribe(() => setChatTheme(themeService.getTheme()));
  }, []);

  useEffect(() => {
    return securityService.subscribe(() => setLockedIds(securityService.getLockedChatIds()));
  }, []);

  const archivedChats = chatStore.getChats(true);
  const sourceChats = filter === 'archived' ? archivedChats : chats;

  const getChatPartner = (chat: Chat): User | undefined => {
    if (chat.type === 'group') return undefined;
    const partnerId = chat.participants.find((p) => p !== currentUser?.id);
    return partnerId ? chatStore.getUser(partnerId) : undefined;
  };

  const getChatTitle = (chat: Chat): string => {
    if (chat.type === 'group' || chat.type === 'channel' || chat.type === 'broadcast') {
      return chat.name || 'DOST Chat';
    }
    const partner = getChatPartner(chat);
    return partner ? partner.displayName : 'DOST User';
  };

  const getChatAvatar = (chat: Chat): string => {
    if (chat.type === 'group' || chat.type === 'channel' || chat.type === 'broadcast') {
      return chat.photoUrl || '/assets/aistudio/download_7eb2aac4.jpeg';
    }
    const partner = getChatPartner(chat);
    if (partner?.privacySettings?.profilePhotoVisibility === 'nobody') {
      return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(partner.displayName)}`;
    }
    return partner?.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner?.id || 'dost'}`;
  };

  const isPartnerOnline = (chat: Chat): boolean => {
    if (chat.type !== 'private') return false;
    const partner = getChatPartner(chat);
    if (!partner) return false;
    if (partner.privacySettings?.lastSeenVisibility === 'nobody') return false;
    return partner.isOnline;
  };

  const isSomeoneTyping = (chat: Chat): boolean => {
    if (!chat.typingUsers || !currentUser) return false;
    return Object.entries(chat.typingUsers).some(
      ([uid, active]) => uid !== currentUser.id && active === true
    );
  };

  const formatChatTime = (timeStr?: string): string => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 3600);
    if (diffHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const unreadChatsCount = chats.filter((c) => chatStore.getUnreadCountForChat(c.id) > 0).length;
  const pinnedChatsCount = currentUser
    ? chats.filter((c) => (c.pinnedBy || []).includes(currentUser.id)).length
    : 0;

  const trimmedQuery = searchQuery.trim().toLowerCase();

  const filteredChats = sourceChats.filter((chat) => {
    const isLocked = lockedIds.includes(chat.id);
    if (filter === 'locked') {
      if (!isLocked) return false;
    } else if (isLocked && !trimmedQuery) {
      return false;
    }

    const unreadCount = chatStore.getUnreadCountForChat(chat.id);
    const isPinned = currentUser ? (chat.pinnedBy || []).includes(currentUser.id) : false;
    if (filter === 'unread' && unreadCount === 0) return false;
    if (filter === 'pinned' && !isPinned) return false;
    if (filter === 'groups' && chat.type !== 'group') return false;
    if (filter === 'channels' && chat.type !== 'channel' && chat.type !== 'broadcast') return false;

    if (!trimmedQuery) return true;
    const title = getChatTitle(chat).toLowerCase();
    const lastMsg = (chat.lastMessage || '').toLowerCase();
    const partnerEmail = (getChatPartner(chat)?.email || '').toLowerCase();
    return (
      title.includes(trimmedQuery) ||
      lastMsg.includes(trimmedQuery) ||
      partnerEmail.includes(trimmedQuery)
    );
  });

  const shownPrivatePartnerIds = new Set(
    filteredChats
      .filter((c) => c.type === 'private')
      .map((c) => c.participants.find((p) => p !== currentUser?.id))
      .filter(Boolean) as string[]
  );

  const matchedRegisteredUsers = trimmedQuery
    ? registeredUsers.filter((u) => {
        if (u.id === currentUser?.id) return false;
        if (shownPrivatePartnerIds.has(u.id)) return false;
        return (
          (u.displayName || '').toLowerCase().includes(trimmedQuery) ||
          (u.email || '').toLowerCase().includes(trimmedQuery) ||
          (u.phoneNumber || '').toLowerCase().includes(trimmedQuery)
        );
      })
    : [];

  return (
    <div
      className="flex flex-col h-full border-r border-slate-200/80 dark:border-white/10 w-full md:w-[340px] lg:w-[380px] shrink-0 select-none relative transition-colors bg-white dark:bg-[#1E2126] text-slate-900 dark:text-zinc-100"
      onClick={() => menuChatId && setMenuChatId(null)}
    >
      {/* Top Inbox Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-['Outfit'] flex items-center gap-2 text-slate-900 dark:text-white tracking-tight">
            <span>DOST Inbox</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 tabular-nums">
              {sourceChats.length}
            </span>
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
            {unreadChatsCount > 0
              ? `${unreadChatsCount} unread conversation${unreadChatsCount > 1 ? 's' : ''}`
              : 'All caught up · Quick & encrypted chats'}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {/* Mobile Quick Dark/Light Toggle */}
          <button
            type="button"
            onClick={() => themeService.toggleDarkLight()}
            className="md:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-600 dark:text-amber-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] cursor-pointer"
            title={chatTheme.isDark ? 'Switch to Daylight Mode' : 'Switch to Charcoal Dark Mode'}
            aria-label="Toggle Dark Mode"
          >
            {chatTheme.isDark ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          </button>

          <button
            type="button"
            onClick={onOpenChannelsBroadcast}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-600 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-300 hover:bg-slate-100 dark:hover:bg-white/[0.07] transition-colors cursor-pointer"
            title="Channels & Broadcast Lists"
          >
            <Megaphone className="w-4.5 h-4.5" />
          </button>
          <button
            type="button"
            onClick={onNewGroup}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-600 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-300 hover:bg-slate-100 dark:hover:bg-white/[0.07] transition-colors cursor-pointer"
            title="Create New Group"
          >
            <Users className="w-4.5 h-4.5" />
          </button>
          <button
            type="button"
            onClick={onNewChat}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-sm transition-all cursor-pointer ml-0.5"
            title="Start New Direct Chat"
          >
            <MessageSquarePlus className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Search Bar & Quick Inbox Filters */}
      <div className="px-3.5 pt-3 pb-2.5 border-b border-slate-100 dark:border-white/10 space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search people, messages, or emails..."
            className="w-full pl-10 pr-8 py-2.5 rounded-xl text-xs bg-slate-100 dark:bg-[#272B32] focus:bg-white dark:focus:bg-[#2E333C] text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-400 border border-transparent focus:border-emerald-500/70 focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-1 rounded cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {(
            [
              { id: 'all', label: 'All' },
              {
                id: 'unread',
                label: unreadChatsCount > 0 ? `Unread (${unreadChatsCount})` : 'Unread',
              },
              ...(pinnedChatsCount > 0
                ? [{ id: 'pinned' as const, label: `Pinned (${pinnedChatsCount})` }]
                : []),
              { id: 'groups', label: 'Groups' },
              { id: 'channels', label: 'Channels' },
              ...(lockedIds.length > 0
                ? [{ id: 'locked' as const, label: `Locked (${lockedIds.length})` }]
                : []),
              { id: 'archived', label: `Archived (${archivedChats.length})` },
            ] as const
          ).map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  active
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-[#272B32] text-slate-600 dark:text-zinc-300 hover:bg-slate-200/70 dark:hover:bg-[#31363F]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chats Scrollable List */}
      <div className="flex-1 overflow-y-auto pb-20 md:pb-2 p-2 space-y-1">
        {filteredChats.length === 0 && matchedRegisteredUsers.length === 0 ? (
          <div className="p-8 text-center text-slate-400 dark:text-zinc-400 flex flex-col items-center justify-center h-56">
            <MessageSquarePlus className="w-10 h-10 text-slate-300 dark:text-zinc-600 mb-2 stroke-1.5" />
            <p className="text-xs font-medium">
              {trimmedQuery
                ? `No chats or registered users matching "${searchQuery.trim()}"`
                : filter === 'archived'
                ? 'No archived chats'
                : filter === 'unread'
                ? 'No unread messages'
                : filter === 'pinned'
                ? 'No pinned chats yet'
                : 'No conversations yet'}
            </p>
            {filter === 'all' && !trimmedQuery && (
              <button
                type="button"
                onClick={onNewChat}
                className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
              >
                Message a registered DOST user
              </button>
            )}
          </div>
        ) : (
          <>
            {filteredChats.map((chat) => {
              const isActive = chat.id === activeChatId;
              const title = getChatTitle(chat);
              const avatar = getChatAvatar(chat);
              const isOnline = isPartnerOnline(chat);
              const typing = isSomeoneTyping(chat);
              const isPinned = currentUser ? (chat.pinnedBy || []).includes(currentUser.id) : false;
              const isMuted = currentUser ? (chat.mutedBy || []).includes(currentUser.id) : false;
              const isArchived = currentUser
                ? (chat.archivedBy || []).includes(currentUser.id)
                : false;
              const unreadCount = chatStore.getUnreadCountForChat(chat.id);
              const hasUnread = unreadCount > 0;

              return (
                <div
                  key={chat.id}
                  onClick={() => onSelectChat(chat)}
                  className={`relative flex items-center gap-3 p-3 rounded-2xl transition-all cursor-pointer group ${
                    isActive
                      ? 'bg-emerald-500/14 dark:bg-emerald-500/18 ring-1 ring-emerald-500/35'
                      : hasUnread
                      ? 'bg-slate-50/90 dark:bg-[#252930] hover:bg-slate-100/90 dark:hover:bg-[#2B3038]'
                      : 'hover:bg-slate-50 dark:hover:bg-[#252930]/75'
                  }`}
                >
                  {/* Avatar with Online Status */}
                  <div className="relative shrink-0">
                    <img
                      src={avatar}
                      alt={title}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-full object-cover border border-slate-200/80 dark:border-white/10"
                    />
                    {isOnline && (
                      <span
                        className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-[#1E2126]"
                        title="Online"
                      />
                    )}
                    {chat.type === 'group' && (
                      <span className="absolute -bottom-1 -left-1 bg-emerald-700 text-white text-[9px] px-1.5 py-0.2 rounded-md font-bold shadow-xs">
                        GRP
                      </span>
                    )}
                    {chat.type === 'channel' && (
                      <span className="absolute -bottom-1 -left-1 bg-sky-600 text-white text-[9px] px-1.5 py-0.2 rounded-md font-bold shadow-xs">
                        CH
                      </span>
                    )}
                    {chat.type === 'broadcast' && (
                      <span className="absolute -bottom-1 -left-1 bg-amber-600 text-white text-[9px] px-1.5 py-0.2 rounded-md font-bold shadow-xs">
                        BC
                      </span>
                    )}
                    {lockedIds.includes(chat.id) && (
                      <span
                        className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-900 text-emerald-300 rounded-full flex items-center justify-center border border-white/25"
                        title="Locked Chat"
                      >
                        <Lock className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>

                  {/* Row Content: Name, Timestamp, Last Message Preview & Unread Badge */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span
                        className={`text-sm truncate flex items-center gap-1.5 ${
                          hasUnread
                            ? 'font-bold text-slate-950 dark:text-white'
                            : 'font-semibold text-slate-800 dark:text-zinc-100'
                        }`}
                      >
                        {hasUnread && (
                          <span
                            className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                        <span className="truncate">{title}</span>
                      </span>
                      <span
                        className={`text-[11px] font-mono tabular-nums shrink-0 ${
                          hasUnread
                            ? 'font-bold text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-400 dark:text-zinc-400'
                        }`}
                      >
                        {formatChatTime(chat.lastMessageTime)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-xs truncate pr-1 ${
                          typing
                            ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                            : hasUnread
                            ? 'text-slate-800 dark:text-zinc-100 font-semibold'
                            : 'text-slate-500 dark:text-zinc-400'
                        }`}
                      >
                        {typing ? (
                          'typing...'
                        ) : (
                          <>
                            {currentUser && chat.lastSenderId === currentUser.id && chat.lastMessage && (
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 inline mr-1 shrink-0" />
                            )}
                            {chat.lastMessage || 'Tap to start messaging'}
                          </>
                        )}
                      </p>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Desktop quick Pin & Archive triggers on hover */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            chatStore.togglePinChat(chat.id);
                          }}
                          className="hidden md:inline-flex opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-slate-200/70 dark:hover:bg-white/10 text-slate-400 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-opacity cursor-pointer"
                          title={isPinned ? 'Unpin Chat' : 'Pin Chat'}
                        >
                          <Pin className={`w-3.5 h-3.5 ${isPinned ? 'text-emerald-500 fill-emerald-500/30 rotate-45' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            chatStore.toggleArchiveChat(chat.id);
                          }}
                          className="hidden md:inline-flex opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-slate-200/70 dark:hover:bg-white/10 text-slate-400 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-opacity cursor-pointer"
                          title={isArchived ? 'Unarchive Chat' : 'Archive Chat'}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>

                        {(chat.disappearingDuration || 0) > 0 && (
                          <span title="Disappearing messages active">
                            <Timer className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          </span>
                        )}
                        {isPinned && (
                          <Pin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 rotate-45 group-hover:md:hidden" />
                        )}
                        {isMuted && <VolumeX className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />}
                        {hasUnread && (
                          <span className="bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 font-bold text-[10px] min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center tabular-nums shadow-xs">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* More Actions Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuChatId(menuChatId === chat.id ? null : chat.id);
                    }}
                    className="opacity-80 md:opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-100 rounded-lg cursor-pointer"
                    aria-label="Chat options"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {/* Floating Context Menu */}
                  {menuChatId === chat.id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-4 top-12 z-30 w-48 bg-white dark:bg-[#262A32] rounded-2xl shadow-xl border border-slate-100 dark:border-white/10 p-1.5 text-xs text-slate-700 dark:text-zinc-200 animate-scale-in"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          chatStore.togglePinChat(chat.id);
                          setMenuChatId(null);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.06] rounded-xl flex items-center gap-2 cursor-pointer"
                      >
                        <Pin className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{isPinned ? 'Unpin Chat' : 'Pin to Top'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          chatStore.toggleMuteChat(chat.id);
                          setMenuChatId(null);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.06] rounded-xl flex items-center gap-2 cursor-pointer"
                      >
                        <VolumeX className="w-3.5 h-3.5" />
                        <span>{isMuted ? 'Unmute Notifications' : 'Mute Notifications'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          chatStore.toggleArchiveChat(chat.id);
                          setMenuChatId(null);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.06] rounded-xl flex items-center gap-2 cursor-pointer"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>{isArchived ? 'Unarchive Chat' : 'Archive Chat'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (lockedIds.includes(chat.id)) {
                            securityService.unlockChat(chat.id);
                          } else if (!securityService.hasPin()) {
                            setInlinePin('');
                            setPinPromptChatId(chat.id);
                          } else {
                            securityService.lockChat(chat.id);
                          }
                          setMenuChatId(null);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.06] rounded-xl flex items-center gap-2 cursor-pointer"
                      >
                        {lockedIds.includes(chat.id) ? (
                          <>
                            <Unlock className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Unlock Chat</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Lock Chat</span>
                          </>
                        )}
                      </button>
                      <div className="my-1 border-t border-slate-100 dark:border-white/10" />
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDeleteId(chat.id);
                          setMenuChatId(null);
                        }}
                        className="w-full text-left px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 rounded-xl flex items-center gap-2 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Chat</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {matchedRegisteredUsers.length > 0 && (
              <div className="bg-slate-50/70 dark:bg-[#23272F] rounded-2xl mt-2 overflow-hidden border border-slate-100 dark:border-white/10">
                <div className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-500/15 border-b border-emerald-100/70 dark:border-white/10 flex items-center justify-between">
                  <span>Registered DOST Users</span>
                  <span>{matchedRegisteredUsers.length}</span>
                </div>
                {matchedRegisteredUsers.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => {
                      setSearchQuery('');
                      onSelectUserToChat(user);
                    }}
                    className="flex items-center justify-between gap-3 p-3.5 hover:bg-emerald-50/60 dark:hover:bg-white/[0.05] transition-all cursor-pointer border-b last:border-b-0 border-slate-100/70 dark:border-white/5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={
                            user.photoUrl ||
                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`
                          }
                          alt={user.displayName}
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-white/10"
                        />
                        {user.isOnline && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-[#23272F] bg-emerald-500" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100 truncate">
                          {user.displayName}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                          {user.bio || user.email}
                        </p>
                      </div>
                    </div>

                    <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white text-[11px] font-semibold rounded-lg shadow-xs">
                      <MessageSquare className="w-3 h-3" />
                      <span>Chat</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* In-app Delete Confirmation Dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#22252B] rounded-2xl p-5 max-w-xs w-full shadow-2xl border border-slate-100 dark:border-white/10">
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100 mb-1">
              Delete conversation?
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
              This will remove the chat thread from Firestore.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-200 bg-slate-100 dark:bg-[#2D3139] rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  chatStore.deleteChat(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="flex-1 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Inline 4-Digit PIN Setup Modal for Chat Lock */}
      {pinPromptChatId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const clean = inlinePin.replace(/\D/g, '').slice(0, 4);
              if (clean.length !== 4) return;
              await securityService.setPin(clean);
              securityService.lockChat(pinPromptChatId);
              setPinPromptChatId(null);
              setInlinePin('');
            }}
            className="bg-white dark:bg-[#22252B] rounded-2xl p-5 max-w-xs w-full shadow-2xl border border-slate-100 dark:border-white/10 space-y-3"
          >
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <Lock className="w-4 h-4" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                Set PIN to Lock Chat
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Enter a 4-digit PIN (you can also use Fingerprint/Face ID to unlock later).
            </p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={inlinePin}
              onChange={(e) => setInlinePin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Enter 4 digits"
              className="w-full px-3 py-2 text-sm font-mono tracking-widest text-center bg-slate-50 dark:bg-[#1A1D22] border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:border-emerald-500"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPinPromptChatId(null)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-200 bg-slate-100 dark:bg-[#2D3139] rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={inlinePin.length !== 4}
                className="flex-1 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50 cursor-pointer"
              >
                Lock Chat
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
