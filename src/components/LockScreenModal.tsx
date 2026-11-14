import React, { useEffect, useState, useCallback } from 'react';
import { Fingerprint, Lock, Delete, ShieldCheck, X } from 'lucide-react';
import { securityService } from '../services/securityService';

interface LockScreenModalProps {
  isOpen: boolean;
  mode: 'app' | 'chat';
  title?: string;
  subtitle?: string;
  userLabel?: string;
  onUnlocked: () => void;
  onCancel?: () => void;
}

export const LockScreenModal: React.FC<LockScreenModalProps> = ({
  isOpen,
  mode,
  title,
  subtitle,
  userLabel,
  onUnlocked,
  onCancel,
}) => {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [biometricLabel, setBiometricLabel] = useState('Fingerprint / Face ID');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [isPrompting, setIsPrompting] = useState(false);

  const hasPin = securityService.hasPin();
  const bioEnabled = securityService.isBiometricEnabled();

  const triggerBiometric = useCallback(async () => {
    if (isPrompting) return;
    setIsPrompting(true);
    setErrorMsg('');
    try {
      const res = await securityService.authenticateBiometric({
        title: title || (mode === 'app' ? 'Unlock DOST' : 'Unlock Locked Chat'),
        subtitle: subtitle || 'Verify your fingerprint, face ID, or device lock',
        userLabel,
      });
      if (res.success) {
        setPin('');
        onUnlocked();
      } else if (res.error) {
        setErrorMsg(hasPin ? 'Use your 4-digit PIN or tap Biometric again.' : res.error);
      }
    } finally {
      setIsPrompting(false);
    }
  }, [hasPin, isPrompting, mode, onUnlocked, subtitle, title, userLabel]);

  useEffect(() => {
    if (!isOpen) {
      setPin('');
      setErrorMsg('');
      return;
    }

    let mounted = true;
    securityService.checkBiometricSupport().then((info) => {
      if (!mounted) return;
      setBiometricAvailable(info.available);
      setBiometricLabel(info.label);
      if (bioEnabled && info.available) {
        void triggerBiometric();
      }
    });

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDigit = async (digit: string) => {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    setErrorMsg('');

    if (next.length === 4) {
      const valid = await securityService.verifyPin(next);
      if (valid) {
        setPin('');
        onUnlocked();
      } else {
        setErrorMsg('Incorrect PIN. Please try again.');
        window.setTimeout(() => setPin(''), 250);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-between bg-[#062415] text-white px-6 py-8 select-none">
      {/* Top Bar */}
      <div className="w-full max-w-sm flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
          <ShieldCheck className="w-4 h-4" />
          <span>DOST Security Lock</span>
        </div>
        {mode === 'chat' && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Center Lock Crest & PIN Dots */}
      <div className="w-full max-w-xs flex flex-col items-center text-center my-auto">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-emerald-300" />
        </div>

        <h2 className="text-xl font-bold font-['Outfit'] text-white">
          {title || (mode === 'app' ? 'DOST is Locked' : 'Locked Chat')}
        </h2>
        <p className="text-xs text-emerald-100/75 mt-1 mb-6">
          {subtitle ||
            (hasPin
              ? 'Enter your 4-digit PIN or use Biometric unlock'
              : 'Verify with Fingerprint / Face ID')}
        </p>

        {hasPin && (
          <div className="flex items-center gap-4 mb-4">
            {[0, 1, 2, 3].map((idx) => (
              <span
                key={idx}
                className={`w-3.5 h-3.5 rounded-full transition-all ${
                  idx < pin.length
                    ? 'bg-emerald-400 scale-110'
                    : 'bg-white/20 border border-white/25'
                }`}
              />
            ))}
          </div>
        )}

        {errorMsg && (
          <p className="text-xs font-medium text-rose-300 mb-3 min-h-[18px]">{errorMsg}</p>
        )}

        {/* Tactile 48px+ Keypad when PIN exists */}
        {hasPin ? (
          <div className="grid grid-cols-3 gap-3.5 w-full max-w-[260px] mt-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => void handleDigit(d)}
                className="h-14 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-lg font-bold font-['Outfit'] transition-all cursor-pointer"
              >
                {d}
              </button>
            ))}

            <button
              type="button"
              onClick={() => void triggerBiometric()}
              disabled={!bioEnabled && !biometricAvailable}
              className="h-14 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 active:scale-95 flex items-center justify-center text-emerald-300 disabled:opacity-35 transition-all cursor-pointer"
              title={biometricLabel}
            >
              <Fingerprint className="w-6 h-6" />
            </button>

            <button
              type="button"
              onClick={() => void handleDigit('0')}
              className="h-14 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-lg font-bold font-['Outfit'] transition-all cursor-pointer"
            >
              0
            </button>

            <button
              type="button"
              onClick={() => setPin((p) => p.slice(0, -1))}
              className="h-14 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-emerald-100 transition-all cursor-pointer"
              title="Backspace"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void triggerBiometric()}
            className="mt-2 px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center gap-2.5 shadow-lg cursor-pointer transition-all active:scale-95"
          >
            <Fingerprint className="w-5 h-5" />
            <span>Unlock with {biometricLabel}</span>
          </button>
        )}
      </div>

      <p className="text-[11px] text-emerald-200/60 tracking-wide">
        DOST Protected · Developed by Husnain Butt
      </p>
    </div>
  );
};
