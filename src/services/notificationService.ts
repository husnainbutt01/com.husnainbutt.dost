import { Capacitor, registerPlugin } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { CallSession } from '../types';

export interface NotificationActionPayload {
  action: 'open_chat' | 'open_call' | 'answer_call' | 'decline_call';
  chatId?: string;
  callId?: string;
}

export interface NativePermissionStatus {
  notifications: boolean;
  microphone: boolean;
  camera: boolean;
  batteryUnrestricted: boolean;
}

interface DostNativePluginInterface {
  requestAllPermissions(): Promise<NativePermissionStatus>;
  getPermissionStatus(): Promise<NativePermissionStatus>;
  startBackgroundService(): Promise<{ started: boolean; error?: string }>;
  stopBackgroundService(): Promise<void>;
  requestIgnoreBatteryOptimizations(): Promise<NativePermissionStatus>;
  showMessageNotification(options: {
    title: string;
    body: string;
    chatId: string;
    senderName?: string;
  }): Promise<void>;
  showIncomingCallNotification(options: {
    callId: string;
    callerName: string;
    callType: 'audio' | 'video';
  }): Promise<void>;
  cancelCallNotification(): Promise<void>;
  getPendingAction(): Promise<NotificationActionPayload | Record<string, never>>;
  addListener(
    eventName: 'notificationAction',
    listenerFunc: (data: NotificationActionPayload) => void
  ): Promise<{ remove: () => Promise<void> }>;
}

const DostNative = Capacitor.isNativePlatform()
  ? registerPlugin<DostNativePluginInterface>('DostNative')
  : null;

const BG_ENABLED_KEY = 'dost_bg_service_enabled';

class NotificationService {
  private lastNotifiedCallId: string | null = null;
  private notifiedMessageIds = new Set<string>();
  private actionHandlers: ((payload: NotificationActionPayload) => void)[] = [];
  private nativeListenerBound = false;
  private isNativeAppActive = true;

