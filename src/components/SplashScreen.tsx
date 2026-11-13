import React, { useEffect } from 'react';
import { Shield } from 'lucide-react';

interface SplashScreenProps {
  onDismiss: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onDismiss }) => {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      onDismiss();
    }, 1600);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-b from-[#0FA958] via-[#0B8043] to-[#054C28] text-white p-8 select-none animate-fade-in">
      <div className="w-full flex justify-between items-center text-xs tracking-wider uppercase text-emerald-200/90 font-medium pt-2">
        <span className="flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-emerald-300" />
          End-to-End Encrypted
        </span>
        <span>Version 1.0</span>
      </div>

      <div className="flex flex-col items-center text-center max-w-sm my-auto">
        {/* Official DOST Logo */}
        <div className="relative mb-6">
          <div className="absolute -inset-3 bg-emerald-300/25 rounded-3xl blur-xl animate-pulse" />
          <img
            src="/assets/aistudio/download_7eb2aac4.jpeg"
            alt="DOST Messaging App Logo"
            className="relative w-32 h-32 rounded-3xl shadow-2xl object-cover border-2 border-white/25"
          />
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1.5 font-['Outfit']">
          DOST
        </h1>
        <p className="text-xs font-medium text-emerald-100/90 tracking-wide mb-6">
          DOST MESSAGING APP · Developed by Husnain Butt
        </p>

        {/* Subtle WhatsApp-style loading indicator */}
        <div className="w-36 h-1 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full animate-pulse w-2/3 mx-auto" />
        </div>
      </div>

      <div className="text-center text-[11px] text-emerald-200/80 pb-2 tracking-wide">
        <span>from</span>
        <p className="font-bold text-white text-xs mt-0.5 tracking-wider uppercase">
          Husnain Butt
        </p>
      </div>
    </div>
  );
};
