import React, { useState, useEffect } from 'react';
import { CallSession, User } from '../types';
import { chatStore } from '../services/chatService';
import {
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Search,
  Trash2,
} from 'lucide-react';

interface CallsListProps {
  currentUser: User | null;
  onStartVoiceCall: (user: User) => void;
  onStartVideoCall: (user: User) => void;
}

export const CallsList: React.FC<CallsListProps> = ({
  currentUser,
  onStartVoiceCall,
  onStartVideoCall,
}) => {
  const [callLogs, setCallLogs] = useState<CallSession[]>(chatStore.getCallLogs());
  const [users, setUsers] = useState<User[]>(chatStore.getUsers());
  const [filter, setFilter] = useState<'all' | 'missed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const sync = () => {
      setCallLogs(chatStore.getCallLogs());
      setUsers(chatStore.getUsers());
    };
    sync();
    return chatStore.subscribe(sync);
  }, []);

  const otherUsers = users.filter((u) => u.id !== currentUser?.id);

  const filteredCallLogs = callLogs.filter((log) => {
    const isMissed = log.status === 'missed' || log.status === 'rejected';
    if (filter === 'missed' && !isMissed) return false;
    if (!searchQuery.trim()) return true;
    const isOutgoing = currentUser ? log.callerId === currentUser.id : true;
    const peerName = (isOutgoing ? log.receiverName : log.callerName) || '';
    return peerName.toLowerCase().includes(searchQuery.trim().toLowerCase());
  });

  const formatCallTime = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F4F6F8] dark:bg-[#181A1D] text-slate-900 dark:text-zinc-100 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 select-none transition-colors">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100 font-['Outfit']">
              Calls
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Real-time WebRTC audio & video call history
            </p>
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-[#22252B] p-1 rounded-xl border border-slate-200 dark:border-white/[0.08] self-start">
            <button
              onClick={() => setFilter('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                filter === 'all'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/[0.06]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('missed')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                filter === 'missed'
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/[0.06]'
              }`}
            >
              Missed
            </button>
          </div>
        </div>

        {/* Search Call Logs */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search call logs by contact name..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#22252B] text-xs text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] focus:border-emerald-500 focus:outline-none shadow-xs"
          />
        </div>

        {/* Real Call Logs */}
        {filteredCallLogs.length === 0 ? (
          <div className="bg-white dark:bg-[#22252B] rounded-3xl p-8 border border-slate-200/80 dark:border-white/[0.08] text-center shadow-xs">
            <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-emerald-100 dark:border-emerald-500/20">
              <Phone className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100 mb-1">
              {filter === 'missed' ? 'No missed calls' : 'No call history yet'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
              Your real peer-to-peer WebRTC voice and video calls appear here once placed or received.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#22252B] rounded-3xl p-2 shadow-xs border border-slate-200/80 dark:border-white/[0.08] divide-y divide-slate-100 dark:divide-white/[0.06]">
            {filteredCallLogs.map((log) => {
              const isOutgoing = currentUser ? log.callerId === currentUser.id : true;
              const peerId = isOutgoing ? log.receiverId : log.callerId;
              const peerName = isOutgoing ? log.receiverName : log.callerName;
              const peerPhoto = isOutgoing ? log.receiverPhoto : log.callerPhoto;
              const peerUser = chatStore.getUser(peerId);
              const isMissed = log.status === 'missed' || log.status === 'rejected';

              return (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors rounded-2xl"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={
                        peerPhoto ||
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(peerName)}`
                      }
                      alt={peerName}
                      referrerPolicy="no-referrer"
                      className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-white/10"
                    />
                    <div className="min-w-0">
                      <h3
                        className={`text-sm font-semibold truncate ${
                          isMissed
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-900 dark:text-zinc-100'
                        }`}
                      >
                        {peerName}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                        {isMissed ? (
                          <PhoneMissed className="w-3.5 h-3.5 text-rose-500" />
                        ) : isOutgoing ? (
                          <PhoneOutgoing className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <PhoneIncoming className="w-3.5 h-3.5 text-emerald-500" />
                        )}
                        <span>
                          {isMissed ? 'Missed' : isOutgoing ? 'Outgoing' : 'Incoming'} ·{' '}
                          {log.duration ? `${log.duration}s` : log.type}
                        </span>
                        <span>·</span>
                        <span className="font-mono tabular-nums">{formatCallTime(log.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {peerUser && (
                      <>
                        <button
                          onClick={() => onStartVoiceCall(peerUser)}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-white/[0.07] rounded-xl transition-colors cursor-pointer"
                          title="Voice Call"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onStartVideoCall(peerUser)}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-white/[0.07] rounded-xl transition-colors cursor-pointer"
                          title="Video Call"
                        >
                          <Video className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => chatStore.deleteCallLog(log.id)}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 dark:text-zinc-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/15 rounded-xl transition-colors cursor-pointer"
                      title="Delete Call Log"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quick Dial Real Registered Contacts */}
        {otherUsers.length > 0 && (
          <div>
            <h2 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2.5 px-1">
              Quick Call Registered Contacts ({otherUsers.length})
            </h2>
            <div className="bg-white dark:bg-[#22252B] rounded-3xl p-2 shadow-xs border border-slate-200/80 dark:border-white/[0.08] divide-y divide-slate-100 dark:divide-white/[0.06]">
              {otherUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors rounded-2xl"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={user.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
                      alt={user.displayName}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-white/10"
                    />
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
                        {user.displayName}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                        {user.isOnline ? 'Online' : 'Registered DOST user'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onStartVoiceCall(user)}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-white/[0.07] rounded-xl transition-colors cursor-pointer"
                      title="Start Voice Call"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onStartVideoCall(user)}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-white/[0.07] rounded-xl transition-colors cursor-pointer"
                      title="Start Video Call"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
