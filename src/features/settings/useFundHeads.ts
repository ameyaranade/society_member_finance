import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../auth/useAuth';
import type { FundHead, FundCode } from '../../types/config';

export function useFundHeads() {
  const { societyId, user } = useAuth();
  const [fundHeads, setFundHeads] = useState<FundHead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!societyId) return;
    const q = query(
      collection(db, `societies/${societyId}/fundHeads`),
      orderBy('createdAt', 'asc'),
    );
    return onSnapshot(q, snap => {
      setFundHeads(snap.docs.map(d => ({ id: d.id, ...d.data() } as FundHead)));
      setLoading(false);
    });
  }, [societyId]);

  async function createFundHead(data: {
    name: string;
    code: FundCode;
    description?: string;
  }): Promise<void> {
    if (!societyId || !user) return;
    await addDoc(collection(db, `societies/${societyId}/fundHeads`), {
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
    await updateDoc(doc(db, `societies/${societyId}/fundHeads`, id), data);
  }

  async function deleteFundHead(id: string): Promise<void> {
    if (!societyId) return;
    await deleteDoc(doc(db, `societies/${societyId}/fundHeads`, id));
  }

  return { fundHeads, loading, createFundHead, updateFundHead, deleteFundHead };
}
