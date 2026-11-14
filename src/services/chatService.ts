import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  User,
  Chat,
  Message,
  NotificationItem,
  BlockedUser,
  Report,
  Story,
  CallSession,
  PollData,
  PaymentData,
  PaymentMethod,
} from '../types';
import { sounds } from '../utils/soundEffects';
import { notificationService } from './notificationService';
import { formatPKR, generatePaymentRef, paymentService } from './paymentService';

interface OutboxEntry {
  message: Message;
  preview: string;
  chatTitle: string;
}

const OUTBOX_KEY = (uid: string) => `dost_offline_outbox_${uid}`;
const CACHE_KEY = (uid: string, kind: 'users' | 'chats' | 'messages') => `dost_cache_${kind}_${uid}`;

class ChatStore {
  private users: User[] = [];
  private chats: Chat[] = [];
  private publicChannels: Chat[] = [];
  private messages: Message[] = [];
  private publicChannelMessages: Message[] = [];
  private outbox: OutboxEntry[] = [];
  private stories: Story[] = [];
  private blockedUsers: BlockedUser[] = [];
  private notifications: NotificationItem[] = [];
  private reports: Report[] = [];
  private callLogs: CallSession[] = [];
  private hiddenMessageIds: Set<string> = new Set();
  private currentUser: User | null = null;
  private activeChatId: string | null = null;
  private listeners: (() => void)[] = [];

  private unsubs: (() => void)[] = [];
  private initialMessagesLoaded = false;
  private isFlushingOutbox = false;
  private onlineListenerBound = false;
  private retryIntervalId: number | null = null;

  constructor() {
    if (typeof window !== 'undefined' && !this.onlineListenerBound) {
      this.onlineListenerBound = true;
      window.addEventListener('online', () => {
        void this.flushOfflineOutbox();
      });
      this.retryIntervalId = window.setInterval(() => {
        if (navigator.onLine && this.outbox.length > 0 && this.currentUser) {
          void this.flushOfflineOutbox();
        }
      }, 8000);
    }
  }

  private loadLocalCaches(userId: string) {
    try {
      const u = localStorage.getItem(CACHE_KEY(userId, 'users'));
      if (u) this.users = JSON.parse(u) as User[];
      const c = localStorage.getItem(CACHE_KEY(userId, 'chats'));
      if (c) this.chats = JSON.parse(c) as Chat[];
      const m = localStorage.getItem(CACHE_KEY(userId, 'messages'));
      if (m) this.messages = JSON.parse(m) as Message[];
      const o = localStorage.getItem(OUTBOX_KEY(userId));
      if (o) this.outbox = JSON.parse(o) as OutboxEntry[];
      const h = localStorage.getItem(`dost_hidden_msgs_${userId}`);
      if (h) this.hiddenMessageIds = new Set(JSON.parse(h) as string[]);
    } catch {}
  }

  private saveHiddenMessages() {
    if (!this.currentUser) return;
    try {
      localStorage.setItem(
        `dost_hidden_msgs_${this.currentUser.id}`,
        JSON.stringify(Array.from(this.hiddenMessageIds))
      );
    } catch {}
  }

  private saveCache(userId: string, kind: 'users' | 'chats' | 'messages', data: unknown) {
    try {
      // Keep last 400 messages cached locally for instant offline startup
      const payload = kind === 'messages' && Array.isArray(data) ? data.slice(-400) : data;
      localStorage.setItem(CACHE_KEY(userId, kind), JSON.stringify(payload));
    } catch {}
  }

  private saveOutbox() {
    if (!this.currentUser) return;
    try {
      localStorage.setItem(OUTBOX_KEY(this.currentUser.id), JSON.stringify(this.outbox));
    } catch {}
  }

  getPendingCount(): number {
    return this.outbox.length;
  }

  setActiveChatId(chatId: string | null) {
    this.activeChatId = chatId;
    if (chatId && this.currentUser) {
      this.markChatMessagesAsRead(chatId);
    }
  }

