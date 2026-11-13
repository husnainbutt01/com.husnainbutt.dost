import React, { useState } from 'react';
import { Chat, Message, User } from '../types';
import { chatStore } from '../services/chatService';
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

  if (!isOpen || !partner || !chat) return null;

  const isBlocked = chatStore.isUserBlocked(partner.id);
  const isPinned = currentUser ? (chat.pinnedBy || []).includes(currentUser.id) : false;
  const isMuted = currentUser ? (chat.mutedBy || []).includes(currentUser.id) : false;

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
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
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
          <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5 border border-slate-100">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">About</p>
              <p className="text-xs text-slate-700 mt-0.5">
                {partner.bio || 'Hey there! I am using DOST Messaging App.'}
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600 pt-1">
              <Mail className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="font-mono truncate">{partner.email}</span>
            </div>

            {partner.phoneNumber && (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="font-mono">{partner.phoneNumber}</span>
              </div>
            )}
          </div>

          {/* Shared Media & Docs */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Shared in this Chat
              </h3>
              <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px]">
                <button
                  onClick={() => setMediaTab('media')}
                  className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                    mediaTab === 'media' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Media ({sharedMedia.length})
                </button>
                <button
                  onClick={() => setMediaTab('docs')}
                  className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                    mediaTab === 'docs' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Docs ({sharedDocs.length})
                </button>
              </div>
            </div>

            {mediaTab === 'media' ? (
              sharedMedia.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-2xl text-center text-xs text-slate-400 flex flex-col items-center">
                  <ImageIcon className="w-6 h-6 text-slate-300 mb-1" />
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
                        className="w-full h-20 object-cover rounded-xl border border-slate-200"
                      />
                    ) : (
                      <video
                        key={m.id}
                        src={m.mediaUrl}
                        className="w-full h-20 object-cover rounded-xl bg-black border border-slate-200"
                      />
                    )
                  )}
                </div>
              )
            ) : sharedDocs.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-2xl text-center text-xs text-slate-400">
                No documents shared yet.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {sharedDocs.map((d) => (
                  <a
                    key={d.id}
                    href={d.mediaUrl}
                    download={d.fileName || 'document'}
                    className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-emerald-50 rounded-xl border border-slate-200/70 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-medium text-slate-700 truncate">{d.fileName}</span>
                    </div>
                    <Download className="w-4 h-4 text-slate-400 shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Chat Controls */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
            <button
              onClick={() => chatStore.togglePinChat(chat.id)}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 rounded-xl font-medium text-slate-700 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Pin className="w-4 h-4 text-emerald-600" />
                {isPinned ? 'Unpin Conversation' : 'Pin Conversation'}
              </span>
            </button>

            <button
              onClick={() => chatStore.toggleMuteChat(chat.id)}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 rounded-xl font-medium text-slate-700 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <VolumeX className="w-4 h-4 text-slate-500" />
                {isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
              </span>
            </button>

            <button
              onClick={() =>
                isBlocked
                  ? chatStore.unblockUser(partner.id)
                  : chatStore.blockUser(partner.id, partner.displayName)
              }
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-rose-50 text-rose-600 rounded-xl font-semibold cursor-pointer"
            >
              <UserX className="w-4 h-4" />
              <span>{isBlocked ? `Unblock ${partner.displayName}` : `Block ${partner.displayName}`}</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onRequestReport(partner);
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-rose-50 text-rose-600 rounded-xl font-semibold cursor-pointer"
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
