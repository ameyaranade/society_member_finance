import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { COLLECTIONS } from '../../lib/db';
import { useSocietyCollection } from '../../lib/hooks';
import { useAuth } from '../auth/useAuth';
import type { Account, AccountType } from '../../types/config';

export function useAccounts() {
  const { societyId, user } = useAuth();
  const { items: accounts, loading } = useSocietyCollection<Account>(societyId, COLLECTIONS.accounts);

  async function createAccount(data: {
    name: string;
    type: AccountType;
    openingBalancePaise: number;
  }): Promise<void> {
    if (!societyId || !user) return;
    await addDoc(collection(db, COLLECTIONS.accounts(societyId)), {
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
    await updateDoc(doc(db, COLLECTIONS.accounts(societyId), id), data);
  }

  async function deleteAccount(id: string): Promise<void> {
    if (!societyId) return;
    await deleteDoc(doc(db, COLLECTIONS.accounts(societyId), id));
  }

  return { accounts, loading, createAccount, updateAccount, deleteAccount };
}
