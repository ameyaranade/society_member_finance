import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../auth/useAuth';
import type { Account, AccountType } from '../../types/config';

export function useAccounts() {
  const { societyId, user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!societyId) return;
    const q = query(
      collection(db, `societies/${societyId}/accounts`),
      orderBy('createdAt', 'asc'),
    );
    return onSnapshot(q, snap => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Account)));
      setLoading(false);
    });
  }, [societyId]);

  async function createAccount(data: {
    name: string;
    type: AccountType;
    openingBalancePaise: number;
  }): Promise<void> {
    if (!societyId || !user) return;
    await addDoc(collection(db, `societies/${societyId}/accounts`), {
      societyId,
      ...data,
      currentBalancePaise: data.openingBalancePaise,
      createdAt: serverTimestamp(),
      createdBy: user.uid,
    });
  }

  async function updateAccount(
    id: string,
    data: Partial<Pick<Account, 'name' | 'type' | 'openingBalancePaise'>>,
  ): Promise<void> {
    if (!societyId) return;
    await updateDoc(doc(db, `societies/${societyId}/accounts`, id), data);
  }

  async function deleteAccount(id: string): Promise<void> {
    if (!societyId) return;
    await deleteDoc(doc(db, `societies/${societyId}/accounts`, id));
  }

  return { accounts, loading, createAccount, updateAccount, deleteAccount };
}
