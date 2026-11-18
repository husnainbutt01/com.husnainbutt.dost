import React, { useState } from 'react';
import { User } from '../types';
import { chatStore } from '../services/chatService';
import {
  Search,
  MessageSquare,
  Phone,
  Video,
  Copy,
  Check,
  Share2,
  Users,
} from 'lucide-react';

interface ContactsListProps {
  currentUser: User | null;
  onSelectUserToChat: (user: User) => void;
  onStartVoiceCall: (user: User) => void;
  onStartVideoCall: (user: User) => void;
}

export const ContactsList: React.FC<ContactsListProps> = ({
  currentUser,
  onSelectUserToChat,
  onStartVoiceCall,
  onStartVideoCall,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [users, setUsers] = useState<User[]>(chatStore.getUsers());

  React.useEffect(() => {
    const sync = () => setUsers(chatStore.getUsers());
    sync();
    return chatStore.subscribe(sync);
  }, []);

  const otherUsers = users.filter((u) => u.id !== currentUser?.id);

  const filteredUsers = otherUsers.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phoneNumber || '').toLowerCase().includes(q) ||
      (u.bio || '').toLowerCase().includes(q)
    );
  });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F4F6F8] dark:bg-[#181A1D] text-slate-900 dark:text-zinc-100 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 select-none transition-colors">
      <div className="max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100 font-['Outfit']">
              Contacts
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Registered DOST users · Tap to message or call
            </p>
          </div>

          <button
            onClick={handleCopyLink}
            className="min-h-[40px] py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Link Copied!' : 'Invite / Share'}</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search registered users by name, email, or phone..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#22252B] text-xs text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] focus:border-emerald-500 focus:outline-none shadow-xs"
          />
        </div>

        {/* Empty State */}
        {otherUsers.length === 0 ? (
          <div className="bg-white dark:bg-[#22252B] rounded-3xl p-8 border border-slate-200/80 dark:border-white/[0.08] text-center shadow-xs">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100 dark:border-emerald-500/20">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100 mb-1">
              You are the first registered user!
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto mb-5 leading-relaxed">
              Share your DOST link with friends or sign in on another device to start real-time messaging and calls.
            </p>
            <button
              onClick={handleCopyLink}
              className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'Link Copied!' : 'Copy App Link to Invite'}</span>
            </button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-white dark:bg-[#22252B] rounded-2xl p-6 text-center text-slate-500 dark:text-zinc-400 text-xs border border-slate-200/70 dark:border-white/[0.08]">
            No registered users found matching &ldquo;{searchQuery}&rdquo;.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="bg-white dark:bg-[#22252B] rounded-2xl p-3.5 sm:p-4 shadow-xs border border-slate-200/80 dark:border-white/[0.08] hover:border-emerald-400/60 dark:hover:border-emerald-500/40 transition-all flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      src={user.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
                      alt={user.displayName}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-white/10"
                    />
                    <span
                      className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#22252B] ${
                        user.isOnline ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-600'
                      }`}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate">
                        {user.displayName}
                      </h3>
                      {user.role === 'admin' && (
                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-semibold px-2 py-0.5 rounded-md">
                          Developer / Admin
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 truncate max-w-sm">
                      {user.bio || 'Available on DOST'}
                    </p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono mt-0.5 truncate">
                      {user.email}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onSelectUserToChat(user)}
                    className="min-h-[42px] min-w-[42px] flex items-center justify-center bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-600 hover:text-white text-emerald-700 dark:text-emerald-400 rounded-xl transition-all cursor-pointer"
                    title="Message"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onStartVoiceCall(user)}
                    className="min-h-[42px] min-w-[42px] flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-emerald-50 dark:hover:bg-white/[0.08] hover:text-emerald-600 dark:hover:text-emerald-400 rounded-xl transition-all cursor-pointer"
                    title="Voice Call"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onStartVideoCall(user)}
                    className="min-h-[42px] min-w-[42px] flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-emerald-50 dark:hover:bg-white/[0.08] hover:text-emerald-600 dark:hover:text-emerald-400 rounded-xl transition-all cursor-pointer"
                    title="Video Call"
                  >
                    <Video className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
