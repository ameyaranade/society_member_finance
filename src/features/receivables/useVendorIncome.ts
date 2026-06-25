import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, addDoc, updateDoc, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { COLLECTIONS } from '../../lib/db';
import { useAuth } from '../auth/useAuth';
import type { VendorIncomeRecord } from '../../types/receivables';

export function useVendorIncome(period: string | null) {
  const { societyId, user } = useAuth();
  const [records, setRecords] = useState<VendorIncomeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!societyId || !period) { setLoading(false); return; }
    const q = query(
      collection(db, COLLECTIONS.vendorIncome(societyId)),
      where('period', '==', period),
      orderBy('period', 'desc'),
    );
    return onSnapshot(q, snap => {
      setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as VendorIncomeRecord)));
      setLoading(false);
    }, () => setLoading(false));
  }, [societyId, period]);

  async function createRecord(data: {
    vendorId: string;
    vendorRelationId: string;
    period: string;
    expectedPaise: number;
    dueDate: string;
    remarks?: string;
  }): Promise<void> {
    if (!societyId || !user) return;
    await addDoc(collection(db, COLLECTIONS.vendorIncome(societyId)), {
      societyId,
      ...data,
      receivedPaise: 0,
      status: 'pending',
      createdAt: serverTimestamp(),
      createdBy: user.uid,
    });
  }

  async function recordReceipt(
    id: string,
    data: { receivedPaise: number; txnId?: string; remarks?: string },
  ): Promise<void> {
    if (!societyId || !user) return;
    await updateDoc(doc(db, COLLECTIONS.vendorIncome(societyId), id), {
      receivedPaise: data.receivedPaise,
      status: 'paid',
      txnId: data.txnId ?? null,
      remarks: data.remarks ?? null,
      updatedAt: serverTimestamp(),
    });
  }

  return { records, loading, createRecord, recordReceipt };
}
