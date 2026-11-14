import {
  collection,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { PaymentMethod, PaymentTransaction } from '../types';

export interface PaymentRailMeta {
  id: PaymentMethod;
  name: string;
  placeholder: string;
  badgeClass: string;
}

export const PAYMENT_RAILS: Record<PaymentMethod, PaymentRailMeta> = {
  jazzcash: {
    id: 'jazzcash',
    name: 'JazzCash',
    placeholder: '0300-1234567',
    badgeClass: 'text-rose-700 bg-rose-50 border-rose-200',
  },
  easypaisa: {
    id: 'easypaisa',
    name: 'Easypaisa',
    placeholder: '0345-1234567',
    badgeClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  },
  sadapay: {
    id: 'sadapay',
    name: 'SadaPay',
    placeholder: '03XX-1234567',
    badgeClass: 'text-teal-700 bg-teal-50 border-teal-200',
  },
  nayapay: {
    id: 'nayapay',
    name: 'NayaPay',
    placeholder: '03XX-1234567',
    badgeClass: 'text-orange-700 bg-orange-50 border-orange-200',
  },
  raast: {
    id: 'raast',
    name: 'Raast / Bank IBAN',
    placeholder: 'PK36MEZN0000000000000001',
    badgeClass: 'text-sky-700 bg-sky-50 border-sky-200',
  },
};

export function formatPKR(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `Rs. ${safe.toLocaleString('en-PK')}`;
}

export function generatePaymentRef(): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const num = Date.now().toString().slice(-5);
  return `DP-${num}-${rand}`;
}

class PaymentService {
  private transactions: PaymentTransaction[] = [];
  private listeners = new Set<() => void>();
  private unsubOut: (() => void) | null = null;
  private unsubIn: (() => void) | null = null;
  private currentUserId: string | null = null;

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  getTransactions(): PaymentTransaction[] {
    return this.transactions;
  }

  startListening(userId: string) {
    if (this.currentUserId === userId && this.unsubOut) return;
    this.stopListening();
    this.currentUserId = userId;

    let outgoing: PaymentTransaction[] = [];
    let incoming: PaymentTransaction[] = [];

    const merge = () => {
      const map = new Map<string, PaymentTransaction>();
      [...outgoing, ...incoming].forEach((tx) => map.set(tx.id, tx));
      this.transactions = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      this.notify();
    };

    try {
      this.unsubOut = onSnapshot(
        query(collection(db, 'payments'), where('senderId', '==', userId)),
        (snap) => {
          outgoing = snap.docs.map((d) => d.data() as PaymentTransaction);
          merge();
        },
        () => {}
      );

      this.unsubIn = onSnapshot(
        query(collection(db, 'payments'), where('receiverId', '==', userId)),
        (snap) => {
          incoming = snap.docs.map((d) => d.data() as PaymentTransaction);
          merge();
        },
        () => {}
      );
    } catch {}
  }

  stopListening() {
    if (this.unsubOut) {
      this.unsubOut();
      this.unsubOut = null;
    }
    if (this.unsubIn) {
      this.unsubIn();
      this.unsubIn = null;
    }
    this.currentUserId = null;
    this.transactions = [];
    this.notify();
  }

  async createLedgerEntry(tx: PaymentTransaction): Promise<void> {
    try {
      await setDoc(doc(db, 'payments', tx.id), tx);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `payments/${tx.id}`);
    }
  }

  async updateLedgerStatus(
    paymentId: string,
    status: 'pending' | 'sent' | 'completed' | 'declined',
    referenceId?: string
  ): Promise<void> {
    try {
      const updates: Record<string, string> = {
        status,
        updatedAt: new Date().toISOString(),
      };
      if (referenceId) {
        updates.referenceId = referenceId;
      }
      await updateDoc(doc(db, 'payments', paymentId), updates);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `payments/${paymentId}`);
    }
  }
}

export const paymentService = new PaymentService();
