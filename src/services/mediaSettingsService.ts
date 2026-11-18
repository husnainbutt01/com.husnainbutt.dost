import { UserMediaSettings } from '../types';

const STORAGE_KEY = 'dost_media_settings_v1';

const DEFAULT_SETTINGS: UserMediaSettings = {
  noiseCancellation: true,
  lowDataMode: false,
  defaultHdMedia: false,
};

class MediaSettingsService {
  private settings: UserMediaSettings = { ...DEFAULT_SETTINGS };
  private listeners = new Set<() => void>();

  constructor() {
    this.load();
  }

  private load() {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<UserMediaSettings>;
        this.settings = {
          noiseCancellation: parsed.noiseCancellation ?? true,
          lowDataMode: parsed.lowDataMode ?? false,
          defaultHdMedia: parsed.defaultHdMedia ?? false,
        };
      }
    } catch {}
  }

  private save() {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      } catch {}
    }
    this.listeners.forEach((cb) => cb());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSettings(): UserMediaSettings {
    return { ...this.settings };
  }

  hydrateFromProfile(remote?: UserMediaSettings) {
    if (!remote) return;
    this.settings = {
      noiseCancellation: remote.noiseCancellation ?? this.settings.noiseCancellation,
      lowDataMode: remote.lowDataMode ?? this.settings.lowDataMode,
      defaultHdMedia: remote.defaultHdMedia ?? this.settings.defaultHdMedia,
    };
    this.save();
  }

  update(partial: Partial<UserMediaSettings>): UserMediaSettings {
    this.settings = {
      ...this.settings,
      ...partial,
    };
    this.save();
    return this.getSettings();
  }
}

export const mediaSettingsService = new MediaSettingsService();
