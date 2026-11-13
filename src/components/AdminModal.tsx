import React, { useState, useEffect } from 'react';
import { User, Report } from '../types';
import { chatStore } from '../services/chatService';
import {
  ShieldCheck,
  Users,
  MessageSquare,
  AlertTriangle,
  Radio,
  X,
  CheckCircle2,
  Database,
} from 'lucide-react';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
}

export const AdminModal: React.FC<AdminModalProps> = ({ isOpen, onClose, currentUser }) => {
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastSent, setBroadcastSent] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>(chatStore.getUsers());
  const [chatsCount, setChatsCount] = useState(chatStore.getAllUserChats().length);
  const [reports, setReports] = useState<Report[]>(chatStore.getReports());

  useEffect(() => {
    if (!isOpen) return;
    const sync = () => {
      setUsers(chatStore.getUsers());
      setChatsCount(chatStore.getAllUserChats().length);
      setReports(chatStore.getReports());
    };
    sync();
    return chatStore.subscribe(sync);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;

    await chatStore.sendSystemBroadcastNotification(
      'DOST Announcement',
      broadcastText.trim()
    );

    setBroadcastText('');
    setBroadcastSent(true);
    setTimeout(() => setBroadcastSent(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-fade-in select-none">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#084825] via-[#0B8043] to-[#0FA958] p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center border border-white/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold font-['Outfit']">DOST Admin Control Console</h2>
              <p className="text-[11px] text-emerald-100 font-medium">
                Administrator: {currentUser?.displayName || 'Admin'} · Role: {currentUser?.role?.toUpperCase() || 'ADMIN'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:text-emerald-200 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {actionNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between">
              <span className="font-semibold">{actionNotice}</span>
              <button onClick={() => setActionNotice(null)} className="text-emerald-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-100">
              <span className="text-xs text-emerald-800 font-medium flex items-center gap-1.5">
                <Users className="w-4 h-4" /> Users
              </span>
              <p className="text-2xl font-extrabold text-emerald-950 mt-1 font-mono">{users.length}</p>
            </div>
            <div className="p-3.5 bg-blue-50 rounded-2xl border border-blue-100">
              <span className="text-xs text-blue-800 font-medium flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" /> Active Chats
              </span>
              <p className="text-2xl font-extrabold text-blue-950 mt-1 font-mono">{chatsCount}</p>
            </div>
            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-100">
              <span className="text-xs text-amber-800 font-medium flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Reports
              </span>
              <p className="text-2xl font-extrabold text-amber-950 mt-1 font-mono">{reports.length}</p>
            </div>
            <div className="p-3.5 bg-purple-50 rounded-2xl border border-purple-100">
              <span className="text-xs text-purple-800 font-medium flex items-center gap-1.5">
                <Database className="w-4 h-4" /> Firestore
              </span>
              <p className="text-xs font-bold text-purple-900 mt-2">Real-Time Live</p>
            </div>
          </div>

          {/* Broadcast Announcement Bar */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-emerald-600" />
              Broadcast Notification to All Registered Users
            </h3>
            <form onSubmit={handleBroadcast} className="flex gap-2">
              <input
                type="text"
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                placeholder="Type system announcement..."
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Send Broadcast
              </button>
            </form>
            {broadcastSent && (
              <p className="text-[11px] text-emerald-700 font-medium mt-1.5 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Broadcast notification sent to all registered users.
              </p>
            )}
          </div>

          {/* User Directory Management */}
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5">
              Registered User Accounts ({users.length})
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-2xl p-1">
              {users.map((u) => {
                const isSelf = currentUser?.id === u.id;
                return (
                  <div key={u.id} className="flex items-center justify-between p-2.5 text-xs">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={u.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`}
                        alt={u.displayName}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <div>
                        <p className="font-semibold text-slate-800">{u.displayName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          u.role === 'admin' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {u.role.toUpperCase()}
                      </span>
                      {!isSelf && (
                        <button
                          onClick={async () => {
                            const nextRole = u.role === 'admin' ? 'user' : 'admin';
                            await chatStore.updateUserRole(u.id, nextRole);
                            setActionNotice(`Updated ${u.displayName} role to ${nextRole.toUpperCase()}.`);
                          }}
                          className="text-[10px] px-2 py-1 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 rounded-lg font-semibold cursor-pointer"
                        >
                          {u.role === 'admin' ? 'Demote' : 'Make Admin'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* User Reports & Moderation Tickets */}
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5">
              Moderation Tickets & Reports ({reports.length})
            </h3>
            {reports.length === 0 ? (
              <p className="text-xs text-slate-400 p-3 bg-slate-50 rounded-xl text-center">
                No user reports currently pending.
              </p>
            ) : (
              <div className="space-y-2">
                {reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-amber-950">
                        Report: {rep.reason} ({rep.status})
                      </p>
                      <p className="text-[11px] text-amber-800">{rep.details || 'No additional details'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => chatStore.updateReportStatus(rep.id, 'dismissed')}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg font-medium shadow-xs cursor-pointer"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={async () => {
                          await chatStore.updateReportStatus(rep.id, 'reviewed');
                          setActionNotice(`Report ${rep.id} marked as reviewed.`);
                        }}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium shadow-xs cursor-pointer"
                      >
                        Mark Reviewed
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
