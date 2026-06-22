import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../auth/useAuth';
import type { RecurringCategory, RecurringPayment } from '../../types/ledger';
import type { FundCode } from '../../types/config';

type CreateInput = {
  name: string;
  category: RecurringCategory;
  amountPaise: number;
  dueDay: number;
  fundHead: FundCode;
  accountId: string;
  active: boolean;
  startYearMonth: string;
  vendorId?: string;
  endYearMonth?: string;
  description?: string;
};

export function useRecurringPayments() {
  const { societyId, user } = useAuth();
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!societyId) return;
    const q = query(
      collection(db, `societies/${societyId}/recurringPayments`),
      orderBy('createdAt', 'asc'),
    );
    return onSnapshot(q, snap => {
      setRecurringPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as RecurringPayment)));
      setLoading(false);
    });
  }, [societyId]);

  async function createRecurringPayment(data: CreateInput): Promise<void> {
    if (!societyId || !user) return;
    const doc_data: Record<string, unknown> = {
      societyId,
      name: data.name,
      category: data.category,
      amountPaise: data.amountPaise,
      dueDay: data.dueDay,
      fundHead: data.fundHead,
      accountId: data.accountId,
      active: data.active,
      startYearMonth: data.startYearMonth,
      createdAt: serverTimestamp(),
      createdBy: user.uid,
    };
    if (data.vendorId) doc_data.vendorId = data.vendorId;
    if (data.endYearMonth) doc_data.endYearMonth = data.endYearMonth;
    if (data.description) doc_data.description = data.description;
    await addDoc(collection(db, `societies/${societyId}/recurringPayments`), doc_data);
  }

  async function updateRecurringPayment(
    id: string,
    data: Partial<Omit<CreateInput, never>>,
  ): Promise<void> {
    if (!societyId) return;
    const update: Record<string, unknown> = { ...data };
    // Explicitly unset optional fields when cleared
    if ('vendorId' in data && !data.vendorId) update.vendorId = null;
    if ('endYearMonth' in data && !data.endYearMonth) update.endYearMonth = null;
    if ('description' in data && !data.description) update.description = null;
    await updateDoc(doc(db, `societies/${societyId}/recurringPayments`, id), update);
  }

  async function toggleActive(id: string, active: boolean): Promise<void> {
    if (!societyId) return;
    await updateDoc(doc(db, `societies/${societyId}/recurringPayments`, id), { active });
  }

  async function deleteRecurringPayment(id: string): Promise<void> {
    if (!societyId) return;
    await deleteDoc(doc(db, `societies/${societyId}/recurringPayments`, id));
  }

  return { recurringPayments, loading, createRecurringPayment, updateRecurringPayment, toggleActive, deleteRecurringPayment };
}
