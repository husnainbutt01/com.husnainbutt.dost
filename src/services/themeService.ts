export type ChatThemeId =
  | 'charcoal-dark'
  | 'emerald-glass'
  | 'midnight-emerald'
  | 'ocean-slate'
  | 'royal-plum'
  | 'warm-sand';

export interface ChatThemeConfig {
  id: ChatThemeId;
  name: string;
  subtitle: string;
  isDark: boolean;
  swatchPrimary: string;
  swatchCanvas: string;
  canvasBg: string;
  patternColor: string;
  patternOpacity: string;
  headerBg: string;
  headerTitle: string;
  headerSubtitle: string;
  headerIcon: string;
  headerHover: string;
  outgoingBubble: string;
  outgoingMeta: string;
  outgoingReplyBox: string;
  outgoingReplyBar: string;
  outgoingDocBox: string;
  outgoingAudioBtn: string;
  outgoingAudioWave: string;
  incomingBubble: string;
  incomingMeta: string;
  incomingReplyBox: string;
  incomingReplyBar: string;
  incomingDocBox: string;
  incomingAudioBtn: string;
  incomingAudioWave: string;
  dividerBadge: string;
  composerBg: string;
  composerInput: string;
  sendButton: string;
  micButton: string;
  scrollDownBtn: string;
  searchBarBg: string;
  replyBannerBg: string;
}

