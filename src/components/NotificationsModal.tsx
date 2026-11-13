import React, { useState, useEffect } from 'react';
import { NotificationItem } from '../types';
import { chatStore } from '../services/chatService';
import {
  Bell,
  X,
  CheckCheck,
  Trash2,
  MessageSquare,
  Megaphone,
  PhoneCall,
  Users,
} from 'lucide-react';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenChat: (chatId: string) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  onOpenChat,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    chatStore.getNotifications()
  );

  useEffect(() => {
    if (!isOpen) return;
    const sync = () => setNotifications(chatStore.getNotifications());
    sync();
    return chatStore.subscribe(sync);
  }, [isOpen]);

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const diffHours = (Date.now() - d.getTime()) / (1000 * 3600);
    if (diffHours < 24) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'system':
        return <Megaphone className="w-4 h-4 text-amber-600" />;
      case 'call':
        return <PhoneCall className="w-4 h-4 text-emerald-600" />;
      case 'group_invite':
        return <Users className="w-4 h-4 text-indigo-600" />;
      default:
        return <MessageSquare className="w-4 h-4 text-emerald-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in select-none">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0FA958] to-[#0B8043] p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-['Outfit']">
                Notifications {unreadCount > 0 ? `(${unreadCount})` : ''}
              </h2>
              <p className="text-[11px] text-emerald-100">
                Messages & DOST announcements
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={() => chatStore.markAllNotificationsRead()}
                className="px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
            <button onClick={onClose} className="p-1 hover:text-emerald-200 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {notifications.length === 0 ? (
            <div className="p-10 text-center text-slate-400">
              <Bell className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-1" />
              <p className="text-xs font-semibold text-slate-600">No notifications yet</p>
              <p className="text-[11px] mt-1">
                New messages and system announcements appear here in real time.
              </p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => {
                  if (!notif.isRead) {
                    chatStore.markNotificationRead(notif.id);
                  }
                  if (notif.chatId) {
                    onOpenChat(notif.chatId);
                    onClose();
                  }
                }}
                className={`p-4 flex items-start gap-3 transition-colors cursor-pointer ${
                  notif.isRead ? 'bg-white hover:bg-slate-50' : 'bg-emerald-50/50 hover:bg-emerald-50'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                  {notif.senderPhotoUrl ? (
                    <img
                      src={notif.senderPhotoUrl}
                      alt={notif.senderName}
                      className="w-9 h-9 rounded-full object-cover"
                    />
                  ) : (
                    renderIcon(notif.type)
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-800 truncate">{notif.title}</p>
                    <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                      {formatTime(notif.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{notif.body}</p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!notif.isRead && (
                    <span className="w-2 h-2 rounded-full bg-emerald-600 mr-1" title="Unread" />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      chatStore.deleteNotification(notif.id);
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                    title="Delete notification"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
