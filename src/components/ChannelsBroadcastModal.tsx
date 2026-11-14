import React, { useState, useEffect } from 'react';
import { Chat, User } from '../types';
import { chatStore } from '../services/chatService';
import { uploadMediaFile } from '../services/storageService';
import {
  Megaphone,
  Radio,
  X,
  Check,
  Search,
  Globe,
  Lock,
  Loader2,
  Camera,
  Users,
  Plus,
} from 'lucide-react';

interface ChannelsBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onOpenChat: (chat: Chat) => void;
}

export const ChannelsBroadcastModal: React.FC<ChannelsBroadcastModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onOpenChat,
}) => {
  const [tab, setTab] = useState<'discover' | 'create_channel' | 'create_broadcast'>('discover');
  const [publicChannels, setPublicChannels] = useState<Chat[]>(chatStore.getPublicChannels());
  const [searchQuery, setSearchQuery] = useState('');

  // Create Channel state
  const [channelName, setChannelName] = useState('');
  const [channelDesc, setChannelDesc] = useState('');
  const [isPublicChannel, setIsPublicChannel] = useState(true);
  const [channelAvatarFile, setChannelAvatarFile] = useState<File | null>(null);
  const [channelPhotoPreview, setChannelPhotoPreview] = useState('');

  // Create Broadcast List state
  const [broadcastName, setBroadcastName] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [recipientSearch, setRecipientSearch] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPublicChannels(chatStore.getPublicChannels());
    return chatStore.subscribe(() => {
      setPublicChannels(chatStore.getPublicChannels());
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const allOtherUsers = chatStore
    .getUsers()
    .filter((u) => u.id !== currentUser.id)
    .filter((u) => {
      if (!recipientSearch.trim()) return true;
      const q = recipientSearch.trim().toLowerCase();
      return (
        (u.displayName || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      );
    });

  const filteredChannels = publicChannels.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.description || '').toLowerCase().includes(q)
    );
  });

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName.trim()) return;
    setIsSaving(true);
    try {
      let uploadedUrl: string | undefined;
      if (channelAvatarFile) {
        uploadedUrl = await uploadMediaFile(
          `channels/${Date.now()}_${channelAvatarFile.name}`,
          channelAvatarFile,
          { isImage: true }
        );
      }
      const created = await chatStore.createChannel(
        channelName.trim(),
        channelDesc.trim(),
        isPublicChannel,
        uploadedUrl
      );
      setChannelName('');
      setChannelDesc('');
      setChannelAvatarFile(null);
      setChannelPhotoPreview('');
      onOpenChat(created);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastName.trim() || selectedRecipients.length === 0) return;
    setIsSaving(true);
    try {
      const created = await chatStore.createBroadcastList(broadcastName.trim(), selectedRecipients);
      setBroadcastName('');
      setSelectedRecipients([]);
      onOpenChat(created);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#064E29] via-[#0B8043] to-[#0FA958] p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold font-['Outfit']">Channels & Broadcasts</h2>
              <p className="text-[11px] text-emerald-100">
                Reach unlimited followers or message multiple contacts at once
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/15 rounded-xl cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Pills */}
        <div className="px-4 pt-3 pb-2 border-b border-slate-100 flex gap-1.5 overflow-x-auto shrink-0">
          {[
            { id: 'discover', label: 'Explore Channels', icon: Globe },
            { id: 'create_channel', label: 'New Channel', icon: Plus },
            { id: 'create_broadcast', label: 'Broadcast List', icon: Radio },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as any)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                  active
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'discover' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search public DOST channels..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-100 rounded-xl text-xs focus:outline-none focus:bg-white border border-transparent focus:border-emerald-500"
                />
              </div>

              {filteredChannels.length === 0 ? (
                <div className="text-center py-10 text-slate-400 space-y-2">
                  <Megaphone className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
                  <p className="text-xs font-medium">No public channels found yet.</p>
                  <button
                    type="button"
                    onClick={() => setTab('create_channel')}
                    className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                  >
                    Create the first DOST Channel
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredChannels.map((ch) => {
                    const isJoined = ch.participants.includes(currentUser.id);
                    return (
                      <div
                        key={ch.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200/80 hover:bg-slate-50"
                      >
                        <div
                          onClick={async () => {
                            if (!isJoined) {
                              await chatStore.joinChannel(ch.id);
                            }
                            onOpenChat(ch);
                            onClose();
                          }}
                          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                        >
                          <img
                            src={ch.photoUrl || '/assets/aistudio/download_7eb2aac4.jpeg'}
                            alt={ch.name}
                            className="w-11 h-11 rounded-2xl object-cover border border-slate-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{ch.name}</p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {ch.participants.length} follower{ch.participants.length === 1 ? '' : 's'} ·{' '}
                              {ch.description || 'Announcement channel'}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={async () => {
                            if (isJoined) {
                              onOpenChat(ch);
                              onClose();
                            } else {
                              await chatStore.joinChannel(ch.id);
                              onOpenChat(ch);
                              onClose();
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
                            isJoined
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          }`}
                        >
                          {isJoined ? 'Open' : 'Follow'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'create_channel' && (
            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="relative cursor-pointer shrink-0">
                  <img
                    src={channelPhotoPreview || '/assets/aistudio/download_7eb2aac4.jpeg'}
                    alt="Channel Icon"
                    className="w-14 h-14 rounded-2xl object-cover border border-emerald-200"
                  />
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center border-2 border-white">
                    <Camera className="w-3 h-3" />
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setChannelAvatarFile(f);
                        setChannelPhotoPreview(URL.createObjectURL(f));
                      }
                    }}
                    className="hidden"
                  />
                </label>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Channel Name
                  </label>
                  <input
                    type="text"
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    placeholder="e.g. Tech Updates Pakistan"
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description & Purpose
                </label>
                <textarea
                  value={channelDesc}
                  onChange={(e) => setChannelDesc(e.target.value)}
                  placeholder="Share announcements, polls, photos, and news with followers..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 h-20"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsPublicChannel(true)}
                  className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                    isPublicChannel
                      ? 'border-emerald-500 bg-emerald-50/70'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Globe className="w-4 h-4 text-emerald-600 mb-1" />
                  <p className="text-xs font-bold text-slate-800">Public Channel</p>
                  <p className="text-[10px] text-slate-500">Anyone on DOST can discover & follow</p>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPublicChannel(false)}
                  className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                    !isPublicChannel
                      ? 'border-emerald-500 bg-emerald-50/70'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Lock className="w-4 h-4 text-emerald-600 mb-1" />
                  <p className="text-xs font-bold text-slate-800">Private Channel</p>
                  <p className="text-[10px] text-slate-500">Only admins & invited members</p>
                </button>
              </div>

              <button
                type="submit"
                disabled={isSaving || !channelName.trim()}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Create Channel</span>
              </button>
            </form>
          )}

          {tab === 'create_broadcast' && (
            <form onSubmit={handleCreateBroadcast} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Broadcast List Name
                </label>
                <input
                  type="text"
                  value={broadcastName}
                  onChange={(e) => setBroadcastName(e.target.value)}
                  placeholder="e.g. Family & Clients Announcement"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Messages sent in a broadcast list are delivered directly to every selected recipient&apos;s private chat.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                    Select Recipients ({selectedRecipients.length})
                  </span>
                </div>

                <div className="relative mb-2">
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    placeholder="Search registered contacts..."
                    className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {allOtherUsers.map((u) => {
                    const checked = selectedRecipients.includes(u.id);
                    return (
                      <div
                        key={u.id}
                        onClick={() =>
                          setSelectedRecipients((prev) =>
                            checked ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                          )
                        }
                        className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                          checked ? 'border-emerald-500 bg-emerald-50/60' : 'border-slate-100 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={u.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`}
                            alt={u.displayName}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate">{u.displayName}</p>
                            <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center ${
                            checked ? 'bg-emerald-600 text-white' : 'border border-slate-300'
                          }`}
                        >
                          {checked && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving || !broadcastName.trim() || selectedRecipients.length === 0}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Create Broadcast List ({selectedRecipients.length})</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