  setCurrentUser(user: User | null) {
    const prevUid = this.currentUser?.id;
    this.currentUser = user;

    if (user) {
      if (prevUid !== user.id) {
        this.loadLocalCaches(user.id);
        this.initFirestoreListeners(user.id);
        paymentService.startListening(user.id);
        if (typeof navigator !== 'undefined' && navigator.onLine && this.outbox.length > 0) {
          void this.flushOfflineOutbox();
        }
      }
    } else {
      this.cleanupListeners();
      paymentService.stopListening();
      this.users = [];
      this.chats = [];
      this.publicChannels = [];
      this.messages = [];
      this.publicChannelMessages = [];
      this.outbox = [];
      this.stories = [];
      this.blockedUsers = [];
      this.notifications = [];
      this.reports = [];
      this.callLogs = [];
      this.hiddenMessageIds = new Set();
      this.activeChatId = null;
      this.initialMessagesLoaded = false;
    }
    this.notify();
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  initFirestoreListeners(userId: string) {
    this.cleanupListeners();
    this.initialMessagesLoaded = false;

    // 1. All real registered users
    try {
      const usersQuery = query(collection(db, 'users'));
      const unsub = onSnapshot(
        usersQuery,
        (snapshot) => {
          const fetchedUsers: User[] = [];
          snapshot.forEach((d) => {
            fetchedUsers.push(d.data() as User);
          });
          if (fetchedUsers.length > 0) {
            this.users = fetchedUsers;
            this.saveCache(userId, 'users', fetchedUsers);
            const me = fetchedUsers.find((u) => u.id === userId);
            if (me) {
              this.currentUser = me;
            }
          }
          this.notify();
        },
        (err) => {
          console.warn('Users snapshot:', err.message);
        }
      );
      this.unsubs.push(unsub);
    } catch {}

    // 2. Chats where current user is a participant
    try {
      const chatsQuery = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', userId)
      );
      const unsub = onSnapshot(
        chatsQuery,
        (snapshot) => {
          const fetchedChats: Chat[] = [];
          snapshot.forEach((d) => {
            fetchedChats.push(d.data() as Chat);
          });
          this.chats = fetchedChats.sort((a, b) => {
            const tA = new Date(a.lastMessageTime || a.createdAt).getTime();
            const tB = new Date(b.lastMessageTime || b.createdAt).getTime();
            return tB - tA;
          });
          this.saveCache(userId, 'chats', this.chats);
          this.notify();
        },
        (err) => {
          console.warn('Chats snapshot:', err.message);
        }
      );
      this.unsubs.push(unsub);
    } catch {}

    // 3. Messages where current user is a participant (sorted in JS)
    try {
      const messagesQuery = query(
        collection(db, 'messages'),
        where('participants', 'array-contains', userId)
      );
      const unsub = onSnapshot(
        messagesQuery,
        (snapshot) => {
          const fetchedMessages: Message[] = [];
          const newIncomingMessages: Message[] = [];

          snapshot.forEach((d) => {
            const msg = d.data() as Message;
            fetchedMessages.push(msg);

            if (
              this.initialMessagesLoaded &&
              !this.messages.some((m) => m.id === msg.id) &&
              msg.senderId !== userId &&
              !msg.isDeleted
            ) {
              newIncomingMessages.push(msg);
            }

            if (msg.senderId !== userId && !msg.isDeleted) {
              const readBy = msg.readBy || [];
              const deliveredTo = msg.deliveredTo || [];
              const allowReceipts = this.currentUser?.privacySettings?.readReceipts !== false;

              if (this.activeChatId === msg.chatId && !readBy.includes(userId) && allowReceipts) {
                updateDoc(doc(db, 'messages', msg.id), {
                  status: 'read',
                  readBy: arrayUnion(userId),
                  deliveredTo: arrayUnion(userId),
                }).catch(() => {});
              } else if (msg.status === 'sent' && !deliveredTo.includes(userId)) {
                updateDoc(doc(db, 'messages', msg.id), {
                  status: 'delivered',
                  deliveredTo: arrayUnion(userId),
                }).catch(() => {});
              }
            }
          });

          fetchedMessages.sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          this.messages = fetchedMessages;
          this.saveCache(userId, 'messages', fetchedMessages);
          this.initialMessagesLoaded = true;

          // Remove any outbox item that already landed in Firestore
          const syncedIds = new Set(fetchedMessages.map((m) => m.id));
          if (this.outbox.some((entry) => syncedIds.has(entry.message.id))) {
            this.outbox = this.outbox.filter((entry) => !syncedIds.has(entry.message.id));
            this.saveOutbox();
          }

          if (newIncomingMessages.length > 0) {
            const unmutedIncoming = newIncomingMessages.filter((m) => {
              const chat = this.getChat(m.chatId);
              const isMuted = (chat?.mutedBy || []).includes(userId);
              const isBlocked = this.isUserBlocked(m.senderId);
              return !isMuted && !isBlocked;
            });

            if (unmutedIncoming.length > 0) {
              if (this.currentUser?.notificationSettings?.messageSounds !== false) {
                sounds.playMessageReceived();
              }

              if (this.currentUser?.notificationSettings?.inAppAlerts !== false) {
                const showPreview = this.currentUser?.notificationSettings?.previewMessage !== false;
                const latestMsg = unmutedIncoming[unmutedIncoming.length - 1];
                const chat = this.getChat(latestMsg.chatId);
                const senderLabel = latestMsg.senderName || 'DOST User';
                const title =
                  chat?.type === 'group'
                    ? `${senderLabel} · ${chat.name || 'Group'}`
                    : senderLabel;
                const previewText = showPreview
                  ? latestMsg.text ||
                    (latestMsg.type === 'image'
                      ? 'Sent a photo'
                      : latestMsg.type === 'video'
                      ? 'Sent a video'
                      : latestMsg.type === 'audio'
                      ? 'Sent a voice message'
                      : latestMsg.type === 'document'
                      ? `Document: ${latestMsg.fileName || 'File'}`
                      : latestMsg.type === 'payment' && latestMsg.payment
                      ? latestMsg.payment.kind === 'send'
                        ? `Sent ${formatPKR(latestMsg.payment.amount)}`
                        : `Requested ${formatPKR(latestMsg.payment.amount)}`
                      : 'New message')
                  : 'New message received';

                void notificationService.notifyIncomingMessage({
                  messageId: latestMsg.id,
                  chatId: latestMsg.chatId,
                  title,
                  body: previewText,
                  senderName: senderLabel,
                  isActiveChat: this.activeChatId === latestMsg.chatId,
                });
              }
            }
          }
          this.notify();
        },
        (err) => {
          console.warn('Messages snapshot:', err.message);
        }
      );
      this.unsubs.push(unsub);
    } catch {}

    // 4. Stories
    try {
      const storiesQuery = query(collection(db, 'stories'));
      const unsub = onSnapshot(
        storiesQuery,
        (snapshot) => {
          const now = Date.now();
          const fetchedStories: Story[] = [];
          snapshot.forEach((d) => {
            const s = d.data() as Story;
            if (new Date(s.expiresAt).getTime() > now) {
              fetchedStories.push(s);
            }
          });
          fetchedStories.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          this.stories = fetchedStories;
          this.notify();
        },
        () => {}
      );
      this.unsubs.push(unsub);
    } catch {}

    // 5. Blocked users
    try {
      const blockedQuery = query(collection(db, 'blocked_users'), where('userId', '==', userId));
      const unsub = onSnapshot(
        blockedQuery,
        (snapshot) => {
          const fetched: BlockedUser[] = [];
          snapshot.forEach((d) => fetched.push(d.data() as BlockedUser));
          this.blockedUsers = fetched;
          this.notify();
        },
        () => {}
      );
      this.unsubs.push(unsub);
    } catch {}

    // 6. Notifications
    try {
      const notifQuery = query(collection(db, 'notifications'), where('userId', '==', userId));
      const unsub = onSnapshot(
        notifQuery,
        (snapshot) => {
          const fetched: NotificationItem[] = [];
          snapshot.forEach((d) => fetched.push(d.data() as NotificationItem));
          fetched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          this.notifications = fetched;
          this.notify();
        },
        () => {}
      );
      this.unsubs.push(unsub);
    } catch {}

    // 7. Call logs
    try {
      let outgoingCalls: CallSession[] = [];
      let incomingCalls: CallSession[] = [];
      const mergeCalls = () => {
        const map = new Map<string, CallSession>();
        [...outgoingCalls, ...incomingCalls].forEach((c) => map.set(c.id, c));
        this.callLogs = Array.from(map.values()).sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        this.notify();
      };

      const unsubOut = onSnapshot(query(collection(db, 'calls'), where('callerId', '==', userId)), (snap) => {
        outgoingCalls = snap.docs.map((d) => d.data() as CallSession);
        mergeCalls();
      });
      const unsubIn = onSnapshot(query(collection(db, 'calls'), where('receiverId', '==', userId)), (snap) => {
        incomingCalls = snap.docs.map((d) => d.data() as CallSession);
        mergeCalls();
      });
      this.unsubs.push(unsubOut, unsubIn);
    } catch {}

    // 8. Reports
    try {
      const reportsQuery =
        this.currentUser?.role === 'admin'
          ? query(collection(db, 'reports'))
          : query(collection(db, 'reports'), where('reporterId', '==', userId));
      const unsub = onSnapshot(
        reportsQuery,
        (snapshot) => {
          const fetched: Report[] = [];
          snapshot.forEach((d) => fetched.push(d.data() as Report));
          this.reports = fetched;
          this.notify();
        },
        () => {}
      );
      this.unsubs.push(unsub);
    } catch {}

    // 9. Discoverable Public Channels & Channel Posts
    try {
      const pubChannelsQuery = query(
        collection(db, 'chats'),
        where('type', '==', 'channel'),
        where('isPublic', '==', true)
      );
      const unsubCh = onSnapshot(
        pubChannelsQuery,
        (snapshot) => {
          const list: Chat[] = [];
          snapshot.forEach((d) => list.push(d.data() as Chat));
          this.publicChannels = list.sort((a, b) => (b.participants?.length || 0) - (a.participants?.length || 0));
          this.notify();
        },
        () => {}
      );
      this.unsubs.push(unsubCh);

      const pubMsgsQuery = query(
        collection(db, 'messages'),
        where('isPublicChannel', '==', true)
      );
      const unsubPubMsgs = onSnapshot(
        pubMsgsQuery,
        (snapshot) => {
          const list: Message[] = [];
          snapshot.forEach((d) => list.push(d.data() as Message));
          list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          this.publicChannelMessages = list;
          this.notify();
        },
        () => {}
      );
      this.unsubs.push(unsubPubMsgs);
    } catch {}
  }

