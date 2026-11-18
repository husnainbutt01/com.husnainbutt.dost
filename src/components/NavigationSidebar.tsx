import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { themeService } from '../services/themeService';
import {
  MessageSquare,
  CircleDot,
  PhoneCall,
  Users,
  Settings,
  UserCheck,
  Bell,
  Sun,
  Moon,
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
  const [isDark, setIsDark] = useState(themeService.isDarkMode());

  useEffect(() => {
    return themeService.subscribe(() => setIsDark(themeService.isDarkMode()));
  }, []);

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
      {/* Desktop / Tablet Vertical Rail */}
      <aside className="hidden md:flex flex-col items-center justify-between w-[76px] py-4 bg-white dark:bg-[#1C1F24] border-r border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-zinc-300 z-30 shrink-0 transition-colors">
        <div className="flex flex-col items-center gap-5 w-full">
          {/* Brand Mark */}
          <button
            type="button"
            onClick={() => onSelectTab('chats')}
            className="group cursor-pointer focus:outline-none"
            title="DOST Messaging App"
          >
            <div className="w-11 h-11 rounded-2xl overflow-hidden shadow-md ring-1 ring-emerald-500/35 p-0.5 bg-emerald-600/10 group-hover:scale-105 transition-transform">
              <img
                src="/assets/aistudio/download_7eb2aac4.jpeg"
                alt="DOST"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover rounded-[14px]"
              />
            </div>
          </button>

          {/* Labeled Nav Items */}
          <nav className="flex flex-col items-center gap-1.5 w-full px-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`relative w-full py-2 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600/12 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold'
                      : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-zinc-100'
                  }`}
                  title={item.label}
                >
                  <div className="relative">
                    <Icon className="w-5 h-5" />
                    {item.badge !== null && (
                      <span className="absolute -top-1.5 -right-2.5 bg-emerald-600 text-white font-bold text-[9px] min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center shadow-xs tabular-nums">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] tracking-tight">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Controls: Theme Switch, Notifications, Profile */}
        <div className="flex flex-col items-center gap-2.5 w-full px-1.5">
          <button
            type="button"
            onClick={() => themeService.toggleDarkLight()}
            className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-[#262A31] hover:bg-slate-200/80 dark:hover:bg-[#30353E] text-slate-700 dark:text-amber-300 flex items-center justify-center transition-colors cursor-pointer"
            title={isDark ? 'Switch to Daylight Mode' : 'Switch to Charcoal Dark Mode'}
            aria-label={isDark ? 'Switch to Daylight Mode' : 'Switch to Charcoal Dark Mode'}
          >
            {isDark ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          </button>

          {currentUser && (
            <button
              type="button"
              onClick={onOpenNotifications}
              className="relative w-10 h-10 rounded-2xl bg-slate-100 dark:bg-[#262A31] hover:bg-slate-200/80 dark:hover:bg-[#30353E] text-slate-700 dark:text-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4.5 h-4.5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 font-bold text-[10px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center shadow-sm tabular-nums">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>
          )}

          {currentUser ? (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="group relative cursor-pointer mt-1"
              title={`Logged in as ${currentUser.displayName}. Tap for account details.`}
            >
              <img
                src={
                  currentUser.photoUrl ||
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.id}`
                }
                alt={currentUser.displayName}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500/70 shadow-sm group-hover:ring-2 group-hover:ring-emerald-400 transition-all"
              />
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition-colors shadow cursor-pointer mt-1"
              title="Register or Sign In"
            >
              <UserCheck className="w-5 h-5" />
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#1C1F24]/95 backdrop-blur-md border-t border-slate-200/80 dark:border-white/10 flex items-center justify-around h-16 px-1.5 text-slate-600 dark:text-zinc-300">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`relative flex flex-col items-center justify-center min-w-[48px] min-h-[44px] px-2 rounded-xl transition-all cursor-pointer ${
                isActive
                  ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'text-slate-500 dark:text-zinc-400'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'scale-105' : ''}`} />
                {item.badge !== null && (
                  <span className="absolute -top-1.5 -right-2.5 bg-emerald-600 text-white font-bold text-[9px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center tabular-nums">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            </button>
          );
        })}
        {currentUser && (
          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative flex flex-col items-center justify-center min-w-[48px] min-h-[44px] px-2 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <div className="relative">
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-amber-400 text-slate-950 font-bold text-[9px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center tabular-nums">
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
