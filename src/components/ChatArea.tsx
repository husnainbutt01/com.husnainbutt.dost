import React, { useState, useEffect, useRef } from 'react';
import { Chat, Message, User } from '../types';
import { chatStore, getRemainingModifyMs, isMessageExpired } from '../services/chatService';
import { uploadMediaFile, formatFileSize } from '../services/storageService';
import { CHAT_THEMES, ChatThemeConfig, ChatThemeId, themeService } from '../services/themeService';
import { securityService } from '../services/securityService';
import { PAYMENT_RAILS, formatPKR } from '../services/paymentService';
import { mediaSettingsService } from '../services/mediaSettingsService';
import { liveLocationService } from '../services/liveLocationService';
import { ContactInfoModal } from './ContactInfoModal';
import { PaymentModal } from './PaymentModal';
import { LiveLocationPickerModal, LiveLocationMessageCard } from './LiveLocationComponents';
import {
  Phone,
  Video,
  Search,
  MoreVertical,
  Smile,
  Paperclip,
  Camera,
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
  Sun,
  Moon,
  Timer,
  Eye,
  EyeOff,
  MapPin,
  AudioWaveform,
  Sparkles,
  Wifi,
  Radio,
  Shield,
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

  const [mediaSettings, setMediaSettings] = useState(mediaSettingsService.getSettings());
  const [activeLiveSessions, setActiveLiveSessions] = useState(liveLocationService.getActiveSessions());
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [audioSpeed, setAudioSpeed] = useState<1 | 1.5 | 2>(1);
  const [pendingVoiceNote, setPendingVoiceNote] = useState<{
    blob: Blob;
    url: string;
    duration: number;
    mimeType: string;
  } | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  const [pendingMediaPreview, setPendingMediaPreview] = useState<{
    file: File;
    objectUrl: string;
    isVideo: boolean;
  } | null>(null);
  const [isHdMedia, setIsHdMedia] = useState(() => mediaSettingsService.getSettings().defaultHdMedia);
  const [isViewOnceMedia, setIsViewOnceMedia] = useState(false);
  const [pendingMediaCaption, setPendingMediaCaption] = useState('');

  const [activeViewOnceMsg, setActiveViewOnceMsg] = useState<Message | null>(null);
  const [isViewerObscured, setIsViewerObscured] = useState(false);
  const [loadedLowDataMsgIds, setLoadedLowDataMsgIds] = useState<Set<string>>(() => new Set());

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showDisappearingModal, setShowDisappearingModal] = useState(false);
  const [showPinLockPrompt, setShowPinLockPrompt] = useState(false);
  const [inlineLockPin, setInlineLockPin] = useState('');

  const [swipeState, setSwipeState] = useState<{ msgId: string; offsetX: number } | null>(null);
  const swipeTouchRef = useRef<{ msgId: string; startX: number; startY: number; active: boolean } | null>(
    null
  );

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const rawRecordStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);

  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSelectedMsgId(null);
    setShowContactInfo(false);
    setShowMoreMenu(false);
    setShowAttachMenu(false);
    setShowEmojiPicker(false);
    setShowDisappearingModal(false);
    setShowLocationModal(false);
    setActiveViewOnceMsg(null);
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setIsPreviewPlaying(false);
    setPendingVoiceNote((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setPendingMediaPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev.objectUrl);
      return null;
    });
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
    const el = composerTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [inputText, chat?.id]);

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
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      if (recordStreamRef.current) {
        recordStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (rawRecordStreamRef.current) {
        rawRecordStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    const syncTheme = () => setChatTheme(themeService.getTheme());
    return themeService.subscribe(syncTheme);
  }, []);

  useEffect(() => {
    const syncMedia = () => setMediaSettings(mediaSettingsService.getSettings());
    const syncLoc = () => setActiveLiveSessions(liveLocationService.getActiveSessions());
    const unsubMedia = mediaSettingsService.subscribe(syncMedia);
    const unsubLoc = liveLocationService.subscribe(syncLoc);
    const ticker = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => {
      unsubMedia();
      unsubLoc();
      clearInterval(ticker);
    };
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

  useEffect(() => {
    if (!activeViewOnceMsg) {
      setIsViewerObscured(false);
      return;
    }
    void securityService.setNativeSecureScreen(true);

    const handleBlur = () => setIsViewerObscured(true);
    const handleFocus = () => setIsViewerObscured(false);
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') {
        setIsViewerObscured(true);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.key === 'PrintScreen' ||
        ((e.metaKey || e.ctrlKey) && e.shiftKey && ['3', '4', '5', 's', 'S'].includes(e.key))
      ) {
        setIsViewerObscured(true);
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKey);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKey);
      void securityService.setNativeSecureScreen(false);
    };
  }, [activeViewOnceMsg?.id]);

  if (!chat) {
    return (
      <div
        className={`hidden md:flex flex-1 flex-col items-center justify-center text-center p-8 select-none relative overflow-hidden transition-colors ${chatTheme.canvasBg}`}
      >
        <div
          className={`absolute inset-0 pointer-events-none ${chatTheme.patternOpacity}`}
          style={{
            backgroundImage: `radial-gradient(${chatTheme.patternColor} 1.25px, transparent 1.25px)`,
            backgroundSize: '26px 26px',
          }}
        />
        <div className="relative z-10 flex flex-col items-center max-w-sm">
          <div className="w-24 h-24 mb-6 rounded-[28px] bg-white dark:bg-[#252930] p-2 shadow-xl ring-1 ring-slate-200/80 dark:ring-white/10 flex items-center justify-center">
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
            Select a conversation from the inbox or tap Contacts to chat and call in real time.
          </p>
          <button
            type="button"
            onClick={() => themeService.toggleDarkLight()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/90 dark:bg-[#252930] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-zinc-200 shadow-xs hover:border-emerald-500/50 transition-colors cursor-pointer mb-5"
          >
            {chatTheme.isDark ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span>Switch to Daylight Theme</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-emerald-600" />
                <span>Switch to Charcoal Dark Mode</span>
              </>
            )}
          </button>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">
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
    setShowAttachMenu(false);
    chatStore.setTyping(chat.id, false);

    if (editingMessage) {
      try {
        await chatStore.editMessage(editingMessage.id, textToSend);
      } catch (err: any) {
        setUploadError(err?.message || 'Messages can only be edited within 15 minutes of sending.');
      }
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

  const cycleAudioSpeed = () => {
    const next: 1 | 1.5 | 2 = audioSpeed === 1 ? 1.5 : audioSpeed === 1.5 ? 2 : 1;
    setAudioSpeed(next);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.playbackRate = next;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.playbackRate = next;
    }
  };

  const handleStartRecording = async () => {
    if (isBlocked) return;
    setUploadError(null);
    if (pendingVoiceNote) {
      URL.revokeObjectURL(pendingVoiceNote.url);
      setPendingVoiceNote(null);
    }
    try {
      const nc = mediaSettings.noiseCancellation;
      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: nc,
          echoCancellation: nc,
          autoGainControl: nc,
        },
      });
      rawRecordStreamRef.current = rawStream;

      let streamToRecord: MediaStream = rawStream;
      if (nc && typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
        try {
          const Ctx = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new Ctx();
          audioCtxRef.current = ctx;
          const src = ctx.createMediaStreamSource(rawStream);
          const highpass = ctx.createBiquadFilter();
          highpass.type = 'highpass';
          highpass.frequency.value = 90;
          const comp = ctx.createDynamicsCompressor();
          comp.threshold.value = -24;
          comp.ratio.value = 4;
          const dest = ctx.createMediaStreamDestination();
          src.connect(highpass);
          highpass.connect(comp);
          comp.connect(dest);
          streamToRecord = dest.stream;
        } catch {
          streamToRecord = rawStream;
        }
      }

      recordStreamRef.current = streamToRecord;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';
      const recorder = mimeType
        ? new MediaRecorder(streamToRecord, { mimeType })
        : new MediaRecorder(streamToRecord);
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

  const uploadAndSendVoiceBlob = async (blob: Blob, durationSec: number, mimeType: string) => {
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    setIsUploading(true);
    setUploadProgress(0);
    setUploadLabel('Sending voice note...');
    setUploadError(null);
    try {
      const ext = mimeType.includes('mp4') ? 'm4a' : 'webm';
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
        duration: Math.max(durationSec, 1),
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

  const handleStopRecording = (mode: 'cancel' | 'preview' | 'send') => {
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
      if (rawRecordStreamRef.current) {
        rawRecordStreamRef.current.getTracks().forEach((t) => t.stop());
        rawRecordStreamRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }

      if (mode === 'cancel' || audioChunksRef.current.length === 0) {
        audioChunksRef.current = [];
        return;
      }

      const actualMime = recorder.mimeType || 'audio/webm';
      const blob = new Blob(audioChunksRef.current, { type: actualMime });
      audioChunksRef.current = [];

      if (mode === 'preview') {
        const url = URL.createObjectURL(blob);
        setPendingVoiceNote({
          blob,
          url,
          duration: Math.max(duration, 1),
          mimeType: actualMime,
        });
        return;
      }

      await uploadAndSendVoiceBlob(blob, duration, actualMime);
    };

    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  const togglePreviewVoiceNote = () => {
    if (!pendingVoiceNote) return;
    if (isPreviewPlaying && previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
      return;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    const audio = new Audio(pendingVoiceNote.url);
    audio.playbackRate = audioSpeed;
    previewAudioRef.current = audio;
    setIsPreviewPlaying(true);
    audio.onended = () => {
      setIsPreviewPlaying(false);
      previewAudioRef.current = null;
    };
    audio.onerror = () => {
      setIsPreviewPlaying(false);
      previewAudioRef.current = null;
    };
    audio.play().catch(() => setIsPreviewPlaying(false));
  };

  const discardPendingVoiceNote = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setIsPreviewPlaying(false);
    if (pendingVoiceNote) {
      URL.revokeObjectURL(pendingVoiceNote.url);
      setPendingVoiceNote(null);
    }
  };

  const sendPendingVoiceNote = async () => {
    if (!pendingVoiceNote) return;
    const note = pendingVoiceNote;
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setIsPreviewPlaying(false);
    setPendingVoiceNote(null);
    await uploadAndSendVoiceBlob(note.blob, note.duration, note.mimeType);
    URL.revokeObjectURL(note.url);
  };

  const handleMediaFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    if (pendingMediaPreview) {
      URL.revokeObjectURL(pendingMediaPreview.objectUrl);
    }
    setIsHdMedia(mediaSettings.defaultHdMedia);
    setIsViewOnceMedia(false);
    setPendingMediaCaption('');
    setPendingMediaPreview({
      file,
      objectUrl: URL.createObjectURL(file),
      isVideo,
    });
  };

  const handleConfirmSendMedia = async () => {
    if (!pendingMediaPreview || isBlocked) return;
    const { file, objectUrl, isVideo } = pendingMediaPreview;
    const hd = isHdMedia;
    const viewOnce = isViewOnceMedia;
    const caption = pendingMediaCaption.trim();

    setPendingMediaPreview(null);
    setPendingMediaCaption('');

    const controller = new AbortController();
    uploadAbortRef.current = controller;
    setIsUploading(true);
    setUploadProgress(0);
    setUploadLabel(
      isVideo
        ? `Uploading ${hd ? 'HD ' : ''}video (${formatFileSize(file.size)})...`
        : hd
        ? 'Preparing HD photo...'
        : 'Compressing & sending photo...'
    );
    setUploadError(null);
    try {
      const mediaUrl = await uploadMediaFile(
        `chats/${chat.id}/${isVideo ? 'video' : 'images'}/${Date.now()}_${file.name}`,
        file,
        {
          isImage: !isVideo,
          hd,
          lowDataMode: mediaSettings.lowDataMode && !hd,
          onProgress: setUploadProgress,
          signal: controller.signal,
        }
      );
      await chatStore.sendMessage({
        chatId: chat.id,
        type: isVideo ? 'video' : 'image',
        mediaUrl,
        text: caption,
        fileName: file.name,
        fileSize: formatFileSize(file.size),
        isViewOnce: viewOnce,
        isHD: hd,
      });
    } catch (err: any) {
      if (err?.message !== 'Upload cancelled.') {
        setUploadError(err?.message || 'Failed to upload media file.');
      }
    } finally {
      URL.revokeObjectURL(objectUrl);
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
    audio.playbackRate = audioSpeed;
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

  const closeViewOnceViewer = async () => {
    const closing = activeViewOnceMsg;
    setActiveViewOnceMsg(null);
    setIsViewerObscured(false);
    if (closing) {
      await chatStore.markViewOnceOpened(closing.id).catch(() => {});
    }
  };

  const nonExpiredMessages = messages.filter((m) => !isMessageExpired(m, nowMs));
  const filteredMessages =
    isSearchOpen && searchQuery.trim()
      ? nonExpiredMessages.filter((m) =>
          (m.text || m.fileName || '').toLowerCase().includes(searchQuery.toLowerCase())
        )
      : nonExpiredMessages;
  const chatLiveSessions = activeLiveSessions.filter((s) => s.chatId === chat.id);

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
    <div
      onClick={() => {
        if (showMoreMenu) setShowMoreMenu(false);
      }}
      className={`flex-1 flex flex-col h-full relative overflow-hidden select-none transition-colors duration-200 ${chatTheme.canvasBg}`}
    >
      {/* Subtle Geometric Dot Pattern */}
      <div
        className={`absolute inset-0 pointer-events-none ${chatTheme.patternOpacity}`}
        style={{
          backgroundImage: `radial-gradient(${chatTheme.patternColor} 1.25px, transparent 1.25px)`,
          backgroundSize: '26px 26px',
        }}
      />

      {/* Hidden Real File & Camera Inputs */}
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleMediaFileSelected}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
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
      <div className={`relative z-20 flex items-center justify-between px-3 sm:px-4 py-2.5 shadow-xs transition-colors ${chatTheme.headerBg}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onBack}
            className={`md:hidden min-h-[44px] min-w-[44px] -ml-1 flex items-center justify-center rounded-xl cursor-pointer transition-colors ${chatTheme.headerIcon} ${chatTheme.headerHover}`}
            aria-label="Back to chats"
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
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500/30"
            />
            {showPartnerOnline && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-[#202327]" />
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
            <h2 className={`text-sm sm:text-[15px] font-bold truncate font-['Outfit'] leading-tight flex items-center gap-1.5 ${chatTheme.headerTitle}`}>
              <span className="truncate">{chatTitle}</span>
              {(chat.disappearingDuration || 0) > 0 && (
                <span title="Disappearing messages active">
                  <Timer className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                </span>
              )}
            </h2>
            <p
              className={`text-[11px] truncate mt-0.5 ${
                typingParticipantNames.length > 0
                  ? 'text-emerald-500 dark:text-emerald-400 font-semibold'
                  : chatTheme.headerSubtitle
              }`}
            >
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
                className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl transition-colors cursor-pointer ${chatTheme.headerHover}`}
                title="Start Voice Call"
                aria-label="Voice Call"
              >
                <Phone className="w-[18px] h-[18px]" />
              </button>
              <button
                onClick={() => onStartVideoCall(partner)}
                className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl transition-colors cursor-pointer ${chatTheme.headerHover}`}
                title="Start Video Call"
                aria-label="Video Call"
              >
                <Video className="w-[18px] h-[18px]" />
              </button>
            </>
          )}

          <button
            onClick={() => setShowThemePicker(true)}
            className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl transition-colors cursor-pointer ${chatTheme.headerHover}`}
            title="Chat Theme & Dark/Light Mode"
            aria-label="Chat Theme"
          >
            <Palette className="w-[18px] h-[18px]" />
          </button>

          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className={`hidden sm:flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl transition-colors cursor-pointer ${
              isSearchOpen ? 'bg-emerald-500/15 text-emerald-500' : chatTheme.headerHover
            }`}
            title="Search inside chat"
            aria-label="Search messages"
          >
            <Search className="w-[18px] h-[18px]" />
          </button>

          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl transition-colors cursor-pointer ${chatTheme.headerHover}`}
              aria-label="Conversation options"
            >
              <MoreVertical className="w-[18px] h-[18px]" />
            </button>

            {showMoreMenu && (
              <div className="absolute right-0 top-12 z-30 w-52 bg-white dark:bg-[#262A31] rounded-2xl shadow-2xl border border-slate-200/80 dark:border-white/10 p-1.5 text-xs text-slate-700 dark:text-zinc-200">
                <button
                  onClick={() => {
                    setIsSearchOpen(!isSearchOpen);
                    setShowMoreMenu(false);
                  }}
                  className="sm:hidden w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-white/[0.07] rounded-xl flex items-center gap-2.5 cursor-pointer"
                >
                  <Search className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Search Messages</span>
                </button>
                {chat.type === 'group' ? (
                  <button
                    onClick={() => {
                      onOpenGroupInfo(chat);
                      setShowMoreMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-white/[0.07] rounded-xl font-medium cursor-pointer flex items-center gap-2.5"
                  >
                    <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Group Info & Admins</span>
                  </button>
                ) : (
                  partner && (
                    <>
                      <button
                        onClick={() => {
                          setShowContactInfo(true);
                          setShowMoreMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-white/[0.07] rounded-xl flex items-center gap-2.5 cursor-pointer font-medium"
                      >
                        <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Contact Info & Media</span>
                      </button>
                      <button
                        onClick={() => {
                          isBlocked
                            ? chatStore.unblockUser(partner.id)
                            : chatStore.blockUser(partner.id, partner.displayName);
                          setShowMoreMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-white/[0.07] rounded-xl flex items-center gap-2.5 cursor-pointer font-medium"
                      >
                        <UserX className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                        <span>{isBlocked ? 'Unblock Contact' : 'Block Contact'}</span>
                      </button>
                      <button
                        onClick={() => {
                          setReportTarget(partner);
                          setReportDetails('');
                          setShowMoreMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-rose-50 dark:hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 rounded-xl flex items-center gap-2.5 cursor-pointer font-medium"
                      >
                        <ShieldAlert className="w-4 h-4" />
                        <span>Report Contact</span>
                      </button>
                    </>
                  )
                )}
                <button
                  onClick={() => {
                    setShowDisappearingModal(true);
                    setShowMoreMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-white/[0.07] rounded-xl flex items-center justify-between gap-2 cursor-pointer font-medium"
                >
                  <span className="flex items-center gap-2.5">
                    <Timer className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Disappearing Messages</span>
                  </span>
                  {(chat.disappearingDuration || 0) > 0 && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">ON</span>
                  )}
                </button>
                <button
                  onClick={() => {
                    if (isChatLocked) {
                      securityService.unlockChat(chat.id);
                    } else if (!securityService.hasPin()) {
                      setInlineLockPin('');
                      setShowPinLockPrompt(true);
                    } else {
                      securityService.lockChat(chat.id);
                    }
                    setShowMoreMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-white/[0.07] rounded-xl flex items-center gap-2.5 cursor-pointer font-medium"
                >
                  {isChatLocked ? (
                    <>
                      <Unlock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Unlock Chat</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Lock Chat</span>
                    </>
                  )}
                </button>
                <div className="border-t border-slate-100 dark:border-white/[0.08] my-1" />
                <button
                  onClick={() => {
                    setConfirmClearChat(true);
                    setShowMoreMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 rounded-xl cursor-pointer font-medium"
                >
                  Delete Conversation
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Location Active Strip */}
      {chatLiveSessions.length > 0 && (
        <div className="bg-emerald-600/95 text-white px-4 py-1.5 flex items-center justify-between text-xs z-20 shadow-xs">
          <span className="flex items-center gap-2 font-semibold">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>You are sharing your live location in this chat</span>
          </span>
          <button
            type="button"
            onClick={() => {
              chatLiveSessions.forEach((s) => void liveLocationService.stopSharing(s.messageId));
            }}
            className="px-2.5 py-0.5 rounded-lg bg-white/20 hover:bg-white/30 text-[11px] font-bold cursor-pointer"
          >
            Stop
          </button>
        </div>
      )}

      {/* In-Chat Message Search Bar */}
      {isSearchOpen && (
        <div className={`px-4 py-2 flex items-center justify-between z-20 ${chatTheme.searchBarBg}`}>
          <div className="flex items-center gap-2.5 flex-1">
            <Search className="w-4 h-4 text-emerald-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages in this conversation..."
              className="bg-transparent text-xs placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none flex-1"
              autoFocus
            />
          </div>
          <button
            onClick={() => {
              setSearchQuery('');
              setIsSearchOpen(false);
            }}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="bg-rose-50 dark:bg-rose-950/60 border-b border-rose-200 dark:border-rose-500/30 px-4 py-2 flex items-center justify-between text-xs text-rose-700 dark:text-rose-300 z-20">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {uploadError}
          </span>
          <button onClick={() => setUploadError(null)} className="p-1 hover:text-rose-900 dark:hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Message Scroll Viewport */}
      <div
        ref={messagesScrollRef}
        onScroll={handleMessagesScroll}
        onClick={() => {
          if (selectedMsgId) setSelectedMsgId(null);
          if (showAttachMenu) setShowAttachMenu(false);
          if (showEmojiPicker) setShowEmojiPicker(false);
        }}
        className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-2.5 z-10 relative"
      >
        <div className="flex justify-center my-1">
          <span className={`text-[10px] font-semibold uppercase tracking-[0.14em] px-3 py-1 rounded-full ${chatTheme.dividerBadge}`}>
            End-to-End Real-Time Sync
          </span>
        </div>

        {filteredMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
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
                  <span className={`text-[11px] font-semibold px-3 py-0.5 rounded-full ${chatTheme.dividerBadge}`}>
                    {formatDateDivider(msg.createdAt)}
                  </span>
                </div>
              )}

              <div
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group/msg relative`}
                onTouchStart={(e) => {
                  if (msg.isDeleted) return;
                  const t = e.touches[0];
                  swipeTouchRef.current = {
                    msgId: msg.id,
                    startX: t.clientX,
                    startY: t.clientY,
                    active: true,
                  };
                }}
                onTouchMove={(e) => {
                  const st = swipeTouchRef.current;
                  if (!st || !st.active || st.msgId !== msg.id) return;
                  const t = e.touches[0];
                  const dx = t.clientX - st.startX;
                  const dy = Math.abs(t.clientY - st.startY);
                  if (dy > 28 && Math.abs(dx) < 16) {
                    st.active = false;
                    setSwipeState(null);
                    return;
                  }
                  if (dx > 8) {
                    setSwipeState({ msgId: msg.id, offsetX: Math.min(dx, 64) });
                  }
                }}
                onTouchEnd={() => {
                  if (swipeState?.msgId === msg.id && swipeState.offsetX >= 48 && !msg.isDeleted) {
                    setReplyTo(msg);
                    composerTextareaRef.current?.focus();
                  }
                  swipeTouchRef.current = null;
                  setSwipeState(null);
                }}
                onTouchCancel={() => {
                  swipeTouchRef.current = null;
                  setSwipeState(null);
                }}
              >
                {swipeState?.msgId === msg.id && swipeState.offsetX > 12 && (
                  <div className="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center pointer-events-none">
                    <Reply className="w-4 h-4" />
                  </div>
                )}

                {!isMe && chat.type === 'group' && (
                  <span className={`text-[11px] font-bold mb-1 ml-2 ${chatTheme.isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    {msg.senderName}
                  </span>
                )}

                {/* Message Bubble Container */}
                <div
                  style={
                    swipeState?.msgId === msg.id
                      ? { transform: `translateX(${swipeState.offsetX}px)` }
                      : undefined
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!msg.isDeleted) {
                      setSelectedMsgId(isSelected ? null : msg.id);
                    }
                  }}
                  className={`relative max-w-[84%] md:max-w-[68%] px-3.5 py-2.5 text-[14px] leading-relaxed transition-all cursor-pointer ${
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
                      className={`mb-2 px-2.5 py-1.5 rounded-xl text-xs flex items-start gap-2 overflow-hidden ${
                        isMe ? chatTheme.outgoingReplyBox : chatTheme.incomingReplyBox
                      }`}
                    >
                      <Reply className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-80" />
                      <div className="min-w-0 flex-1">
                        <span className="font-bold block text-[10px] opacity-90">
                          {msg.replyToSenderName || 'Reply'}
                        </span>
                        <span className="truncate block opacity-85">{msg.replyToText}</span>
                      </div>
                    </div>
                  )}

                  {/* View Once Protected Media */}
                  {(msg.type === 'image' || msg.type === 'video') && msg.isViewOnce && !msg.isDeleted && (() => {
                    const alreadyViewedByMe = currentUser
                      ? (msg.viewedOnceBy || []).includes(currentUser.id)
                      : false;
                    const viewedByRecipient = (msg.viewedOnceBy || []).some(
                      (uid) => uid !== currentUser?.id
                    );

                    if (isMe) {
                      return (
                        <div
                          className={`mb-1.5 px-3 py-2.5 rounded-xl border flex items-center gap-2.5 text-xs ${
                            isMe
                              ? 'bg-white/12 border-white/25 text-white'
                              : 'bg-slate-50 dark:bg-[#1F2227] border-slate-200 dark:border-white/10'
                          }`}
                        >
                          {viewedByRecipient ? (
                            <EyeOff className="w-4 h-4 shrink-0 opacity-85" />
                          ) : (
                            <Eye className="w-4 h-4 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-bold">
                              {msg.type === 'video' ? '1 Video · View Once' : '1 Photo · View Once'}
                            </p>
                            <p className="text-[10px] opacity-80">
                              {viewedByRecipient ? 'Opened by recipient' : 'Sent · View Once enabled'}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    if (alreadyViewedByMe || !msg.mediaUrl) {
                      return (
                        <div className="mb-1.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100/70 dark:bg-[#1D2026] text-slate-500 dark:text-zinc-400 flex items-center gap-2.5 text-xs italic">
                          <EyeOff className="w-4 h-4 shrink-0" />
                          <span>Opened · View Once media expired</span>
                        </div>
                      );
                    }

                    return (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveViewOnceMsg(msg);
                        }}
                        className="mb-1.5 w-full px-3.5 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-700 dark:text-emerald-300 flex items-center gap-2.5 text-xs font-bold cursor-pointer transition-colors"
                      >
                        <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] font-mono shrink-0">
                          1x
                        </span>
                        <span className="text-left">
                          {msg.type === 'video' ? 'Video · Tap to view once' : 'Photo · Tap to view once'}
                        </span>
                      </button>
                    );
                  })()}

                  {/* Standard & HD Photos (with Low Data Mode tap gate) */}
                  {msg.type === 'image' && msg.mediaUrl && !msg.isViewOnce && !msg.isDeleted && (
                    mediaSettings.lowDataMode && !isMe && !loadedLowDataMsgIds.has(msg.id) ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLoadedLowDataMsgIds((prev) => new Set(prev).add(msg.id));
                        }}
                        className="mb-2 w-full px-3.5 py-3 rounded-xl bg-slate-100 dark:bg-[#1E2126] border border-slate-200 dark:border-white/10 flex items-center gap-2.5 text-xs text-slate-700 dark:text-zinc-200 cursor-pointer hover:border-emerald-500/50"
                      >
                        <Wifi className="w-4 h-4 text-amber-500 shrink-0" />
                        <div className="text-left">
                          <p className="font-bold">Tap to load photo · Low Data Mode</p>
                          <p className="text-[10px] opacity-75">{msg.fileSize || 'Compressed media'}</p>
                        </div>
                      </button>
                    ) : (
                      <div className="relative mb-2 rounded-xl overflow-hidden border border-black/10 dark:border-white/10">
                        <img
                          src={msg.mediaUrl}
                          alt={msg.fileName || 'Photo'}
                          referrerPolicy="no-referrer"
                          className="max-h-64 w-full object-cover rounded-lg hover:opacity-95 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightboxImage(msg.mediaUrl!);
                          }}
                        />
                        {msg.isHD && (
                          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/70 text-white text-[9px] font-extrabold tracking-wider border border-white/20">
                            HD
                          </span>
                        )}
                      </div>
                    )
                  )}

                  {/* Standard & HD Videos (with Low Data Mode tap gate) */}
                  {msg.type === 'video' && msg.mediaUrl && !msg.isViewOnce && !msg.isDeleted && (
                    mediaSettings.lowDataMode && !isMe && !loadedLowDataMsgIds.has(msg.id) ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLoadedLowDataMsgIds((prev) => new Set(prev).add(msg.id));
                        }}
                        className="mb-2 w-full px-3.5 py-3 rounded-xl bg-slate-100 dark:bg-[#1E2126] border border-slate-200 dark:border-white/10 flex items-center gap-2.5 text-xs text-slate-700 dark:text-zinc-200 cursor-pointer hover:border-emerald-500/50"
                      >
                        <Wifi className="w-4 h-4 text-amber-500 shrink-0" />
                        <div className="text-left">
                          <p className="font-bold">Tap to load video · Low Data Mode</p>
                          <p className="text-[10px] opacity-75">{msg.fileSize || 'Video file'}</p>
                        </div>
                      </button>
                    ) : (
                      <div className="relative mb-2 rounded-xl overflow-hidden border border-black/10 dark:border-white/10">
                        <video
                          src={msg.mediaUrl}
                          controls
                          className="max-h-64 w-full rounded-lg bg-black"
                          onClick={(e) => e.stopPropagation()}
                        />
                        {msg.isHD && (
                          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/70 text-white text-[9px] font-extrabold tracking-wider border border-white/20">
                            HD
                          </span>
                        )}
                      </div>
                    )
                  )}

                  {msg.type === 'audio' && !msg.isDeleted && (
                    <div className="flex items-center gap-2.5 py-1 min-w-[230px]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAudioPlayback(msg);
                        }}
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
                      <div className="flex-1 min-w-0">
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
                          <span className="font-mono tabular-nums">{msg.duration ? `${msg.duration}s` : '0:01'}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          cycleAudioSpeed();
                        }}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold font-mono shrink-0 cursor-pointer ${
                          isMe
                            ? 'bg-white/20 hover:bg-white/30 text-white'
                            : 'bg-slate-200/80 dark:bg-[#1E2126] hover:bg-slate-300 dark:hover:bg-[#31363F] text-slate-700 dark:text-zinc-200'
                        }`}
                        title="Playback speed (1x / 1.5x / 2x)"
                      >
                        {audioSpeed}x
                      </button>
                    </div>
                  )}

                  {msg.type === 'document' && !msg.isDeleted && (
                    <a
                      href={msg.mediaUrl || '#'}
                      download={msg.fileName || 'document'}
                      onClick={(e) => e.stopPropagation()}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border mb-1 cursor-pointer ${
                        isMe ? chatTheme.outgoingDocBox : chatTheme.incomingDocBox
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${isMe ? 'bg-white/20' : 'bg-emerald-500/15 text-emerald-500'}`}>
                        <FileText className="w-5 h-5" />
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
                          <BarChart3 className={`w-4 h-4 mt-0.5 shrink-0 ${isMe ? 'text-emerald-100' : 'text-emerald-500'}`} />
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
                                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-500/20 text-slate-900 dark:text-white'
                                    : 'border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-[#1F2227] text-slate-800 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-[#313640]'
                                }`}
                              >
                                <div
                                  className={`absolute inset-y-0 left-0 transition-all duration-300 ${
                                    isMe ? 'bg-white/20' : 'bg-emerald-500/20'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                                <div className="relative flex items-center justify-between gap-2 text-xs">
                                  <span className="font-semibold flex items-center gap-1.5 truncate">
                                    {voted && <Check className="w-3.5 h-3.5 shrink-0" />}
                                    <span className="truncate">{opt.text}</span>
                                  </span>
                                  <span className="font-mono text-[11px] tabular-nums shrink-0 opacity-85">
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
                            : 'bg-slate-50 dark:bg-[#1F2227] border-slate-200 dark:border-white/10 text-slate-900 dark:text-zinc-100'
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
                                  : 'text-emerald-600 dark:text-emerald-400'
                                : p.status === 'declined'
                                ? isMe
                                  ? 'text-rose-200'
                                  : 'text-rose-600 dark:text-rose-400'
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
                              isMe
                                ? 'border-white/20 text-white/85'
                                : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400'
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
                                  : 'bg-slate-200 dark:bg-[#2F343C] hover:bg-slate-300 dark:hover:bg-[#3A404A] text-slate-700 dark:text-zinc-200'
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

                  {msg.type === 'location' && msg.location && !msg.isDeleted && (
                    <LiveLocationMessageCard
                      location={msg.location}
                      isMe={isMe}
                      senderName={msg.senderName}
                      onStopSharing={() => void liveLocationService.stopSharing(msg.id)}
                    />
                  )}

                  {msg.text && msg.type !== 'poll' && msg.type !== 'payment' && msg.type !== 'location' && (
                    <p className={`whitespace-pre-wrap break-words leading-relaxed ${msg.isDeleted ? 'italic opacity-75 text-xs' : ''}`}>
                      {msg.text}
                    </p>
                  )}

                  {/* Footer: Sent Time + Disappearing Icon + Read/Delivered Ticks */}
                  <div
                    className={`flex items-center justify-end gap-1 mt-1 text-[10px] tabular-nums font-mono ${
                      isMe ? chatTheme.outgoingMeta : chatTheme.incomingMeta
                    }`}
                  >
                    {msg.expiresAt && !msg.isDeleted && (
                      <span title="Disappearing message">
                        <Timer className="w-3 h-3 opacity-80" />
                      </span>
                    )}
                    {msg.isEdited && !msg.isDeleted && <span className="italic font-sans mr-1">edited</span>}
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

                  {/* Emoji Reactions Pill */}
                  {msg.reactions && msg.reactions.length > 0 && !msg.isDeleted && (() => {
                    const counts = new Map<string, number>();
                    msg.reactions.forEach((r) => counts.set(r.emoji, (counts.get(r.emoji) || 0) + 1));
                    return (
                      <div className="absolute -bottom-2.5 right-2 bg-white dark:bg-[#23262C] text-slate-800 dark:text-zinc-100 rounded-full shadow-md px-2 py-0.5 border border-slate-200 dark:border-white/12 flex items-center gap-1.5 text-[11px]">
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
                            {count > 1 && <span className="font-bold text-[10px] tabular-nums">{count}</span>}
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
                      isSelected ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none group-hover/msg:opacity-100 group-hover/msg:pointer-events-auto'
                    } transition-opacity flex items-center gap-0.5 my-1 px-2 bg-white/95 dark:bg-[#262A31]/95 backdrop-blur-xs rounded-full shadow-md border border-slate-200/80 dark:border-white/10 py-0.5 ${
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
                        className="p-1.5 hover:scale-125 text-xs transition-transform cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setReplyTo(msg);
                        setSelectedMsgId(null);
                        composerTextareaRef.current?.focus();
                      }}
                      className="p-1.5 text-slate-500 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-colors cursor-pointer"
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
                        className="p-1.5 text-slate-500 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-colors cursor-pointer"
                        title="Copy text"
                      >
                        {copiedMsgId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
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
                      className="p-1.5 text-slate-500 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-colors cursor-pointer"
                      title="Forward"
                    >
                      <Forward className="w-3.5 h-3.5" />
                    </button>

                    {isMe && msg.type === 'text' && getRemainingModifyMs(msg, nowMs) > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingMessage(msg);
                          setInputText(msg.text || '');
                          setSelectedMsgId(null);
                          composerTextareaRef.current?.focus();
                        }}
                        className="p-1.5 text-slate-500 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-colors cursor-pointer"
                        title={`Edit (${Math.ceil(getRemainingModifyMs(msg, nowMs) / 60000)}m left)`}
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
                      className="p-1.5 text-slate-400 dark:text-zinc-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
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

        {/* Live Animated Typing Indicator Bubble */}
        {typingParticipantNames.length > 0 && (
          <div className="flex flex-col items-start pt-1">
            <div className={`px-4 py-2.5 inline-flex items-center gap-2 ${chatTheme.incomingBubble}`}>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 typing-dot-1" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 typing-dot-2" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 typing-dot-3" />
              </div>
              {chat.type === 'group' && (
                <span className="text-[11px] font-medium opacity-75">
                  {typingParticipantNames[0]} is typing
                </span>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom floating button */}
      {showScrollBottom && (
        <button
          onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className={`absolute bottom-24 right-5 z-20 w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors ${chatTheme.scrollDownBtn}`}
          title="Jump to latest messages"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}

      {/* Quoted Reply Banner */}
      {replyTo && (
        <div className={`px-4 py-2 flex items-center justify-between gap-2 z-20 ${chatTheme.replyBannerBg}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
              <Reply className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-emerald-500 block">
                Replying to {replyTo.senderName}
              </span>
              <p className="text-xs opacity-80 truncate max-w-md">
                {replyTo.text || `[${replyTo.type}]`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Editing Banner */}
      {editingMessage && (
        <div className="bg-amber-50/95 dark:bg-[#2B261B] px-4 py-2 border-t border-amber-200 dark:border-amber-500/25 flex items-center justify-between gap-2 z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Edit2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 block">
                Editing Message
              </span>
              <p className="text-xs text-slate-600 dark:text-zinc-300 truncate max-w-md">
                {editingMessage.text}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingMessage(null);
              setInputText('');
            }}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Smart Bottom Composer Bar (Thumb-Reachable) */}
      <div className={`px-3 sm:px-4 py-2.5 z-20 mb-16 md:mb-0 transition-colors ${chatTheme.composerBg}`}>
        {isBlocked && partner ? (
          <div className="flex items-center justify-between py-2 px-3 bg-slate-100 dark:bg-[#272B32] rounded-xl text-xs text-slate-600 dark:text-zinc-300">
            <span>You blocked {partner.displayName}. Unblock to send messages.</span>
            <button
              onClick={() => chatStore.unblockUser(partner.id)}
              className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
            >
              Unblock
            </button>
          </div>
        ) : isPostingRestricted ? (
          <div className="flex items-center justify-between py-2 px-3 bg-slate-100/90 dark:bg-[#272B32] rounded-xl text-xs text-slate-600 dark:text-zinc-300">
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
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-semibold cursor-pointer"
              >
                {currentUser && chat.participants.includes(currentUser.id) ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Attachment Popover */}
            {showAttachMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-20 left-3 sm:left-6 z-30 bg-white dark:bg-[#262A31] rounded-2xl shadow-2xl border border-slate-200/80 dark:border-white/10 p-3.5 grid grid-cols-3 sm:flex sm:flex-wrap gap-3.5 text-xs"
              >
                <button
                  onClick={() => mediaInputRef.current?.click()}
                  className="flex flex-col items-center gap-1.5 text-slate-700 dark:text-zinc-200 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                >
                  <div className="w-11 h-11 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-2xl flex items-center justify-center shadow-xs">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <span>Gallery</span>
                </button>
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center gap-1.5 text-slate-700 dark:text-zinc-200 hover:text-teal-600 dark:hover:text-teal-400 cursor-pointer"
                >
                  <div className="w-11 h-11 bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 rounded-2xl flex items-center justify-center shadow-xs">
                    <Camera className="w-5 h-5" />
                  </div>
                  <span>Camera</span>
                </button>
                <button
                  onClick={() => docInputRef.current?.click()}
                  className="flex flex-col items-center gap-1.5 text-slate-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                >
                  <div className="w-11 h-11 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded-2xl flex items-center justify-center shadow-xs">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <span>Document</span>
                </button>
                <button
                  onClick={() => {
                    setShowAttachMenu(false);
                    handleStartRecording();
                  }}
                  className="flex flex-col items-center gap-1.5 text-slate-700 dark:text-zinc-200 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer"
                >
                  <div className="w-11 h-11 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-2xl flex items-center justify-center shadow-xs">
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
                  className="flex flex-col items-center gap-1.5 text-slate-700 dark:text-zinc-200 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer"
                >
                  <div className="w-11 h-11 bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 rounded-2xl flex items-center justify-center shadow-xs">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <span>Poll</span>
                </button>
                <button
                  onClick={() => {
                    setShowAttachMenu(false);
                    setShowLocationModal(true);
                  }}
                  className="flex flex-col items-center gap-1.5 text-slate-700 dark:text-zinc-200 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                >
                  <div className="w-11 h-11 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 rounded-2xl flex items-center justify-center shadow-xs">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <span>Location</span>
                </button>
                {(chat.type === 'private' || chat.type === 'group') && currentUser && (
                  <button
                    onClick={() => {
                      setShowAttachMenu(false);
                      setShowPaymentModal(true);
                    }}
                    className="flex flex-col items-center gap-1.5 text-slate-700 dark:text-zinc-200 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                  >
                    <div className="w-11 h-11 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-xs">
                      <Banknote className="w-5 h-5" />
                    </div>
                    <span>DOST Pay</span>
                  </button>
                )}
              </div>
            )}

            {/* Emoji Picker */}
            {showEmojiPicker && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-20 left-3 z-30 bg-white dark:bg-[#262A31] rounded-2xl shadow-2xl border border-slate-200/80 dark:border-white/10 p-2.5 flex flex-wrap gap-1.5 max-w-xs text-xl"
              >
                {['👋', '💚', '🔥', '🚀', '✨', '😂', '👍', '🙏', '🎉', '💯', '❤️', '🤝', '😊', '👌'].map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => {
                      handleInputChange(inputText + em);
                      setShowEmojiPicker(false);
                      composerTextareaRef.current?.focus();
                    }}
                    className="hover:scale-125 transition-transform p-1.5 cursor-pointer"
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}

            {isUploading ? (
              <div className="flex items-center justify-between gap-3 py-2 px-3 bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-200/70 dark:border-emerald-500/30 rounded-2xl">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-800 dark:text-emerald-200 mb-1">
                      <span className="truncate">{uploadLabel}</span>
                      <span className="ml-2 shrink-0 font-mono tabular-nums">{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-emerald-200/80 dark:bg-emerald-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 dark:bg-emerald-400 rounded-full transition-all duration-200"
                        style={{ width: `${Math.max(uploadProgress, 8)}%` }}
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => uploadAbortRef.current?.abort()}
                  className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 rounded-lg transition-colors shrink-0 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : isRecording ? (
              <div className="flex items-center justify-between gap-2 py-1 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-rose-500 rounded-full animate-ping shrink-0" />
                  <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 font-mono tabular-nums">
                    00:{recordDuration.toString().padStart(2, '0')}
                  </span>
                  {mediaSettings.noiseCancellation && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold">
                      <AudioWaveform className="w-3 h-3" />
                      <span>Noise Cancel</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleStopRecording('cancel')}
                    className="min-h-[38px] px-2.5 text-xs font-semibold text-slate-500 dark:text-zinc-300 hover:text-rose-500 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStopRecording('preview')}
                    className="min-h-[38px] px-3 bg-slate-200 dark:bg-[#2F343D] hover:bg-slate-300 dark:hover:bg-[#3A404B] text-slate-800 dark:text-zinc-100 font-semibold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStopRecording('send')}
                    className="min-h-[38px] px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </div>
              </div>
            ) : pendingVoiceNote ? (
              <div className="flex items-center justify-between gap-2.5 py-1.5 px-3 bg-slate-100/90 dark:bg-[#272B32] rounded-2xl border border-slate-200/80 dark:border-white/10">
                <button
                  type="button"
                  onClick={togglePreviewVoiceNote}
                  className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 cursor-pointer"
                  title={isPreviewPlaying ? 'Pause Preview' : 'Listen Before Sending'}
                >
                  {isPreviewPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-zinc-100">
                    Voice Note Preview · {pendingVoiceNote.duration}s
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                    Listen, change speed, or tap Send
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cycleAudioSpeed}
                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#1E2126] border border-slate-200 dark:border-white/10 text-xs font-bold font-mono text-slate-700 dark:text-zinc-200 cursor-pointer"
                  title="Preview Speed"
                >
                  {audioSpeed}x
                </button>
                <button
                  type="button"
                  onClick={discardPendingVoiceNote}
                  className="p-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 cursor-pointer"
                  title="Discard voice note"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void sendPendingVoiceNote()}
                  className="min-h-[38px] px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="flex items-end gap-1.5 sm:gap-2">
                {/* Thumb-zone Pill Input Container */}
                <div className={`flex-1 flex items-end gap-1 px-1.5 py-1 rounded-3xl transition-all ${chatTheme.composerInput}`}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAttachMenu(false);
                      setShowEmojiPicker(!showEmojiPicker);
                    }}
                    className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full transition-colors cursor-pointer shrink-0 ${chatTheme.headerIcon} ${chatTheme.headerHover}`}
                    title="Emoji"
                    aria-label="Insert emoji"
                  >
                    <Smile className="w-5 h-5" />
                  </button>

                  <textarea
                    ref={composerTextareaRef}
                    rows={1}
                    value={inputText}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    className="flex-1 py-2.5 px-1 text-sm bg-transparent focus:outline-none resize-none max-h-[120px] leading-snug"
                  />

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowEmojiPicker(false);
                      setShowAttachMenu(!showAttachMenu);
                    }}
                    className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full transition-colors cursor-pointer shrink-0 ${chatTheme.headerIcon} ${chatTheme.headerHover}`}
                    title="Attach file, Poll, or DOST Pay"
                    aria-label="Attachments"
                  >
                    <Paperclip className="w-[18px] h-[18px]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full transition-colors cursor-pointer shrink-0 ${chatTheme.headerIcon} ${chatTheme.headerHover}`}
                    title="Take Photo or Share Image"
                    aria-label="Camera"
                  >
                    <Camera className="w-[18px] h-[18px]" />
                  </button>
                </div>

                {/* Primary Thumb CTA: Send or Voice Note */}
                {inputText.trim() ? (
                  <button
                    type="submit"
                    className={`min-h-[46px] min-w-[46px] flex items-center justify-center rounded-full transition-all cursor-pointer active:scale-95 shrink-0 ${chatTheme.sendButton}`}
                    title="Send Message"
                    aria-label="Send message"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    className={`min-h-[46px] min-w-[46px] flex items-center justify-center rounded-full transition-colors cursor-pointer active:scale-95 shrink-0 ${chatTheme.micButton}`}
                    title="Record Voice Message"
                    aria-label="Record voice message"
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
            className="absolute top-4 right-4 p-2.5 bg-white/10 text-white rounded-full hover:bg-white/20 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxImage}
            alt="Full Preview"
            referrerPolicy="no-referrer"
            className="max-h-[85vh] max-w-full rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Forward Message Modal */}
      {forwardingMessage && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#25282F] rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-100 dark:border-white/10 text-slate-800 dark:text-zinc-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">Forward Message To</h3>
              <button onClick={() => setForwardingMessage(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
              <input
                type="text"
                value={forwardSearch}
                onChange={(e) => setForwardSearch(e.target.value)}
                placeholder="Search chat or registered user..."
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-100 dark:bg-[#1E2126] rounded-xl focus:outline-none border border-transparent focus:border-emerald-500"
              />
            </div>

            {availableForwardChats.length === 0 && forwardableNewUsers.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-zinc-400 py-6 text-center">No matching conversations or users found.</p>
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
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-white/[0.06] text-left text-xs font-semibold cursor-pointer"
                    >
                      <span>{label}</span>
                      <Send className="w-3.5 h-3.5 text-emerald-500" />
                    </button>
                  );
                })}

                {forwardableNewUsers.length > 0 && (
                  <p className="px-2 pt-2 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
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
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-white/[0.06] text-left text-xs font-semibold cursor-pointer"
                  >
                    <span>{u.displayName}</span>
                    <Send className="w-3.5 h-3.5 text-emerald-500" />
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
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#25282F] rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-100 dark:border-white/10 text-slate-800 dark:text-zinc-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">Report {reportTarget.displayName}</h3>
              <button onClick={() => setReportTarget(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Reason</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-[#1E2126] border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:border-emerald-500"
                >
                  <option value="Spam or unwanted messages">Spam or unwanted messages</option>
                  <option value="Harassment or abusive behavior">Harassment or abusive behavior</option>
                  <option value="Impersonation or fake profile">Impersonation or fake profile</option>
                  <option value="Inappropriate or harmful content">Inappropriate or harmful content</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Additional Details (Optional)</label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Describe what happened..."
                  className="w-full p-2.5 bg-slate-50 dark:bg-[#1E2126] border border-slate-200 dark:border-white/10 rounded-xl h-20 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setReportTarget(null)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-[#31353E] text-slate-600 dark:text-zinc-300 font-semibold rounded-xl cursor-pointer"
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
      {deleteTargetMsg && (() => {
        const remMs = getRemainingModifyMs(deleteTargetMsg, nowMs);
        const canUnsend = Boolean(currentUser && deleteTargetMsg.senderId === currentUser.id && remMs > 0);
        const remMins = Math.ceil(remMs / 60000);
        return (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-white dark:bg-[#25282F] rounded-2xl p-5 max-w-xs w-full shadow-2xl border border-slate-100 dark:border-white/10">
              <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-1">Delete Message?</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
                Choose how you want to remove this message.
              </p>
              <div className="space-y-2">
                {canUnsend ? (
                  <button
                    onClick={async () => {
                      try {
                        await chatStore.deleteMessage(deleteTargetMsg.id, true);
                      } catch (err: any) {
                        setUploadError(err?.message || 'Unsend window expired.');
                      }
                      setDeleteTargetMsg(null);
                    }}
                    className="w-full py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer"
                  >
                    Delete for Everyone ({remMins}m left)
                  </button>
                ) : currentUser && deleteTargetMsg.senderId === currentUser.id ? (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15 px-3 py-2 rounded-xl">
                    15-min unsend window expired — you can Delete for Me
                  </p>
                ) : null}
                <button
                  onClick={() => {
                    chatStore.deleteMessage(deleteTargetMsg.id, false);
                    setDeleteTargetMsg(null);
                  }}
                  className="w-full py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 rounded-xl cursor-pointer"
                >
                  Delete for Me
                </button>
                <button
                  onClick={() => setDeleteTargetMsg(null)}
                  className="w-full py-2 text-xs font-semibold text-slate-600 dark:text-zinc-300 bg-slate-100 dark:bg-[#31353E] rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Clear Chat Confirmation Modal */}
      {confirmClearChat && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#25282F] rounded-2xl p-5 max-w-xs w-full shadow-2xl border border-slate-100 dark:border-white/10">
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-1">Delete this conversation?</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">This action removes the chat thread from Firestore.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmClearChat(false)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-300 bg-slate-100 dark:bg-[#31353E] rounded-xl cursor-pointer"
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
          className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#25282F] w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-slate-100 dark:border-white/10 text-slate-900 dark:text-zinc-100"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold font-['Outfit']">Chat Theme</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Pick comfortable dark grey or crisp daylight</p>
              </div>
              <button
                onClick={() => setShowThemePicker(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 rounded-xl cursor-pointer"
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
                        ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-500/15 ring-1 ring-emerald-500/30'
                        : 'border-slate-200/80 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-11 h-11 rounded-xl shrink-0 border border-black/10 dark:border-white/15 flex items-center justify-center relative overflow-hidden"
                        style={{ backgroundColor: t.swatchCanvas }}
                      >
                        <span
                          className="w-5 h-3.5 rounded-md shadow-xs translate-x-1 -translate-y-1"
                          style={{ backgroundColor: t.swatchPrimary }}
                        />
                        <span
                          className={`w-4 h-3 rounded-md shadow-xs -translate-x-1.5 translate-y-1.5 ${
                            t.isDark ? 'bg-[#282C32] border border-white/15' : 'bg-white border border-black/10'
                          }`}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{t.name}</p>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">{t.subtitle}</p>
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
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs"
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
            className="bg-white dark:bg-[#25282F] rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-100 dark:border-white/10 space-y-4 text-slate-800 dark:text-zinc-100"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-['Outfit']">Create Poll</h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">Ask members to vote in real time</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPollModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Question</label>
              <input
                type="text"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="Ask a question..."
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-[#1E2126] border border-slate-200 dark:border-white/10 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold">Options</label>
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
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-[#1E2126] border border-slate-200 dark:border-white/10 focus:outline-none focus:border-emerald-500"
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
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Option</span>
                </button>
              )}
            </div>

            <label className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-white/10 cursor-pointer">
              <span className="font-semibold">Allow multiple answers</span>
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

      {/* Pre-Send Media Preview Modal (HD & View Once Toggles) */}
      {pendingMediaPreview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white dark:bg-[#22252B] text-slate-900 dark:text-zinc-100 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-bold font-['Outfit']">
                Preview {pendingMediaPreview.isVideo ? 'Video' : 'Photo'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(pendingMediaPreview.objectUrl);
                  setPendingMediaPreview(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="bg-black rounded-2xl overflow-hidden max-h-64 flex items-center justify-center">
                {pendingMediaPreview.isVideo ? (
                  <video
                    src={pendingMediaPreview.objectUrl}
                    controls
                    className="max-h-64 w-full object-contain"
                  />
                ) : (
                  <img
                    src={pendingMediaPreview.objectUrl}
                    alt="Preview"
                    className="max-h-64 w-full object-contain"
                  />
                )}
              </div>

              {/* Quality & View Once Controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsHdMedia((v) => !v)}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    isHdMedia
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-100 dark:bg-[#2A2E37] text-slate-700 dark:text-zinc-200 border-slate-200 dark:border-white/10'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isHdMedia ? 'HD Quality ON' : 'Standard'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsViewOnceMedia((v) => !v)}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    isViewOnceMedia
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-slate-100 dark:bg-[#2A2E37] text-slate-700 dark:text-zinc-200 border-slate-200 dark:border-white/10'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  <span>{isViewOnceMedia ? 'View Once (1x)' : 'Keep in Chat'}</span>
                </button>
              </div>

              <input
                type="text"
                value={pendingMediaCaption}
                onChange={(e) => setPendingMediaCaption(e.target.value)}
                placeholder="Add a caption (optional)..."
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-[#1A1D22] border border-slate-200 dark:border-white/10 focus:outline-none focus:border-emerald-500"
              />

              <button
                type="button"
                onClick={() => void handleConfirmSendMedia()}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Send {isViewOnceMedia ? 'View Once' : isHdMedia ? 'HD Media' : 'Media'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Protected View Once Media Viewer */}
      {activeViewOnceMsg && (
        <div
          onContextMenu={(e) => e.preventDefault()}
          className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-between p-4 select-none"
        >
          <div className="w-full flex items-center justify-between text-white">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
              <Shield className="w-4 h-4" />
              <span>View Once Protected · Capture Blocked</span>
            </div>
            <button
              type="button"
              onClick={() => void closeViewOnceViewer()}
              className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>
          </div>

          <div className="relative flex-1 w-full flex items-center justify-center my-4 overflow-hidden">
            {activeViewOnceMsg.type === 'video' ? (
              <video
                src={activeViewOnceMsg.mediaUrl}
                controls
                autoPlay
                controlsList="nodownload"
                disablePictureInPicture
                onContextMenu={(e) => e.preventDefault()}
                className={`max-h-[75vh] max-w-full rounded-2xl transition-all ${
                  isViewerObscured ? 'blur-2xl opacity-15' : ''
                }`}
              />
            ) : (
              <img
                src={activeViewOnceMsg.mediaUrl}
                alt="View Once"
                draggable={false}
                referrerPolicy="no-referrer"
                onContextMenu={(e) => e.preventDefault()}
                className={`max-h-[75vh] max-w-full rounded-2xl object-contain pointer-events-none transition-all ${
                  isViewerObscured ? 'blur-2xl opacity-15' : ''
                }`}
              />
            )}

            {isViewerObscured && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-6">
                <EyeOff className="w-10 h-10 text-amber-400 mb-2" />
                <p className="text-sm font-bold">Protected Media Hidden</p>
                <p className="text-xs text-zinc-300 mt-1">
                  Return focus to DOST window to view once.
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => void closeViewOnceViewer()}
            className="w-full max-w-xs py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
          >
            Done · Burn After Viewing
          </button>
        </div>
      )}

      {/* Disappearing Messages Modal */}
      {showDisappearingModal && (
        <div
          onClick={() => setShowDisappearingModal(false)}
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs bg-white dark:bg-[#22252B] text-slate-900 dark:text-zinc-100 rounded-3xl p-5 shadow-2xl border border-slate-100 dark:border-white/10 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer className="w-5 h-5 text-emerald-500" />
                <h3 className="text-sm font-bold font-['Outfit']">Disappearing Messages</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDisappearingModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              New messages sent in this chat will automatically delete after the selected duration.
            </p>
            <div className="space-y-1.5">
              {[
                { seconds: 0, label: 'Off (Keep Messages)' },
                { seconds: 3600, label: '1 Hour' },
                { seconds: 21600, label: '6 Hours' },
                { seconds: 86400, label: '24 Hours' },
                { seconds: 604800, label: '7 Days' },
                { seconds: 2592000, label: '30 Days' },
              ].map((opt) => {
                const active = (chat.disappearingDuration || 0) === opt.seconds;
                return (
                  <button
                    key={opt.seconds}
                    type="button"
                    onClick={async () => {
                      await chatStore.setDisappearingDuration(chat.id, opt.seconds || null);
                      setShowDisappearingModal(false);
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer border ${
                      active
                        ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-500 text-emerald-800 dark:text-emerald-200'
                        : 'bg-slate-50 dark:bg-[#1A1D22] border-slate-200/80 dark:border-white/10 hover:border-emerald-500/40'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {active && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Live Location Picker Modal */}
      <LiveLocationPickerModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onSendLocation={async ({ lat, lng, accuracy, isLive, durationMinutes }) => {
          const expiresAt =
            isLive && durationMinutes
              ? new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()
              : undefined;
          const sent = await chatStore.sendMessage({
            chatId: chat.id,
            type: 'location',
            location: {
              lat,
              lng,
              ...(accuracy !== undefined ? { accuracy } : {}),
              isLive,
              ...(expiresAt ? { liveExpiresAt: expiresAt } : {}),
              isStopped: false,
              updatedAt: new Date().toISOString(),
            },
          });
          if (isLive && durationMinutes) {
            liveLocationService.startTrackingMessage({
              messageId: sent.id,
              chatId: chat.id,
              durationMinutes,
              initialLat: lat,
              initialLng: lng,
            });
          }
        }}
      />

      {/* Inline 4-Digit PIN Prompt for Chat Lock */}
      {showPinLockPrompt && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const clean = inlineLockPin.replace(/\D/g, '').slice(0, 4);
              if (clean.length !== 4) return;
              await securityService.setPin(clean);
              securityService.lockChat(chat.id);
              setShowPinLockPrompt(false);
              setInlineLockPin('');
            }}
            className="bg-white dark:bg-[#22252B] rounded-2xl p-5 max-w-xs w-full shadow-2xl border border-slate-100 dark:border-white/10 space-y-3"
          >
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <Lock className="w-4 h-4" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                Set PIN to Lock Chat
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Enter a 4-digit PIN (you can also unlock with Fingerprint or Face ID).
            </p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={inlineLockPin}
              onChange={(e) => setInlineLockPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Enter 4 digits"
              className="w-full px-3 py-2 text-sm font-mono tracking-widest text-center bg-slate-50 dark:bg-[#1A1D22] border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:border-emerald-500"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowPinLockPrompt(false)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-200 bg-slate-100 dark:bg-[#2D3139] rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={inlineLockPin.length !== 4}
                className="flex-1 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50 cursor-pointer"
              >
                Lock Chat
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
