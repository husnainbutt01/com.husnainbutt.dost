import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile as updateFirebaseProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, getDocFromCache, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { User } from '../types';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const CACHED_USER_KEY = (uid: string) => `dost_cached_user_${uid}`;

interface PendingRegistration {
  email: string;
  displayName: string;
  phoneNumber?: string;
  bio?: string;
  photoUrl?: string;
}

export class AuthService {
  private pendingRegistration: PendingRegistration | null = null;

  onAuthChange(callback: (fbUser: FirebaseUser | null) => void) {
    return onAuthStateChanged(auth, callback);
  }

  getCachedUserProfile(uid: string): User | null {
    try {
      const raw = localStorage.getItem(CACHED_USER_KEY(uid));
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }

  private cacheUserProfile(user: User) {
    try {
      localStorage.setItem(CACHED_USER_KEY(user.id), JSON.stringify(user));
    } catch {}
  }

  // Fetch or bootstrap user profile from Firestore (with offline cache fallback)
  async getOrCreateUserProfile(fbUser: FirebaseUser): Promise<User> {
    const userRef = doc(db, 'users', fbUser.uid);
    let existing: User | null = null;
    const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

    const pending =
      this.pendingRegistration &&
      fbUser.email &&
      this.pendingRegistration.email.toLowerCase() === fbUser.email.toLowerCase()
        ? this.pendingRegistration
        : null;

    try {
      const snap = isOnline ? await getDoc(userRef) : await getDocFromCache(userRef).catch(() => null);
      if (snap && snap.exists()) {
        existing = snap.data() as User;
      }
    } catch {
      try {
        const cachedSnap = await getDocFromCache(userRef);
        if (cachedSnap.exists()) {
          existing = cachedSnap.data() as User;
        }
      } catch {}
    }

    if (!existing) {
      existing = this.getCachedUserProfile(fbUser.uid);
    }

    if (existing) {
      const updated: User = {
        ...existing,
        displayName:
          pending?.displayName ||
          existing.displayName ||
          fbUser.displayName ||
          fbUser.email?.split('@')[0] ||
          'DOST User',
        email: existing.email || fbUser.email || 'user@dostapp.io',
        phoneNumber: pending?.phoneNumber ?? existing.phoneNumber ?? fbUser.phoneNumber ?? '',
        bio: pending?.bio || existing.bio || 'Hey there! I am using DOST Messaging App.',
        photoUrl:
          pending?.photoUrl ||
          existing.photoUrl ||
          fbUser.photoURL ||
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${fbUser.uid}`,
        isProfileComplete: pending ? true : existing.isProfileComplete,
        isOnline: isOnline,
        lastSeen: isOnline ? 'Online' : existing.lastSeen,
        updatedAt: new Date().toISOString(),
      };
      this.cacheUserProfile(updated);
      if (isOnline) {
        this.saveUserToFirestore(updated).catch(() => {});
      }
      return updated;
    }

    // Brand new authenticated user -> create profile document
    const isGoogleAdmin = fbUser.email === 'hbontop01@gmail.com' && fbUser.emailVerified;
    const resolvedName =
      pending?.displayName || fbUser.displayName || fbUser.email?.split('@')[0] || 'DOST User';
    const newUser: User = {
      id: fbUser.uid,
      email: fbUser.email || pending?.email || 'user@dostapp.io',
      displayName: resolvedName,
      photoUrl:
        pending?.photoUrl ||
        fbUser.photoURL ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(resolvedName || fbUser.uid)}`,
      phoneNumber: pending?.phoneNumber || fbUser.phoneNumber || '',
      bio: pending?.bio || 'Hey there! I am using DOST Messaging App.',
      isOnline,
      lastSeen: isOnline ? 'Online' : new Date().toISOString(),
      role: isGoogleAdmin ? 'admin' : 'user',
      isProfileComplete: Boolean(pending || fbUser.displayName),
      privacySettings: {
        lastSeenVisibility: 'everyone',
        readReceipts: true,
        profilePhotoVisibility: 'everyone',
        allowGroupAdd: 'everyone',
      },
      notificationSettings: {
        messageSounds: true,
        callRingtones: true,
        inAppAlerts: true,
        previewMessage: true,
        vibrate: true,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.cacheUserProfile(newUser);
    const saveOp = this.saveUserToFirestore(newUser);
    if (isOnline) {
      await saveOp;
    } else {
      saveOp.catch(() => {});
    }
    return newUser;
  }

  async signInWithGoogle(): Promise<User> {
    const result = await signInWithPopup(auth, googleProvider);
    return await this.getOrCreateUserProfile(result.user);
  }

  async registerWithEmail(params: {
    email: string;
    password: string;
    displayName: string;
    phoneNumber?: string;
    bio?: string;
    photoUrl?: string;
  }): Promise<User> {
    this.pendingRegistration = {
      email: params.email,
      displayName: params.displayName,
      phoneNumber: params.phoneNumber,
      bio: params.bio,
      photoUrl: params.photoUrl,
    };

    try {
      const credential = await createUserWithEmailAndPassword(auth, params.email, params.password);
      const fbUser = credential.user;

      try {
        await updateFirebaseProfile(fbUser, {
          displayName: params.displayName,
          photoURL: params.photoUrl && params.photoUrl.length <= 2000 ? params.photoUrl : undefined,
        });
      } catch {}

      try {
        await sendEmailVerification(fbUser);
      } catch {}

      const user: User = {
        id: fbUser.uid,
        email: params.email,
        displayName: params.displayName,
        phoneNumber: params.phoneNumber || '',
        photoUrl:
          params.photoUrl ||
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(params.displayName)}`,
        bio: params.bio || 'Hey there! I am using DOST Messaging App.',
        isOnline: true,
        lastSeen: 'Online',
        role: 'user',
        isProfileComplete: true,
        privacySettings: {
          lastSeenVisibility: 'everyone',
          readReceipts: true,
          profilePhotoVisibility: 'everyone',
          allowGroupAdd: 'everyone',
        },
        notificationSettings: {
          messageSounds: true,
          callRingtones: true,
          inAppAlerts: true,
          previewMessage: true,
          vibrate: true,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.cacheUserProfile(user);
      await this.saveUserToFirestore(user);
      return user;
    } finally {
      this.pendingRegistration = null;
    }
  }

  async loginWithEmail(email: string, password: string): Promise<User> {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return await this.getOrCreateUserProfile(credential.user);
  }

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  }

  isEmailVerified(): boolean {
    return Boolean(auth.currentUser?.emailVerified);
  }

  async resendEmailVerification(): Promise<void> {
    if (!auth.currentUser) throw new Error('Not signed in');
    await sendEmailVerification(auth.currentUser);
  }

  async saveUserToFirestore(user: User) {
    this.cacheUserProfile(user);
    try {
      const userRef = doc(db, 'users', user.id);
      await setDoc(
        userRef,
        {
          ...user,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.id}`);
      }
    }
  }

  async setOfflineStatus(userId: string) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(
        userRef,
        {
          isOnline: false,
          lastSeen: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch {}
  }

  async signOut() {
    const uid = auth.currentUser?.uid;
    if (uid) {
      await this.setOfflineStatus(uid);
      try {
        localStorage.removeItem(CACHED_USER_KEY(uid));
      } catch {}
    }
    await firebaseSignOut(auth);
  }
}

export const authService = new AuthService();
