import React, { useState, useEffect, useRef } from 'react';
import { Chat, Message, User } from '../types';
import { chatStore } from '../services/chatService';
import { uploadMediaFile, formatFileSize } from '../services/storageService';
import { CHAT_THEMES, ChatThemeConfig, ChatThemeId, themeService } from '../services/themeService';
import { securityService } from '../services/securityService';
import { PAYMENT_RAILS, formatPKR } from '../services/paymentService';
import { ContactInfoModal } from './ContactInfoModal';
import { PaymentModal } from './PaymentModal';
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
  Palette,
  BarChart3,
  Lock,
  Unlock,
  Plus,
  Banknote,
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
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [copiedPayId, setCopiedPayId] = useState<string | null>(null);
  const [chatTheme, setChatTheme] = useState<ChatThemeConfig>(themeService.getTheme());
  const [isChatLocked, setIsChatLocked] = useState(false);

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

  useEffect(() => {
    const syncTheme = () => setChatTheme(themeService.getTheme());
    return themeService.subscribe(syncTheme);
  }, []);

  useEffect(() => {
    if (!chat) {
      setIsChatLocked(false);
      return;
    }
    const syncLock = () => setIsChatLocked(securityService.isChatLocked(chat.id));
    syncLock();
    return securityService.subscribe(syncLock);
  }, [chat?.id]);

  if (!chat) {
    return (
      <div
        className={`hidden md:flex flex-1 flex-col items-center justify-center text-center p-8 select-none relative overflow-hidden ${chatTheme.canvasBg}`}
      >
        <div
          className={`absolute inset-0 pointer-events-none ${chatTheme.patternOpacity}`}
          style={{
            backgroundImage: `radial-gradient(${chatTheme.patternColor} 1.25px, transparent 1.25px)`,
            backgroundSize: '26px 26px',
          }}
        />
        <div className="relative z-10 flex flex-col items-center max-w-sm">
          <div className="w-24 h-24 mb-6 rounded-[28px] bg-white dark:bg-[#0D2116] p-2 shadow-[0_20px_45px_-12px_rgba(11,128,67,0.22)] ring-1 ring-emerald-950/10 flex items-center justify-center">
            <img
              src="/assets/aistudio/download_7eb2aac4.jpeg"
              alt="DOST"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover rounded-[20px]"
            />
          </div>
          <h2 className={`text-2xl font-bold font-['Outfit'] mb-2 ${chatTheme.headerTitle}`}>
            DOST Messaging App
          </h2>
          <p className={`text-sm mb-6 leading-relaxed ${chatTheme.headerSubtitle}`}>
            Select a conversation or open Contacts to message real registered DOST users in real time.
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-600/90">
            Developed by Husnain Butt · Version 1.0
          </p>
        </div>
      </div>
    );
  }

  const partnerId = chat.type === 'private' ? chat.participants.find((p) => p !== currentUser?.id) : null;
  const partner = partnerId ? chatStore.getUser(partnerId) : null;
  const isBlocked = partner ? chatStore.isUserBlocked(partner.id) : false;
  const isGroupOrChannelAdmin =
    !currentUser
      ? false
      : (chat.adminIds || []).includes(currentUser.id) || chat.createdBy === currentUser.id;
  const isPostingRestricted =
    (chat.type === 'channel' && !isGroupOrChannelAdmin) ||
    (chat.type === 'group' && Boolean(chat.onlyAdminsCanMessage) && !isGroupOrChannelAdmin);

  const chatTitle =
    chat.type === 'group' || chat.type === 'channel' || chat.type === 'broadcast'
      ? chat.name || 'DOST Chat'
      : partner?.displayName || 'DOST User';
  const chatAvatar =
    chat.type === 'group' || chat.type === 'channel' || chat.type === 'broadcast'
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
    <div className={`flex-1 flex flex-col h-full relative overflow-hidden select-none transition-colors duration-300 ${chatTheme.canvasBg}`}>
      {/* Crisp Geometric Chat Canvas Pattern */}
      <div
        className={`absolute inset-0 pointer-events-none ${chatTheme.patternOpacity}`}
        style={{
          backgroundImage: `radial-gradient(${chatTheme.patternColor} 1.25px, transparent 1.25px)`,
          backgroundSize: '26px 26px',
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
      <div className={`relative z-20 flex items-center justify-between px-4 py-3 shadow-xs transition-colors ${chatTheme.headerBg}`}>
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className={`md:hidden p-2 -ml-1.5 rounded-xl cursor-pointer transition-colors ${chatTheme.headerIcon} ${chatTheme.headerHover}`}
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
              className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500/20"
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
            <h2 className={`text-sm font-bold truncate font-['Outfit'] ${chatTheme.headerTitle}`}>
              {chatTitle}
            </h2>
            <p className={`text-[11px] truncate ${typingParticipantNames.length > 0 ? 'text-emerald-500 font-semibold' : chatTheme.headerSubtitle}`}>
              {typingParticipantNames.length > 0
                ? chat.type === 'group'
                  ? `${typingParticipantNames[0]} is typing...`
                  : 'typing...'
                : chat.type === 'channel'
                ? `${chat.participants.length} follower${chat.participants.length === 1 ? '' : 's'} · ${chat.isPublic ? 'Public Channel' : 'Private Channel'}`
                : chat.type === 'broadcast'
                ? `Broadcast list · ${Math.max(chat.participants.length - 1, 0)} recipients`
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
        <div className={`flex items-center gap-0.5 shrink-0 ${chatTheme.headerIcon}`}>
          {partner && !isBlocked && (
            <>
              <button
                onClick={() => onStartVoiceCall(partner)}
                className={`p-2.5 rounded-xl transition-colors cursor-pointer ${chatTheme.headerHover}`}
                title="Start Voice Call"
              >
                <Phone className="w-5 h-5" />
              </button>
              <button
                onClick={() => onStartVideoCall(partner)}
                className={`p-2.5 rounded-xl transition-colors cursor-pointer ${chatTheme.headerHover}`}
                title="Start Video Call"
              >
                <Video className="w-5 h-5" />
              </button>
            </>
          )}

          <button
            onClick={() => setShowThemePicker(true)}
            className={`p-2.5 rounded-xl transition-colors cursor-pointer ${chatTheme.headerHover}`}
            title="Change Chat Theme"
          >
            <Palette className="w-5 h-5" />
          </button>

          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
              isSearchOpen ? 'bg-emerald-500/15 text-emerald-500' : chatTheme.headerHover
            }`}
            title="Search inside chat"
          >
            <Search className="w-5 h-5" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className={`p-2.5 rounded-xl transition-colors cursor-pointer ${chatTheme.headerHover}`}
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
                <button
                  onClick={() => {
                    if (isChatLocked) {
                      securityService.unlockChat(chat.id);
                    } else {
                      securityService.lockChat(chat.id);
                    }
                    setShowMoreMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-xl flex items-center gap-2 cursor-pointer"
                >
                  {isChatLocked ? (
                    <>
                      <Unlock className="w-4 h-4 text-emerald-600" />
                      <span>Unlock Chat</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-emerald-600" />
                      <span>Lock Chat</span>
                    </>
                  )}
                </button>
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
        <div className={`px-4 py-2 flex items-center justify-between z-20 ${chatTheme.searchBarBg}`}>
          <div className="flex items-center gap-2 flex-1">
            <Search className="w-4 h-4 text-emerald-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages in this conversation..."
              className="bg-transparent text-xs placeholder-slate-400 focus:outline-none flex-1"
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
          <span className={`text-[10px] font-semibold uppercase tracking-[0.14em] px-3 py-1 rounded-full ${chatTheme.dividerBadge}`}>
            End-to-End Real-Time Sync
          </span>
        </div>

        {filteredMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
            <p className={`text-xs px-4 py-2 rounded-2xl ${chatTheme.dividerBadge}`}>
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
                <div className="flex justify-center my-2.5">
                  <span className={`text-[10px] font-semibold px-3 py-0.5 rounded-full ${chatTheme.dividerBadge}`}>
                    {formatDateDivider(msg.createdAt)}
                  </span>
                </div>
              )}

              <div
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group/msg relative`}
              >
                {!isMe && chat.type === 'group' && (
                  <span className={`text-[10px] font-bold mb-1 ml-2 ${chatTheme.isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>
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
                  className={`relative max-w-[85%] md:max-w-[70%] px-3.5 py-2.5 text-sm transition-all cursor-pointer ${
                    isMe ? chatTheme.outgoingBubble : chatTheme.incomingBubble
                  } ${isSelected ? 'ring-2 ring-emerald-400/80' : ''}`}
                >
                {msg.forwardedFrom && (
                  <div className="flex items-center gap-1 text-[10px] opacity-80 italic mb-1">
                    <Forward className="w-3 h-3" />
                    <span>Forwarded</span>
                  </div>
                )}

                {msg.replyToText && (
                  <div
                    className={`mb-2 p-2 rounded-xl text-xs flex items-stretch gap-2 overflow-hidden ${
                      isMe ? chatTheme.outgoingReplyBox : chatTheme.incomingReplyBox
                    }`}
                  >
                    <span className={`w-1 rounded-full shrink-0 ${isMe ? chatTheme.outgoingReplyBar : chatTheme.incomingReplyBar}`} />
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold block text-[10px] opacity-80">
                        {msg.replyToSenderName || 'Reply'}
                      </span>
                      <span className="truncate block opacity-90">{msg.replyToText}</span>
                    </div>
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
                        isMe ? chatTheme.outgoingAudioBtn : chatTheme.incomingAudioBtn
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
                                  : 'bg-emerald-500 animate-pulse'
                                : isMe
                                ? chatTheme.outgoingAudioWave
                                : chatTheme.incomingAudioWave
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
                      isMe ? chatTheme.outgoingDocBox : chatTheme.incomingDocBox
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${isMe ? 'bg-white/20' : 'bg-emerald-500/15 text-emerald-600'}`}>
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{msg.fileName || 'Document'}</p>
                      <p className="text-[10px] opacity-75">{msg.fileSize || 'File'}</p>
                    </div>
                    <Download className="w-4 h-4 shrink-0 opacity-80 hover:opacity-100" />
                  </a>
                )}

                {msg.type === 'poll' && msg.poll && !msg.isDeleted && (() => {
                  const totalVotes = msg.poll.options.reduce((sum, o) => sum + o.voterIds.length, 0);
                  return (
                    <div className="min-w-[230px] sm:min-w-[270px] space-y-2 py-0.5">
                      <div className="flex items-start gap-2">
                        <BarChart3 className={`w-4 h-4 mt-0.5 shrink-0 ${isMe ? 'text-emerald-100' : 'text-emerald-600'}`} />
                        <div>
                          <p className="font-bold text-sm leading-snug">{msg.poll.question}</p>
                          <p className="text-[10px] opacity-75">
                            {msg.poll.allowMultiple ? 'Select multiple' : 'Select one'} · {totalVotes} vote{totalVotes === 1 ? '' : 's'}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        {msg.poll.options.map((opt) => {
                          const voted = currentUser ? opt.voterIds.includes(currentUser.id) : false;
                          const pct = totalVotes > 0 ? Math.round((opt.voterIds.length / totalVotes) * 100) : 0;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void chatStore.voteOnPoll(msg.id, opt.id);
                              }}
                              className={`relative w-full text-left rounded-xl px-3 py-2 overflow-hidden border transition-all cursor-pointer ${
                                isMe
                                  ? voted
                                    ? 'border-white bg-white/20 text-white'
                                    : 'border-white/25 bg-black/10 text-white hover:bg-white/15'
                                  : voted
                                  ? 'border-emerald-500 bg-emerald-50/70 text-slate-900'
                                  : 'border-slate-200 bg-slate-50/80 text-slate-800 hover:bg-slate-100'
                              }`}
                            >
                              <div
                                className={`absolute inset-y-0 left-0 transition-all duration-300 ${
                                  isMe ? 'bg-white/20' : 'bg-emerald-500/15'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                              <div className="relative flex items-center justify-between gap-2 text-xs">
                                <span className="font-semibold flex items-center gap-1.5 truncate">
                                  {voted && <Check className="w-3.5 h-3.5 shrink-0" />}
                                  <span className="truncate">{opt.text}</span>
                                </span>
                                <span className="font-mono text-[11px] shrink-0 opacity-85">
                                  {pct}% ({opt.voterIds.length})
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {msg.type === 'payment' && msg.payment && !msg.isDeleted && (() => {
                  const p = msg.payment;
                  const railName = PAYMENT_RAILS[p.method]?.name || p.method;
                  const isReceiver = currentUser?.id === p.receiverId;
                  const statusLabel =
                    p.status === 'completed'
                      ? 'Completed'
                      : p.status === 'declined'
                      ? 'Declined'
                      : p.status === 'sent'
                      ? 'Sent · Awaiting confirmation'
                      : 'Requested';

                  return (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`min-w-[235px] sm:min-w-[275px] rounded-2xl p-3 space-y-2.5 border ${
                        isMe
                          ? 'bg-white/12 border-white/25 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-bold flex items-center gap-1.5">
                          <Banknote className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {railName} · {p.kind === 'send' ? 'Payment' : 'Request'}
                          </span>
                        </span>
                        <span
                          className={`font-semibold flex items-center gap-1 ${
                            p.status === 'completed'
                              ? isMe
                                ? 'text-emerald-200'
                                : 'text-emerald-700'
                              : p.status === 'declined'
                              ? isMe
                                ? 'text-rose-200'
                                : 'text-rose-600'
                              : 'opacity-85'
                          }`}
                        >
                          {p.status === 'completed' ? (
                            <CheckCheck className="w-3.5 h-3.5" />
                          ) : p.status === 'declined' ? (
                            <X className="w-3.5 h-3.5" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                          <span>{statusLabel}</span>
                        </span>
                      </div>

                      <div>
                        <p className="text-xl font-extrabold font-mono tabular-nums tracking-tight">
                          {formatPKR(p.amount)}
                        </p>
                        {p.note && (
                          <p className="text-xs opacity-90 mt-0.5 break-words">{p.note}</p>
                        )}
                      </div>

                      {(p.accountNumber || p.referenceId) && (
                        <div
                          className={`text-[10px] pt-2 border-t space-y-1 ${
                            isMe ? 'border-white/20 text-white/85' : 'border-slate-200 text-slate-600'
                          }`}
                        >
                          {p.accountNumber && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono truncate">
                                {p.accountTitle ? `${p.accountTitle} · ` : ''}
                                {p.accountNumber}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard?.writeText(p.accountNumber || '');
                                  setCopiedPayId(msg.id);
                                  setTimeout(() => setCopiedPayId(null), 1500);
                                }}
                                className="font-semibold underline shrink-0 cursor-pointer"
                              >
                                {copiedPayId === msg.id ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          )}
                          {p.referenceId && (
                            <p className="font-mono opacity-80">Ref: {p.referenceId}</p>
                          )}
                        </div>
                      )}

                      {/* Action Buttons for Receiver */}
                      {isReceiver && p.kind === 'request' && p.status === 'pending' && (
                        <div className="flex gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => void chatStore.respondToPaymentMessage(msg.id, 'completed')}
                            className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer transition-colors"
                          >
                            Pay & Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => void chatStore.respondToPaymentMessage(msg.id, 'declined')}
                            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                              isMe
                                ? 'bg-white/15 hover:bg-white/25 text-white'
                                : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                            }`}
                          >
                            Decline
                          </button>
                        </div>
                      )}

                      {isReceiver && p.kind === 'send' && p.status === 'sent' && (
                        <button
                          type="button"
                          onClick={() => void chatStore.respondToPaymentMessage(msg.id, 'completed')}
                          className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer transition-colors"
                        >
                          Confirm Money Received
                        </button>
                      )}
                    </div>
                  );
                })()}

                {msg.text && msg.type !== 'poll' && msg.type !== 'payment' && (
                  <p className={`whitespace-pre-wrap break-words leading-relaxed ${msg.isDeleted ? 'italic opacity-75 text-xs' : ''}`}>
                    {msg.text}
                  </p>
                )}

                {/* Footer: Time & Delivery/Seen Ticks */}
                <div
                  className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                    isMe ? chatTheme.outgoingMeta : chatTheme.incomingMeta
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

                {msg.reactions && msg.reactions.length > 0 && !msg.isDeleted && (() => {
                  const counts = new Map<string, number>();
                  msg.reactions.forEach((r) => counts.set(r.emoji, (counts.get(r.emoji) || 0) + 1));
                  return (
                    <div className="absolute -bottom-2.5 right-2 bg-white text-slate-700 rounded-full shadow-md px-2 py-0.5 border border-slate-200 flex items-center gap-1.5 text-[11px]">
                      {Array.from(counts.entries()).map(([emoji, count]) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void chatStore.reactToMessage(msg.id, emoji);
                          }}
                          className="hover:scale-110 transition-transform flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>{emoji}</span>
                          {count > 1 && <span className="font-bold text-[10px]">{count}</span>}
                        </button>
                      ))}
                    </div>
                  );
                })()}
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
          className={`absolute bottom-24 right-6 z-20 w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors ${chatTheme.scrollDownBtn}`}
          title="Jump to latest messages"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}

      {/* Quoted Reply Banner */}
      {replyTo && (
        <div className={`px-4 py-2 flex items-center justify-between z-20 ${chatTheme.replyBannerBg}`}>
          <div className="flex items-stretch gap-2.5 min-w-0">
            <span className="w-1 rounded-full bg-emerald-600 shrink-0" />
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-emerald-600">
                Replying to {replyTo.senderName}
              </span>
              <p className="text-xs opacity-80 truncate max-w-md">
                {replyTo.text || `[${replyTo.type}]`}
              </p>
            </div>
          </div>
          <button onClick={() => setReplyTo(null)} className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Editing Banner */}
      {editingMessage && (
        <div className="bg-amber-50/95 px-4 py-2 border-t border-amber-200 flex items-center justify-between z-20">
          <div className="flex items-stretch gap-2.5 min-w-0">
            <span className="w-1 rounded-full bg-amber-600 shrink-0" />
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-amber-800">Editing Message</span>
              <p className="text-xs text-slate-600 truncate max-w-md">{editingMessage.text}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingMessage(null);
              setInputText('');
            }}
            className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input Action Bar (or Blocked Banner) */}
      <div className={`px-4 py-3 z-20 mb-16 md:mb-0 transition-colors ${chatTheme.composerBg}`}>
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
        ) : isPostingRestricted ? (
          <div className="flex items-center justify-between py-2 px-3 bg-slate-100/90 rounded-xl text-xs text-slate-600">
            <span>
              {chat.type === 'channel'
                ? 'Only channel admins can post updates.'
                : 'Only group admins can send messages in this group.'}
            </span>
            {chat.type === 'channel' && (
              <button
                type="button"
                onClick={async () => {
                  const isSubscribed = currentUser && chat.participants.includes(currentUser.id);
                  if (isSubscribed) {
                    await chatStore.leaveChannel(chat.id);
                  } else {
                    await chatStore.joinChannel(chat.id);
                  }
                }}
                className="px-3 py-1 bg-emerald-600 text-white rounded-lg font-semibold cursor-pointer"
              >
                {currentUser && chat.participants.includes(currentUser.id) ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
        ) : (
          <>
            {showAttachMenu && (
              <div className="absolute bottom-20 left-6 sm:left-12 z-30 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 flex flex-wrap gap-3 sm:gap-4 text-xs animate-scale-in">
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
                <button
                  onClick={() => {
                    setShowAttachMenu(false);
                    setPollQuestion('');
                    setPollOptions(['', '']);
                    setPollAllowMultiple(false);
                    setShowPollModal(true);
                  }}
                  className="flex flex-col items-center gap-1.5 text-slate-700 hover:text-sky-700 cursor-pointer"
                >
                  <div className="w-11 h-11 bg-sky-100 text-sky-700 rounded-2xl flex items-center justify-center shadow-xs">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <span>Create Poll</span>
                </button>
                {(chat.type === 'private' || chat.type === 'group') && currentUser && (
                  <button
                    onClick={() => {
                      setShowAttachMenu(false);
                      setShowPaymentModal(true);
                    }}
                    className="flex flex-col items-center gap-1.5 text-slate-700 hover:text-emerald-700 cursor-pointer"
                  >
                    <div className="w-11 h-11 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-xs">
                      <Banknote className="w-5 h-5" />
                    </div>
                    <span>DOST Pay</span>
                  </button>
                )}
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
                  className={`p-2.5 rounded-xl transition-colors cursor-pointer ${chatTheme.headerIcon} ${chatTheme.headerHover}`}
                  title="Emoji"
                >
                  <Smile className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowAttachMenu(!showAttachMenu)}
                  className={`p-2.5 rounded-xl transition-colors cursor-pointer ${chatTheme.headerIcon} ${chatTheme.headerHover}`}
                  title="Attach Photo, Video, or Document"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="Type a message..."
                  className={`flex-1 py-2.5 px-4 text-sm rounded-2xl focus:outline-none transition-all ${chatTheme.composerInput}`}
                />

                {inputText.trim() ? (
                  <button
                    type="submit"
                    className={`p-2.5 rounded-2xl transition-all cursor-pointer active:scale-95 ${chatTheme.sendButton}`}
                    title="Send Message"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    className={`p-2.5 rounded-2xl transition-colors cursor-pointer ${chatTheme.micButton}`}
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

      {/* Chat Theme Picker Modal */}
      {showThemePicker && (
        <div
          onClick={() => setShowThemePicker(false)}
          className="fixed inset-0 z-50 bg-black/55 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-slate-100"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-['Outfit']">Chat Theme</h3>
                <p className="text-xs text-slate-500">Pick a wallpaper & message bubble style</p>
              </div>
              <button
                onClick={() => setShowThemePicker(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {(Object.keys(CHAT_THEMES) as ChatThemeId[]).map((id) => {
                const t = CHAT_THEMES[id];
                const isActive = chatTheme.id === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      themeService.setTheme(id);
                      setShowThemePicker(false);
                    }}
                    className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isActive
                        ? 'border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-500/30'
                        : 'border-slate-200/80 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-11 h-11 rounded-xl shrink-0 border border-black/10 flex items-center justify-center relative overflow-hidden"
                        style={{ backgroundColor: t.swatchCanvas }}
                      >
                        <span
                          className="w-5 h-3.5 rounded-md shadow-xs translate-x-1 -translate-y-1"
                          style={{ backgroundColor: t.swatchPrimary }}
                        />
                        <span
                          className={`w-4 h-3 rounded-md shadow-xs -translate-x-1.5 translate-y-1.5 ${
                            t.isDark ? 'bg-[#13261D] border border-emerald-400/20' : 'bg-white border border-black/10'
                          }`}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{t.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{t.subtitle}</p>
                      </div>
                    </div>
                    {isActive && (
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Create Poll Modal */}
      {showPollModal && (
        <div
          onClick={() => setShowPollModal(false)}
          className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4 backdrop-blur-xs"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              const validOpts = pollOptions.map((o) => o.trim()).filter(Boolean);
              if (!pollQuestion.trim() || validOpts.length < 2) return;
              await chatStore.sendPollMessage(chat.id, pollQuestion, validOpts, pollAllowMultiple);
              setShowPollModal(false);
            }}
            className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4 text-slate-800"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-['Outfit']">Create Poll</h3>
                  <p className="text-[11px] text-slate-500">Ask members to vote in real time</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPollModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Question</label>
              <input
                type="text"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="Ask a question..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">Options</label>
              {pollOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const next = [...pollOptions];
                      next[idx] = e.target.value;
                      setPollOptions(next);
                    }}
                    placeholder={`Option ${idx + 1}`}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                    required={idx < 2}
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                      className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 6 && (
                <button
                  type="button"
                  onClick={() => setPollOptions([...pollOptions, ''])}
                  className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Option</span>
                </button>
              )}
            </div>

            <label className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 cursor-pointer">
              <span className="font-semibold text-slate-700">Allow multiple answers</span>
              <input
                type="checkbox"
                checked={pollAllowMultiple}
                onChange={(e) => setPollAllowMultiple(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 cursor-pointer"
              />
            </label>

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-md cursor-pointer"
            >
              Send Poll
            </button>
          </form>
        </div>
      )}

      {/* In-App Payments (DOST Pay) Modal */}
      {currentUser && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          chat={chat}
          currentUser={currentUser}
          defaultPartner={partner || null}
        />
      )}
    </div>
  );
};
