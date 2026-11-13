import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { chatStore } from '../services/chatService';
import { authService } from '../services/firebaseAuth';
import { uploadMediaFile } from '../services/storageService';
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
  const [activeTab, setActiveTab] = useState<'profile' | 'privacy' | 'notifications' | 'about'>('profile');

  // Profile state
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [phone, setPhone] = useState(currentUser?.phoneNumber || '');
  const [photoUrl, setPhotoUrl] = useState(currentUser?.photoUrl || '');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState('');

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

  // Notification state
  const [soundsOn, setSoundsOn] = useState(currentUser?.notificationSettings?.messageSounds ?? true);
  const [ringtonesOn, setRingtonesOn] = useState(currentUser?.notificationSettings?.callRingtones ?? true);
  const [alertsOn, setAlertsOn] = useState(currentUser?.notificationSettings?.inAppAlerts ?? true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const blockedUsers = chatStore.getBlockedUsers();

  useEffect(() => {
    if (isOpen && currentUser) {
      setDisplayName(currentUser.displayName || '');
      setBio(currentUser.bio || '');
      setPhone(currentUser.phoneNumber || '');
      setPhotoUrl(currentUser.photoUrl || '');
      setLastSeen(currentUser.privacySettings?.lastSeenVisibility || 'everyone');
      setReadReceipts(currentUser.privacySettings?.readReceipts ?? true);
      setProfileVisibility(currentUser.privacySettings?.profilePhotoVisibility || 'everyone');
      setSoundsOn(currentUser.notificationSettings?.messageSounds ?? true);
      setRingtonesOn(currentUser.notificationSettings?.callRingtones ?? true);
      setAlertsOn(currentUser.notificationSettings?.inAppAlerts ?? true);
    }
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
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left whitespace-nowrap ${
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
                    <p className="font-semibold text-slate-800">In-App Alerts</p>
                    <p className="text-[11px] text-slate-500">Display alert banner when notifications arrive</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={alertsOn}
                    onChange={(e) => handleSaveNotifications({ inAppAlerts: e.target.checked })}
                    className="w-4 h-4 accent-emerald-600 cursor-pointer"
                  />
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
