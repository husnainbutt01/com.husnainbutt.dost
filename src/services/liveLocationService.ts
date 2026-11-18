import { LocationData } from '../types';
import { chatStore } from './chatService';

interface ActiveLiveSession {
  messageId: string;
  chatId: string;
  watchId: number;
  expiryTimerId: number;
  expiresAt: string;
  lastSentAt: number;
  lastLat: number;
  lastLng: number;
}

class LiveLocationService {
  private sessions = new Map<string, ActiveLiveSession>();
  private listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  getActiveSessions(): ActiveLiveSession[] {
    return Array.from(this.sessions.values());
  }

  getActiveForChat(chatId: string): ActiveLiveSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.chatId === chatId);
  }

  isSharingMessage(messageId: string): boolean {
    return this.sessions.has(messageId);
  }

  startTrackingMessage(params: {
    messageId: string;
    chatId: string;
    durationMinutes: number;
    initialLat: number;
    initialLng: number;
  }) {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    // Clean up if replacing an existing session for the same messageId
    this.clearLocalSession(params.messageId);

    const expiresMs = params.durationMinutes * 60 * 1000;
    const expiresAt = new Date(Date.now() + expiresMs).toISOString();

    const expiryTimerId = window.setTimeout(() => {
      void this.stopSharing(params.messageId);
    }, expiresMs);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const session = this.sessions.get(params.messageId);
        if (!session) return;
        const now = Date.now();
        if (now >= new Date(session.expiresAt).getTime()) {
          void this.stopSharing(params.messageId);
          return;
        }

        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const deltaLat = Math.abs(lat - session.lastLat);
        const deltaLng = Math.abs(lng - session.lastLng);
        const movedSignificantly = deltaLat > 0.00008 || deltaLng > 0.00008; // ~9 meters
        const enoughTimePassed = now - session.lastSentAt >= 8000;

        if (movedSignificantly || enoughTimePassed) {
          session.lastSentAt = now;
          session.lastLat = lat;
          session.lastLng = lng;

          const updated: LocationData = {
            lat,
            lng,
            accuracy: Math.round(pos.coords.accuracy || 0),
            isLive: true,
            liveExpiresAt: session.expiresAt,
            isStopped: false,
            updatedAt: new Date(now).toISOString(),
          };
          void chatStore.updateLiveLocation(params.messageId, updated);
          this.notify();
        }
      },
      (err) => {
        console.warn('Live GPS watch warning:', err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );

    this.sessions.set(params.messageId, {
      messageId: params.messageId,
      chatId: params.chatId,
      watchId,
      expiryTimerId,
      expiresAt,
      lastSentAt: Date.now(),
      lastLat: params.initialLat,
      lastLng: params.initialLng,
    });
    this.notify();
  }

  private clearLocalSession(messageId: string) {
    const existing = this.sessions.get(messageId);
    if (!existing) return;
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(existing.watchId);
    }
    clearTimeout(existing.expiryTimerId);
    this.sessions.delete(messageId);
  }

  async stopSharing(messageId: string) {
    this.clearLocalSession(messageId);
    this.notify();
    await chatStore.stopLiveLocation(messageId);
  }

  stopAll() {
    const ids = Array.from(this.sessions.keys());
    for (const id of ids) {
      this.clearLocalSession(id);
    }
    this.notify();
  }
}

export const liveLocationService = new LiveLocationService();
