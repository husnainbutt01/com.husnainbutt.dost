import { Capacitor, registerPlugin } from '@capacitor/core';

interface DostSecurityPlugin {
  isBiometricAvailable(): Promise<{
    biometric: boolean;
    deviceCredential: boolean;
    available: boolean;
  }>;
  authenticateBiometric(options: {
    title?: string;
    subtitle?: string;
  }): Promise<{ success: boolean; error?: string }>;
}

const DostNative = Capacitor.isNativePlatform()
  ? registerPlugin<DostSecurityPlugin>('DostNative')
  : null;

const STORAGE_KEY = 'dost_security_lock_v1';

interface SecurityState {
  appLockEnabled: boolean;
  biometricEnabled: boolean;
  pinHash: string | null;
  lockedChatIds: string[];
  webauthnCredId: string | null;
}

const DEFAULT_STATE: SecurityState = {
  appLockEnabled: false,
  biometricEnabled: true,
  pinHash: null,
  lockedChatIds: [],
  webauthnCredId: null,
};

async function hashPin(pin: string): Promise<string> {
  const salted = `dost_lock_${pin}_2026`;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salted));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback deterministic hash for non-HTTPS contexts
  let hash = 0;
  for (let i = 0; i < salted.length; i++) {
    hash = (hash << 5) - hash + salted.charCodeAt(i);
    hash |= 0;
  }
  return `fb_${hash}`;
}

function toBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(padded);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

class SecurityService {
  private state: SecurityState = { ...DEFAULT_STATE };
  private listeners = new Set<() => void>();

  constructor() {
    this.load();
  }

  private load() {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SecurityState>;
        this.state = {
          appLockEnabled: Boolean(parsed.appLockEnabled),
          biometricEnabled: parsed.biometricEnabled ?? true,
          pinHash: parsed.pinHash || null,
          lockedChatIds: Array.isArray(parsed.lockedChatIds) ? parsed.lockedChatIds : [],
          webauthnCredId: parsed.webauthnCredId || null,
        };
      }
    } catch {}
  }

  private save() {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
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

  isAppLockEnabled(): boolean {
    return this.state.appLockEnabled && (Boolean(this.state.pinHash) || this.state.biometricEnabled);
  }

  isBiometricEnabled(): boolean {
    return this.state.biometricEnabled;
  }

  hasPin(): boolean {
    return Boolean(this.state.pinHash);
  }

  getLockedChatIds(): string[] {
    return this.state.lockedChatIds;
  }

  isChatLocked(chatId: string): boolean {
    return this.state.lockedChatIds.includes(chatId);
  }

  async setPin(pin: string): Promise<void> {
    this.state.pinHash = await hashPin(pin);
    this.save();
  }

  async verifyPin(pin: string): Promise<boolean> {
    if (!this.state.pinHash) return false;
    const h = await hashPin(pin);
    return h === this.state.pinHash;
  }

  setAppLockEnabled(enabled: boolean) {
    this.state.appLockEnabled = enabled;
    this.save();
  }

  setBiometricEnabled(enabled: boolean) {
    this.state.biometricEnabled = enabled;
    this.save();
  }

  lockChat(chatId: string) {
    if (!this.state.lockedChatIds.includes(chatId)) {
      this.state.lockedChatIds = [...this.state.lockedChatIds, chatId];
      this.save();
    }
  }

  unlockChat(chatId: string) {
    if (this.state.lockedChatIds.includes(chatId)) {
      this.state.lockedChatIds = this.state.lockedChatIds.filter((id) => id !== chatId);
      this.save();
    }
  }

  async checkBiometricSupport(): Promise<{ available: boolean; label: string }> {
    if (Capacitor.isNativePlatform() && DostNative) {
      try {
        const res = await DostNative.isBiometricAvailable();
        return {
          available: Boolean(res.available),
          label: res.biometric ? 'Fingerprint / Face Unlock' : 'Device Screen Lock',
        };
      } catch {
        return { available: false, label: 'PIN Lock' };
      }
    }

    if (
      typeof window !== 'undefined' &&
      window.PublicKeyCredential &&
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    ) {
      try {
        const available =
          await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        return {
          available,
          label: available ? 'Fingerprint / Face ID (Passkey)' : 'PIN Lock',
        };
      } catch {}
    }

    return { available: false, label: 'PIN Lock' };
  }

  private async enrollWebAuthn(userLabel: string): Promise<string | null> {
    if (typeof window === 'undefined' || !navigator.credentials?.create) return null;
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const userId = new Uint8Array(16);
      crypto.getRandomValues(userId);

      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'DOST Messaging App' },
          user: {
            id: userId,
            name: userLabel || 'dost-user',
            displayName: userLabel || 'DOST User',
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
          },
          timeout: 45000,
        },
      })) as PublicKeyCredential | null;

      if (cred?.rawId) {
        const encoded = toBase64Url(cred.rawId);
        this.state.webauthnCredId = encoded;
        this.save();
        return encoded;
      }
    } catch {}
    return null;
  }

  async authenticateBiometric(options?: {
    title?: string;
    subtitle?: string;
    userLabel?: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (Capacitor.isNativePlatform() && DostNative) {
      try {
        return await DostNative.authenticateBiometric({
          title: options?.title || 'Unlock DOST',
          subtitle: options?.subtitle || 'Use fingerprint, face ID, or device lock',
        });
      } catch (err: any) {
        return { success: false, error: err?.message || 'Biometric unavailable' };
      }
    }

    // Web platform authenticator (Touch ID / Face ID / Windows Hello)
    if (typeof window !== 'undefined' && navigator.credentials?.get && window.PublicKeyCredential) {
      try {
        let credId = this.state.webauthnCredId;
        if (!credId) {
          credId = await this.enrollWebAuthn(options?.userLabel || 'DOST User');
          if (credId) {
            return { success: true };
          }
          return { success: false, error: 'Platform biometric unavailable; use PIN' };
        }

        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        const assertion = await navigator.credentials.get({
          publicKey: {
            challenge,
            allowCredentials: [
              {
                type: 'public-key',
                id: fromBase64Url(credId).buffer as ArrayBuffer,
              },
            ],
            userVerification: 'required',
            timeout: 45000,
          },
        });
        if (assertion) {
          return { success: true };
        }
      } catch (err: any) {
        return { success: false, error: err?.message || 'Biometric cancelled' };
      }
    }

    return { success: false, error: 'Biometric unavailable on this browser; use PIN' };
  }
}

export const securityService = new SecurityService();
