export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'call_log' | 'poll' | 'payment';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read';
export type UserRole = 'user' | 'admin';
export type ChatType = 'private' | 'group' | 'channel' | 'broadcast';
export type PaymentMethod = 'jazzcash' | 'easypaisa' | 'sadapay' | 'nayapay' | 'raast';

export interface UserPaymentAccount {
  method: PaymentMethod;
  accountTitle: string;
  accountNumber: string; // Mobile wallet number or IBAN
  updatedAt?: string;
}

export interface UserPrivacySettings {
  lastSeenVisibility: 'everyone' | 'contacts' | 'nobody';
  readReceipts: boolean;
  profilePhotoVisibility: 'everyone' | 'contacts' | 'nobody';
  allowGroupAdd: 'everyone' | 'contacts';
}

export interface UserNotificationSettings {
  messageSounds: boolean;
  callRingtones: boolean;
  inAppAlerts: boolean;
  previewMessage: boolean;
  vibrate: boolean;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  photoUrl?: string;
  bio?: string;
  isOnline: boolean;
  lastSeen: string;
  role: UserRole;
  isProfileComplete?: boolean;
  privacySettings?: UserPrivacySettings;
  notificationSettings?: UserNotificationSettings;
  paymentAccount?: UserPaymentAccount;
  createdAt: string;
  updatedAt?: string;
}

export interface Chat {
  id: string;
  type: ChatType;
  participants: string[]; // User UIDs (for broadcast lists: includes sender + recipients)
  name?: string; // For groups, channels, broadcast lists
  photoUrl?: string;
  description?: string;
  adminIds?: string[];
  createdBy?: string;
  isPublic?: boolean; // For public channels
  onlyAdminsCanMessage?: boolean; // Group / Channel posting restriction
  onlyAdminsCanEdit?: boolean; // Group info edit restriction
  lastMessage?: string;
  lastMessageTime?: string;
  lastSenderId?: string;
  pinnedBy?: string[];
  mutedBy?: string[];
  archivedBy?: string[];
  typingUsers?: Record<string, boolean>;
  unreadCounts?: Record<string, number>;
  createdAt: string;
  updatedAt?: string;
}

export interface MessageReaction {
  userId: string;
  emoji: string;
}

export interface PollOption {
  id: string;
  text: string;
  voterIds: string[];
}

export interface PollData {
  question: string;
  allowMultiple: boolean;
  options: PollOption[];
  isClosed?: boolean;
}

export interface PaymentData {
  paymentId: string;
  kind: 'send' | 'request';
  amount: number;
  currency: 'PKR';
  method: PaymentMethod;
  status: 'pending' | 'sent' | 'completed' | 'declined';
  receiverId: string;
  receiverName: string;
  accountNumber?: string;
  accountTitle?: string;
  referenceId?: string;
  note?: string;
}

export interface PaymentTransaction {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  amount: number;
  currency: 'PKR';
  method: PaymentMethod;
  kind: 'send' | 'request';
  status: 'pending' | 'sent' | 'completed' | 'declined';
  accountNumber?: string;
  referenceId?: string;
  note?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Message {
  id: string;
  chatId: string;
  participants: string[]; // For secure Firestore query enforcement
  isPublicChannel?: boolean;
  senderId: string;
  senderName: string;
  senderPhotoUrl?: string;
  text?: string;
  type: MessageType;
  poll?: PollData;
  payment?: PaymentData;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: string;
  duration?: number; // In seconds (for audio voice notes or call duration)
  status: MessageStatus;
  readBy?: string[];
  deliveredTo?: string[];
  replyToMessageId?: string;
  replyToText?: string;
  replyToSenderName?: string;
  forwardedFrom?: string;
  isEdited?: boolean;
  isDeleted?: boolean;
  reactions?: MessageReaction[];
  createdAt: string;
  updatedAt?: string;
}

export interface DeviceSession {
  id: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  platform: 'android' | 'desktop' | 'tablet' | 'mobile_web';
  browserInfo: string;
  lastActive: string;
  createdAt: string;
  revoked?: boolean;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  photoUrl?: string;
  createdBy: string;
  adminIds: string[];
  memberIds: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  senderId: string;
  senderName: string;
  senderPhotoUrl?: string;
  title: string;
  body: string;
  type: 'message' | 'call' | 'group_invite' | 'system';
  chatId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface BlockedUser {
  id: string;
  userId: string;
  blockedUserId: string;
  blockedUserName: string;
  createdAt: string;
}

export interface Report {
  id: string;
  reporterId: string;
  reportedUserId: string;
  reason: string;
  details?: string;
  status: 'pending' | 'reviewed' | 'dismissed';
  createdAt: string;
}

export interface CallSession {
  id: string;
  callerId: string;
  callerName: string;
  callerPhoto?: string;
  receiverId: string;
  receiverName: string;
  receiverPhoto?: string;
  type: 'audio' | 'video';
  status: 'calling' | 'ringing' | 'connected' | 'ended' | 'rejected' | 'missed';
  offer?: { type: string; sdp: string };
  answer?: { type: string; sdp: string };
  startTime?: number;
  duration?: number;
  isMuted?: boolean;
  isVideoEnabled?: boolean;
  isSpeakerOn?: boolean;
  createdAt?: string;
  endedAt?: string;
}

export interface Story {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  mediaUrl: string;
  type: 'image' | 'text';
  caption?: string;
  backgroundColor?: string;
  createdAt: string;
  expiresAt: string;
  viewers: string[];
}
