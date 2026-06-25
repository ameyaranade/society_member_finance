import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { COLLECTIONS } from '../../lib/db';
import { useAuth } from '../auth/useAuth';
import type { CollectionEntry, CollectionPeriod } from '../../types/receivables';

export function useCollectionPeriods() {
  const { societyId } = useAuth();
  const [periods, setPeriods] = useState<CollectionPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!societyId) return;
    const q = query(
      collection(db, COLLECTIONS.collections(societyId)),
      orderBy('period', 'desc'),
    );
    return onSnapshot(q, snap => {
      setPeriods(snap.docs.map(d => ({ id: d.id, ...d.data() } as CollectionPeriod)));
      setLoading(false);
    }, () => setLoading(false));
  }, [societyId]);

  return { periods, loading };
}

export function useCollectionEntries(period: string | null) {
  const { societyId } = useAuth();
  const [entries, setEntries] = useState<CollectionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!societyId || !period) { setLoading(false); return; }
    const q = query(
      collection(db, COLLECTIONS.collectionEntries(societyId, period)),
      orderBy('tower', 'asc'),
      orderBy('flatNumber', 'asc'),
    );
    return onSnapshot(q, snap => {
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as CollectionEntry)));
      setLoading(false);
    }, () => setLoading(false));
  }, [societyId, period]);

  async function markPaid(
    entryId: string,
    data: { amountReceivedPaise: number; paidAt: string; referenceNo?: string; txnId?: string },
  ) {
    if (!societyId || !period) return;
    await updateDoc(doc(db, COLLECTIONS.collectionEntries(societyId, period), entryId), {
      status: 'paid',
      ...data,
      updatedAt: serverTimestamp(),
    });
  }

  async function markPending(entryId: string) {
    if (!societyId || !period) return;
    await updateDoc(doc(db, COLLECTIONS.collectionEntries(societyId, period), entryId), {
      status: 'pending',
      amountReceivedPaise: null,
      paidAt: null,
      referenceNo: null,
      txnId: null,
      updatedAt: serverTimestamp(),
    });
  }

  return { entries, loading, markPaid, markPending };
}
