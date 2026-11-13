import React, { useState, useEffect, useRef } from 'react';
import { Chat, Message, User } from '../types';
import { chatStore } from '../services/chatService';
import { uploadMediaFile, formatFileSize } from '../services/storageService';
import { ContactInfoModal } from './ContactInfoModal';
import {
  Phone,
  Video,
  Search,
  MoreVertical,
  Smile,
  Paperclip,
  Mic,
  Send,
  Check,
  CheckCheck,
  Clock,
  ArrowLeft,
  X,
  Play,
  Pause,
  FileText,
  Download,
  Reply,
  Edit2,
  Trash2,
  Image as ImageIcon,
  ShieldAlert,
  UserX,
  FileSpreadsheet,
  Forward,
  Loader2,
  AlertCircle,
  Copy,
  Info,
  ArrowDown,
} from 'lucide-react';

interface ChatAreaProps {
  chat: Chat | null;
  currentUser: User | null;
  onBack: () => void;
  onStartVoiceCall: (partner: User) => void;
  onStartVideoCall: (partner: User) => void;
  onOpenGroupInfo: (chat: Chat) => void;
  onReportSubmitted?: (partnerName: string) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  chat,
  currentUser,
  onBack,
  onStartVoiceCall,
  onStartVideoCall,
  onOpenGroupInfo,
  onReportSubmitted,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [forwardSearch, setForwardSearch] = useState('');
  const [deleteTargetMsg, setDeleteTargetMsg] = useState<Message | null>(null);
  const [confirmClearChat, setConfirmClearChat] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [reportTarget, setReportTarget] = useState<User | null>(null);
  const [reportReason, setReportReason] = useState('Spam or unwanted messages');
  const [reportDetails, setReportDetails] = useState('');
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadLabel, setUploadLabel] = useState('Uploading media...');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);

  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSelectedMsgId(null);
    setShowContactInfo(false);
    setShowMoreMenu(false);
    if (!chat) return;
    const updateMessages = () => {
      setMessages(chatStore.getMessages(chat.id));
    };
    updateMessages();
    const unsubscribe = chatStore.subscribe(updateMessages);
    return () => {
      unsubscribe();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (chat) {
        chatStore.setTyping(chat.id, false);
      }
    };
  }, [chat?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    return () => {
      if (uploadAbortRef.current) {
        uploadAbortRef.current.abort();
        uploadAbortRef.current = null;
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      if (recordStreamRef.current) {
        recordStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  if (!chat) {
    return (
      <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-[#F8FAF9] text-center p-8 select-none">
        <div className="w-24 h-24 mb-6 rounded-3xl bg-emerald-100/60 p-4 shadow-inner flex items-center justify-center">
          <img
            src="/assets/aistudio/download_7eb2aac4.jpeg"
            alt="DOST"
            className="w-full h-full object-cover rounded-2xl shadow-sm"
          />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 font-['Outfit'] mb-2">
          DOST Messaging App
        </h2>
        <p className="text-sm text-slate-500 max-w-sm mb-6 leading-relaxed">
          Select a conversation or open Contacts to message real registered DOST users in real time.
        </p>
        <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-100/70 px-4 py-2 rounded-full font-medium">
          <span>Developed by Husnain Butt</span>
          <span>·</span>
          <span>Version 1.0</span>
        </div>
      </div>
    );
  }

  const partnerId = chat.type === 'group' ? null : chat.participants.find((p) => p !== currentUser?.id);
  const partner = partnerId ? chatStore.getUser(partnerId) : null;
  const isBlocked = partner ? chatStore.isUserBlocked(partner.id) : false;

  const chatTitle = chat.type === 'group' ? chat.name || 'Group Chat' : partner?.displayName || 'DOST User';
  const chatAvatar =
    chat.type === 'group'
      ? chat.photoUrl || '/assets/aistudio/download_7eb2aac4.jpeg'
      : partner?.privacySettings?.profilePhotoVisibility === 'nobody'
      ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(chatTitle)}`
      : partner?.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner?.id || 'dost'}`;

  const showPartnerOnline =
    partner && partner.privacySettings?.lastSeenVisibility !== 'nobody' ? partner.isOnline : false;

  const typingParticipantNames = Object.entries(chat.typingUsers || {})
    .filter(([uid, active]) => uid !== currentUser?.id && active === true)
    .map(([uid]) => chatStore.getUser(uid)?.displayName || 'Someone');

  const formatLastSeen = (val?: string) => {
    if (!val) return 'Offline';
    if (val === 'Online') return 'Online';
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return `Last seen ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const handleInputChange = (val: string) => {
    setInputText(val);
    if (!chat) return;
    if (val.trim()) {
      chatStore.setTyping(chat.id, true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = window.setTimeout(() => {
        chatStore.setTyping(chat.id, false);
      }, 2500);
    } else {
      chatStore.setTyping(chat.id, false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isBlocked) return;

    const textToSend = inputText.trim();
    setInputText('');
    setShowEmojiPicker(false);
    chatStore.setTyping(chat.id, false);

    if (editingMessage) {
      await chatStore.editMessage(editingMessage.id, textToSend);
      setEditingMessage(null);
      return;
    }

    await chatStore.sendMessage({
      chatId: chat.id,
      text: textToSend,
      type: 'text',
      replyToMessageId: replyTo?.id,
      replyToText: replyTo?.text || `[${replyTo?.type}]`,
      replyToSenderName: replyTo?.senderName,
    });
    setReplyTo(null);
  };

  const handleStartRecording = async () => {
    if (isBlocked) return;
    setUploadError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.start();
      setIsRecording(true);
      setRecordDuration(0);

      recordTimerRef.current = window.setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch {
      setUploadError('Microphone permission denied or unavailable on this device.');
    }
  };

  const handleStopRecording = (send: boolean) => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    const duration = recordDuration;
    setIsRecording(false);
    setRecordDuration(0);

    if (!recorder) return;

    recorder.onstop = async () => {
      if (recordStreamRef.current) {
        recordStreamRef.current.getTracks().forEach((t) => t.stop());
        recordStreamRef.current = null;
      }

      if (!send || audioChunksRef.current.length === 0) {
        audioChunksRef.current = [];
        return;
      }

      const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      audioChunksRef.current = [];

      const controller = new AbortController();
      uploadAbortRef.current = controller;
      setIsUploading(true);
      setUploadProgress(0);
      setUploadLabel('Sending voice note...');
      setUploadError(null);
      try {
        const ext = (recorder.mimeType || '').includes('mp4') ? 'm4a' : 'webm';
        const fileName = `Voice_note_${Date.now()}.${ext}`;
        const mediaUrl = await uploadMediaFile(`chats/${chat.id}/audio/${fileName}`, blob, {
          onProgress: setUploadProgress,
          signal: controller.signal,
        });
        await chatStore.sendMessage({
          chatId: chat.id,
          type: 'audio',
          mediaUrl,
          fileName,
          fileSize: formatFileSize(blob.size),
          duration: Math.max(duration, 1),
        });
      } catch (err: any) {
        if (err?.message !== 'Upload cancelled.') {
          setUploadError(err?.message || 'Failed to upload voice note.');
        }
      } finally {
        if (uploadAbortRef.current === controller) {
          uploadAbortRef.current = null;
        }
        setIsUploading(false);
        setUploadProgress(0);
      }
    };

    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  const handleMediaFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setShowAttachMenu(false);
    if (!file || isBlocked) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) {
      setUploadError('Please select a valid image or video file.');
      return;
    }

    const controller = new AbortController();
    uploadAbortRef.current = controller;
    setIsUploading(true);
    setUploadProgress(0);
    setUploadLabel(isVideo ? `Uploading video (${formatFileSize(file.size)})...` : 'Compressing & sending photo...');
    setUploadError(null);
    try {
      const mediaUrl = await uploadMediaFile(
        `chats/${chat.id}/${isVideo ? 'video' : 'images'}/${Date.now()}_${file.name}`,
        file,
        {
          isImage,
          onProgress: setUploadProgress,
          signal: controller.signal,
        }
      );
      await chatStore.sendMessage({
        chatId: chat.id,
        type: isVideo ? 'video' : 'image',
        mediaUrl,
        fileName: file.name,
        fileSize: formatFileSize(file.size),
      });
    } catch (err: any) {
      if (err?.message !== 'Upload cancelled.') {
        setUploadError(err?.message || 'Failed to upload media file.');
      }
    } finally {
      if (uploadAbortRef.current === controller) {
        uploadAbortRef.current = null;
      }
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDocFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setShowAttachMenu(false);
    if (!file || isBlocked) return;

    const controller = new AbortController();
    uploadAbortRef.current = controller;
    setIsUploading(true);
    setUploadProgress(0);
    setUploadLabel(`Uploading document (${formatFileSize(file.size)})...`);
    setUploadError(null);
    try {
      const mediaUrl = await uploadMediaFile(
        `chats/${chat.id}/docs/${Date.now()}_${file.name}`,
        file,
        {
          onProgress: setUploadProgress,
          signal: controller.signal,
        }
      );
      await chatStore.sendMessage({
        chatId: chat.id,
        type: 'document',
        mediaUrl,
        fileName: file.name,
        fileSize: formatFileSize(file.size),
      });
    } catch (err: any) {
      if (err?.message !== 'Upload cancelled.') {
        setUploadError(err?.message || 'Failed to upload document.');
      }
    } finally {
      if (uploadAbortRef.current === controller) {
        uploadAbortRef.current = null;
      }
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const toggleAudioPlayback = (msg: Message) => {
    if (playingAudioId === msg.id) {
      audioPlayerRef.current?.pause();
      setPlayingAudioId(null);
      return;
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }

    if (!msg.mediaUrl) return;
    const audio = new Audio(msg.mediaUrl);
    audioPlayerRef.current = audio;
    setPlayingAudioId(msg.id);

    audio.onended = () => {
      setPlayingAudioId(null);
      audioPlayerRef.current = null;
    };
    audio.onerror = () => {
      setPlayingAudioId(null);
      audioPlayerRef.current = null;
    };
    audio.play().catch(() => {
      setPlayingAudioId(null);
    });
  };

  const filteredMessages =
    isSearchOpen && searchQuery.trim()
      ? messages.filter((m) => (m.text || m.fileName || '').toLowerCase().includes(searchQuery.toLowerCase()))
      : messages;

  const formatDateDivider = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleCopyText = (msg: Message) => {
    if (!msg.text) return;
    navigator.clipboard?.writeText(msg.text).catch(() => {});
    setCopiedMsgId(msg.id);
    setTimeout(() => setCopiedMsgId(null), 1500);
  };

  const handleMessagesScroll = () => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottom(distanceFromBottom > 180);
  };

  const availableForwardChats = chatStore
    .getChats()
    .filter((c) => c.id !== chat.id)
    .filter((c) => {
      if (!forwardSearch.trim()) return true;
      const otherId = c.type === 'group' ? null : c.participants.find((p) => p !== currentUser?.id);
      const other = otherId ? chatStore.getUser(otherId) : null;
      const label = (c.type === 'group' ? c.name || 'Group' : other?.displayName || '').toLowerCase();
      return label.includes(forwardSearch.trim().toLowerCase());
    });

  const existingPrivatePartnerIds = new Set(
    availableForwardChats
      .filter((c) => c.type === 'private')
      .map((c) => c.participants.find((p) => p !== currentUser?.id))
      .filter(Boolean) as string[]
  );

  const forwardableNewUsers = chatStore
    .getUsers()
    .filter((u) => u.id !== currentUser?.id && u.id !== partner?.id && !existingPrivatePartnerIds.has(u.id))
    .filter((u) => {
      if (!forwardSearch.trim()) return true;
      const q = forwardSearch.trim().toLowerCase();
      return (
        (u.displayName || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      );
    });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#EFEAE2] relative overflow-hidden select-none">
      {/* Subtle Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(#0FA958 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Hidden Real File Inputs */}
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleMediaFileSelected}
        className="hidden"
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.csv"
        onChange={handleDocFileSelected}
        className="hidden"
      />

      {/* Top Conversation Header */}
      <div className="relative z-20 flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="md:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div
            onClick={() => {
              if (chat.type === 'group') {
                onOpenGroupInfo(chat);
              } else if (partner) {
                setShowContactInfo(true);
              }
            }}
            className="relative shrink-0 cursor-pointer"
          >
            <img
              src={chatAvatar}
              alt={chatTitle}
              className="w-10 h-10 rounded-full object-cover border border-slate-200"
            />
            {showPartnerOnline && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
            )}
          </div>

          <div
            onClick={() => {
              if (chat.type === 'group') {
                onOpenGroupInfo(chat);
              } else if (partner) {
                setShowContactInfo(true);
              }
            }}
            className="min-w-0 cursor-pointer"
          >
            <h2 className="text-sm font-bold text-slate-800 truncate font-['Outfit']">
              {chatTitle}
            </h2>
            <p className={`text-[11px] truncate ${typingParticipantNames.length > 0 ? 'text-emerald-600 font-semibold' : 'text-slate-500'}`}>
              {typingParticipantNames.length > 0
                ? chat.type === 'group'
                  ? `${typingParticipantNames[0]} is typing...`
                  : 'typing...'
                : chat.type === 'group'
                ? `${chat.participants.length} members · tap for info`
                : partner?.privacySettings?.lastSeenVisibility === 'nobody'
                ? 'Private status'
                : showPartnerOnline
                ? 'Online'
                : formatLastSeen(partner?.lastSeen)}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0 text-slate-600">
          {partner && !isBlocked && (
            <>
              <button
                onClick={() => onStartVoiceCall(partner)}
                className="p-2 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-colors cursor-pointer"
                title="Start Voice Call"
              >
                <Phone className="w-5 h-5" />
              </button>
              <button
                onClick={() => onStartVideoCall(partner)}
                className="p-2 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-colors cursor-pointer"
                title="Start Video Call"
              >
                <Video className="w-5 h-5" />
              </button>
            </>
          )}

          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              isSearchOpen ? 'bg-emerald-100 text-emerald-800' : 'hover:bg-slate-100'
            }`}
            title="Search inside chat"
          >
            <Search className="w-5 h-5" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMoreMenu && (
              <div className="absolute right-0 top-11 z-30 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 p-1.5 text-xs text-slate-700 animate-scale-in">
                {chat.type === 'group' ? (
                  <button
                    onClick={() => {
                      onOpenGroupInfo(chat);
                      setShowMoreMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-xl font-medium cursor-pointer"
                  >
                    Group Info & Admins
                  </button>
                ) : (
                  partner && (
                    <>
                      <button
                        onClick={() => {
                          setShowContactInfo(true);
                          setShowMoreMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-xl flex items-center gap-2 cursor-pointer"
                      >
                        <Info className="w-4 h-4 text-emerald-600" />
                        <span>Contact Info & Media</span>
                      </button>
                      <button
                        onClick={() => {
                          isBlocked
                            ? chatStore.unblockUser(partner.id)
                            : chatStore.blockUser(partner.id, partner.displayName);
                          setShowMoreMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-xl flex items-center gap-2 cursor-pointer"
                      >
                        <UserX className="w-4 h-4 text-slate-500" />
                        <span>{isBlocked ? 'Unblock Contact' : 'Block Contact'}</span>
                      </button>
                      <button
                        onClick={() => {
                          setReportTarget(partner);
                          setReportDetails('');
                          setShowMoreMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-rose-50 text-rose-600 rounded-xl flex items-center gap-2 cursor-pointer"
                      >
                        <ShieldAlert className="w-4 h-4 text-rose-500" />
                        <span>Report Contact</span>
                      </button>
                    </>
                  )
                )}
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={() => {
                    setConfirmClearChat(true);
                    setShowMoreMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer"
                >
                  Delete Conversation
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* In-Chat Message Search Bar */}
      {isSearchOpen && (
        <div className="bg-emerald-50 px-4 py-2 border-b border-emerald-200/80 flex items-center justify-between z-20">
          <div className="flex items-center gap-2 flex-1">
            <Search className="w-4 h-4 text-emerald-700" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages in this conversation..."
              className="bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none flex-1"
              autoFocus
            />
          </div>
          <button
            onClick={() => {
              setSearchQuery('');
              setIsSearchOpen(false);
            }}
            className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 flex items-center justify-between text-xs text-rose-700 z-20">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {uploadError}
          </span>
          <button onClick={() => setUploadError(null)} className="p-1 hover:text-rose-900 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Message Scroll Viewport */}
      <div
        ref={messagesScrollRef}
        onScroll={handleMessagesScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3 z-10 relative"
      >
        <div className="flex justify-center my-2">
          <span className="bg-white/80 backdrop-blur-xs text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-1 rounded-full shadow-xs border border-slate-200/50">
            End-to-End Real-Time Sync
          </span>
        </div>

        {filteredMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
            <p className="text-xs bg-white/80 px-4 py-2 rounded-2xl shadow-xs">
              {searchQuery ? 'No messages match your search.' : `Say Salam / Hello to ${chatTitle}!`}
            </p>
          </div>
        )}

        {filteredMessages.map((msg, index) => {
          const isMe = currentUser ? msg.senderId === currentUser.id : false;
          const isSelected = selectedMsgId === msg.id;
          const prevMsg = index > 0 ? filteredMessages[index - 1] : null;
          const showDateDivider =
            !prevMsg ||
            new Date(prevMsg.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();

          return (
            <React.Fragment key={msg.id}>
              {showDateDivider && (
                <div className="flex justify-center my-2">
                  <span className="bg-white/90 text-[10px] font-semibold text-slate-500 px-3 py-0.5 rounded-full shadow-xs border border-slate-200/60">
                    {formatDateDivider(msg.createdAt)}
                  </span>
                </div>
              )}

              <div
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group/msg relative`}
              >
                {!isMe && chat.type === 'group' && (
                  <span className="text-[10px] font-bold text-emerald-800 mb-1 ml-2">
                    {msg.senderName}
                  </span>
                )}

                {/* Message Bubble Container */}
                <div
                  onClick={() => {
                    if (!msg.isDeleted) {
                      setSelectedMsgId(isSelected ? null : msg.id);
                    }
                  }}
                  className={`relative max-w-[85%] md:max-w-[70%] p-3 text-sm shadow-xs transition-all cursor-pointer ${
                    isMe
                      ? 'bg-[#0FA958] text-white rounded-2xl rounded-tr-xs'
                      : 'bg-white text-slate-800 border border-slate-100 rounded-2xl rounded-tl-xs'
                  } ${isSelected ? 'ring-2 ring-emerald-400/70' : ''}`}
                >
                {msg.forwardedFrom && (
                  <div className="flex items-center gap-1 text-[10px] opacity-80 italic mb-1">
                    <Forward className="w-3 h-3" />
                    <span>Forwarded</span>
                  </div>
                )}

                {msg.replyToText && (
                  <div
                    className={`mb-2 p-2 rounded-xl text-xs border-l-4 truncate ${
                      isMe
                        ? 'bg-emerald-700/60 border-white text-white'
                        : 'bg-slate-100 border-emerald-600 text-slate-700'
                    }`}
                  >
                    <span className="font-semibold block text-[10px] opacity-80">
                      {msg.replyToSenderName || 'Reply'}
                    </span>
                    <span className="truncate block opacity-90">{msg.replyToText}</span>
                  </div>
                )}

                {msg.type === 'image' && msg.mediaUrl && !msg.isDeleted && (
                  <div className="mb-2 rounded-xl overflow-hidden border border-black/10">
                    <img
                      src={msg.mediaUrl}
                      alt={msg.fileName || 'Photo'}
                      className="max-h-64 w-full object-cover rounded-lg hover:opacity-95 cursor-pointer"
                      onClick={() => setLightboxImage(msg.mediaUrl!)}
                    />
                  </div>
                )}

                {msg.type === 'video' && msg.mediaUrl && !msg.isDeleted && (
                  <div className="mb-2 rounded-xl overflow-hidden border border-black/10">
                    <video
                      src={msg.mediaUrl}
                      controls
                      className="max-h-64 w-full rounded-lg bg-black"
                    />
                  </div>
                )}

                {msg.type === 'audio' && !msg.isDeleted && (
                  <div className="flex items-center gap-3 py-1 min-w-[220px]">
                    <button
                      onClick={() => toggleAudioPlayback(msg)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 cursor-pointer ${
                        isMe ? 'bg-white text-emerald-700' : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {playingAudioId === msg.id ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5 ml-0.5" />
                      )}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-0.5 h-6 my-1">
                        {[40, 70, 90, 50, 80, 100, 60, 40, 85, 95, 60, 75, 45, 90, 65, 30].map((h, i) => (
                          <span
                            key={i}
                            className={`w-1 rounded-full transition-all ${
                              playingAudioId === msg.id
                                ? isMe
                                  ? 'bg-white animate-pulse'
                                  : 'bg-emerald-700 animate-pulse'
                                : isMe
                                ? 'bg-emerald-200/70'
                                : 'bg-slate-300'
                            }`}
                            style={{ height: `${h}%` }}
                          />
                        ))}
                      </div>
                      <div className="flex justify-between text-[10px] opacity-80">
                        <span>{playingAudioId === msg.id ? 'Playing...' : 'Voice message'}</span>
                        <span className="font-mono">{msg.duration ? `${msg.duration}s` : '0:01'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {msg.type === 'document' && !msg.isDeleted && (
                  <a
                    href={msg.mediaUrl || '#'}
                    download={msg.fileName || 'document'}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border mb-1 cursor-pointer ${
                      isMe ? 'bg-emerald-700/50 border-emerald-400/30 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${isMe ? 'bg-white/20' : 'bg-emerald-100 text-emerald-700'}`}>
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{msg.fileName || 'Document'}</p>
                      <p className="text-[10px] opacity-75">{msg.fileSize || 'File'}</p>
                    </div>
                    <Download className="w-4 h-4 shrink-0 opacity-80 hover:opacity-100" />
                  </a>
                )}

                {msg.text && (
                  <p className={`whitespace-pre-wrap break-words leading-relaxed ${msg.isDeleted ? 'italic opacity-75 text-xs' : ''}`}>
                    {msg.text}
                  </p>
                )}

                {/* Footer: Time & Delivery/Seen Ticks */}
                <div
                  className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                    isMe ? 'text-emerald-100' : 'text-slate-400'
                  }`}
                >
                  {msg.isEdited && !msg.isDeleted && <span className="italic mr-1">edited</span>}
                  <span>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isMe && !msg.isDeleted && (
                    <span
                      title={
                        msg.status === 'pending'
                          ? 'Queued offline — will send automatically when online'
                          : msg.status === 'read'
                          ? 'Seen'
                          : msg.status === 'delivered'
                          ? 'Delivered'
                          : 'Sent'
                      }
                    >
                      {msg.status === 'pending' ? (
                        <Clock className="w-3 h-3 opacity-85" />
                      ) : msg.status === 'read' ? (
                        <CheckCheck className="w-3.5 h-3.5 text-sky-200" />
                      ) : msg.status === 'delivered' ? (
                        <CheckCheck className="w-3.5 h-3.5 opacity-85" />
                      ) : (
                        <Check className="w-3.5 h-3.5 opacity-80" />
                      )}
                    </span>
                  )}
                </div>

                {msg.reactions && msg.reactions.length > 0 && !msg.isDeleted && (
                  <div className="absolute -bottom-2 right-2 bg-white rounded-full shadow-md px-1.5 py-0.5 border border-slate-200 flex items-center gap-0.5 text-xs">
                    {msg.reactions.map((r, i) => (
                      <span key={i}>{r.emoji}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Message Quick Action Bar (Hover on Desktop + Tap on Mobile) */}
              {!msg.isDeleted && (
                <div
                  className={`${
                    isSelected ? 'opacity-100' : 'opacity-0 group-hover/msg:opacity-100'
                  } transition-opacity flex items-center gap-1 my-1 px-2 bg-white/95 backdrop-blur-xs rounded-full shadow-sm border border-slate-200/70 py-0.5 ${
                    isMe ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {['👍', '❤️', '😂', '🔥', '😮', '🙏'].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={(e) => {
                        e.stopPropagation();
                        chatStore.reactToMessage(msg.id, emoji);
                        setSelectedMsgId(null);
                      }}
                      className="p-1 hover:scale-125 text-xs transition-transform cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setReplyTo(msg);
                      setSelectedMsgId(null);
                    }}
                    className="p-1 text-slate-500 hover:text-emerald-700 rounded transition-colors cursor-pointer"
                    title="Reply"
                  >
                    <Reply className="w-3.5 h-3.5" />
                  </button>

                  {msg.text && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyText(msg);
                      }}
                      className="p-1 text-slate-500 hover:text-emerald-700 rounded transition-colors cursor-pointer flex items-center gap-0.5"
                      title="Copy text"
                    >
                      {copiedMsgId === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setForwardSearch('');
                      setForwardingMessage(msg);
                      setSelectedMsgId(null);
                    }}
                    className="p-1 text-slate-500 hover:text-emerald-700 rounded transition-colors cursor-pointer"
                    title="Forward"
                  >
                    <Forward className="w-3.5 h-3.5" />
                  </button>

                  {isMe && msg.type === 'text' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingMessage(msg);
                        setInputText(msg.text || '');
                        setSelectedMsgId(null);
                      }}
                      className="p-1 text-slate-500 hover:text-emerald-700 rounded transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTargetMsg(msg);
                      setSelectedMsgId(null);
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom floating button */}
      {showScrollBottom && (
        <button
          onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="absolute bottom-24 right-6 z-20 w-9 h-9 bg-white text-emerald-700 rounded-full shadow-lg border border-slate-200 flex items-center justify-center hover:bg-emerald-50 cursor-pointer"
          title="Jump to latest messages"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}

      {/* Quoted Reply Banner */}
      {replyTo && (
        <div className="bg-emerald-50 px-4 py-2 border-t border-emerald-200 flex items-center justify-between z-20">
          <div className="border-l-4 border-emerald-600 pl-3">
            <span className="text-[11px] font-bold text-emerald-800">
              Replying to {replyTo.senderName}
            </span>
            <p className="text-xs text-slate-600 truncate max-w-md">
              {replyTo.text || `[${replyTo.type}]`}
            </p>
          </div>
          <button onClick={() => setReplyTo(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Editing Banner */}
      {editingMessage && (
        <div className="bg-amber-50 px-4 py-2 border-t border-amber-200 flex items-center justify-between z-20">
          <div className="border-l-4 border-amber-600 pl-3">
            <span className="text-[11px] font-bold text-amber-800">Editing Message</span>
            <p className="text-xs text-slate-600 truncate max-w-md">{editingMessage.text}</p>
          </div>
          <button
            onClick={() => {
              setEditingMessage(null);
              setInputText('');
            }}
            className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input Action Bar (or Blocked Banner) */}
      <div className="bg-white px-4 py-3 border-t border-slate-200/80 z-20 mb-16 md:mb-0">
        {isBlocked && partner ? (
          <div className="flex items-center justify-between py-1 px-3 bg-slate-100 rounded-xl text-xs text-slate-600">
            <span>You blocked {partner.displayName}. Unblock to send messages.</span>
            <button
              onClick={() => chatStore.unblockUser(partner.id)}
              className="text-emerald-700 font-semibold hover:underline cursor-pointer"
            >
              Unblock
            </button>
          </div>
        ) : (
          <>
            {showAttachMenu && (
              <div className="absolute bottom-20 left-12 z-30 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 flex gap-4 text-xs animate-scale-in">
                <button
                  onClick={() => mediaInputRef.current?.click()}
                  className="flex flex-col items-center gap-1.5 text-slate-700 hover:text-emerald-700 cursor-pointer"
                >
                  <div className="w-11 h-11 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center shadow-xs">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <span>Photo / Video</span>
                </button>
                <button
                  onClick={() => docInputRef.current?.click()}
                  className="flex flex-col items-center gap-1.5 text-slate-700 hover:text-indigo-700 cursor-pointer"
                >
                  <div className="w-11 h-11 bg-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-center shadow-xs">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <span>Document</span>
                </button>
                <button
                  onClick={() => {
                    setShowAttachMenu(false);
                    handleStartRecording();
                  }}
                  className="flex flex-col items-center gap-1.5 text-slate-700 hover:text-amber-700 cursor-pointer"
                >
                  <div className="w-11 h-11 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center shadow-xs">
                    <Mic className="w-5 h-5" />
                  </div>
                  <span>Voice Note</span>
                </button>
              </div>
            )}

            {showEmojiPicker && (
              <div className="absolute bottom-20 left-4 z-30 bg-white rounded-2xl shadow-xl border border-slate-100 p-2.5 flex flex-wrap gap-1.5 max-w-xs text-xl animate-scale-in">
                {['👋', '💚', '🔥', '🚀', '✨', '😂', '👍', '🙏', '🎉', '💯', '❤️', '🤝', '😊', '👌'].map((em) => (
                  <button
                    key={em}
                    onClick={() => {
                      handleInputChange(inputText + em);
                      setShowEmojiPicker(false);
                    }}
                    className="hover:scale-125 transition-transform p-1 cursor-pointer"
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}

            {isUploading ? (
              <div className="flex items-center justify-between gap-3 py-1.5 px-2 bg-emerald-50/80 border border-emerald-200/70 rounded-xl">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-700 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-800 mb-1">
                      <span className="truncate">{uploadLabel}</span>
                      <span className="ml-2 shrink-0 font-mono">{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-emerald-200/80 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all duration-200"
                        style={{ width: `${Math.max(uploadProgress, 8)}%` }}
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => uploadAbortRef.current?.abort()}
                  className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : isRecording ? (
              <div className="flex items-center justify-between gap-4 py-1">
                <div className="flex items-center gap-3">
                  <span className="w-3.5 h-3.5 bg-rose-500 rounded-full animate-ping" />
                  <span className="text-xs font-semibold text-rose-600 font-mono">
                    Recording Voice Note: 00:{recordDuration.toString().padStart(2, '0')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStopRecording(false)}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-rose-600 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleStopRecording(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Note</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition-colors cursor-pointer"
                  title="Emoji"
                >
                  <Smile className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowAttachMenu(!showAttachMenu)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition-colors cursor-pointer"
                  title="Attach Photo, Video, or Document"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 py-2.5 px-4 bg-slate-100 focus:bg-white text-sm text-slate-800 placeholder-slate-400 rounded-2xl border border-transparent focus:border-emerald-500 focus:outline-none transition-all"
                />

                {inputText.trim() ? (
                  <button
                    type="submit"
                    className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-md transition-all cursor-pointer active:scale-95"
                    title="Send Message"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    className="p-2.5 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded-2xl transition-colors cursor-pointer"
                    title="Record Voice Message"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                )}
              </form>
            )}
          </>
        )}
      </div>

      {/* Image Lightbox Modal */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxImage}
            alt="Full Preview"
            className="max-h-[85vh] max-w-full rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Forward Message Modal (Chats + Any Registered User) */}
      {forwardingMessage && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-800">Forward Message To</h3>
              <button onClick={() => setForwardingMessage(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={forwardSearch}
                onChange={(e) => setForwardSearch(e.target.value)}
                placeholder="Search chat or registered user..."
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-100 rounded-xl focus:outline-none focus:bg-white border border-transparent focus:border-emerald-500"
              />
            </div>

            {availableForwardChats.length === 0 && forwardableNewUsers.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No matching conversations or users found.</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {availableForwardChats.map((c) => {
                  const otherId = c.type === 'group' ? null : c.participants.find((p) => p !== currentUser?.id);
                  const other = otherId ? chatStore.getUser(otherId) : null;
                  const label = c.type === 'group' ? c.name || 'Group' : other?.displayName || 'DOST User';
                  return (
                    <button
                      key={c.id}
                      onClick={async () => {
                        await chatStore.forwardMessage(forwardingMessage, c.id);
                        setForwardingMessage(null);
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50 text-left text-xs font-semibold text-slate-700 cursor-pointer"
                    >
                      <span>{label}</span>
                      <Send className="w-3.5 h-3.5 text-emerald-600" />
                    </button>
                  );
                })}

                {forwardableNewUsers.length > 0 && (
                  <p className="px-2 pt-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    Registered Users
                  </p>
                )}

                {forwardableNewUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={async () => {
                      const targetChat = await chatStore.createOrGetPrivateChat(u.id);
                      await chatStore.forwardMessage(forwardingMessage, targetChat.id);
                      setForwardingMessage(null);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50 text-left text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    <span>{u.displayName}</span>
                    <Send className="w-3.5 h-3.5 text-emerald-600" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contact Info Modal */}
      <ContactInfoModal
        isOpen={showContactInfo}
        onClose={() => setShowContactInfo(false)}
        partner={partner || null}
        chat={chat}
        currentUser={currentUser}
        messages={messages}
        onStartVoiceCall={onStartVoiceCall}
        onStartVideoCall={onStartVideoCall}
        onRequestReport={(p) => {
          setReportTarget(p);
          setReportDetails('');
        }}
      />

      {/* Report Contact Modal */}
      {reportTarget && (
        <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-800">Report {reportTarget.displayName}</h3>
              <button onClick={() => setReportTarget(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                >
                  <option value="Spam or unwanted messages">Spam or unwanted messages</option>
                  <option value="Harassment or abusive behavior">Harassment or abusive behavior</option>
                  <option value="Impersonation or fake profile">Impersonation or fake profile</option>
                  <option value="Inappropriate or harmful content">Inappropriate or harmful content</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Additional Details (Optional)</label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Describe what happened..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl h-20 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setReportTarget(null)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await chatStore.reportUser(reportTarget.id, reportReason, reportDetails.trim());
                    const reportedName = reportTarget.displayName;
                    setReportTarget(null);
                    if (onReportSubmitted) onReportSubmitted(reportedName);
                  }}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl cursor-pointer"
                >
                  Submit Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Message Modal */}
      {deleteTargetMsg && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-5 max-w-xs w-full shadow-2xl border border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 mb-1">Delete Message?</h3>
            <p className="text-xs text-slate-500 mb-4">Choose how you want to remove this message.</p>
            <div className="space-y-2">
              {currentUser && deleteTargetMsg.senderId === currentUser.id && (
                <button
                  onClick={() => {
                    chatStore.deleteMessage(deleteTargetMsg.id, true);
                    setDeleteTargetMsg(null);
                  }}
                  className="w-full py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer"
                >
                  Delete for Everyone
                </button>
              )}
              <button
                onClick={() => {
                  chatStore.deleteMessage(deleteTargetMsg.id, false);
                  setDeleteTargetMsg(null);
                }}
                className="w-full py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl cursor-pointer"
              >
                Delete for Me
              </button>
              <button
                onClick={() => setDeleteTargetMsg(null)}
                className="w-full py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Chat Confirmation Modal */}
      {confirmClearChat && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-5 max-w-xs w-full shadow-2xl border border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 mb-1">Delete this conversation?</h3>
            <p className="text-xs text-slate-500 mb-4">This action removes the chat thread from Firestore.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmClearChat(false)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  chatStore.deleteChat(chat.id);
                  setConfirmClearChat(false);
                  onBack();
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