  cleanupListeners() {
    this.unsubs.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
    this.unsubs = [];
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  getUsers(): User[] {
    return this.users;
  }

  getUser(userId: string): User | undefined {
    return this.users.find((u) => u.id === userId);
  }

  async updateProfile(updates: Partial<User>) {
    if (!this.currentUser) return;
    const updatedUser: User = {
      ...this.currentUser,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.currentUser = updatedUser;
    this.users = this.users.map((u) => (u.id === updatedUser.id ? updatedUser : u));
    this.saveCache(updatedUser.id, 'users', this.users);
    try {
      localStorage.setItem(`dost_cached_user_${updatedUser.id}`, JSON.stringify(updatedUser));
    } catch {}
    this.notify();

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setDoc(doc(db, 'users', updatedUser.id), updatedUser, { merge: true }).catch(() => {});
      return;
    }

    try {
      await setDoc(doc(db, 'users', updatedUser.id), updatedUser, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${updatedUser.id}`);
    }
  }

  getChats(includeArchived = false): Chat[] {
    if (!this.currentUser) return [];
    const myUid = this.currentUser.id;

    // Reflect latest pending outbox message preview in chat list
    const chatsWithOptimistic = this.chats.map((c) => {
      const pendingForChat = this.outbox.filter((e) => e.message.chatId === c.id);
      if (pendingForChat.length === 0) return c;
      const latestPending = pendingForChat[pendingForChat.length - 1];
      return {
        ...c,
        lastMessage: latestPending.preview,
        lastMessageTime: latestPending.message.createdAt,
        lastSenderId: latestPending.message.senderId,
      };
    });

    return chatsWithOptimistic
      .filter((c) => {
        if (!c.participants.includes(myUid)) return false;
        const isArchived = (c.archivedBy || []).includes(myUid);
        return includeArchived ? isArchived : !isArchived;
      })
      .sort((a, b) => {
        const aPinned = (a.pinnedBy || []).includes(myUid);
        const bPinned = (b.pinnedBy || []).includes(myUid);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        const timeA = new Date(a.lastMessageTime || a.createdAt).getTime();
        const timeB = new Date(b.lastMessageTime || b.createdAt).getTime();
        return timeB - timeA;
      });
  }

  getAllUserChats(): Chat[] {
    if (!this.currentUser) return [];
    return this.chats.filter((c) => c.participants.includes(this.currentUser!.id));
  }

  getChat(chatId: string): Chat | undefined {
    return this.chats.find((c) => c.id === chatId);
  }

  getUnreadCountForChat(chatId: string): number {
    if (!this.currentUser) return 0;
    const myUid = this.currentUser.id;
    return this.messages.filter(
      (m) =>
        m.chatId === chatId &&
        !this.hiddenMessageIds.has(m.id) &&
        m.senderId !== myUid &&
        !m.isDeleted &&
        !(m.readBy || []).includes(myUid)
    ).length;
  }

  async createOrGetPrivateChat(targetUserId: string): Promise<Chat> {
    if (!this.currentUser) throw new Error('Must be registered to start chat');
    const myUid = this.currentUser.id;

    const existing = this.chats.find(
      (c) =>
        c.type === 'private' &&
        c.participants.includes(myUid) &&
        c.participants.includes(targetUserId)
    );
    if (existing) return existing;

    const chatId = `chat_${[myUid, targetUserId].sort().join('_')}`;
    const newChat: Chat = {
      id: chatId,
      type: 'private',
      participants: [myUid, targetUserId],
      lastMessage: '',
      lastMessageTime: new Date().toISOString(),
      lastSenderId: myUid,
      pinnedBy: [],
      mutedBy: [],
      archivedBy: [],
      typingUsers: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.chats = [newChat, ...this.chats];
    this.saveCache(myUid, 'chats', this.chats);
    this.notify();

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setDoc(doc(db, 'chats', chatId), newChat).catch(() => {});
      return newChat;
    }

    try {
      await setDoc(doc(db, 'chats', chatId), newChat);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `chats/${chatId}`);
    }

    return newChat;
  }

  async createGroup(name: string, description: string, memberIds: string[], photoUrl?: string): Promise<Chat> {
    if (!this.currentUser) throw new Error('Must be registered to create group');
    const myUid = this.currentUser.id;
    const allMembers = Array.from(new Set([myUid, ...memberIds]));
    const groupId = `group_${Date.now()}`;

    const newChat: Chat = {
      id: groupId,
      type: 'group',
      name,
      description,
      photoUrl: photoUrl || '/assets/aistudio/download_7eb2aac4.jpeg',
      participants: allMembers,
      adminIds: [myUid],
      createdBy: myUid,
      lastMessage: `Group created by ${this.currentUser.displayName}`,
      lastMessageTime: new Date().toISOString(),
      lastSenderId: myUid,
      pinnedBy: [],
      mutedBy: [],
      archivedBy: [],
      typingUsers: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'chats', groupId), newChat);
      await setDoc(doc(db, 'groups', groupId), {
        id: groupId,
        name,
        description,
        photoUrl: newChat.photoUrl,
        createdBy: myUid,
        adminIds: [myUid],
        memberIds: allMembers,
        createdAt: newChat.createdAt,
        updatedAt: newChat.createdAt,
      });

      await this.sendMessage({
        chatId: groupId,
        participants: allMembers,
        text: `${this.currentUser.displayName} created group "${name}"`,
        type: 'text',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `groups/${groupId}`);
    }

    return newChat;
  }

  async updateGroup(
    groupId: string,
    updates: {
      name: string;
      description: string;
      participants: string[];
      adminIds?: string[];
      photoUrl?: string;
      onlyAdminsCanMessage?: boolean;
      onlyAdminsCanEdit?: boolean;
    }
  ) {
    if (!this.currentUser) return;
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'chats', groupId), {
        name: updates.name,
        description: updates.description,
        participants: updates.participants,
        ...(updates.adminIds ? { adminIds: updates.adminIds } : {}),
        ...(updates.photoUrl ? { photoUrl: updates.photoUrl } : {}),
        ...(updates.onlyAdminsCanMessage !== undefined
          ? { onlyAdminsCanMessage: updates.onlyAdminsCanMessage }
          : {}),
        ...(updates.onlyAdminsCanEdit !== undefined
          ? { onlyAdminsCanEdit: updates.onlyAdminsCanEdit }
          : {}),
        updatedAt: now,
      });
      await updateDoc(doc(db, 'groups', groupId), {
        name: updates.name,
        description: updates.description,
        memberIds: updates.participants,
        ...(updates.adminIds ? { adminIds: updates.adminIds } : {}),
        ...(updates.photoUrl ? { photoUrl: updates.photoUrl } : {}),
        updatedAt: now,
      }).catch(() => {});
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `groups/${groupId}`);
    }
  }

  getPublicChannels(): Chat[] {
    return this.publicChannels;
  }

  async createChannel(
    name: string,
    description: string,
    isPublic: boolean,
    photoUrl?: string
  ): Promise<Chat> {
    if (!this.currentUser) throw new Error('Must be logged in to create a channel');
    const myUid = this.currentUser.id;
    const channelId = `channel_${Date.now()}`;
    const now = new Date().toISOString();

    const newChannel: Chat = {
      id: channelId,
      type: 'channel',
      name: name.trim(),
      description: description.trim(),
      photoUrl: photoUrl || '/assets/aistudio/download_7eb2aac4.jpeg',
      participants: [myUid],
      adminIds: [myUid],
      createdBy: myUid,
      isPublic,
      onlyAdminsCanMessage: true,
      onlyAdminsCanEdit: true,
      lastMessage: `Channel "${name.trim()}" created`,
      lastMessageTime: now,
      lastSenderId: myUid,
      pinnedBy: [],
      mutedBy: [],
      archivedBy: [],
      typingUsers: {},
      createdAt: now,
      updatedAt: now,
    };

    try {
      await setDoc(doc(db, 'chats', channelId), newChannel);
      await this.sendMessage({
        chatId: channelId,
        participants: [myUid],
        text: `Welcome to ${name.trim()}! Official updates & announcements will appear here.`,
        type: 'text',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `chats/${channelId}`);
    }

    return newChannel;
  }

  async joinChannel(channelId: string) {
    if (!this.currentUser) return;
    try {
      await updateDoc(doc(db, 'chats', channelId), {
        participants: arrayUnion(this.currentUser.id),
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `chats/${channelId}`);
    }
  }

  async leaveChannel(channelId: string) {
    if (!this.currentUser) return;
    try {
      await updateDoc(doc(db, 'chats', channelId), {
        participants: arrayRemove(this.currentUser.id),
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `chats/${channelId}`);
    }
  }

  async createBroadcastList(name: string, recipientIds: string[]): Promise<Chat> {
    if (!this.currentUser) throw new Error('Must be logged in to create a broadcast list');
    const myUid = this.currentUser.id;
    const allMembers = Array.from(new Set([myUid, ...recipientIds]));
    const broadcastId = `broadcast_${Date.now()}`;
    const now = new Date().toISOString();

    const newBroadcast: Chat = {
      id: broadcastId,
      type: 'broadcast',
      name: name.trim(),
      description: `Broadcast list · ${recipientIds.length} recipients`,
      photoUrl: '/assets/aistudio/download_7eb2aac4.jpeg',
      participants: allMembers,
      adminIds: [myUid],
      createdBy: myUid,
      onlyAdminsCanMessage: true,
      lastMessage: `Broadcast list ready (${recipientIds.length} recipients)`,
      lastMessageTime: now,
      lastSenderId: myUid,
      pinnedBy: [],
      mutedBy: [],
      archivedBy: [],
      typingUsers: {},
      createdAt: now,
      updatedAt: now,
    };

    try {
      await setDoc(doc(db, 'chats', broadcastId), newBroadcast);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `chats/${broadcastId}`);
    }

    return newBroadcast;
  }

  async leaveGroup(groupId: string) {
    if (!this.currentUser) return;
    const myUid = this.currentUser.id;
    const myName = this.currentUser.displayName;
    const chat = this.getChat(groupId);
    if (!chat) return;

    const remainingParticipants = chat.participants.filter((id) => id !== myUid);
    const remainingAdmins = (chat.adminIds || []).filter((id) => id !== myUid);
    if (remainingAdmins.length === 0 && remainingParticipants.length > 0) {
      remainingAdmins.push(remainingParticipants[0]);
    }

    try {
      await this.sendMessage({
        chatId: groupId,
        participants: chat.participants,
        text: `${myName} left the group`,
        type: 'text',
      });
    } catch {}

    this.chats = this.chats.filter((c) => c.id !== groupId);
    this.notify();

    try {
      if (remainingParticipants.length === 0) {
        await deleteDoc(doc(db, 'chats', groupId));
      } else {
        await updateDoc(doc(db, 'chats', groupId), {
          participants: remainingParticipants,
          adminIds: remainingAdmins,
          updatedAt: new Date().toISOString(),
        });
      }
      await updateDoc(doc(db, 'groups', groupId), {
        memberIds: remainingParticipants,
        adminIds: remainingAdmins,
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `chats/${groupId}`);
    }
  }

  async togglePinChat(chatId: string) {
    if (!this.currentUser) return;
    const myUid = this.currentUser.id;
    const chat = this.getChat(chatId);
    const isPinned = (chat?.pinnedBy || []).includes(myUid);
    const op = updateDoc(doc(db, 'chats', chatId), {
      pinnedBy: isPinned ? arrayRemove(myUid) : arrayUnion(myUid),
    });
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      op.catch(() => {});
      return;
    }
    try {
      await op;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `chats/${chatId}`);
    }
  }

  async toggleMuteChat(chatId: string) {
    if (!this.currentUser) return;
    const myUid = this.currentUser.id;
    const chat = this.getChat(chatId);
    const isMuted = (chat?.mutedBy || []).includes(myUid);
    const op = updateDoc(doc(db, 'chats', chatId), {
      mutedBy: isMuted ? arrayRemove(myUid) : arrayUnion(myUid),
    });
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      op.catch(() => {});
      return;
    }
    try {
      await op;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `chats/${chatId}`);
    }
  }

  async toggleArchiveChat(chatId: string) {
    if (!this.currentUser) return;
    const myUid = this.currentUser.id;
    const chat = this.getChat(chatId);
    const isArchived = (chat?.archivedBy || []).includes(myUid);
    const op = updateDoc(doc(db, 'chats', chatId), {
      archivedBy: isArchived ? arrayRemove(myUid) : arrayUnion(myUid),
    });
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      op.catch(() => {});
      return;
    }
    try {
      await op;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `chats/${chatId}`);
    }
  }

  async deleteChat(chatId: string) {
    this.chats = this.chats.filter((c) => c.id !== chatId);
    this.notify();
    const op = deleteDoc(doc(db, 'chats', chatId));
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      op.catch(() => {});
      return;
    }
    try {
      await op;
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `chats/${chatId}`);
    }
  }

  async setTyping(chatId: string, isTyping: boolean) {
    if (!this.currentUser || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        [`typingUsers.${this.currentUser.id}`]: isTyping,
      });
    } catch {}
  }

  async markChatMessagesAsRead(chatId: string) {
    if (!this.currentUser || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    if (this.currentUser.privacySettings?.readReceipts === false) return;
    const myUid = this.currentUser.id;
    const unread = this.messages.filter(
      (m) => m.chatId === chatId && m.senderId !== myUid && !m.isDeleted && !(m.readBy || []).includes(myUid)
    );
    for (const msg of unread) {
      updateDoc(doc(db, 'messages', msg.id), {
        status: 'read',
        readBy: arrayUnion(myUid),
        deliveredTo: arrayUnion(myUid),
      }).catch(() => {});
    }
  }

  // Merge Firestore-synced messages, public channel posts, and offline queued outbox messages
  getMessages(chatId: string): Message[] {
    const map = new Map<string, Message>();
    for (const m of this.messages) {
      if (m.chatId === chatId && !this.hiddenMessageIds.has(m.id)) {
        map.set(m.id, m);
      }
    }
    for (const m of this.publicChannelMessages) {
      if (m.chatId === chatId && !this.hiddenMessageIds.has(m.id) && !map.has(m.id)) {
        map.set(m.id, m);
      }
    }
    for (const e of this.outbox) {
      const m = e.message;
      if (m.chatId === chatId && !this.hiddenMessageIds.has(m.id) && !map.has(m.id)) {
        map.set(m.id, m);
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  private async commitOutboxEntry(entry: OutboxEntry): Promise<void> {
    const msg = entry.message;
    const firestorePayload: Message = {
      ...msg,
      status: 'sent',
    };

    await setDoc(doc(db, 'messages', msg.id), firestorePayload);

    await updateDoc(doc(db, 'chats', msg.chatId), {
      lastMessage: entry.preview,
      lastMessageTime: msg.createdAt,
      lastSenderId: msg.senderId,
      [`typingUsers.${msg.senderId}`]: false,
      updatedAt: new Date().toISOString(),
    }).catch(() => {});

    const recipients = msg.participants.filter((uid) => uid !== msg.senderId);
    for (const recipientId of recipients) {
      const notifId = `notif_${Date.now()}_${recipientId.slice(0, 6)}`;
      setDoc(doc(db, 'notifications', notifId), {
        id: notifId,
        userId: recipientId,
        senderId: msg.senderId,
        senderName: msg.senderName,
        senderPhotoUrl: msg.senderPhotoUrl || '',
        title: entry.chatTitle || msg.senderName,
        body: entry.preview.slice(0, 200),
        type: 'message',
        chatId: msg.chatId,
        isRead: false,
        createdAt: msg.createdAt,
      }).catch(() => {});
    }
  }

  async flushOfflineOutbox(): Promise<number> {
    if (this.isFlushingOutbox || !this.currentUser) return 0;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 0;
    if (this.outbox.length === 0) return 0;

    this.isFlushingOutbox = true;
    let sentCount = 0;

    try {
      const queueCopy = [...this.outbox].sort(
        (a, b) => new Date(a.message.createdAt).getTime() - new Date(b.message.createdAt).getTime()
      );

      for (const entry of queueCopy) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) break;
        try {
          await this.commitOutboxEntry(entry);
          this.outbox = this.outbox.filter((o) => o.message.id !== entry.message.id);
          if (!this.messages.some((m) => m.id === entry.message.id)) {
            this.messages = [...this.messages, { ...entry.message, status: 'sent' }];
          }
          this.saveOutbox();
          if (this.currentUser) {
            this.saveCache(this.currentUser.id, 'messages', this.messages);
          }
          sentCount++;
          this.notify();
        } catch (err) {
          console.warn('Outbox flush paused on entry:', entry.message.id, err);
          break;
        }
      }
    } finally {
      this.isFlushingOutbox = false;
    }

    return sentCount;
  }

  async sendMessage(params: {
    chatId: string;
    participants?: string[];
    text?: string;
    type?: 'text' | 'image' | 'video' | 'audio' | 'document' | 'call_log' | 'poll' | 'payment';
    poll?: PollData;
    payment?: PaymentData;
    mediaUrl?: string;
    fileName?: string;
    fileSize?: string;
    duration?: number;
    replyToMessageId?: string;
    replyToText?: string;
    replyToSenderName?: string;
    forwardedFrom?: string;
    skipBroadcastFanout?: boolean;
  }): Promise<Message> {
    if (!this.currentUser) throw new Error('User must be logged in');

    const chat = this.getChat(params.chatId);
    const isBroadcast = chat?.type === 'broadcast';
    const isPublicChannel = Boolean(chat?.type === 'channel' && chat?.isPublic);
    const participants = isBroadcast
      ? [this.currentUser.id]
      : params.participants || chat?.participants || [this.currentUser.id];
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

    const newMessage: Message = {
      id: msgId,
      chatId: params.chatId,
      participants,
      ...(isPublicChannel ? { isPublicChannel: true } : {}),
      senderId: this.currentUser.id,
      senderName: this.currentUser.displayName,
      senderPhotoUrl: this.currentUser.photoUrl || '',
      text: params.text || '',
      type: params.type || 'text',
      ...(params.poll ? { poll: params.poll } : {}),
      ...(params.payment ? { payment: params.payment } : {}),
      ...(params.mediaUrl ? { mediaUrl: params.mediaUrl } : {}),
      ...(params.fileName ? { fileName: params.fileName } : {}),
      ...(params.fileSize ? { fileSize: params.fileSize } : {}),
      ...(params.duration !== undefined ? { duration: params.duration } : {}),
      status: isOnline ? 'sent' : 'pending',
      readBy: [this.currentUser.id],
      deliveredTo: [this.currentUser.id],
      ...(params.replyToMessageId ? { replyToMessageId: params.replyToMessageId } : {}),
      ...(params.replyToText ? { replyToText: params.replyToText } : {}),
      ...(params.replyToSenderName ? { replyToSenderName: params.replyToSenderName } : {}),
      ...(params.forwardedFrom ? { forwardedFrom: params.forwardedFrom } : {}),
      createdAt: now,
    };

    const preview =
      params.type === 'poll'
        ? `📊 Poll: ${params.poll?.question || 'Vote now'}`
        : params.type === 'payment' && params.payment
        ? params.payment.kind === 'send'
          ? `💸 Payment: ${formatPKR(params.payment.amount)}`
          : `💳 Payment Request: ${formatPKR(params.payment.amount)}`
        : params.text ||
          (params.type === 'image'
            ? '📷 Photo'
            : params.type === 'video'
            ? '🎥 Video'
            : params.type === 'audio'
            ? '🎤 Voice message'
            : params.type === 'document'
            ? `📄 ${params.fileName || 'Document'}`
            : 'Message');

    const entry: OutboxEntry = {
      message: { ...newMessage, status: 'pending' },
      preview,
      chatTitle:
        chat?.type === 'group' || chat?.type === 'channel'
          ? chat.name || 'DOST'
          : this.currentUser.displayName,
    };

    if (this.currentUser.notificationSettings?.messageSounds !== false) {
      sounds.playMessageSent();
    }

    // Store in durable local outbox immediately so offline messages are never lost
    this.outbox.push(entry);
    this.saveOutbox();
    this.notify();

    // Broadcast list fan-out: deliver individually to every recipient's private chat
    if (isBroadcast && !params.skipBroadcastFanout && chat) {
      const recipientIds = chat.participants.filter((uid) => uid !== this.currentUser!.id);
      for (const recipientId of recipientIds) {
        void this.createOrGetPrivateChat(recipientId).then((privateChat) =>
          this.sendMessage({
            chatId: privateChat.id,
            participants: privateChat.participants,
            text: params.text,
            type: params.type,
            poll: params.poll,
            mediaUrl: params.mediaUrl,
            fileName: params.fileName,
            fileSize: params.fileSize,
            duration: params.duration,
            skipBroadcastFanout: true,
          })
        );
      }
    }

    // If offline right now, return immediately — flushOfflineOutbox() will auto-send on reconnect!
    if (!isOnline) {
      return entry.message;
    }

    // Online: commit immediately and clear from outbox
    try {
      await this.commitOutboxEntry(entry);
      this.outbox = this.outbox.filter((o) => o.message.id !== msgId);
      this.saveOutbox();
      this.notify();
    } catch (err) {
      console.warn('Message queued for auto-retry:', err);
    }

    return newMessage;
  }

  async sendPollMessage(
    chatId: string,
    question: string,
    optionTexts: string[],
    allowMultiple: boolean
  ): Promise<Message> {
    const cleanOptions = optionTexts
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 6)
      .map((text, idx) => ({
        id: `opt_${idx}_${Date.now().toString(36)}`,
        text,
        voterIds: [],
      }));

    return this.sendMessage({
      chatId,
      text: question.trim(),
      type: 'poll',
      poll: {
        question: question.trim(),
        allowMultiple,
        options: cleanOptions,
      },
    });
  }

  async voteOnPoll(messageId: string, optionId: string) {
    if (!this.currentUser) return;
    const myUid = this.currentUser.id;
    const msg =
      this.messages.find((m) => m.id === messageId) ||
      this.publicChannelMessages.find((m) => m.id === messageId);
    if (!msg || !msg.poll || msg.poll.isClosed) return;

    const updatedOptions = msg.poll.options.map((opt) => {
      const hasVoted = opt.voterIds.includes(myUid);
      if (opt.id === optionId) {
        return {
          ...opt,
          voterIds: hasVoted
            ? opt.voterIds.filter((id) => id !== myUid)
            : [...opt.voterIds, myUid],
        };
      }
      if (!msg.poll!.allowMultiple && hasVoted) {
        return {
          ...opt,
          voterIds: opt.voterIds.filter((id) => id !== myUid),
        };
      }
      return opt;
    });

    const updatedPoll: PollData = {
      ...msg.poll,
      options: updatedOptions,
    };

    try {
      await updateDoc(doc(db, 'messages', messageId), {
        poll: updatedPoll,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `messages/${messageId}`);
    }
  }

  async sendPaymentMessage(params: {
    chatId: string;
    receiverId: string;
    receiverName: string;
    kind: 'send' | 'request';
    amount: number;
    method: PaymentMethod;
    accountNumber?: string;
    accountTitle?: string;
    referenceId?: string;
    note?: string;
  }): Promise<Message> {
    if (!this.currentUser) throw new Error('User must be logged in');
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const refId = params.referenceId?.trim() || generatePaymentRef();
    const initialStatus = params.kind === 'send' ? 'sent' : 'pending';

    const paymentData: PaymentData = {
      paymentId,
      kind: params.kind,
      amount: params.amount,
      currency: 'PKR',
      method: params.method,
      status: initialStatus,
      receiverId: params.receiverId,
      receiverName: params.receiverName,
      ...(params.accountNumber ? { accountNumber: params.accountNumber.trim() } : {}),
      ...(params.accountTitle ? { accountTitle: params.accountTitle.trim() } : {}),
      referenceId: refId,
      ...(params.note ? { note: params.note.trim() } : {}),
    };

    await paymentService.createLedgerEntry({
      id: paymentId,
      chatId: params.chatId,
      senderId: this.currentUser.id,
      senderName: this.currentUser.displayName,
      receiverId: params.receiverId,
      receiverName: params.receiverName,
      amount: params.amount,
      currency: 'PKR',
      method: params.method,
      kind: params.kind,
      status: initialStatus,
      ...(params.accountNumber ? { accountNumber: params.accountNumber.trim() } : {}),
      referenceId: refId,
      ...(params.note ? { note: params.note.trim() } : {}),
      createdAt: now,
      updatedAt: now,
    });

    const summaryText =
      params.kind === 'send'
        ? `Sent ${formatPKR(params.amount)}${params.note ? ` · ${params.note.trim()}` : ''}`
        : `Requested ${formatPKR(params.amount)}${params.note ? ` · ${params.note.trim()}` : ''}`;

    return this.sendMessage({
      chatId: params.chatId,
      text: summaryText,
      type: 'payment',
      payment: paymentData,
    });
  }

  async respondToPaymentMessage(
    messageId: string,
    nextStatus: 'sent' | 'completed' | 'declined',
    referenceId?: string
  ): Promise<void> {
    const msg = this.messages.find((m) => m.id === messageId);
    if (!msg || !msg.payment) return;
    const now = new Date().toISOString();
    const updatedPayment: PaymentData = {
      ...msg.payment,
      status: nextStatus,
      ...(referenceId?.trim() ? { referenceId: referenceId.trim() } : {}),
    };

    try {
      await updateDoc(doc(db, 'messages', messageId), {
        payment: updatedPayment,
        updatedAt: now,
      });
      await paymentService.updateLedgerStatus(msg.payment.paymentId, nextStatus, referenceId);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `messages/${messageId}`);
    }
  }

  async forwardMessage(message: Message, targetChatId: string) {
    await this.sendMessage({
      chatId: targetChatId,
      text: message.text,
      type: message.type,
      poll: message.poll,
      mediaUrl: message.mediaUrl,
      fileName: message.fileName,
      fileSize: message.fileSize,
      duration: message.duration,
      forwardedFrom: message.senderName,
    });
  }

  async editMessage(messageId: string, newText: string) {
    const outboxIdx = this.outbox.findIndex((e) => e.message.id === messageId);
    if (outboxIdx >= 0) {
      this.outbox[outboxIdx].message.text = newText;
      this.outbox[outboxIdx].preview = newText;
      this.saveOutbox();
      this.notify();
      return;
    }

    const msg =
      this.messages.find((m) => m.id === messageId) ||
      this.publicChannelMessages.find((m) => m.id === messageId);
    const now = new Date().toISOString();

    const op = updateDoc(doc(db, 'messages', messageId), {
      text: newText,
      isEdited: true,
      updatedAt: now,
    });
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      op.catch(() => {});
      return;
    }
    try {
      await op;
      if (msg) {
        const chatMsgs = this.getMessages(msg.chatId);
        const latest = chatMsgs[chatMsgs.length - 1];
        if (latest && latest.id === messageId) {
          updateDoc(doc(db, 'chats', msg.chatId), {
            lastMessage: newText,
            updatedAt: now,
          }).catch(() => {});
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `messages/${messageId}`);
    }
  }

  async deleteMessage(messageId: string, forEveryone: boolean) {
    if (this.outbox.some((e) => e.message.id === messageId)) {
      this.outbox = this.outbox.filter((e) => e.message.id !== messageId);
      this.saveOutbox();
      this.notify();
      return;
    }

    if (!forEveryone) {
      this.hiddenMessageIds.add(messageId);
      this.saveHiddenMessages();
      this.notify();
      return;
    }

    const msg =
      this.messages.find((m) => m.id === messageId) ||
      this.publicChannelMessages.find((m) => m.id === messageId);
    const now = new Date().toISOString();

    const op = updateDoc(doc(db, 'messages', messageId), {
      text: 'This message was deleted',
      mediaUrl: '',
      isDeleted: true,
      updatedAt: now,
    });

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      op.catch(() => {});
      return;
    }
    try {
      await op;
      if (msg) {
        const chatMsgs = this.getMessages(msg.chatId);
        const latest = chatMsgs[chatMsgs.length - 1];
        if (latest && latest.id === messageId) {
          updateDoc(doc(db, 'chats', msg.chatId), {
            lastMessage: 'This message was deleted',
            updatedAt: now,
          }).catch(() => {});
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `messages/${messageId}`);
    }
  }

  async reactToMessage(messageId: string, emoji: string) {
    if (!this.currentUser) return;
    const msg = this.messages.find((m) => m.id === messageId);
    if (!msg) return;
    const reactions = [...(msg.reactions || [])];
    const existingIdx = reactions.findIndex((r) => r.userId === this.currentUser!.id);
    if (existingIdx >= 0) {
      if (reactions[existingIdx].emoji === emoji) {
        reactions.splice(existingIdx, 1);
      } else {
        reactions[existingIdx] = { userId: this.currentUser.id, emoji };
      }
    } else {
      reactions.push({ userId: this.currentUser.id, emoji });
    }

    const op = updateDoc(doc(db, 'messages', messageId), { reactions });
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      op.catch(() => {});
      return;
    }
    try {
      await op;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `messages/${messageId}`);
    }
  }

  getStories(): Story[] {
    return this.stories;
  }

  async addStory(mediaUrl: string, caption?: string, backgroundColor?: string) {
    if (!this.currentUser) return;
    const storyId = `story_${Date.now()}`;
    const newStory: Story = {
      id: storyId,
      userId: this.currentUser.id,
      userName: this.currentUser.displayName,
      userPhoto: this.currentUser.photoUrl || '',
      mediaUrl,
      type: mediaUrl ? 'image' : 'text',
      caption: caption || '',
      ...(backgroundColor ? { backgroundColor } : {}),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600 * 24 * 1000).toISOString(),
      viewers: [],
    };
    try {
      await setDoc(doc(db, 'stories', storyId), newStory);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `stories/${storyId}`);
    }
  }

  async deleteStory(storyId: string) {
    this.stories = this.stories.filter((s) => s.id !== storyId);
    this.notify();
    try {
      await deleteDoc(doc(db, 'stories', storyId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `stories/${storyId}`);
    }
  }

  async markStoryViewed(storyId: string) {
    if (!this.currentUser) return;
    try {
      await updateDoc(doc(db, 'stories', storyId), {
        viewers: arrayUnion(this.currentUser.id),
      });
    } catch {}
  }

  getCallLogs(): CallSession[] {
    return this.callLogs;
  }

  async deleteCallLog(callId: string) {
    this.callLogs = this.callLogs.filter((c) => c.id !== callId);
    this.notify();
    try {
      await deleteDoc(doc(db, 'calls', callId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `calls/${callId}`);
    }
  }

  getNotifications(): NotificationItem[] {
    return this.notifications;
  }

  getUnreadNotificationsCount(): number {
    return this.notifications.filter((n) => !n.isRead).length;
  }

  async markNotificationRead(notificationId: string) {
    this.notifications = this.notifications.map((n) =>
      n.id === notificationId ? { ...n, isRead: true } : n
    );
    this.notify();
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
    } catch {}
  }

  async markAllNotificationsRead() {
    const unread = this.notifications.filter((n) => !n.isRead);
    this.notifications = this.notifications.map((n) => ({ ...n, isRead: true }));
    this.notify();
    for (const n of unread) {
      updateDoc(doc(db, 'notifications', n.id), { isRead: true }).catch(() => {});
    }
  }

  async deleteNotification(notificationId: string) {
    this.notifications = this.notifications.filter((n) => n.id !== notificationId);
    this.notify();
    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
    } catch {}
  }

  async sendSystemBroadcastNotification(title: string, body: string) {
    if (!this.currentUser) return;
    const now = new Date().toISOString();
    for (const user of this.users) {
      const notifId = `sys_${Date.now()}_${user.id.slice(0, 6)}`;
      await setDoc(doc(db, 'notifications', notifId), {
        id: notifId,
        userId: user.id,
        senderId: this.currentUser.id,
        senderName: this.currentUser.displayName,
        senderPhotoUrl: this.currentUser.photoUrl || '',
        title,
        body,
        type: 'system',
        isRead: false,
        createdAt: now,
      });
    }
  }

  async blockUser(targetUserId: string, targetName: string) {
    if (!this.currentUser) return;
    const blockId = `block_${this.currentUser.id}_${targetUserId}`;
    const newBlock: BlockedUser = {
      id: blockId,
      userId: this.currentUser.id,
      blockedUserId: targetUserId,
      blockedUserName: targetName,
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'blocked_users', blockId), newBlock);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `blocked_users/${blockId}`);
    }
  }

  async unblockUser(targetUserId: string) {
    if (!this.currentUser) return;
    const blockId = `block_${this.currentUser.id}_${targetUserId}`;
    try {
      await deleteDoc(doc(db, 'blocked_users', blockId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `blocked_users/${blockId}`);
    }
  }

  isUserBlocked(targetUserId: string): boolean {
    return this.blockedUsers.some((b) => b.blockedUserId === targetUserId);
  }

  getBlockedUsers(): BlockedUser[] {
    return this.blockedUsers;
  }

  async reportUser(reportedUserId: string, reason: string, details?: string) {
    if (!this.currentUser) return;
    const reportId = `rep_${Date.now()}`;
    const newReport: Report = {
      id: reportId,
      reporterId: this.currentUser.id,
      reportedUserId,
      reason,
      details: details || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'reports', reportId), newReport);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `reports/${reportId}`);
    }
  }

  getReports(): Report[] {
    return this.reports;
  }

  async updateReportStatus(reportId: string, status: 'pending' | 'reviewed' | 'dismissed') {
    try {
      await updateDoc(doc(db, 'reports', reportId), { status });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reports/${reportId}`);
    }
  }

  async updateUserRole(userId: string, role: 'user' | 'admin') {
    try {
      await updateDoc(doc(db, 'users', userId), { role });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  }
}

export const chatStore = new ChatStore();