export const CHAT_THEMES: Record<ChatThemeId, ChatThemeConfig> = {
  'charcoal-dark': {
    id: 'charcoal-dark',
    name: 'Charcoal Comfort',
    subtitle: 'Eye-friendly dark grey & crisp emerald bubbles',
    isDark: true,
    swatchPrimary: '#0FA958',
    swatchCanvas: '#181A1D',
    canvasBg: 'bg-[#181A1D]',
    patternColor: '#9CA3AF',
    patternOpacity: 'opacity-[0.045]',
    headerBg: 'bg-[#202327]/95 backdrop-blur-md border-b border-white/10 text-zinc-100',
    headerTitle: 'text-zinc-100',
    headerSubtitle: 'text-zinc-400',
    headerIcon: 'text-zinc-300',
    headerHover: 'hover:bg-white/[0.07] hover:text-white',
    outgoingBubble:
      'bg-gradient-to-br from-[#0FA958] to-[#0B7D41] text-white rounded-2xl rounded-br-sm shadow-[0_6px_18px_-6px_rgba(15,169,88,0.35)]',
    outgoingMeta: 'text-emerald-50/90',
    outgoingReplyBox: 'bg-black/25 text-white',
    outgoingReplyBar: 'bg-emerald-200',
    outgoingDocBox: 'bg-black/20 border-white/20 text-white',
    outgoingAudioBtn: 'bg-white text-emerald-800 shadow-xs',
    outgoingAudioWave: 'bg-emerald-100/80',
    incomingBubble:
      'bg-[#282C32] text-zinc-100 border border-white/[0.08] rounded-2xl rounded-bl-sm shadow-[0_4px_14px_-6px_rgba(0,0,0,0.4)]',
    incomingMeta: 'text-zinc-400',
    incomingReplyBox: 'bg-black/25 text-zinc-200',
    incomingReplyBar: 'bg-emerald-400',
    incomingDocBox: 'bg-[#202328] border-white/10 text-zinc-100',
    incomingAudioBtn: 'bg-emerald-500 text-slate-950 shadow-xs',
    incomingAudioWave: 'bg-zinc-500',
    dividerBadge: 'bg-[#23272D]/95 backdrop-blur-xs text-zinc-300 border border-white/10 shadow-sm',
    composerBg: 'bg-[#202327]/95 backdrop-blur-md border-t border-white/10',
    composerInput:
      'bg-[#2A2E35] focus:bg-[#30353D] text-zinc-100 placeholder-zinc-400 border border-white/10 focus:border-emerald-500',
    sendButton: 'bg-gradient-to-br from-[#10B981] to-[#059669] hover:brightness-105 text-slate-950 font-bold shadow-md shadow-black/30',
    micButton: 'bg-white/[0.08] text-emerald-300 hover:bg-white/[0.14]',
    scrollDownBtn: 'bg-[#282C32] text-emerald-300 border border-white/15 shadow-lg hover:bg-[#31363E]',
    searchBarBg: 'bg-[#23272D] border-b border-white/10 text-zinc-100',
    replyBannerBg: 'bg-[#23272D] border-t border-white/10 text-zinc-100',
  },
  'emerald-glass': {
    id: 'emerald-glass',
    name: 'DOST Emerald',
    subtitle: 'Crisp mint-alabaster & gradient bubbles',
    isDark: false,
    swatchPrimary: '#0FA958',
    swatchCanvas: '#EEF5F1',
    canvasBg: 'bg-[#EEF5F1]',
    patternColor: '#0B8043',
    patternOpacity: 'opacity-[0.045]',
    headerBg: 'bg-white/95 backdrop-blur-md border-b border-emerald-950/10 text-slate-800',
    headerTitle: 'text-slate-900',
    headerSubtitle: 'text-slate-500',
    headerIcon: 'text-slate-600',
    headerHover: 'hover:bg-emerald-50 hover:text-emerald-700',
    outgoingBubble:
      'bg-gradient-to-br from-[#0FA958] via-[#0D964E] to-[#087A3F] text-white rounded-2xl rounded-br-sm shadow-[0_6px_18px_-6px_rgba(11,128,67,0.45)]',
    outgoingMeta: 'text-emerald-50/90',
    outgoingReplyBox: 'bg-black/15 text-white',
    outgoingReplyBar: 'bg-emerald-200',
    outgoingDocBox: 'bg-black/15 border-white/20 text-white',
    outgoingAudioBtn: 'bg-white text-emerald-700 shadow-xs',
    outgoingAudioWave: 'bg-emerald-100/80',
    incomingBubble:
      'bg-white text-slate-800 border border-emerald-950/6 rounded-2xl rounded-bl-sm shadow-[0_4px_14px_-6px_rgba(15,23,42,0.1)]',
    incomingMeta: 'text-slate-400',
    incomingReplyBox: 'bg-emerald-50/80 text-slate-700',
    incomingReplyBar: 'bg-emerald-600',
    incomingDocBox: 'bg-slate-50 border-slate-200/80 text-slate-800',
    incomingAudioBtn: 'bg-emerald-600 text-white shadow-xs',
    incomingAudioWave: 'bg-slate-300',
    dividerBadge: 'bg-white/85 backdrop-blur-xs text-slate-500 border border-emerald-950/8 shadow-xs',
    composerBg: 'bg-white/95 backdrop-blur-md border-t border-emerald-950/8',
    composerInput:
      'bg-[#F1F6F3] focus:bg-white text-slate-800 placeholder-slate-400 border border-emerald-950/5 focus:border-emerald-500',
    sendButton: 'bg-gradient-to-br from-[#0FA958] to-[#0B8043] hover:brightness-105 text-white shadow-md shadow-emerald-600/25',
    micButton: 'bg-emerald-100/90 text-emerald-800 hover:bg-emerald-200/90',
    scrollDownBtn: 'bg-white/95 text-emerald-700 border border-emerald-950/10 shadow-lg hover:bg-emerald-50',
    searchBarBg: 'bg-emerald-50/95 border-b border-emerald-200/80 text-slate-800',
    replyBannerBg: 'bg-emerald-50/95 border-t border-emerald-200/80 text-slate-800',
  },
  'midnight-emerald': {
    id: 'midnight-emerald',
    name: 'Midnight Forest',
    subtitle: 'Deep forest slate & emerald contrast',
    isDark: true,
    swatchPrimary: '#10B981',
    swatchCanvas: '#111916',
    canvasBg: 'bg-[#111916]',
    patternColor: '#34D399',
    patternOpacity: 'opacity-[0.055]',
    headerBg: 'bg-[#16211D]/95 backdrop-blur-md border-b border-emerald-400/12 text-slate-100',
    headerTitle: 'text-white',
    headerSubtitle: 'text-emerald-200/70',
    headerIcon: 'text-emerald-200/80',
    headerHover: 'hover:bg-emerald-500/15 hover:text-emerald-300',
    outgoingBubble:
      'bg-gradient-to-br from-[#0FA958] to-[#086E39] text-white rounded-2xl rounded-br-sm shadow-[0_8px_22px_-6px_rgba(15,169,88,0.38)]',
    outgoingMeta: 'text-emerald-100/85',
    outgoingReplyBox: 'bg-black/25 text-white',
    outgoingReplyBar: 'bg-emerald-300',
    outgoingDocBox: 'bg-black/25 border-white/15 text-white',
    outgoingAudioBtn: 'bg-white text-emerald-800',
    outgoingAudioWave: 'bg-emerald-100/75',
    incomingBubble:
      'bg-[#1D2B26] text-zinc-100 border border-emerald-400/14 rounded-2xl rounded-bl-sm shadow-[0_6px_16px_-6px_rgba(0,0,0,0.45)]',
    incomingMeta: 'text-emerald-200/60',
    incomingReplyBox: 'bg-black/25 text-zinc-200',
    incomingReplyBar: 'bg-emerald-400',
    incomingDocBox: 'bg-[#15221D] border-emerald-400/15 text-zinc-100',
    incomingAudioBtn: 'bg-emerald-500 text-slate-950',
    incomingAudioWave: 'bg-emerald-400/35',
    dividerBadge: 'bg-[#1A2622]/90 backdrop-blur-xs text-emerald-200/80 border border-emerald-400/15 shadow-sm',
    composerBg: 'bg-[#16211D]/95 backdrop-blur-md border-t border-emerald-400/12',
    composerInput:
      'bg-[#1D2D27] focus:bg-[#22352E] text-zinc-100 placeholder-emerald-200/45 border border-emerald-400/12 focus:border-emerald-500',
    sendButton: 'bg-gradient-to-br from-[#10B981] to-[#059669] text-slate-950 font-bold shadow-md shadow-emerald-950/50',
    micButton: 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30',
    scrollDownBtn: 'bg-[#1D2B26] text-emerald-300 border border-emerald-400/20 shadow-lg hover:bg-[#23352F]',
    searchBarBg: 'bg-[#16231E] border-b border-emerald-400/15 text-zinc-100',
    replyBannerBg: 'bg-[#192621] border-t border-emerald-400/15 text-zinc-100',
  },
  'ocean-slate': {
    id: 'ocean-slate',
    name: 'Nordic Ocean',
    subtitle: 'Cool sky-slate & deep azure',
    isDark: false,
    swatchPrimary: '#0284C7',
    swatchCanvas: '#ECF3F8',
    canvasBg: 'bg-[#ECF3F8]',
    patternColor: '#0284C7',
    patternOpacity: 'opacity-[0.045]',
    headerBg: 'bg-white/95 backdrop-blur-md border-b border-sky-950/10 text-slate-800',
    headerTitle: 'text-slate-900',
    headerSubtitle: 'text-slate-500',
    headerIcon: 'text-slate-600',
    headerHover: 'hover:bg-sky-50 hover:text-sky-700',
    outgoingBubble:
      'bg-gradient-to-br from-[#0EA5E9] to-[#0369A1] text-white rounded-2xl rounded-br-sm shadow-[0_6px_18px_-6px_rgba(2,132,199,0.4)]',
    outgoingMeta: 'text-sky-50/90',
    outgoingReplyBox: 'bg-black/15 text-white',
    outgoingReplyBar: 'bg-sky-200',
    outgoingDocBox: 'bg-black/15 border-white/20 text-white',
    outgoingAudioBtn: 'bg-white text-sky-700',
    outgoingAudioWave: 'bg-sky-100/80',
    incomingBubble:
      'bg-white text-slate-800 border border-sky-950/6 rounded-2xl rounded-bl-sm shadow-[0_4px_14px_-6px_rgba(15,23,42,0.1)]',
    incomingMeta: 'text-slate-400',
    incomingReplyBox: 'bg-sky-50/85 text-slate-700',
    incomingReplyBar: 'bg-sky-600',
    incomingDocBox: 'bg-slate-50 border-slate-200/80 text-slate-800',
    incomingAudioBtn: 'bg-sky-600 text-white',
    incomingAudioWave: 'bg-slate-300',
    dividerBadge: 'bg-white/85 backdrop-blur-xs text-slate-500 border border-sky-950/8 shadow-xs',
    composerBg: 'bg-white/95 backdrop-blur-md border-t border-sky-950/8',
    composerInput:
      'bg-[#F1F5F9] focus:bg-white text-slate-800 placeholder-slate-400 border border-sky-950/5 focus:border-sky-500',
    sendButton: 'bg-gradient-to-br from-[#0EA5E9] to-[#0284C7] text-white shadow-md shadow-sky-600/25',
    micButton: 'bg-sky-100 text-sky-800 hover:bg-sky-200',
    scrollDownBtn: 'bg-white text-sky-700 border border-sky-950/10 shadow-lg hover:bg-sky-50',
    searchBarBg: 'bg-sky-50/95 border-b border-sky-200/80 text-slate-800',
    replyBannerBg: 'bg-sky-50/95 border-t border-sky-200/80 text-slate-800',
  },
  'royal-plum': {
    id: 'royal-plum',
    name: 'Velvet Dusk',
    subtitle: 'Soft pearl-lavender & deep violet',
    isDark: false,
    swatchPrimary: '#7C3AED',
    swatchCanvas: '#F3F0F8',
    canvasBg: 'bg-[#F3F0F8]',
    patternColor: '#6D28D9',
    patternOpacity: 'opacity-[0.04]',
    headerBg: 'bg-white/95 backdrop-blur-md border-b border-purple-950/10 text-slate-800',
    headerTitle: 'text-slate-900',
    headerSubtitle: 'text-slate-500',
    headerIcon: 'text-slate-600',
    headerHover: 'hover:bg-violet-50 hover:text-violet-700',
    outgoingBubble:
      'bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] text-white rounded-2xl rounded-br-sm shadow-[0_6px_18px_-6px_rgba(124,58,237,0.38)]',
    outgoingMeta: 'text-violet-100/90',
    outgoingReplyBox: 'bg-black/15 text-white',
    outgoingReplyBar: 'bg-violet-200',
    outgoingDocBox: 'bg-black/15 border-white/20 text-white',
    outgoingAudioBtn: 'bg-white text-violet-700',
    outgoingAudioWave: 'bg-violet-100/80',
    incomingBubble:
      'bg-white text-slate-800 border border-purple-950/6 rounded-2xl rounded-bl-sm shadow-[0_4px_14px_-6px_rgba(15,23,42,0.1)]',
    incomingMeta: 'text-slate-400',
    incomingReplyBox: 'bg-violet-50/85 text-slate-700',
    incomingReplyBar: 'bg-violet-600',
    incomingDocBox: 'bg-slate-50 border-slate-200/80 text-slate-800',
    incomingAudioBtn: 'bg-violet-600 text-white',
    incomingAudioWave: 'bg-slate-300',
    dividerBadge: 'bg-white/85 backdrop-blur-xs text-slate-500 border border-purple-950/8 shadow-xs',
    composerBg: 'bg-white/95 backdrop-blur-md border-t border-purple-950/8',
    composerInput:
      'bg-[#F4F2F8] focus:bg-white text-slate-800 placeholder-slate-400 border border-purple-950/5 focus:border-violet-500',
    sendButton: 'bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] text-white shadow-md shadow-violet-600/25',
    micButton: 'bg-violet-100 text-violet-800 hover:bg-violet-200',
    scrollDownBtn: 'bg-white text-violet-700 border border-purple-950/10 shadow-lg hover:bg-violet-50',
    searchBarBg: 'bg-violet-50/95 border-b border-violet-200/80 text-slate-800',
    replyBannerBg: 'bg-violet-50/95 border-t border-violet-200/80 text-slate-800',
  },
  'warm-sand': {
    id: 'warm-sand',
    name: 'Warm Sandstone',
    subtitle: 'Classic sandstone & forest green',
    isDark: false,
    swatchPrimary: '#15803D',
    swatchCanvas: '#EFE9DF',
    canvasBg: 'bg-[#EFE9DF]',
    patternColor: '#15803D',
    patternOpacity: 'opacity-[0.04]',
    headerBg: 'bg-[#FFFDF9]/95 backdrop-blur-md border-b border-stone-200/80 text-slate-800',
    headerTitle: 'text-slate-900',
    headerSubtitle: 'text-stone-500',
    headerIcon: 'text-stone-600',
    headerHover: 'hover:bg-emerald-50 hover:text-emerald-700',
    outgoingBubble:
      'bg-gradient-to-br from-[#16A34A] to-[#15803D] text-white rounded-2xl rounded-br-sm shadow-[0_6px_18px_-6px_rgba(21,128,61,0.38)]',
    outgoingMeta: 'text-emerald-50/90',
    outgoingReplyBox: 'bg-black/15 text-white',
    outgoingReplyBar: 'bg-emerald-200',
    outgoingDocBox: 'bg-black/15 border-white/20 text-white',
    outgoingAudioBtn: 'bg-white text-emerald-700',
    outgoingAudioWave: 'bg-emerald-100/80',
    incomingBubble:
      'bg-[#FFFDF9] text-slate-800 border border-stone-200/80 rounded-2xl rounded-bl-sm shadow-[0_4px_14px_-6px_rgba(28,25,23,0.08)]',
    incomingMeta: 'text-stone-400',
    incomingReplyBox: 'bg-stone-100 text-slate-700',
    incomingReplyBar: 'bg-emerald-600',
    incomingDocBox: 'bg-stone-50 border-stone-200 text-slate-800',
    incomingAudioBtn: 'bg-emerald-600 text-white',
    incomingAudioWave: 'bg-stone-300',
    dividerBadge: 'bg-[#FFFDF9]/90 backdrop-blur-xs text-stone-500 border border-stone-200/70 shadow-xs',
    composerBg: 'bg-[#FFFDF9]/95 backdrop-blur-md border-t border-stone-200/80',
    composerInput:
      'bg-stone-100 focus:bg-white text-slate-800 placeholder-stone-400 border border-stone-200/60 focus:border-emerald-500',
    sendButton: 'bg-gradient-to-br from-[#16A34A] to-[#15803D] text-white shadow-md shadow-emerald-700/25',
    micButton: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200',
    scrollDownBtn: 'bg-[#FFFDF9] text-emerald-700 border border-stone-200 shadow-lg hover:bg-emerald-50',
    searchBarBg: 'bg-emerald-50/95 border-b border-emerald-200/80 text-slate-800',
    replyBannerBg: 'bg-emerald-50/95 border-t border-emerald-200/80 text-slate-800',
  },
};

