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
  ShieldCheck,
  UserCheck
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

  const otherUsers = users.filter(u => u.id !== currentUser?.id);

  const filteredUsers = otherUsers.filter(u => {
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
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 select-none">
      <div className="max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 font-['Outfit']">Real Users Directory</h1>
            <p className="text-xs text-slate-500">Live registered accounts in Cloud Firestore</p>
          </div>

          <button
            onClick={handleCopyLink}
            className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Link Copied!' : 'Invite / Share App'}</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search real registered users by name or email..."
            className="w-full pl-10 pr-4 py-2.5 bg-white text-xs text-slate-800 placeholder-slate-400 rounded-2xl border border-slate-200/80 focus:border-emerald-500 focus:outline-none shadow-xs"
          />
        </div>

        {/* Empty state when no other users have registered yet */}
        {otherUsers.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-slate-200/80 text-center shadow-xs">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">
              You are the first registered user!
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5 leading-relaxed">
              Every user registers once with their real account. Open another browser tab, private window, or send the link to a friend to test real-time instant messaging!
            </p>
            <button
              onClick={handleCopyLink}
              className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'Link Copied to Clipboard!' : 'Copy App Link to Invite'}</span>
            </button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-slate-500 text-xs">
            No registered users found matching "{searchQuery}".
          </div>
        ) : (
          /* Contacts Grid */
          <div className="space-y-3">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/70 hover:border-emerald-300 hover:shadow-md transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      src={user.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
                      alt={user.displayName}
                      className="w-12 h-12 rounded-full object-cover border border-slate-200"
                    />
                    <span 
                      className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
                        user.isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                      }`} 
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-800 truncate">{user.displayName}</h3>
                      {user.role === 'admin' && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.2 rounded-full">
                          Developer / Admin
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate max-w-sm">{user.bio || 'Available on DOST'}</p>
                    <p className="text-[11px] text-emerald-700 font-mono mt-0.5">{user.email}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0 ml-3">
                  <button
                    onClick={() => onSelectUserToChat(user)}
                    className="p-2.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 rounded-xl transition-all cursor-pointer"
                    title="Message in Real-Time"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onStartVoiceCall(user)}
                    className="p-2.5 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-all cursor-pointer"
                    title="Voice Call"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onStartVideoCall(user)}
                    className="p-2.5 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-all cursor-pointer"
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
