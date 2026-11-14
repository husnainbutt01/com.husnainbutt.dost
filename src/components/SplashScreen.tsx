import React, { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';

interface SplashScreenProps {
  onDismiss: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onDismiss }) => {
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => {
      setIsLeaving(true);
    }, 1750);

    const dismissTimer = window.setTimeout(() => {
      onDismiss();
    }, 2050);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(dismissTimer);
    };
  }, [onDismiss]);

  const handleQuickEnter = () => {
    if (isLeaving) return;
    setIsLeaving(true);
    window.setTimeout(() => {
      onDismiss();
    }, 220);
  };

  return (
    <div
      onClick={handleQuickEnter}
      role="presentation"
      className={`fixed inset-0 z-50 flex flex-col justify-between overflow-hidden select-none cursor-pointer bg-[#F6FAF7] dark:bg-[#07150E] text-slate-900 dark:text-slate-100 transition-all duration-300 ease-out ${
        isLeaving ? 'opacity-0 scale-[1.02]' : 'opacity-100 scale-100'
      }`}
    >
      {/* Architectural Deep-Emerald Curved Canopy */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[44%] min-h-[270px] overflow-hidden">
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#064E29] via-[#0B8043] to-[#0FA958]"
          style={{
            clipPath: 'ellipse(95% 86% at 50% 10%)',
          }}
        />
        {/* Crisp geometric hairline rings (non-blur, precision crest) */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.14]"
          viewBox="0 0 800 400"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <circle cx="400" cy="360" r="170" fill="none" stroke="white" strokeWidth="1" />
          <circle cx="400" cy="360" r="245" fill="none" stroke="white" strokeWidth="1" />
          <circle cx="400" cy="360" r="325" fill="none" stroke="white" strokeWidth="1" strokeDasharray="5 7" />
        </svg>
      </div>

      {/* Top Metadata Header */}
      <header className="relative z-10 w-full max-w-2xl mx-auto flex items-center justify-between px-6 pt-7 text-[11px] font-semibold tracking-[0.14em] uppercase text-emerald-100/90">
        <span className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-emerald-200" />
          Encrypted
        </span>
        <span className="text-emerald-100/80">Version 1.0</span>
      </header>

      {/* Centerpiece Brand Showcase */}
      <main className="relative z-10 flex flex-col items-center text-center px-6 my-auto">
        <div className="animate-splash-scale relative mb-7">
          <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-[34px] bg-white dark:bg-[#0D2116] p-2.5 shadow-[0_24px_55px_-12px_rgba(11,128,67,0.32)] ring-1 ring-emerald-950/10 dark:ring-emerald-400/20">
            <img
              src="/assets/aistudio/download_7eb2aac4.jpeg"
              alt="DOST Messaging App Official Crest"
              referrerPolicy="no-referrer"
              className="w-full h-full rounded-[26px] object-cover"
            />
          </div>
        </div>

        <div className="animate-splash-rise space-y-2.5 max-w-sm">
          <h1 className="text-4xl sm:text-[42px] font-bold tracking-[0.06em] text-slate-900 dark:text-white leading-none font-['Outfit']">
            DOST
          </h1>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0B8043] dark:text-emerald-400">
            DOST Messaging App
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide pt-0.5">
            Private Chats · HD Audio & Video Calls · Live Sync
          </p>
        </div>

        {/* Smooth Compositor Progress Track */}
        <div className="animate-splash-rise-late mt-8 w-44">
          <div className="h-[3px] w-full rounded-full bg-emerald-950/10 dark:bg-white/10 overflow-hidden">
            <div className="h-full w-full rounded-full bg-gradient-to-r from-[#0B8043] to-[#0FA958] animate-splash-bar" />
          </div>
        </div>
      </main>

      {/* Editorial Footer Attribution */}
      <footer className="relative z-10 pb-8 px-6 text-center animate-splash-rise-late">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          Developed by
        </p>
        <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-[#085C30] dark:text-emerald-300 font-['Outfit']">
          Husnain Butt
        </p>
      </footer>
    </div>
  );
};