const THEME_STORAGE_KEY = 'dost_chat_theme_id';

class ThemeService {
  private currentThemeId: ChatThemeId = 'charcoal-dark';
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY) as ChatThemeId | null;
      if (saved && CHAT_THEMES[saved]) {
        this.currentThemeId = saved;
      }
      this.syncDocumentDarkClass();
    }
  }

  private syncDocumentDarkClass() {
    if (typeof document === 'undefined') return;
    const isDark = CHAT_THEMES[this.currentThemeId].isDark;
    document.documentElement.classList.toggle('dark', isDark);
  }

  getThemeId(): ChatThemeId {
    return this.currentThemeId;
  }

  getTheme(): ChatThemeConfig {
    return CHAT_THEMES[this.currentThemeId];
  }

  isDarkMode(): boolean {
    return CHAT_THEMES[this.currentThemeId].isDark;
  }

  setTheme(id: ChatThemeId) {
    if (!CHAT_THEMES[id] || this.currentThemeId === id) return;
    this.currentThemeId = id;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, id);
      this.syncDocumentDarkClass();
    }
    this.listeners.forEach((cb) => cb());
  }

  toggleDarkLight() {
    const next: ChatThemeId = this.isDarkMode() ? 'emerald-glass' : 'charcoal-dark';
    this.setTheme(next);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const themeService = new ThemeService();
