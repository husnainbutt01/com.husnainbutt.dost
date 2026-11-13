import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { chatStore } from '../services/chatService';
import { authService } from '../services/firebaseAuth';
import { uploadMediaFile } from '../services/storageService';
import {
  Mail,
  Lock,
  User as UserIcon,
  Phone,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  LogIn,
  AlertCircle,
  Camera,
  KeyRound,
  ArrowLeft,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onUserChanged: (user: User) => void;
  isRequired?: boolean;
  needsProfileSetup?: boolean;
}

function getFriendlyAuthError(err: any): string {
  const code = err?.code || '';
  if (code === 'auth/operation-not-allowed') {
    return 'Email/Password sign-in is currently disabled in Firebase Console. Enable it in Firebase Authentication → Sign-in method, or use "Continue with Google" below.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'This email is already registered. Please switch to Sign In.';
  }
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return 'Incorrect email or password. Try again or reset your password.';
  }
  if (code === 'auth/user-not-found') {
    return 'No account found with this email. Please create an account first.';
  }
  if (code === 'auth/weak-password') {
    return 'Password must be at least 6 characters long.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Google sign-in popup was closed before completing.';
  }
  if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
    return 'Google popup is blocked in this WebView/browser. Please use Email & Password sign-in/registration above (make sure Email/Password is enabled in Firebase Console).';
  }
  return err?.message || 'Authentication failed. Please try again.';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChanged,
  isRequired = false,
  needsProfileSetup = false,
}) => {
  const [mode, setMode] = useState<'register' | 'login' | 'forgot' | 'setup'>(
    needsProfileSetup ? 'setup' : 'register'
  );
  const [name, setName] = useState(currentUser?.displayName || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState(currentUser?.phoneNumber || '');
  const [bio, setBio] = useState(currentUser?.bio || 'Hey there! I am using DOST Messaging App.');
  const [avatarPreview, setAvatarPreview] = useState(currentUser?.photoUrl || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isEmailProviderDisabled, setIsEmailProviderDisabled] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (needsProfileSetup && currentUser) {
      setMode('setup');
      setName(currentUser.displayName || '');
      setPhone(currentUser.phoneNumber || '');
      setBio(currentUser.bio || 'Hey there! I am using DOST Messaging App.');
      setAvatarPreview(currentUser.photoUrl || '');
    } else if (!currentUser && mode === 'setup') {
      setMode('register');
    }
  }, [needsProfileSetup, currentUser]);

  if (!isOpen) return null;

  const handleAvatarSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMsg('');
    setIsEmailProviderDisabled(false);
    setSuccessMsg('');
    try {
      const user = await authService.signInWithGoogle();
      chatStore.setCurrentUser(user);
      onUserChanged(user);
      if (!user.isProfileComplete) {
        setMode('setup');
        setName(user.displayName);
        setAvatarPreview(user.photoUrl || '');
      } else {
        setSuccessMsg(`Welcome, ${user.displayName}!`);
        setTimeout(() => onClose(), 700);
      }
    } catch (err: any) {
      setErrorMsg(getFriendlyAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setErrorMsg('Please fill in your full name, email, and password.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setIsEmailProviderDisabled(false);
    setSuccessMsg('');
    try {
      const user = await authService.registerWithEmail({
        displayName: name.trim(),
        email: email.trim(),
        password: password.trim(),
        phoneNumber: phone.trim() || undefined,
        bio: bio.trim() || undefined,
      });

      if (avatarFile) {
        try {
          const uploadedPhotoUrl = await uploadMediaFile(
            `avatars/${user.id}/${Date.now()}_${avatarFile.name}`,
            avatarFile,
            { isImage: true }
          );
          user.photoUrl = uploadedPhotoUrl;
          await authService.saveUserToFirestore(user);
        } catch {}
      }

      chatStore.setCurrentUser(user);
      onUserChanged(user);
      setSuccessMsg('Account created! Verification email sent.');
      setTimeout(() => onClose(), 900);
    } catch (err: any) {
      if (err?.code === 'auth/operation-not-allowed') {
        setIsEmailProviderDisabled(true);
      }
      setErrorMsg(getFriendlyAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter your email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setIsEmailProviderDisabled(false);
    setSuccessMsg('');
    try {
      const user = await authService.loginWithEmail(email.trim(), password.trim());
      chatStore.setCurrentUser(user);
      onUserChanged(user);
      setSuccessMsg(`Welcome back, ${user.displayName}!`);
      setTimeout(() => onClose(), 700);
    } catch (err: any) {
      if (err?.code === 'auth/operation-not-allowed') {
        setIsEmailProviderDisabled(true);
      }
      setErrorMsg(getFriendlyAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Please enter your registered email address.');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await authService.resetPassword(email.trim());
      setSuccessMsg('Password reset link sent to your email.');
    } catch (err: any) {
      setErrorMsg(getFriendlyAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteProfileSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !name.trim()) {
      setErrorMsg('Please enter your display name.');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      let finalPhotoUrl = currentUser.photoUrl;
      if (avatarFile) {
        finalPhotoUrl = await uploadMediaFile(
          `avatars/${currentUser.id}_${Date.now()}`,
          avatarFile,
          { isImage: true }
        );
      }

      await chatStore.updateProfile({
        displayName: name.trim(),
        phoneNumber: phone.trim(),
        bio: bio.trim() || 'Hey there! I am using DOST Messaging App.',
        photoUrl: finalPhotoUrl,
        isProfileComplete: true,
      });

      const updated = chatStore.getCurrentUser();
      if (updated) onUserChanged(updated);
      setSuccessMsg('Profile saved! Entering chats...');
      setTimeout(() => onClose(), 600);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not save profile.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 max-h-[92vh] flex flex-col">
        {/* Top Emerald Header */}
        <div className="bg-gradient-to-r from-[#0FA958] via-[#0B8043] to-[#054C28] p-6 text-white text-center relative shrink-0">
          {!isRequired && currentUser && mode !== 'setup' && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-emerald-200 hover:text-white text-lg p-1 cursor-pointer"
            >
              ✕
            </button>
          )}

          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-white/10 p-1 backdrop-blur-sm border border-white/20 shadow-md flex items-center justify-center overflow-hidden">
            <img
              src="/assets/aistudio/download_7eb2aac4.jpeg"
              alt="DOST Logo"
              className="w-full h-full object-cover rounded-xl"
            />
          </div>

          <h2 className="text-xl font-bold font-['Outfit']">
            {mode === 'setup'
              ? 'Complete Your DOST Profile'
              : mode === 'forgot'
              ? 'Reset Password'
              : mode === 'register'
              ? 'Create Your DOST Account'
              : 'Sign In to DOST'}
          </h2>
          <p className="text-xs text-emerald-100/90 mt-0.5">
            {mode === 'setup'
              ? 'One-time setup before chatting with real users'
              : 'One-time registration · Real users & real-time messaging'}
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto">
          {errorMsg && (
            <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>

              {isEmailProviderDisabled && (
                <div className="pt-2 border-t border-rose-200/70 space-y-2">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs cursor-pointer transition-colors"
                  >
                    Continue with Google Now (Works Immediately)
                  </button>
                  <div className="text-[11px] text-rose-700 space-y-1">
                    <p className="font-semibold">To enable Email/Password login in Firebase:</p>
                    <p>1. Open Firebase Console → Authentication → Sign-in method.</p>
                    <p>2. Click Email/Password → toggle Enable → Save.</p>
                    <a
                      href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline mt-0.5"
                    >
                      <span>Open Firebase Auth Providers</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="font-semibold">{successMsg}</span>
            </div>
          )}

          {/* Profile Completion Step */}
          {mode === 'setup' ? (
            <form onSubmit={handleCompleteProfileSetup} className="space-y-3.5">
              <div className="flex flex-col items-center mb-2">
                <div className="relative">
                  <img
                    src={
                      avatarPreview ||
                      currentUser?.photoUrl ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.id || 'dost'}`
                    }
                    alt="Profile"
                    className="w-20 h-20 rounded-full object-cover border-2 border-emerald-500 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 w-7 h-7 bg-emerald-600 text-white rounded-full flex items-center justify-center border-2 border-white shadow cursor-pointer hover:bg-emerald-700"
                    title="Upload Profile Picture"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarSelected}
                    className="hidden"
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-1.5">Tap camera to upload profile picture</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Display Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your real name"
                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+92 300 1234567"
                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">About / Bio</label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                <span>{isLoading ? 'Saving Profile...' : 'Save & Start Chatting'}</span>
              </button>
            </form>
          ) : (
            <>
              {mode !== 'forgot' && (
                <>
                  {/* 1-Click Real Google Authentication */}
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="w-full py-3 px-4 bg-emerald-50/70 hover:bg-emerald-50 text-slate-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2.5 shadow-xs transition-all cursor-pointer mb-4"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Continue with Google (Instant Sign-In)</span>
                  </button>

                  <div className="relative flex items-center justify-center mb-4">
                    <div className="border-t border-slate-200 w-full" />
                    <span className="bg-white px-3 text-[11px] text-slate-400 uppercase tracking-wider absolute">
                      or email & password
                    </span>
                  </div>
                </>
              )}

              {mode === 'register' && (
                <form onSubmit={handleRegister} className="space-y-3">
                  {/* Optional Profile Photo Upload */}
                  <div className="flex items-center gap-3 pb-1">
                    <div className="relative shrink-0">
                      <img
                        src={
                          avatarPreview ||
                          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || 'dost')}`
                        }
                        alt="Avatar Preview"
                        className="w-12 h-12 rounded-full object-cover border border-emerald-300"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center border-2 border-white cursor-pointer"
                      >
                        <Camera className="w-3 h-3" />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarSelected}
                        className="hidden"
                      />
                    </div>
                    <div className="text-[11px] text-slate-500">
                      <p className="font-semibold text-slate-700">Profile Picture (Optional)</p>
                      <p>Upload your real photo so contacts recognize you</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Your Real Full Name</label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your full name"
                        className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number (Optional)</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+92 300 1234567"
                        className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md transition-colors cursor-pointer mt-2 flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    <span>{isLoading ? 'Creating Account...' : 'Create Account'}</span>
                  </button>

                  <div className="text-center text-xs text-slate-500 pt-2">
                    Already registered?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg('');
                        setIsEmailProviderDisabled(false);
                        setSuccessMsg('');
                        setMode('login');
                      }}
                      className="text-emerald-700 font-semibold hover:underline cursor-pointer"
                    >
                      Sign In
                    </button>
                  </div>
                </form>
              )}

              {mode === 'login' && (
                <form onSubmit={handleLogin} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">Password</label>
                      <button
                        type="button"
                        onClick={() => {
                          setErrorMsg('');
                          setIsEmailProviderDisabled(false);
                          setSuccessMsg('');
                          setMode('forgot');
                        }}
                        className="text-[11px] text-emerald-700 font-semibold hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md transition-colors cursor-pointer mt-2 flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                    <span>{isLoading ? 'Signing In...' : 'Sign In'}</span>
                  </button>

                  <div className="text-center text-xs text-slate-500 pt-2">
                    New to DOST?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg('');
                        setIsEmailProviderDisabled(false);
                        setSuccessMsg('');
                        setMode('register');
                      }}
                      className="text-emerald-700 font-semibold hover:underline cursor-pointer"
                    >
                      Register once
                    </button>
                  </div>
                </form>
              )}

              {mode === 'forgot' && (
                <form onSubmit={handleForgotPassword} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Registered Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    <span>{isLoading ? 'Sending Link...' : 'Send Password Reset Email'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setIsEmailProviderDisabled(false);
                      setSuccessMsg('');
                      setMode('login');
                    }}
                    className="w-full py-2 text-xs text-slate-600 font-semibold hover:text-emerald-700 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Sign In</span>
                  </button>
                </form>
              )}
            </>
          )}

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Firebase Authentication & Cloud Firestore</span>
          </div>
        </div>
      </div>
    </div>
  );
};
