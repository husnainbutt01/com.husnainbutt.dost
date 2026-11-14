import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { db } from './firebase';
import { DeviceSession } from '../types';

const DEVICE_ID_KEY = 'dost_persistent_device_id';

function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'dev_ssr';
  let id = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    window.localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function detectDeviceMeta(): {
  deviceName: string;
  platform: DeviceSession['platform'];
  browserInfo: string;
} {
  if (Capacitor.isNativePlatform()) {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isTablet = /tablet|ipad/i.test(ua) || (typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) >= 700);
    return {
      deviceName: isTablet ? 'Android Tablet (DOST App)' : 'Android Phone (DOST App)',
      platform: isTablet ? 'tablet' : 'android',
      browserInfo: 'Capacitor Native APK v1.0',
    };
  }

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIPad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
  const isMobile = /Android|iPhone|iPod|Mobile/i.test(ua) && !isIPad;
  const browser = /Edg/i.test(ua)
    ? 'Edge'
    : /Chrome/i.test(ua)
    ? 'Chrome'
    : /Firefox/i.test(ua)
    ? 'Firefox'
    : /Safari/i.test(ua)
    ? 'Safari'
    : 'Web Browser';

  const os = /Windows/i.test(ua)
    ? 'Windows'
    : /Mac OS|Macintosh/i.test(ua)
    ? 'macOS'
    : /Android/i.test(ua)
    ? 'Android'
    : /iPhone|iPad/i.test(ua)
    ? 'iOS'
    : /Linux/i.test(ua)
    ? 'Linux'
    : 'Desktop';

  if (isIPad) {
    return { deviceName: `Tablet (${os})`, platform: 'tablet', browserInfo: `${browser} on ${os}` };
  }
  if (isMobile) {
    return {
      deviceName: `Mobile Web (${os})`,
      platform: 'mobile_web',
      browserInfo: `${browser} on ${os}`,
    };
  }
  return {
    deviceName: `${os} Desktop (${browser})`,
    platform: 'desktop',
    browserInfo: `${browser} on ${os}`,
  };
}

class DeviceSessionService {
  private deviceId = getOrCreateDeviceId();
  private sessions: DeviceSession[] = [];
  private listeners = new Set<() => void>();
  private unsub: (() => void) | null = null;
  private heartbeatId: number | null = null;
  private currentUserId: string | null = null;
  private onRevokedCallback: (() => void) | null = null;

  getCurrentDeviceId(): string {
    return this.deviceId;
  }

  getCurrentSessionId(userId: string): string {
    return `${userId}_${this.deviceId}`;
  }

  getSessions(): DeviceSession[] {
    return this.sessions.filter((s) => !s.revoked);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  async startSessionTracking(userId: string, onRevoked?: () => void) {
    if (this.currentUserId === userId && this.unsub) return;
    this.stopSessionTracking();
    this.currentUserId = userId;
    this.onRevokedCallback = onRevoked || null;

    const sessionId = this.getCurrentSessionId(userId);
    const meta = detectDeviceMeta();
    const now = new Date().toISOString();

    const sessionPayload: DeviceSession = {
      id: sessionId,
      userId,
      deviceId: this.deviceId,
      deviceName: meta.deviceName,
      platform: meta.platform,
      browserInfo: meta.browserInfo,
      lastActive: now,
      createdAt: now,
      revoked: false,
    };

    try {
      await setDoc(doc(db, 'device_sessions', sessionId), sessionPayload, { merge: true });
    } catch {}

    try {
      const q = query(collection(db, 'device_sessions'), where('userId', '==', userId));
      this.unsub = onSnapshot(
        q,
        (snap) => {
          const list: DeviceSession[] = [];
          let wasRevoked = false;
          snap.forEach((d) => {
            const s = d.data() as DeviceSession;
            if (s.id === sessionId && s.revoked) {
              wasRevoked = true;
            }
            list.push(s);
          });
          this.sessions = list.sort(
            (a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
          );
          this.notify();

          if (wasRevoked && this.onRevokedCallback) {
            this.onRevokedCallback();
          }
        },
        () => {}
      );
    } catch {}

    this.heartbeatId = window.setInterval(() => {
      if (!navigator.onLine || !this.currentUserId) return;
      updateDoc(doc(db, 'device_sessions', sessionId), {
        lastActive: new Date().toISOString(),
      }).catch(() => {});
    }, 60000);
  }

  stopSessionTracking() {
    if (this.unsub) {
      this.unsub();
      this.unsub = null;
    }
    if (this.heartbeatId) {
      clearInterval(this.heartbeatId);
      this.heartbeatId = null;
    }
    this.currentUserId = null;
    this.sessions = [];
    this.notify();
  }

  async revokeDeviceSession(sessionId: string) {
    try {
      await updateDoc(doc(db, 'device_sessions', sessionId), {
        revoked: true,
        lastActive: new Date().toISOString(),
      });
      await deleteDoc(doc(db, 'device_sessions', sessionId)).catch(() => {});
    } catch {}
  }
}

export const deviceSessionService = new DeviceSessionService();