  constructor() {
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener('appStateChange', ({ isActive }) => {
        this.isNativeAppActive = isActive;
      }).catch(() => {});
    }
  }

  isBackgroundEnabled(): boolean {
    try {
      const val = localStorage.getItem(BG_ENABLED_KEY);
      return val === null ? true : val === 'true';
    } catch {
      return true;
    }
  }

  async setBackgroundEnabled(enabled: boolean): Promise<void> {
    try {
      localStorage.setItem(BG_ENABLED_KEY, enabled ? 'true' : 'false');
    } catch {}
    if (enabled) {
      await this.startBackgroundService();
    } else {
      await this.stopBackgroundService();
    }
  }

  async requestPermissions(): Promise<NativePermissionStatus> {
    if (DostNative) {
      try {
        return await DostNative.requestAllPermissions();
      } catch {
        return {
          notifications: false,
          microphone: false,
          camera: false,
          batteryUnrestricted: true,
        };
      }
    }

    let notifGranted = false;
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        notifGranted = true;
      } else if (Notification.permission !== 'denied') {
        try {
          const res = await Notification.requestPermission();
          notifGranted = res === 'granted';
        } catch {}
      }
    }

    return {
      notifications: notifGranted,
      microphone: true,
      camera: true,
      batteryUnrestricted: true,
    };
  }

  async getPermissionStatus(): Promise<NativePermissionStatus> {
    if (DostNative) {
      try {
        return await DostNative.getPermissionStatus();
      } catch {}
    }
    const notifGranted =
      typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
    return {
      notifications: notifGranted,
      microphone: true,
      camera: true,
      batteryUnrestricted: true,
    };
  }

  async startBackgroundService(): Promise<boolean> {
    if (!this.isBackgroundEnabled()) return false;
    if (DostNative) {
      try {
        const res = await DostNative.startBackgroundService();
        return Boolean(res?.started);
      } catch {
        return false;
      }
    }
    return false;
  }

  async stopBackgroundService(): Promise<void> {
    if (DostNative) {
      try {
        await DostNative.stopBackgroundService();
      } catch {}
    }
  }

  async requestBatteryUnrestricted(): Promise<NativePermissionStatus> {
    if (DostNative) {
      try {
        return await DostNative.requestIgnoreBatteryOptimizations();
      } catch {}
    }
    return this.getPermissionStatus();
  }

  bindActionListeners(handler: (payload: NotificationActionPayload) => void): () => void {
    this.actionHandlers.push(handler);

    if (DostNative && !this.nativeListenerBound) {
      this.nativeListenerBound = true;
      DostNative.addListener('notificationAction', (data) => {
        if (data?.action) {
          this.actionHandlers.forEach((h) => h(data));
        }
      }).catch(() => {});
    }

    if (DostNative) {
      DostNative.getPendingAction()
        .then((pending) => {
          if (pending && 'action' in pending && pending.action) {
            handler(pending as NotificationActionPayload);
          }
        })
        .catch(() => {});
    }

    return () => {
      this.actionHandlers = this.actionHandlers.filter((h) => h !== handler);
    };
  }

  async notifyIncomingMessage(params: {
    messageId: string;
    chatId: string;
    title: string;
    body: string;
    senderName?: string;
    isActiveChat?: boolean;
  }): Promise<void> {
    if (this.notifiedMessageIds.has(params.messageId)) return;
    this.notifiedMessageIds.add(params.messageId);
    if (this.notifiedMessageIds.size > 200) {
      const first = this.notifiedMessageIds.values().next().value;
      if (first) this.notifiedMessageIds.delete(first);
    }

    const isHidden =
      (typeof document !== 'undefined' && document.visibilityState !== 'visible') ||
      !this.isNativeAppActive;
    // Notify on phone screen if app is in background OR user is inside another conversation
    if (!isHidden && params.isActiveChat) {
      return;
    }

    if (DostNative) {
      try {
        await DostNative.showMessageNotification({
          title: params.title,
          body: params.body,
          chatId: params.chatId,
          senderName: params.senderName,
        });
      } catch {}
      return;
    }

    // Browser / PWA fallback notification when tab/app is backgrounded
    if (
      isHidden &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            await reg.showNotification(params.title, {
              body: params.body,
              icon: '/pwa-192x192.png',
              badge: '/pwa-192x192.png',
              tag: `dost_chat_${params.chatId}`,
              data: { chatId: params.chatId },
            });
            return;
          }
        }
        new Notification(params.title, {
          body: params.body,
          icon: '/pwa-192x192.png',
          tag: `dost_chat_${params.chatId}`,
        });
      } catch {}
    }
  }

  async notifyIncomingCall(call: CallSession): Promise<void> {
    if (this.lastNotifiedCallId === call.id) return;
    this.lastNotifiedCallId = call.id;

    if (DostNative) {
      try {
        await DostNative.showIncomingCallNotification({
          callId: call.id,
          callerName: call.callerName || 'DOST User',
          callType: call.type,
        });
      } catch {}
      return;
    }

    // Web / Desktop browser fallback notification
    if (
      typeof document !== 'undefined' &&
      document.visibilityState !== 'visible' &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        const title = `${call.callerName || 'DOST User'} is calling`;
        const body = call.type === 'video' ? 'Incoming DOST Video Call' : 'Incoming DOST Voice Call';
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            await reg.showNotification(title, {
              body,
              icon: '/pwa-192x192.png',
              tag: `dost_call_${call.id}`,
              requireInteraction: true,
            });
            return;
          }
        }
        new Notification(title, {
          body,
          icon: '/pwa-192x192.png',
          tag: `dost_call_${call.id}`,
          requireInteraction: true,
        });
      } catch {}
    }
  }

  async cancelCallNotification(): Promise<void> {
    this.lastNotifiedCallId = null;
    if (DostNative) {
      try {
        await DostNative.cancelCallNotification();
      } catch {}
    }
  }

  async sendTestNotification(): Promise<void> {
    if (DostNative) {
      await DostNative.requestAllPermissions();
      await DostNative.showMessageNotification({
        title: 'DOST Alerts Active',
        body: 'Messages aur calls ab aapke phone ki screen par foran aayenge!',
        chatId: 'test',
        senderName: 'DOST',
      });
      return;
    }

    await this.requestPermissions();
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('DOST Alerts Active', {
        body: 'Messages aur calls ke alerts ab active hain!',
        icon: '/pwa-192x192.png',
      });
    }
  }
}

export const notificationService = new NotificationService();
