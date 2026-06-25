import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { COLLECTIONS } from '../../lib/db';
import { useSocietyCollection } from '../../lib/hooks';
import { useAuth } from '../auth/useAuth';
import type { FundHead, FundCode } from '../../types/config';

export function useFundHeads() {
  const { societyId, user } = useAuth();
  const { items: fundHeads, loading } = useSocietyCollection<FundHead>(societyId, COLLECTIONS.fundHeads);

  async function createFundHead(data: {
    name: string;
    code: FundCode;
    description?: string;
  }): Promise<void> {
    if (!societyId || !user) return;
    await addDoc(collection(db, COLLECTIONS.fundHeads(societyId)), {
      societyId,
      ...data,
      createdAt: serverTimestamp(),
      createdBy: user.uid,
    });
  }

  async function updateFundHead(
    id: string,
    data: Partial<Pick<FundHead, 'name' | 'code' | 'description'>>,
  ): Promise<void> {
    if (!societyId) return;
    await updateDoc(doc(db, COLLECTIONS.fundHeads(societyId), id), data);
  }

  async function deleteFundHead(id: string): Promise<void> {
    if (!societyId) return;
    await deleteDoc(doc(db, COLLECTIONS.fundHeads(societyId), id));
  }

  return { fundHeads, loading, createFundHead, updateFundHead, deleteFundHead };
}
