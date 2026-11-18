import React, { useState, useEffect } from 'react';
import { Chat, Message, User } from '../types';
import { chatStore } from '../services/chatService';
import { securityService } from '../services/securityService';
import {
  X,
  Phone,
  Video,
  Pin,
  VolumeX,
  UserX,
  ShieldAlert,
  Mail,
  FileText,
  Download,
  Image as ImageIcon,
  Lock,
  Unlock,
  Timer,
} from 'lucide-react';

interface ContactInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  partner: User | null;
  chat: Chat | null;
  currentUser: User | null;
  messages: Message[];
  onStartVoiceCall: (partner: User) => void;
  onStartVideoCall: (partner: User) => void;
  onRequestReport: (partner: User) => void;
}

export const ContactInfoModal: React.FC<ContactInfoModalProps> = ({
  isOpen,
  onClose,
  partner,
  chat,
  currentUser,
  messages,
  onStartVoiceCall,
  onStartVideoCall,
  onRequestReport,
}) => {
  const [mediaTab, setMediaTab] = useState<'media' | 'docs'>('media');
  const [isLocked, setIsLocked] = useState(() => (chat ? securityService.isChatLocked(chat.id) : false));
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [inlinePin, setInlinePin] = useState('');

  useEffect(() => {
    if (!chat) return;
    const sync = () => setIsLocked(securityService.isChatLocked(chat.id));
    sync();
    return securityService.subscribe(sync);
  }, [chat?.id]);

  if (!isOpen || !partner || !chat) return null;

  const isBlocked = chatStore.isUserBlocked(partner.id);
  const isPinned = currentUser ? (chat.pinnedBy || []).includes(currentUser.id) : false;
  const isMuted = currentUser ? (chat.mutedBy || []).includes(currentUser.id) : false;
  const disappearDuration = chat.disappearingDuration || 0;

  const hidePhoto = partner.privacySettings?.profilePhotoVisibility === 'nobody';
  const hideLastSeen = partner.privacySettings?.lastSeenVisibility === 'nobody';

  const avatar = hidePhoto
    ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(partner.displayName)}`
    : partner.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner.id}`;

  const sharedMedia = messages.filter(
    (m) => !m.isDeleted && (m.type === 'image' || m.type === 'video') && m.mediaUrl
  );
  const sharedDocs = messages.filter(
    (m) => !m.isDeleted && m.type === 'document' && m.mediaUrl
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in select-none">
      <div className="w-full max-w-md bg-white dark:bg-[#22252B] dark:text-zinc-100 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-white/10 flex flex-col max-h-[90vh]">
        {/* Top Banner */}
        <div className="bg-gradient-to-r from-[#0FA958] to-[#0B8043] p-5 text-white relative text-center shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-emerald-100 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <img
            src={avatar}
            alt={partner.displayName}
            referrerPolicy="no-referrer"
            className="w-20 h-20 rounded-full object-cover border-3 border-white/80 shadow-lg mx-auto mb-3"
          />
          <h2 className="text-lg font-bold font-['Outfit']">{partner.displayName}</h2>
          <p className="text-xs text-emerald-100 mt-0.5">
            {hideLastSeen
              ? 'Private status'
              : partner.isOnline
              ? 'Online'
              : 'Registered DOST User'}
          </p>

          {!isBlocked && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={() => {
                  onClose();
                  onStartVoiceCall(partner);
                }}
                className="px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Phone className="w-4 h-4" />
                <span>Audio</span>
              </button>
              <button
                onClick={() => {
                  onClose();
                  onStartVideoCall(partner);
                }}
                className="px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Video className="w-4 h-4" />
                <span>Video</span>
              </button>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* About & Contact Details */}
          <div className="bg-slate-50 dark:bg-[#282C34] rounded-2xl p-4 space-y-2.5 border border-slate-100 dark:border-white/10">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-400">About</p>
              <p className="text-xs text-slate-700 dark:text-zinc-200 mt-0.5">
                {partner.bio || 'Hey there! I am using DOST Messaging App.'}
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-300 pt-1">
              <Mail className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-mono truncate">{partner.email}</span>
            </div>

            {partner.phoneNumber && (
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-300">
                <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-mono">{partner.phoneNumber}</span>
              </div>
            )}
          </div>

          {/* Shared Media & Docs */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-wider">
                Shared in this Chat
              </h3>
              <div className="flex gap-1 bg-slate-100 dark:bg-[#1A1D22] p-0.5 rounded-lg text-[11px]">
                <button
                  onClick={() => setMediaTab('media')}
                  className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                    mediaTab === 'media'
                      ? 'bg-white dark:bg-[#282C34] text-emerald-700 dark:text-emerald-300 shadow-xs'
                      : 'text-slate-500 dark:text-zinc-400'
                  }`}
                >
                  Media ({sharedMedia.length})
                </button>
                <button
                  onClick={() => setMediaTab('docs')}
                  className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                    mediaTab === 'docs'
                      ? 'bg-white dark:bg-[#282C34] text-emerald-700 dark:text-emerald-300 shadow-xs'
                      : 'text-slate-500 dark:text-zinc-400'
                  }`}
                >
                  Docs ({sharedDocs.length})
                </button>
              </div>
            </div>

            {mediaTab === 'media' ? (
              sharedMedia.length === 0 ? (
                <div className="p-4 bg-slate-50 dark:bg-[#282C34] rounded-2xl text-center text-xs text-slate-400 dark:text-zinc-400 flex flex-col items-center">
                  <ImageIcon className="w-6 h-6 text-slate-300 dark:text-zinc-600 mb-1" />
                  <span>No photos or videos shared yet.</span>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-44 overflow-y-auto">
                  {sharedMedia.map((m) =>
                    m.type === 'image' ? (
                      <img
                        key={m.id}
                        src={m.mediaUrl}
                        alt={m.fileName || 'Shared'}
                        className="w-full h-20 object-cover rounded-xl border border-slate-200 dark:border-white/10"
                      />
                    ) : (
                      <video
                        key={m.id}
                        src={m.mediaUrl}
                        className="w-full h-20 object-cover rounded-xl bg-black border border-slate-200 dark:border-white/10"
                      />
                    )
                  )}
                </div>
              )
            ) : sharedDocs.length === 0 ? (
              <div className="p-4 bg-slate-50 dark:bg-[#282C34] rounded-2xl text-center text-xs text-slate-400 dark:text-zinc-400">
                No documents shared yet.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {sharedDocs.map((d) => (
                  <a
                    key={d.id}
                    href={d.mediaUrl}
                    download={d.fileName || 'document'}
                    className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-[#282C34] hover:bg-emerald-50 dark:hover:bg-emerald-500/15 rounded-xl border border-slate-200/70 dark:border-white/10 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="font-medium text-slate-700 dark:text-zinc-200 truncate">{d.fileName}</span>
                    </div>
                    <Download className="w-4 h-4 text-slate-400 dark:text-zinc-400 shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Chat Controls */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-white/10 text-xs">
            <button
              onClick={() => chatStore.togglePinChat(chat.id)}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.05] rounded-xl font-medium text-slate-700 dark:text-zinc-200 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Pin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                {isPinned ? 'Unpin Conversation' : 'Pin Conversation'}
              </span>
            </button>

            <button
              onClick={() => chatStore.toggleMuteChat(chat.id)}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.05] rounded-xl font-medium text-slate-700 dark:text-zinc-200 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <VolumeX className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                {isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
              </span>
            </button>

            <div className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.05]">
              <span className="flex items-center gap-2 font-medium text-slate-700 dark:text-zinc-200">
                <Timer className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Disappearing Messages</span>
              </span>
              <select
                value={disappearDuration}
                onChange={(e) => void chatStore.setDisappearingDuration(chat.id, Number(e.target.value) || null)}
                className="bg-slate-100 dark:bg-[#1A1D22] text-slate-700 dark:text-zinc-200 text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-white/10 cursor-pointer"
              >
                <option value={0}>Off</option>
                <option value={3600}>1 Hour</option>
                <option value={21600}>6 Hours</option>
                <option value={86400}>24 Hours</option>
                <option value={604800}>7 Days</option>
                <option value={2592000}>30 Days</option>
              </select>
            </div>

            <button
              onClick={() => {
                if (isLocked) {
                  securityService.unlockChat(chat.id);
                  setShowPinSetup(false);
                } else if (!securityService.hasPin()) {
                  setInlinePin('');
                  setShowPinSetup(true);
                } else {
                  securityService.lockChat(chat.id);
                }
              }}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.05] rounded-xl font-medium text-slate-700 dark:text-zinc-200 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                {isLocked ? (
                  <Unlock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                )}
                <span>{isLocked ? 'Unlock Chat' : 'Chat Lock (Fingerprint / PIN)'}</span>
              </span>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                {isLocked ? 'Locked' : 'Off'}
              </span>
            </button>

            {showPinSetup && !isLocked && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const clean = inlinePin.replace(/\D/g, '').slice(0, 4);
                  if (clean.length !== 4) return;
                  await securityService.setPin(clean);
                  securityService.lockChat(chat.id);
                  setShowPinSetup(false);
                  setInlinePin('');
                }}
                className="p-3 bg-emerald-50/70 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/25 rounded-xl space-y-2"
              >
                <p className="text-[11px] font-semibold text-emerald-900 dark:text-emerald-200">
                  Set a 4-digit PIN first to lock this chat
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={inlinePin}
                    onChange={(e) => setInlinePin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="4-digit PIN"
                    className="flex-1 px-2.5 py-1.5 text-xs font-mono tracking-widest rounded-lg bg-white dark:bg-[#1A1D22] border border-slate-200 dark:border-white/10 focus:outline-none focus:border-emerald-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={inlinePin.length !== 4}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
                  >
                    Lock
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPinSetup(false)}
                    className="px-2.5 py-1.5 bg-slate-200 dark:bg-[#2F343C] text-slate-700 dark:text-zinc-200 text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <button
              onClick={() =>
                isBlocked
                  ? chatStore.unblockUser(partner.id)
                  : chatStore.blockUser(partner.id, partner.displayName)
              }
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-rose-50 dark:hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 rounded-xl font-semibold cursor-pointer"
            >
              <UserX className="w-4 h-4" />
              <span>{isBlocked ? `Unblock ${partner.displayName}` : `Block ${partner.displayName}`}</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onRequestReport(partner);
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-rose-50 dark:hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 rounded-xl font-semibold cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Report {partner.displayName}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
