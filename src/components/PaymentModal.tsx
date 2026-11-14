import React, { useEffect, useState } from 'react';
import { Chat, PaymentMethod, User } from '../types';
import { chatStore } from '../services/chatService';
import { PAYMENT_RAILS, formatPKR } from '../services/paymentService';
import { securityService } from '../services/securityService';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Check,
  Copy,
  KeyRound,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  chat: Chat;
  currentUser: User;
  defaultPartner: User | null;
}

const PRESET_AMOUNTS = [500, 1000, 2500, 5000];

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  chat,
  currentUser,
  defaultPartner,
}) => {
  const [kind, setKind] = useState<'send' | 'request'>('send');
  const [selectedReceiverId, setSelectedReceiverId] = useState<string>(defaultPartner?.id || '');
  const [amountInput, setAmountInput] = useState('1000');
  const [method, setMethod] = useState<PaymentMethod>('jazzcash');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountTitle, setAccountTitle] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [note, setNote] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasPin = securityService.hasPin();
  const groupCandidates = chat.participants
    .filter((uid) => uid !== currentUser.id)
    .map((uid) => chatStore.getUser(uid))
    .filter((u): u is User => Boolean(u));

  const targetUser =
    defaultPartner || groupCandidates.find((u) => u.id === selectedReceiverId) || groupCandidates[0] || null;

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setPinInput('');
    setReferenceId('');
    setNote('');
    if (defaultPartner) {
      setSelectedReceiverId(defaultPartner.id);
    } else if (groupCandidates.length > 0 && !selectedReceiverId) {
      setSelectedReceiverId(groupCandidates[0].id);
    }
  }, [isOpen, defaultPartner?.id]);

  // Populate relevant account handle automatically based on Send vs Request
  useEffect(() => {
    if (!isOpen) return;
    const sourceAccount =
      kind === 'send' ? targetUser?.paymentAccount : currentUser.paymentAccount;
    if (sourceAccount) {
      setMethod(sourceAccount.method);
      setAccountNumber(sourceAccount.accountNumber);
      setAccountTitle(sourceAccount.accountTitle);
    } else {
      setAccountNumber(
        kind === 'send' ? targetUser?.phoneNumber || '' : currentUser.phoneNumber || ''
      );
      setAccountTitle(
        kind === 'send' ? targetUser?.displayName || '' : currentUser.displayName || ''
      );
    }
  }, [isOpen, kind, targetUser?.id, currentUser.id]);

  if (!isOpen) return null;

  const numericAmount = Number(amountInput.replace(/[^\d.]/g, ''));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!targetUser) {
      setErrorMsg('Please select a recipient in this chat.');
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 10000000) {
      setErrorMsg('Enter a valid amount between Rs. 1 and Rs. 10,000,000.');
      return;
    }

    if (kind === 'send' && hasPin) {
      if (pinInput.length !== 4) {
        setErrorMsg('Enter your 4-digit security PIN to authorize payment.');
        return;
      }
      const ok = await securityService.verifyPin(pinInput);
      if (!ok) {
        setErrorMsg('Incorrect 4-digit security PIN.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Save my own payment account automatically if requesting and none saved yet
      if (kind === 'request' && accountNumber.trim() && !currentUser.paymentAccount) {
        await chatStore.updateProfile({
          paymentAccount: {
            method,
            accountNumber: accountNumber.trim(),
            accountTitle: accountTitle.trim() || currentUser.displayName,
            updatedAt: new Date().toISOString(),
          },
        });
      }

      await chatStore.sendPaymentMessage({
        chatId: chat.id,
        receiverId: targetUser.id,
        receiverName: targetUser.displayName,
        kind,
        amount: Math.round(numericAmount),
        method,
        accountNumber: accountNumber.trim(),
        accountTitle: accountTitle.trim() || (kind === 'send' ? targetUser.displayName : currentUser.displayName),
        referenceId: referenceId.trim() || undefined,
        note: note.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not process payment message.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 select-none"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#064E29] via-[#0B8043] to-[#0FA958] px-5 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Banknote className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold font-['Outfit']">DOST Pay</h2>
              <p className="text-[11px] text-emerald-100">
                Local transfers & payment requests in chat
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-white/15 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Segmented Mode Selector */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl">
            <button
              type="button"
              onClick={() => setKind('send')}
              className={`min-h-[44px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                kind === 'send'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Send Money</span>
            </button>
            <button
              type="button"
              onClick={() => setKind('request')}
              className={`min-h-[44px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                kind === 'request'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>Request Money</span>
            </button>
          </div>

          {/* Recipient picker (for group chats) or badge (for private chats) */}
          {chat.type !== 'private' && groupCandidates.length > 0 ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {kind === 'send' ? 'Pay Member' : 'Request From Member'}
              </label>
              <select
                value={selectedReceiverId}
                onChange={(e) => setSelectedReceiverId(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
              >
                {groupCandidates.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName} ({u.email})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            targetUser && (
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                <img
                  src={
                    targetUser.photoUrl ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetUser.id}`
                  }
                  alt={targetUser.displayName}
                  className="w-10 h-10 rounded-full object-cover border border-emerald-200"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {kind === 'send' ? 'Sending to ' : 'Requesting from '}
                    {targetUser.displayName}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {targetUser.paymentAccount
                      ? `${PAYMENT_RAILS[targetUser.paymentAccount.method].name} · ${targetUser.paymentAccount.accountNumber}`
                      : 'No linked wallet saved yet — enter number below'}
                  </p>
                </div>
              </div>
            )
          )}

          {/* Amount Input + Quick Presets */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Amount (PKR)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-emerald-700">
                Rs.
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={10000000}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full pl-11 pr-4 py-3 text-xl font-extrabold font-mono tabular-nums text-slate-900 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:bg-white focus:border-emerald-500"
                required
              />
            </div>

            <div className="grid grid-cols-4 gap-1.5 mt-2">
              {PRESET_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmountInput(String(amt))}
                  className={`min-h-[38px] rounded-xl text-xs font-bold font-mono tabular-nums border transition-colors cursor-pointer ${
                    numericAmount === amt
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {amt.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Local Payment Rail Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Payment Method (Local Rail)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {(Object.keys(PAYMENT_RAILS) as PaymentMethod[]).map((id) => {
                const rail = PAYMENT_RAILS[id];
                const active = method === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMethod(id)}
                    className={`min-h-[42px] px-2.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer truncate ${
                      active
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/30'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {rail.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Wallet Number / IBAN */}
          <div className="space-y-2.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  {kind === 'send' ? 'Recipient Wallet / IBAN' : 'Your Receiving Wallet / IBAN'}
                </label>
                {accountNumber && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(accountNumber);
                      setCopiedAccount(true);
                      setTimeout(() => setCopiedAccount(false), 1500);
                    }}
                    className="text-[11px] font-semibold text-emerald-700 inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedAccount ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedAccount ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder={PAYMENT_RAILS[method].placeholder}
                className="w-full px-3 py-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Dinner, Rent, Work..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  TID / Ref (Optional)
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value)}
                  placeholder="Auto-generated if blank"
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* 4-Digit Security PIN Verification (when sending and PIN is configured) */}
          {kind === 'send' && hasPin && (
            <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-1.5">
              <label className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                <span>Verify 4-Digit Security PIN</span>
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                className="w-full px-3 py-2 text-sm font-mono tracking-[0.4em] bg-white border border-emerald-200 rounded-xl focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {errorMsg && (
            <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl">
              {errorMsg}
            </p>
          )}

          <p className="text-[11px] text-slate-500 leading-relaxed flex items-start gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Pay directly using {PAYMENT_RAILS[method].name} / mobile banking and attach your confirmation receipt right inside this chat.
            </span>
          </p>
        </div>

        {/* Sticky Bottom CTA */}
        <div className="p-4 border-t border-slate-100 bg-white shrink-0">
          <button
            type="submit"
            disabled={isSubmitting || !targetUser || !numericAmount}
            className="w-full min-h-[48px] bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 active:scale-[0.99] transition-all"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>
              {kind === 'send'
                ? `Send ${formatPKR(numericAmount || 0)} Receipt`
                : `Request ${formatPKR(numericAmount || 0)}`}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
