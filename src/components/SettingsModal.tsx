import React, { useState, useEffect, useRef } from 'react';
import { User, DeviceSession, PaymentMethod, PaymentTransaction } from '../types';
import { chatStore } from '../services/chatService';
import { authService } from '../services/firebaseAuth';
import { Capacitor } from '@capacitor/core';
import { uploadMediaFile } from '../services/storageService';
import { notificationService, NativePermissionStatus } from '../services/notificationService';
import { CHAT_THEMES, ChatThemeId, themeService } from '../services/themeService';
import { securityService } from '../services/securityService';
import { deviceSessionService } from '../services/deviceSessionService';
import { PAYMENT_RAILS, formatPKR, paymentService } from '../services/paymentService';
import { PWAInstallButton } from './PWAInstallButton';
import {
  User as UserIcon,
  Lock,
  Bell,
  Info,
  X,
  Check,
  ShieldCheck,
  UserX,
  Camera,
  Loader2,
  BatteryCharging,
  Radio,
  Palette,
  Fingerprint,
  Laptop,
  Smartphone,
  Tablet,
  KeyRound,
  Copy,
  LogOut,
  Banknote,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onOpenAdmin: () => void;
  onSignOut: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onOpenAdmin,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState<
    'profile' | 'theme' | 'security' | 'devices' | 'payments' | 'privacy' | 'notifications' | 'about'
  >('profile');
  const [selectedThemeId, setSelectedThemeId] = useState<ChatThemeId>(themeService.getThemeId());

  // Profile state
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [phone, setPhone] = useState(currentUser?.phoneNumber || '');
  const [photoUrl, setPhotoUrl] = useState(currentUser?.photoUrl || '');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState('');

  // Security & Lock state
  const [appLockOn, setAppLockOn] = useState(securityService.isAppLockEnabled());
  const [biometricOn, setBiometricOn] = useState(securityService.isBiometricEnabled());
  const [hasPin, setHasPin] = useState(securityService.hasPin());
  const [lockedChatIds, setLockedChatIds] = useState<string[]>(securityService.getLockedChatIds());
  const [bioSupport, setBioSupport] = useState<{ available: boolean; label: string }>({
    available: false,
    label: 'PIN Lock',
  });
  const [newPin, setNewPin] = useState('');

  // Multi-device & DOST Pay state
  const [deviceSessions, setDeviceSessions] = useState<DeviceSession[]>(deviceSessionService.getSessions());
  const [payMethod, setPayMethod] = useState<PaymentMethod>(
    currentUser?.paymentAccount?.method || 'jazzcash'
  );
  const [payNumber, setPayNumber] = useState(currentUser?.paymentAccount?.accountNumber || '');
  const [payTitle, setPayTitle] = useState(currentUser?.paymentAccount?.accountTitle || '');
  const [transactions, setTransactions] = useState<PaymentTransaction[]>(paymentService.getTransactions());

  // Privacy state
  const [lastSeen, setLastSeen] = useState<'everyone' | 'contacts' | 'nobody'>(
    currentUser?.privacySettings?.lastSeenVisibility || 'everyone'
  );
  const [readReceipts, setReadReceipts] = useState(
    currentUser?.privacySettings?.readReceipts ?? true
  );
  const [profileVisibility, setProfileVisibility] = useState<'everyone' | 'contacts' | 'nobody'>(
    currentUser?.privacySettings?.profilePhotoVisibility || 'everyone'
  );

  // Notification & Background state
  const [soundsOn, setSoundsOn] = useState(currentUser?.notificationSettings?.messageSounds ?? true);
  const [ringtonesOn, setRingtonesOn] = useState(currentUser?.notificationSettings?.callRingtones ?? true);
  const [alertsOn, setAlertsOn] = useState(currentUser?.notificationSettings?.inAppAlerts ?? true);
  const [bgRunningOn, setBgRunningOn] = useState(notificationService.isBackgroundEnabled());
  const [permStatus, setPermStatus] = useState<NativePermissionStatus | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const blockedUsers = chatStore.getBlockedUsers();

  useEffect(() => {
    if (!isOpen) return;
    setAppLockOn(securityService.isAppLockEnabled());
    setBiometricOn(securityService.isBiometricEnabled());
    setHasPin(securityService.hasPin());
    setLockedChatIds(securityService.getLockedChatIds());
    setDeviceSessions(deviceSessionService.getSessions());
    securityService.checkBiometricSupport().then(setBioSupport).catch(() => {});

    const unsubSec = securityService.subscribe(() => {
      setAppLockOn(securityService.isAppLockEnabled());
      setBiometricOn(securityService.isBiometricEnabled());
      setHasPin(securityService.hasPin());
      setLockedChatIds(securityService.getLockedChatIds());
    });
    const unsubDev = deviceSessionService.subscribe(() => {
      setDeviceSessions(deviceSessionService.getSessions());
    });
    setTransactions(paymentService.getTransactions());
    const unsubPay = paymentService.subscribe(() => {
      setTransactions(paymentService.getTransactions());
    });

    if (currentUser) {
      setDisplayName(currentUser.displayName || '');
      setBio(currentUser.bio || '');
      setPhone(currentUser.phoneNumber || '');
      setPhotoUrl(currentUser.photoUrl || '');
      setPayMethod(currentUser.paymentAccount?.method || 'jazzcash');
      setPayNumber(currentUser.paymentAccount?.accountNumber || currentUser.phoneNumber || '');
      setPayTitle(currentUser.paymentAccount?.accountTitle || currentUser.displayName || '');
      setLastSeen(currentUser.privacySettings?.lastSeenVisibility || 'everyone');
      setReadReceipts(currentUser.privacySettings?.readReceipts ?? true);
      setProfileVisibility(currentUser.privacySettings?.profilePhotoVisibility || 'everyone');
      setSoundsOn(currentUser.notificationSettings?.messageSounds ?? true);
      setRingtonesOn(currentUser.notificationSettings?.callRingtones ?? true);
      setAlertsOn(currentUser.notificationSettings?.inAppAlerts ?? true);
      setBgRunningOn(notificationService.isBackgroundEnabled());
      setSelectedThemeId(themeService.getThemeId());
      notificationService.getPermissionStatus().then(setPermStatus).catch(() => {});
    }

    return () => {
      unsubSec();
      unsubDev();
      unsubPay();
    };
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const showSavedToast = (label: string) => {
    setSavedSuccess(label);
    setTimeout(() => setSavedSuccess(''), 2000);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    setIsUploadingAvatar(true);
    try {
      const url = await uploadMediaFile(`avatars/${currentUser.id}/${Date.now()}_${file.name}`, file, {
        isImage: true,
      });
      setPhotoUrl(url);
      await chatStore.updateProfile({ photoUrl: url });
      showSavedToast('Profile photo updated!');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await chatStore.updateProfile({
      displayName: displayName.trim(),
      bio: bio.trim(),
      phoneNumber: phone.trim(),
      photoUrl,
      isProfileComplete: true,
    });
    showSavedToast('Profile updated!');
  };

  const handleSavePrivacy = async (updates: {
    lastSeenVisibility?: 'everyone' | 'contacts' | 'nobody';
    readReceipts?: boolean;
    profilePhotoVisibility?: 'everyone' | 'contacts' | 'nobody';
  }) => {
    const nextPrivacy = {
      lastSeenVisibility: updates.lastSeenVisibility ?? lastSeen,
      readReceipts: updates.readReceipts ?? readReceipts,
      profilePhotoVisibility: updates.profilePhotoVisibility ?? profileVisibility,
      allowGroupAdd: currentUser?.privacySettings?.allowGroupAdd || ('everyone' as const),
    };
    setLastSeen(nextPrivacy.lastSeenVisibility);
    setReadReceipts(nextPrivacy.readReceipts);
    setProfileVisibility(nextPrivacy.profilePhotoVisibility);
    await chatStore.updateProfile({ privacySettings: nextPrivacy });
    showSavedToast('Privacy saved');
  };

  const handleSaveNotifications = async (updates: {
    messageSounds?: boolean;
    callRingtones?: boolean;
    inAppAlerts?: boolean;
  }) => {
    const nextNotif = {
      messageSounds: updates.messageSounds ?? soundsOn,
      callRingtones: updates.callRingtones ?? ringtonesOn,
      inAppAlerts: updates.inAppAlerts ?? alertsOn,
      previewMessage: currentUser?.notificationSettings?.previewMessage ?? true,
      vibrate: currentUser?.notificationSettings?.vibrate ?? true,
    };
    setSoundsOn(nextNotif.messageSounds);
    setRingtonesOn(nextNotif.callRingtones);
    setAlertsOn(nextNotif.inAppAlerts);
    await chatStore.updateProfile({ notificationSettings: nextNotif });
    showSavedToast('Preferences saved');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in select-none">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col md:flex-row max-h-[85vh]">
        {/* Left Navigation Sidebar */}
        <div className="w-full md:w-48 bg-slate-50 p-4 border-r border-slate-200/80 flex flex-col justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-800 font-['Outfit'] mb-4 px-2">Settings</h2>
            <nav className="space-y-1 flex md:block gap-1 overflow-x-auto">
              {[
                { id: 'profile', label: 'My Profile', icon: UserIcon },
                { id: 'theme', label: 'Chat Theme', icon: Palette },
                { id: 'security', label: 'App & Chat Lock', icon: Fingerprint },
                { id: 'devices', label: 'Linked Devices', icon: Laptop },
                { id: 'payments', label: 'DOST Pay', icon: Banknote },
                { id: 'privacy', label: 'Privacy', icon: Lock },
                { id: 'notifications', label: 'Notifications', icon: Bell },
                { id: 'about', label: 'About', icon: Info },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`shrink-0 md:w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left whitespace-nowrap ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Quick Actions */}
          <div className="pt-4 border-t border-slate-200 space-y-1.5 mt-3 md:mt-0">
            {currentUser?.role === 'admin' && (
              <button
                onClick={() => {
                  onClose();
                  onOpenAdmin();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold hover:bg-emerald-200 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Admin Console</span>
              </button>
            )}

            {currentUser && (
              <button
                onClick={() => {
                  onClose();
                  onSignOut();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl text-xs font-semibold transition-colors mt-2 cursor-pointer"
              >
                <UserX className="w-4 h-4 text-rose-500" />
                <span>Log Out</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Content Panel */}
        <div className="flex-1 p-6 overflow-y-auto relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {savedSuccess && (
            <div className="mb-3 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              <span>{savedSuccess}</span>
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <h3 className="text-base font-bold text-slate-800 font-['Outfit']">Edit Profile</h3>

              <div className="flex items-center gap-4">
                <div className="relative">
                  <img
                    src={
                      photoUrl ||
                      currentUser?.photoUrl ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.id || 'dost'}`
                    }
                    alt={displayName}
                    className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-600 text-white rounded-full flex items-center justify-center border-2 border-white shadow cursor-pointer hover:bg-emerald-700"
                    title="Upload New Photo"
                  >
                    {isUploadingAvatar ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Camera className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-semibold text-slate-800">{currentUser?.email}</p>
                    {authService.isEmailVerified() ? (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                        Verified
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await authService.resendEmailVerification();
                            showSavedToast('Verification email sent!');
                          } catch {
                            showSavedToast('Try again in a moment');
                          }
                        }}
                        className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full hover:bg-amber-200 cursor-pointer"
                      >
                        Verify Email
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Click camera icon to upload a real profile picture
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">About / Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 h-18"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+92 300 1234567"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                {currentUser?.email && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await authService.resetPassword(currentUser.email);
                        showSavedToast('Password reset link sent!');
                      } catch {
                        showSavedToast('Could not send reset email');
                      }
                    }}
                    className="text-[11px] font-semibold text-emerald-700 hover:underline cursor-pointer"
                  >
                    Send Password Reset Email
                  </button>
                )}
                <button
                  type="submit"
                  className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md transition-colors cursor-pointer ml-auto"
                >
                  Save Profile
                </button>
              </div>
            </form>
          )}

          {/* Chat Theme Tab */}
          {activeTab === 'theme' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 font-['Outfit']">Chat Appearance</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Customize conversation background, header style, and message bubbles
                </p>
              </div>

              <div className="space-y-2.5">
                {(Object.keys(CHAT_THEMES) as ChatThemeId[]).map((id) => {
                  const t = CHAT_THEMES[id];
                  const isActive = selectedThemeId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        themeService.setTheme(id);
                        setSelectedThemeId(id);
                        showSavedToast(`${t.name} theme applied!`);
                      }}
                      className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        isActive
                          ? 'border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-500/30'
                          : 'border-slate-200/80 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl shrink-0 border border-black/10 flex items-center justify-center relative overflow-hidden"
                          style={{ backgroundColor: t.swatchCanvas }}
                        >
                          <span
                            className="w-4.5 h-3 rounded-md shadow-xs translate-x-1 -translate-y-1"
                            style={{ backgroundColor: t.swatchPrimary }}
                          />
                          <span
                            className={`w-4 h-2.5 rounded-md shadow-xs -translate-x-1 translate-y-1.5 ${
                              t.isDark ? 'bg-[#13261D] border border-emerald-400/20' : 'bg-white border border-black/10'
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{t.name}</p>
                          <p className="text-[11px] text-slate-500 truncate">{t.subtitle}</p>
                        </div>
                      </div>
                      {isActive && (
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Security & Lock Tab */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 font-['Outfit']">
                  App Lock & Chat Lock
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Protect DOST and individual chats with Fingerprint, Face ID, or a 4-digit PIN
                </p>
              </div>

              {/* 4-Digit PIN Setup / Update */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const clean = newPin.replace(/\D/g, '').slice(0, 4);
                  if (clean.length !== 4) return;
                  await securityService.setPin(clean);
                  setNewPin('');
                  showSavedToast(hasPin ? '4-digit PIN updated!' : '4-digit PIN saved!');
                }}
                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{hasPin ? 'Change 4-Digit Security PIN' : 'Set 4-Digit Security PIN'}</span>
                  </span>
                  {hasPin && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      PIN Active
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="Enter 4 digits (e.g. 1234)"
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 font-mono tracking-widest"
                  />
                  <button
                    type="submit"
                    disabled={newPin.length !== 4}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    {hasPin ? 'Update' : 'Save PIN'}
                  </button>
                </div>
              </form>

              {/* App Lock & Biometric Toggles */}
              <div className="space-y-3 divide-y divide-slate-100 text-xs">
                <div className="pt-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800">Lock Whole App (App Lock)</p>
                    <p className="text-[11px] text-slate-500">
                      Require Fingerprint, Face ID, or PIN whenever opening DOST
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={appLockOn}
                    onChange={async (e) => {
                      const next = e.target.checked;
                      if (next && !hasPin && !bioSupport.available) {
                        showSavedToast('Set a 4-digit PIN above first');
                        return;
                      }
                      securityService.setAppLockEnabled(next);
                      showSavedToast(next ? 'App Lock enabled!' : 'App Lock disabled');
                    }}
                    className="w-4 h-4 accent-emerald-600 cursor-pointer shrink-0"
                  />
                </div>

                <div className="pt-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <Fingerprint className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{bioSupport.label}</span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {bioSupport.available
                        ? 'Allow native Fingerprint / Face ID unlock on app & locked chats'
                        : 'Enroll biometric or use your 4-digit PIN above'}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={biometricOn}
                    onChange={async (e) => {
                      const next = e.target.checked;
                      if (next) {
                        const res = await securityService.authenticateBiometric({
                          title: 'Enable Biometric Lock',
                          subtitle: 'Verify your fingerprint or face ID',
                          userLabel: currentUser?.email,
                        });
                        if (res.success) {
                          securityService.setBiometricEnabled(true);
                          showSavedToast('Biometric unlock verified!');
                        } else {
                          showSavedToast(res.error || 'Biometric verification cancelled');
                        }
                      } else {
                        securityService.setBiometricEnabled(false);
                        showSavedToast('Biometric unlock turned off');
                      }
                    }}
                    className="w-4 h-4 accent-emerald-600 cursor-pointer shrink-0"
                  />
                </div>
              </div>

              {/* Locked Chats Status */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900">
                    Locked Chats ({lockedChatIds.length})
                  </span>
                  {lockedChatIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        lockedChatIds.forEach((id) => securityService.unlockChat(id));
                        showSavedToast('All chats unlocked');
                      }}
                      className="text-[11px] font-semibold text-emerald-700 hover:underline cursor-pointer"
                    >
                      Unlock All
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-emerald-800/80 leading-relaxed">
                  You can lock any specific chat from its chat header menu or chat list menu. Locked chats stay hidden under the &ldquo;Locked&rdquo; filter tab until unlocked with Fingerprint or PIN.
                </p>
              </div>
            </div>
          )}

          {/* Linked Devices Tab (Multi-Device Support) */}
          {activeTab === 'devices' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 font-['Outfit']">
                  Linked Devices (Multi-Device)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Use the same DOST account simultaneously on your Phone APK, Laptop Web, and Tablet
                </p>
              </div>

              {/* Link Another Device Banner */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 space-y-2">
                <p className="text-xs font-bold text-emerald-900">Link Phone, Laptop, or Tablet</p>
                <p className="text-[11px] text-emerald-800/85 leading-relaxed">
                  Open DOST on your laptop or tablet browser and sign in with{' '}
                  <span className="font-semibold">{currentUser?.email || 'your account'}</span>. All messages, polls, and groups sync instantly across all devices.
                </p>
                {typeof window !== 'undefined' && (
                  <div className="flex items-center gap-2 pt-1">
                    <code className="flex-1 px-2.5 py-1.5 rounded-xl bg-white border border-emerald-200 text-[10px] text-slate-700 truncate font-mono">
                      {window.location.origin}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(window.location.origin);
                        showSavedToast('DOST Web link copied!');
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold rounded-xl flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy Link</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Active Devices List */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700">
                  Active Sessions ({deviceSessions.length})
                </p>
                {deviceSessions.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Sign in to track connected devices in real time.
                  </p>
                ) : (
                  deviceSessions.map((sess) => {
                    const isCurrent = sess.deviceId === deviceSessionService.getCurrentDeviceId();
                    const DevIcon =
                      sess.platform === 'tablet'
                        ? Tablet
                        : sess.platform === 'desktop'
                        ? Laptop
                        : Smartphone;
                    return (
                      <div
                        key={sess.id}
                        className={`flex items-center justify-between gap-3 p-3 rounded-2xl border ${
                          isCurrent
                            ? 'border-emerald-400 bg-emerald-50/50'
                            : 'border-slate-200/80 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <DevIcon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-slate-800 truncate">
                                {sess.deviceName}
                              </p>
                              {isCurrent && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-600 text-white">
                                  This Device
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 truncate">
                              {sess.browserInfo} · Last active{' '}
                              {new Date(sess.lastActive).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>

                        {!isCurrent && (
                          <button
                            type="button"
                            onClick={async () => {
                              await deviceSessionService.revokeDeviceSession(sess.id);
                              showSavedToast(`Signed out ${sess.deviceName}`);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-[11px] font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                            title="Log out this device remotely"
                          >
                            <LogOut className="w-3 h-3" />
                            <span>Log Out</span>
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* DOST Pay (In-App Payments & Ledger) Tab */}
          {activeTab === 'payments' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 font-['Outfit']">
                  DOST Pay · In-Chat Payments
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Save your JazzCash, Easypaisa, SadaPay, NayaPay, or Raast IBAN so friends can pay you directly inside chat
                </p>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!payNumber.trim()) return;
                  await chatStore.updateProfile({
                    paymentAccount: {
                      method: payMethod,
                      accountNumber: payNumber.trim(),
                      accountTitle: payTitle.trim() || currentUser?.displayName || 'DOST User',
                      updatedAt: new Date().toISOString(),
                    },
                  });
                  showSavedToast('Receiving account saved!');
                }}
                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3"
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {(Object.keys(PAYMENT_RAILS) as PaymentMethod[]).map((id) => {
                    const rail = PAYMENT_RAILS[id];
                    const active = payMethod === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setPayMethod(id)}
                        className={`py-2 px-2 rounded-xl border text-[11px] font-bold transition-colors cursor-pointer truncate ${
                          active
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {rail.name}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Account Number / IBAN
                    </label>
                    <input
                      type="text"
                      value={payNumber}
                      onChange={(e) => setPayNumber(e.target.value)}
                      placeholder={PAYMENT_RAILS[payMethod].placeholder}
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Account Holder Title
                    </label>
                    <input
                      type="text"
                      value={payTitle}
                      onChange={(e) => setPayTitle(e.target.value)}
                      placeholder={currentUser?.displayName || 'Full Name'}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Save Receiving Wallet
                </button>
              </form>

              {/* Summary Strip */}
              {(() => {
                const myUid = currentUser?.id;
                const sentTotal = transactions
                  .filter((t) => t.senderId === myUid && (t.status === 'completed' || t.status === 'sent') && t.kind === 'send')
                  .reduce((s, t) => s + t.amount, 0);
                const receivedTotal = transactions
                  .filter((t) => t.receiverId === myUid && t.status === 'completed')
                  .reduce((s, t) => s + t.amount, 0);

                return (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
                      <p className="text-[11px] text-emerald-800 font-semibold">Total Sent</p>
                      <p className="text-base font-extrabold font-mono tabular-nums text-emerald-950 mt-0.5">
                        {formatPKR(sentTotal)}
                      </p>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <p className="text-[11px] text-slate-600 font-semibold">Total Received</p>
                      <p className="text-base font-extrabold font-mono tabular-nums text-slate-900 mt-0.5">
                        {formatPKR(receivedTotal)}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Recent Transactions */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700">
                  Recent Chat Payments ({transactions.length})
                </p>
                {transactions.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Open any chat and tap Attach → DOST Pay to send or request money.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {transactions.map((tx) => {
                      const isOutgoing =
                        (tx.senderId === currentUser?.id && tx.kind === 'send') ||
                        (tx.receiverId === currentUser?.id && tx.kind === 'request');
                      const peerName =
                        tx.senderId === currentUser?.id ? tx.receiverName : tx.senderName;
                      return (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200/80 bg-white text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                isOutgoing
                                  ? 'bg-rose-50 text-rose-600'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {isOutgoing ? (
                                <ArrowUpRight className="w-4 h-4" />
                              ) : (
                                <ArrowDownLeft className="w-4 h-4" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 truncate">{peerName}</p>
                              <p className="text-[10px] text-slate-500 truncate">
                                {PAYMENT_RAILS[tx.method]?.name || tx.method} · {tx.status} ·{' '}
                                {tx.referenceId || tx.id.slice(0, 8)}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`font-extrabold font-mono tabular-nums shrink-0 ${
                              isOutgoing ? 'text-slate-800' : 'text-emerald-700'
                            }`}
                          >
                            {isOutgoing ? '-' : '+'}
                            {formatPKR(tx.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Privacy Tab */}
          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-800 font-['Outfit']">Privacy Controls</h3>

              <div className="space-y-3 divide-y divide-slate-100 text-xs">
                <div className="pt-2 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">Last Seen & Online</p>
                    <p className="text-[11px] text-slate-500">Who can see when you are active</p>
                  </div>
                  <select
                    value={lastSeen}
                    onChange={(e) => handleSavePrivacy({ lastSeenVisibility: e.target.value as any })}
                    className="bg-slate-100 p-1.5 rounded-lg border-0 text-slate-700 font-medium cursor-pointer"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="contacts">Contacts</option>
                    <option value="nobody">Nobody</option>
                  </select>
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">Read Receipts (Blue Ticks)</p>
                    <p className="text-[11px] text-slate-500">Send read confirmations when opening chats</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={readReceipts}
                    onChange={(e) => handleSavePrivacy({ readReceipts: e.target.checked })}
                    className="w-4 h-4 accent-emerald-600 cursor-pointer"
                  />
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">Profile Photo Visibility</p>
                    <p className="text-[11px] text-slate-500">Choose who can view your profile picture</p>
                  </div>
                  <select
                    value={profileVisibility}
                    onChange={(e) => handleSavePrivacy({ profilePhotoVisibility: e.target.value as any })}
                    className="bg-slate-100 p-1.5 rounded-lg border-0 text-slate-700 font-medium cursor-pointer"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="contacts">Contacts</option>
                    <option value="nobody">Nobody</option>
                  </select>
                </div>
              </div>

              {/* Blocked Users Section */}
              <div className="mt-6 pt-4 border-t border-slate-200">
                <h4 className="text-xs font-bold text-slate-700 mb-2">
                  Blocked Contacts ({blockedUsers.length})
                </h4>
                {blockedUsers.length === 0 ? (
                  <p className="text-xs text-slate-400">No blocked contacts.</p>
                ) : (
                  <div className="space-y-1.5">
                    {blockedUsers.map((b) => (
                      <div key={b.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl text-xs">
                        <span className="font-medium text-slate-700">{b.blockedUserName}</span>
                        <button
                          onClick={() => chatStore.unblockUser(b.blockedUserId)}
                          className="text-emerald-700 hover:underline text-[11px] font-semibold cursor-pointer"
                        >
                          Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-800 font-['Outfit']">Notification Preferences</h3>

              <div className="space-y-3 divide-y divide-slate-100 text-xs">
                <div className="pt-2 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">Message Sounds</p>
                    <p className="text-[11px] text-slate-500">Play tone for sent and incoming messages</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={soundsOn}
                    onChange={(e) => handleSaveNotifications({ messageSounds: e.target.checked })}
                    className="w-4 h-4 accent-emerald-600 cursor-pointer"
                  />
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">Call Ringtones</p>
                    <p className="text-[11px] text-slate-500">Play ringtone on incoming WebRTC calls</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={ringtonesOn}
                    onChange={(e) => handleSaveNotifications({ callRingtones: e.target.checked })}
                    className="w-4 h-4 accent-emerald-600 cursor-pointer"
                  />
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">Phone Screen & In-App Alerts</p>
                    <p className="text-[11px] text-slate-500">Show heads-up popup notifications on screen for messages & calls</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={alertsOn}
                    onChange={(e) => handleSaveNotifications({ inAppAlerts: e.target.checked })}
                    className="w-4 h-4 accent-emerald-600 cursor-pointer"
                  />
                </div>

                {Capacitor.isNativePlatform() && (
                  <div className="pt-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Background Running Process</span>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Keeps DOST alive in background so calls & messages arrive instantly
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={bgRunningOn}
                      onChange={async (e) => {
                        const next = e.target.checked;
                        setBgRunningOn(next);
                        await notificationService.setBackgroundEnabled(next);
                        showSavedToast(next ? 'Background service started!' : 'Background service stopped');
                      }}
                      className="w-4 h-4 accent-emerald-600 cursor-pointer"
                    />
                  </div>
                )}
              </div>

              <div className="mt-4 p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-900">Phone Permissions & Alert Test</span>
                  {permStatus && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white text-emerald-700 border border-emerald-200">
                      {permStatus.notifications ? 'Alerts Allowed' : 'Permission Needed'}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const status = await notificationService.requestPermissions();
                      setPermStatus(status);
                      await notificationService.startBackgroundService();
                      showSavedToast('Permissions & background alerts updated!');
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold rounded-xl cursor-pointer transition-colors"
                  >
                    Allow Alerts, Mic & Camera
                  </button>

                  {Capacitor.isNativePlatform() && (
                    <button
                      type="button"
                      onClick={async () => {
                        const status = await notificationService.requestBatteryUnrestricted();
                        setPermStatus(status);
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-semibold rounded-xl inline-flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <BatteryCharging className="w-3.5 h-3.5" />
                      <span>
                        {permStatus?.batteryUnrestricted ? 'Battery Unrestricted OK' : 'Allow Background Battery'}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={async () => {
                      await notificationService.sendTestNotification();
                      showSavedToast('Test alert sent!');
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-semibold rounded-xl cursor-pointer transition-colors"
                  >
                    Send Test Alert
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* About Tab */}
          {activeTab === 'about' && (
            <div className="text-center py-2 space-y-4">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-100/50 p-2 border border-emerald-500/20 shadow-md overflow-hidden">
                <img
                  src="/assets/aistudio/download_7eb2aac4.jpeg"
                  alt="DOST Logo"
                  className="w-full h-full object-cover rounded-2xl"
                />
              </div>

              <div>
                <h3 className="text-xl font-extrabold text-slate-900 font-['Outfit']">
                  DOST MESSAGING APP
                </h3>
                <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                  Developed by Husnain Butt
                </p>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">Version 1.0</p>
              </div>

              <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                A production-grade real-time messaging web app with offline message queuing, automatic network sync, private & group chats, WebRTC voice & video calls, voice notes, and media sharing.
              </p>

              <div className="pt-2 max-w-xs mx-auto">
                <PWAInstallButton />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
