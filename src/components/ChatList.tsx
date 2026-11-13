import React, { useState, useEffect } from 'react';
import { Chat, User } from '../types';
import { chatStore } from '../services/chatService';
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
} from 'lucide-react';

interface ChatListProps {
  chats: Chat[];
  activeChatId: string | null;
  onSelectChat: (chat: Chat) => void;
  onSelectUserToChat: (user: User) => void;
  currentUser: User | null;
  onNewChat: () => void;
  onNewGroup: () => void;
}

export const ChatList: React.FC<ChatListProps> = ({
  chats,
  activeChatId,
  onSelectChat,
  onSelectUserToChat,
  currentUser,
  onNewChat,
  onNewGroup,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'groups' | 'archived'>('all');
  const [menuChatId, setMenuChatId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [registeredUsers, setRegisteredUsers] = useState<User[]>(chatStore.getUsers());

  useEffect(() => {
    const syncUsers = () => setRegisteredUsers(chatStore.getUsers());
    syncUsers();
    return chatStore.subscribe(syncUsers);
  }, []);

  const archivedChats = chatStore.getChats(true);
  const sourceChats = filter === 'archived' ? archivedChats : chats;

  const getChatPartner = (chat: Chat): User | undefined => {
    if (chat.type === 'group') return undefined;
    const partnerId = chat.participants.find((p) => p !== currentUser?.id);
    return partnerId ? chatStore.getUser(partnerId) : undefined;
  };

  const getChatTitle = (chat: Chat): string => {
    if (chat.type === 'group') return chat.name || 'Group Chat';
    const partner = getChatPartner(chat);
    return partner ? partner.displayName : 'DOST User';
  };

  const getChatAvatar = (chat: Chat): string => {
    if (chat.type === 'group') return chat.photoUrl || '/assets/aistudio/download_7eb2aac4.jpeg';
    const partner = getChatPartner(chat);
    if (partner?.privacySettings?.profilePhotoVisibility === 'nobody') {
      return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(partner.displayName)}`;
    }
    return partner?.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner?.id || 'dost'}`;
  };

  const isPartnerOnline = (chat: Chat): boolean => {
    if (chat.type === 'group') return false;
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

  const trimmedQuery = searchQuery.trim().toLowerCase();

  const filteredChats = sourceChats.filter((chat) => {
    const unreadCount = chatStore.getUnreadCountForChat(chat.id);
    if (filter === 'unread' && unreadCount === 0) return false;
    if (filter === 'groups' && chat.type !== 'group') return false;

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

  // Also search all registered users by name, email, or phone directly from Chats search
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
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-full md:w-80 lg:w-96 shrink-0 select-none relative">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 font-['Outfit'] flex items-center gap-2">
            <span>Chats</span>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-medium px-2 py-0.5 rounded-full">
              {sourceChats.length}
            </span>
          </h1>
          <p className="text-[11px] text-slate-400">DOST Messaging App · Husnain Butt</p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onNewGroup}
            className="p-2 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
            title="Create New Group"
          >
            <Users className="w-5 h-5" />
          </button>
          <button
            onClick={onNewChat}
            className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all cursor-pointer"
            title="Start New Direct Chat"
          >
            <MessageSquarePlus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats or registered user name..."
            className="w-full pl-9 pr-8 py-2 bg-slate-100 focus:bg-white rounded-xl text-xs text-slate-800 placeholder-slate-400 border border-transparent focus:border-emerald-500 focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Segmented Control */}
        <div className="flex items-center gap-1 mt-2.5 overflow-x-auto">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'unread', label: 'Unread' },
              { id: 'groups', label: 'Groups' },
              { id: 'archived', label: `Archived (${archivedChats.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                filter === tab.id ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chats Scrollable List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-50 pb-16 md:pb-0">
        {filteredChats.length === 0 && matchedRegisteredUsers.length === 0 ? (
          <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center h-48">
            <MessageSquarePlus className="w-10 h-10 text-slate-300 mb-2 stroke-1" />
            <p className="text-xs font-medium">
              {trimmedQuery
                ? `No chats or registered users matching "${searchQuery.trim()}"`
                : filter === 'archived'
                ? 'No archived chats'
                : 'No conversations yet'}
            </p>
            {filter !== 'archived' && !trimmedQuery && (
              <button
                onClick={onNewChat}
                className="mt-3 text-xs text-emerald-700 font-semibold hover:underline cursor-pointer"
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
              const isArchived = currentUser ? (chat.archivedBy || []).includes(currentUser.id) : false;
              const unreadCount = chatStore.getUnreadCountForChat(chat.id);

              return (
                <div
                  key={chat.id}
                  onClick={() => onSelectChat(chat)}
                  className={`relative flex items-center gap-3 p-3.5 transition-all cursor-pointer group ${
                    isActive
                      ? 'bg-emerald-50/70 border-l-4 border-emerald-600'
                      : 'hover:bg-slate-50'
                  }`}
                >
                {/* Avatar with Online Badge */}
                <div className="relative shrink-0">
                  <img
                    src={avatar}
                    alt={title}
                    className="w-12 h-12 rounded-full object-cover border border-slate-200"
                  />
                  {isOnline && (
                    <span
                      className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white shadow-xs"
                      title="Online"
                    />
                  )}
                  {chat.type === 'group' && (
                    <span className="absolute -bottom-1 -left-1 bg-emerald-800 text-white text-[9px] px-1 py-0.2 rounded font-semibold">
                      GRP
                    </span>
                  )}
                </div>

                {/* Content Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-semibold truncate ${isActive ? 'text-emerald-950' : 'text-slate-800'}`}>
                      {title}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono shrink-0 ml-2">
                      {formatChatTime(chat.lastMessageTime)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className={`text-xs truncate pr-2 max-w-[200px] ${typing ? 'text-emerald-600 font-semibold' : 'text-slate-500'}`}>
                      {typing ? (
                        'typing...'
                      ) : (
                        <>
                          {currentUser && chat.lastSenderId === currentUser.id && chat.lastMessage && (
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-600 inline mr-1" />
                          )}
                          {chat.lastMessage || 'Tap to start messaging'}
                        </>
                      )}
                    </p>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isPinned && <Pin className="w-3 h-3 text-emerald-700 rotate-45" />}
                      {isMuted && <VolumeX className="w-3 h-3 text-slate-400" />}
                      {unreadCount > 0 && (
                        <span className="bg-emerald-600 text-white font-bold text-[10px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Context Menu Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuChatId(menuChatId === chat.id ? null : chat.id);
                  }}
                  className="opacity-70 md:opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {/* Floating Context Actions */}
                {menuChatId === chat.id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-4 top-12 z-30 w-44 bg-white rounded-2xl shadow-xl border border-slate-100 p-1.5 text-xs text-slate-700 animate-scale-in"
                  >
                    <button
                      onClick={() => {
                        chatStore.togglePinChat(chat.id);
                        setMenuChatId(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 rounded-xl flex items-center gap-2 cursor-pointer"
                    >
                      <Pin className="w-3.5 h-3.5" />
                      <span>{isPinned ? 'Unpin Chat' : 'Pin to Top'}</span>
                    </button>
                    <button
                      onClick={() => {
                        chatStore.toggleMuteChat(chat.id);
                        setMenuChatId(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 rounded-xl flex items-center gap-2 cursor-pointer"
                    >
                      <VolumeX className="w-3.5 h-3.5" />
                      <span>{isMuted ? 'Unmute' : 'Mute Notifications'}</span>
                    </button>
                    <button
                      onClick={() => {
                        chatStore.toggleArchiveChat(chat.id);
                        setMenuChatId(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 rounded-xl flex items-center gap-2 cursor-pointer"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>{isArchived ? 'Unarchive' : 'Archive Chat'}</span>
                    </button>
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      onClick={() => {
                        setConfirmDeleteId(chat.id);
                        setMenuChatId(null);
                      }}
                      className="w-full text-left px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-2 cursor-pointer"
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
              <div className="bg-slate-50/70">
                <div className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50/70 border-y border-emerald-100/70 flex items-center justify-between">
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
                    className="flex items-center justify-between gap-3 p-3.5 hover:bg-emerald-50/60 transition-all cursor-pointer border-b border-slate-100/70"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={
                            user.photoUrl ||
                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`
                          }
                          alt={user.displayName}
                          className="w-11 h-11 rounded-full object-cover border border-slate-200"
                        />
                        <span
                          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                            user.isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        />
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {user.displayName}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {user.bio || user.email}
                        </p>
                      </div>
                    </div>

                    <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white text-[11px] font-semibold rounded-lg shadow-xs">
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
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-5 max-w-xs w-full shadow-2xl border border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 mb-1">Delete conversation?</h3>
            <p className="text-xs text-slate-500 mb-4">
              This will remove the chat thread from Firestore.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
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
    </div>
  );
};
