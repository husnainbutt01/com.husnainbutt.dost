import React from 'react';
import { User } from '../types';
import {
  MessageSquare,
  CircleDot,
  PhoneCall,
  Users,
  Settings,
  UserCheck,
  Bell,
} from 'lucide-react';

export type NavigationTab = 'chats' | 'stories' | 'calls' | 'contacts' | 'settings';

interface NavigationSidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  currentUser: User | null;
  unreadTotal: number;
  unreadNotificationsCount: number;
  onOpenNotifications: () => void;
  onOpenAuthModal: () => void;
}

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  currentTab,
  onSelectTab,
  currentUser,
  unreadTotal,
  unreadNotificationsCount,
  onOpenNotifications,
  onOpenAuthModal,
}) => {
  const navItems = [
    {
      id: 'chats' as NavigationTab,
      label: 'Chats',
      icon: MessageSquare,
      badge: unreadTotal > 0 ? unreadTotal : null,
    },
    {
      id: 'stories' as NavigationTab,
      label: 'Status',
      icon: CircleDot,
      badge: null,
    },
    {
      id: 'calls' as NavigationTab,
      label: 'Calls',
      icon: PhoneCall,
      badge: null,
    },
    {
      id: 'contacts' as NavigationTab,
      label: 'Contacts',
      icon: Users,
      badge: null,
    },
    {
      id: 'settings' as NavigationTab,
      label: 'Settings',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <>
      {/* Desktop / Tablet Vertical Sidebar */}
      <aside className="hidden md:flex flex-col items-center justify-between w-20 py-5 bg-[#084825] border-r border-emerald-900/40 text-emerald-100 z-30 shrink-0">
        <div className="flex flex-col items-center gap-6 w-full">
          {/* Brand Logo */}
          <button
            onClick={() => onSelectTab('chats')}
            className="group relative cursor-pointer focus:outline-none"
            title="DOST Messaging App"
          >
            <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg border-2 border-emerald-400/40 p-0.5 bg-emerald-900 group-hover:scale-105 transition-transform">
              <img
                src="/assets/aistudio/download_7eb2aac4.jpeg"
                alt="DOST"
                className="w-full h-full object-cover rounded-xl"
              />
            </div>
            <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#084825]" />
          </button>

          {/* Nav Items */}
          <nav className="flex flex-col items-center gap-2 w-full px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500 text-white shadow-md shadow-black/20'
                      : 'text-emerald-200/80 hover:bg-emerald-800/60 hover:text-white'
                  }`}
                  title={item.label}
                >
                  <Icon className="w-5 h-5" />
                  {item.badge !== null && (
                    <span className="absolute -top-1 -right-1 bg-emerald-300 text-emerald-950 font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Notifications & User Profile Avatar */}
        <div className="flex flex-col items-center gap-3">
          {currentUser && (
            <button
              onClick={onOpenNotifications}
              className="relative w-10 h-10 rounded-2xl bg-emerald-900/60 hover:bg-emerald-800 text-emerald-100 flex items-center justify-center transition-colors cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 font-bold text-[10px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center shadow-sm">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>
          )}

          {currentUser ? (
            <button
              onClick={onOpenAuthModal}
              className="group relative cursor-pointer"
              title={`Logged in as ${currentUser.displayName}. Tap for account details.`}
            >
              <img
                src={currentUser.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.id}`}
                alt={currentUser.displayName}
                className="w-10 h-10 rounded-full object-cover border-2 border-emerald-400/70 shadow group-hover:ring-2 group-hover:ring-emerald-300 transition-all"
              />
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#084825]" />
            </button>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="w-10 h-10 rounded-full bg-emerald-700 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors shadow cursor-pointer"
              title="Register or Sign In"
            >
              <UserCheck className="w-5 h-5" />
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#084825]/95 backdrop-blur-md border-t border-emerald-800/50 flex items-center justify-around h-16 px-2 text-emerald-100">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`relative flex flex-col items-center justify-center w-14 h-12 transition-all cursor-pointer ${
                isActive ? 'text-emerald-300 font-semibold' : 'text-emerald-200/70'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''}`} />
                {item.badge !== null && (
                  <span className="absolute -top-1 -right-2 bg-emerald-300 text-emerald-950 font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            </button>
          );
        })}
        {currentUser && (
          <button
            onClick={onOpenNotifications}
            className="relative flex flex-col items-center justify-center w-14 h-12 text-emerald-200/80 hover:text-white cursor-pointer"
          >
            <div className="relative">
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-amber-400 text-slate-950 font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                  {unreadNotificationsCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Alerts</span>
          </button>
        )}
      </nav>
    </>
  );
};
