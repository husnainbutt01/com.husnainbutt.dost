import React, { useState, useEffect, useRef } from 'react';
import { User, Chat, CallSession } from './types';
import { chatStore } from './services/chatService';
import { authService } from './services/firebaseAuth';
import { webrtcService } from './services/webrtcService';
import { testConnection } from './services/firebase';
import { notificationService } from './services/notificationService';
import { securityService } from './services/securityService';
import { deviceSessionService } from './services/deviceSessionService';

import { SplashScreen } from './components/SplashScreen';
import { NavigationSidebar, NavigationTab } from './components/NavigationSidebar';
import { ChatList } from './components/ChatList';
import { ChatArea } from './components/ChatArea';
import { StatusStories } from './components/StatusStories';
import { CallsList } from './components/CallsList';
import { ContactsList } from './components/ContactsList';
import { AuthModal } from './components/AuthModal';
import { CallModal, IncomingCallModal } from './components/CallModal';
import { GroupModal } from './components/GroupModal';
import { SettingsModal } from './components/SettingsModal';
import { AdminModal } from './components/AdminModal';
import { NotificationsModal } from './components/NotificationsModal';
import { LockScreenModal } from './components/LockScreenModal';
import { ChannelsBroadcastModal } from './components/ChannelsBroadcastModal';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { PWAInstallButton } from './components/PWAInstallButton';
import { CheckCircle2, WifiOff, RefreshCw } from 'lucide-react';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(chatStore.getCurrentUser());
  const [chats, setChats] = useState<Chat[]>(chatStore.getChats());
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [currentTab, setCurrentTab] = useState<NavigationTab>('chats');

  // Offline / Auto-sync state
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(chatStore.getPendingCount());

  // Calling & WebRTC state
  const [callSession, setCallSession] = useState<CallSession | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);

  // Toast notice
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modals & Security state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isGroupOpen, setIsGroupOpen] = useState(false);
  const [isChannelsOpen, setIsChannelsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(
    chatStore.getUnreadNotificationsCount()
  );
  const [groupToEdit, setGroupToEdit] = useState<Chat | null>(null);
  const [isAppLocked, setIsAppLocked] = useState(() => securityService.isAppLockEnabled());
  const [pendingUnlockChat, setPendingUnlockChat] = useState<Chat | null>(null);

  const hiddenAtRef = useRef<number | null>(null);
  const lastUnlockedAtRef = useRef<number>(0);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const openChatWithLockGuard = (target: Chat, switchToChatsTab = false) => {
    if (switchToChatsTab) {
      setCurrentTab('chats');
    }
    if (securityService.isChatLocked(target.id)) {
      setPendingUnlockChat(target);
      return;
    }
    setActiveChat(target);
  };

  // Boot: Firebase Auth observer, Firestore validation, WebRTC listeners, offline auto-sync, and presence
  useEffect(() => {
    testConnection();

    webrtcService.init(
      (session) => setCallSession(session),
      (incoming) => setIncomingCall(incoming)
    );

    const unsubAuth = authService.onAuthChange(async (fbUser) => {
      if (fbUser) {
        try {
          const profile = await authService.getOrCreateUserProfile(fbUser);
          chatStore.setCurrentUser(profile);
          setCurrentUser(profile);
          if (navigator.onLine) {
            webrtcService.listenForIncomingCalls(profile.id);
          }
          deviceSessionService
            .startSessionTracking(profile.id, () => {
              showToast('Signed out remotely from another linked device.');
              deviceSessionService.stopSessionTracking();
              void authService.signOut();
            })
            .catch(() => {});
          notificationService
            .requestPermissions()
            .then(() => notificationService.startBackgroundService())
            .catch(() => {});
        } catch (err) {
          console.error('Auth profile error:', err);
        }
      } else {
        webrtcService.stopListeningForIncomingCalls();
        deviceSessionService.stopSessionTracking();
        void notificationService.stopBackgroundService();
        chatStore.setCurrentUser(null);
        setCurrentUser(null);
        setActiveChat(null);
      }
      setIsAuthChecking(false);
    });

    const handleOnline = async () => {
      setIsOnline(true);
      const user = chatStore.getCurrentUser();
      if (user) {
        webrtcService.listenForIncomingCalls(user.id);
        chatStore.updateProfile({ isOnline: true, lastSeen: 'Online' }).catch(() => {});
        const flushed = await chatStore.flushOfflineOutbox();
        if (flushed > 0) {
          showToast(`Back online — ${flushed} queued message${flushed > 1 ? 's' : ''} sent!`);
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleVisibilityChange = () => {
      const user = chatStore.getCurrentUser();
      if (document.visibilityState === 'hidden') {
        if (Date.now() - lastUnlockedAtRef.current > 3000) {
          hiddenAtRef.current = Date.now();
        }
        if (user && navigator.onLine) {
          authService.setOfflineStatus(user.id);
        }
      } else {
        if (
          securityService.isAppLockEnabled() &&
          hiddenAtRef.current &&
          Date.now() - hiddenAtRef.current > 20000 &&
          Date.now() - lastUnlockedAtRef.current > 5000
        ) {
          setIsAppLocked(true);
        }
        hiddenAtRef.current = null;
        if (user && navigator.onLine) {
          chatStore.updateProfile({ isOnline: true, lastSeen: 'Online' }).catch(() => {});
          void chatStore.flushOfflineOutbox();
        }
      }
    };

    const handleBeforeUnload = () => {
      const user = chatStore.getCurrentUser();
      if (user && navigator.onLine) {
        authService.setOfflineStatus(user.id);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubAuth();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      webrtcService.stopListeningForIncomingCalls();
      deviceSessionService.stopSessionTracking();
    };
  }, []);

  // Subscribe to reactive chatStore
  useEffect(() => {
    const syncStore = () => {
      const user = chatStore.getCurrentUser();
      setCurrentUser(user);
      const updatedChats = chatStore.getChats();
      setChats(updatedChats);
      setPendingCount(chatStore.getPendingCount());
      setUnreadNotificationsCount(chatStore.getUnreadNotificationsCount());
      if (activeChat) {
        const refreshed = updatedChats.find((c) => c.id === activeChat.id);
        if (refreshed) setActiveChat(refreshed);
      }
    };
    syncStore();
    return chatStore.subscribe(syncStore);
  }, [activeChat?.id]);

  // Keep chatStore informed of currently open chat so incoming messages mark read automatically
  useEffect(() => {
    chatStore.setActiveChatId(activeChat?.id || null);
  }, [activeChat?.id]);

  // Handle native notification taps & incoming call Answer/Decline actions from lockscreen/background
  useEffect(() => {
    return notificationService.bindActionListeners((payload) => {
      if (payload.action === 'open_chat' && payload.chatId) {
        const target = chatStore.getChat(payload.chatId);
        if (target) {
          openChatWithLockGuard(target, true);
        }
      } else if (payload.action === 'answer_call') {
        void webrtcService.answerCallById(payload.callId);
      } else if (payload.action === 'decline_call' && payload.callId) {
        void webrtcService.rejectCall(payload.callId);
      }
    });
  }, []);

  // Android native hardware Back button handling
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listenerPromise = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (pendingUnlockChat) {
        setPendingUnlockChat(null);
      } else if (isAdminOpen) {
        setIsAdminOpen(false);
      } else if (isSettingsOpen) {
        setIsSettingsOpen(false);
      } else if (isNotificationsOpen) {
        setIsNotificationsOpen(false);
      } else if (isChannelsOpen) {
        setIsChannelsOpen(false);
      } else if (isGroupOpen) {
        setIsGroupOpen(false);
      } else if (isAuthOpen && currentUser && currentUser.isProfileComplete !== false) {
        setIsAuthOpen(false);
      } else if (activeChat) {
        setActiveChat(null);
      } else if (currentTab !== 'chats') {
        setCurrentTab('chats');
      } else if (canGoBack) {
        window.history.back();
      } else {
        CapApp.exitApp();
      }
    });
    return () => {
      listenerPromise.then((h) => h.remove()).catch(() => {});
    };
  }, [
    pendingUnlockChat,
    isAdminOpen,
    isSettingsOpen,
    isNotificationsOpen,
    isChannelsOpen,
    isGroupOpen,
    isAuthOpen,
    currentUser,
    activeChat,
    currentTab,
  ]);

  const handleStartVoiceCall = (partner: User) => {
    if (!currentUser) {
      setIsAuthOpen(true);
      return;
    }
    if (!isOnline) {
      showToast('Calls require an active internet connection.');
      return;
    }
    webrtcService.startCall({
      receiverId: partner.id,
      receiverName: partner.displayName,
      receiverPhoto: partner.photoUrl,
      type: 'audio',
      callerId: currentUser.id,
      callerName: currentUser.displayName,
      callerPhoto: currentUser.photoUrl,
    });
  };

  const handleStartVideoCall = (partner: User) => {
    if (!currentUser) {
      setIsAuthOpen(true);
      return;
    }
    if (!isOnline) {
      showToast('Video calls require an active internet connection.');
      return;
    }
    webrtcService.startCall({
      receiverId: partner.id,
      receiverName: partner.displayName,
      receiverPhoto: partner.photoUrl,
      type: 'video',
      callerId: currentUser.id,
      callerName: currentUser.displayName,
      callerPhoto: currentUser.photoUrl,
    });
  };

  const handleSelectUserToChat = async (partner: User) => {
    if (!currentUser) {
      setIsAuthOpen(true);
      return;
    }
    const chat = await chatStore.createOrGetPrivateChat(partner.id);
    openChatWithLockGuard(chat, true);
  };

  const handleSignOut = async () => {
    deviceSessionService.stopSessionTracking();
    await authService.signOut();
    chatStore.setCurrentUser(null);
    setCurrentUser(null);
    setActiveChat(null);
    setIsAuthOpen(true);
  };

  const totalUnreadCount = chats.reduce((acc, c) => acc + chatStore.getUnreadCountForChat(c.id), 0);
  const needsProfileSetup = Boolean(currentUser && currentUser.isProfileComplete === false);
  const shouldForceAuthModal = !showSplash && !isAuthChecking && (!currentUser || needsProfileSetup);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* 1. Auto-transitioning WhatsApp-style Splash Screen */}
      {showSplash && <SplashScreen onDismiss={() => setShowSplash(false)} />}

      {/* Floating App Toast */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Subtle Offline / Auto-Sync Indicator Pill */}
      {(!isOnline || pendingCount > 0) && !showSplash && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 rounded-full shadow-lg text-[11px] font-semibold flex items-center gap-2 bg-amber-500 text-white">
          {!isOnline ? (
            <>
              <WifiOff className="w-3.5 h-3.5 shrink-0" />
              <span>
                Offline Mode{pendingCount > 0 ? ` · ${pendingCount} queued (auto-sends online)` : ' · Cached chats active'}
              </span>
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>Syncing {pendingCount} queued message{pendingCount > 1 ? 's' : ''}...</span>
            </>
          )}
        </div>
      )}

      {/* Install PWA Prompt (bottom-right subtle card when installable and Settings closed) */}
      {!showSplash && currentUser && (
        <div className="hidden md:block fixed bottom-4 right-4 z-30 max-w-xs">
          <PWAInstallButton />
        </div>
      )}

      {/* 2. Main Navigation Sidebar */}
      <NavigationSidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (tab === 'settings') {
            setIsSettingsOpen(true);
          } else {
            setCurrentTab(tab);
          }
        }}
        currentUser={currentUser}
        unreadTotal={totalUnreadCount}
        unreadNotificationsCount={unreadNotificationsCount}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenAuthModal={() => setIsAuthOpen(true)}
      />

      {/* 3. Primary Content Area */}
      <div className="flex-1 flex h-full overflow-hidden relative">
        {/* TAB: CHATS */}
        {currentTab === 'chats' && (
          <div className="flex w-full h-full">
            <div className={`w-full md:w-auto h-full ${activeChat ? 'hidden md:flex' : 'flex'}`}>
              <ChatList
                chats={chats}
                activeChatId={activeChat?.id || null}
                onSelectChat={(chat) => openChatWithLockGuard(chat)}
                onSelectUserToChat={handleSelectUserToChat}
                currentUser={currentUser}
                onNewChat={() => setCurrentTab('contacts')}
                onNewGroup={() => {
                  if (!currentUser) {
                    setIsAuthOpen(true);
                    return;
                  }
                  setGroupToEdit(null);
                  setIsGroupOpen(true);
                }}
                onOpenChannelsBroadcast={() => {
                  if (!currentUser) {
                    setIsAuthOpen(true);
                    return;
                  }
                  setIsChannelsOpen(true);
                }}
              />
            </div>

            <div className={`flex-1 h-full ${activeChat ? 'flex' : 'hidden md:flex'}`}>
              <ChatArea
                chat={activeChat}
                currentUser={currentUser}
                onBack={() => setActiveChat(null)}
                onStartVoiceCall={handleStartVoiceCall}
                onStartVideoCall={handleStartVideoCall}
                onOpenGroupInfo={(chat) => {
                  setGroupToEdit(chat);
                  setIsGroupOpen(true);
                }}
                onReportSubmitted={(partnerName) => {
                  showToast(`Report submitted for ${partnerName}.`);
                }}
              />
            </div>
          </div>
        )}

        {/* TAB: STORIES / STATUS */}
        {currentTab === 'stories' && (
          <StatusStories
            currentUser={currentUser}
            onOpenStoryChat={(targetUserId) => {
              if (!currentUser) {
                setIsAuthOpen(true);
                return;
              }
              chatStore.createOrGetPrivateChat(targetUserId).then((chat) => {
                openChatWithLockGuard(chat, true);
              });
            }}
          />
        )}

        {/* TAB: CALLS LOGS */}
        {currentTab === 'calls' && (
          <CallsList
            currentUser={currentUser}
            onStartVoiceCall={handleStartVoiceCall}
            onStartVideoCall={handleStartVideoCall}
          />
        )}

        {/* TAB: REAL USERS CONTACTS DIRECTORY */}
        {currentTab === 'contacts' && (
          <ContactsList
            currentUser={currentUser}
            onSelectUserToChat={handleSelectUserToChat}
            onStartVoiceCall={handleStartVoiceCall}
            onStartVideoCall={handleStartVideoCall}
          />
        )}
      </div>

      {/* 4. Incoming Call Banner & Active WebRTC Call Modal */}
      <IncomingCallModal
        incomingCall={incomingCall}
        onAccept={(call) => webrtcService.answerCall(call)}
        onReject={(callId) => webrtcService.rejectCall(callId)}
      />

      <CallModal
        session={callSession}
        currentUserId={currentUser?.id}
        onEndCall={() => webrtcService.endCall()}
      />

      {/* 5. One-Time Registration & Authentication Modal */}
      <AuthModal
        isOpen={isAuthOpen || shouldForceAuthModal}
        isRequired={!currentUser || needsProfileSetup}
        needsProfileSetup={needsProfileSetup}
        onClose={() => setIsAuthOpen(false)}
        currentUser={currentUser}
        onUserChanged={(u) => {
          setCurrentUser(u);
          if (u.isProfileComplete !== false) {
            setIsAuthOpen(false);
          }
          const userChats = chatStore.getChats();
          setChats(userChats);
          if (!activeChat && userChats.length > 0) {
            setActiveChat(userChats[0]);
          }
        }}
      />

      {/* 6. Group Creation & Management Modal */}
      {currentUser && (
        <GroupModal
          isOpen={isGroupOpen}
          onClose={() => setIsGroupOpen(false)}
          currentUser={currentUser}
          existingChat={groupToEdit}
          onGroupCreated={(newChat) => {
            setActiveChat(newChat);
            setCurrentTab('chats');
          }}
          onGroupLeft={() => {
            setActiveChat(null);
            showToast('You left the group.');
          }}
        />
      )}

      {/* 6B. Channels & Broadcast Lists Modal */}
      {currentUser && (
        <ChannelsBroadcastModal
          isOpen={isChannelsOpen}
          onClose={() => setIsChannelsOpen(false)}
          currentUser={currentUser}
          onOpenChat={(c) => {
            openChatWithLockGuard(c, true);
          }}
        />
      )}

      {/* 7. Settings & Privacy Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUser={currentUser}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onSignOut={handleSignOut}
      />

      {/* 8. Admin Dashboard Modal */}
      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        currentUser={currentUser}
      />

      {/* 9. Notifications Center Modal */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onOpenChat={(chatId) => {
          const target = chatStore.getChat(chatId);
          if (target) {
            openChatWithLockGuard(target, true);
          }
        }}
      />

      {/* 10. Biometric / PIN App Lock & Chat Lock Screen */}
      <LockScreenModal
        isOpen={!showSplash && isAppLocked}
        mode="app"
        userLabel={currentUser?.email}
        onUnlocked={() => {
          lastUnlockedAtRef.current = Date.now();
          setIsAppLocked(false);
        }}
      />

      <LockScreenModal
        isOpen={!showSplash && !isAppLocked && Boolean(pendingUnlockChat)}
        mode="chat"
        title={pendingUnlockChat?.name || 'Locked Chat'}
        subtitle="Verify Fingerprint, Face ID, or PIN to open this locked chat"
        userLabel={currentUser?.email}
        onUnlocked={() => {
          lastUnlockedAtRef.current = Date.now();
          if (pendingUnlockChat) {
            setActiveChat(pendingUnlockChat);
            setCurrentTab('chats');
          }
          setPendingUnlockChat(null);
        }}
        onCancel={() => setPendingUnlockChat(null)}
      />
    </div>
  );
}
