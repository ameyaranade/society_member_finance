import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../auth/useAuth';
import type { ExpenseRequest } from '../../types/requests';

/** Returns all expense requests currently in `requested` status, oldest-first. */
export function useRequestedQueue() {
  const { societyId } = useAuth();
  const [requests, setRequests] = useState<ExpenseRequest[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!societyId) { setLoading(false); return; }
    const q = query(
      collection(db, `societies/${societyId}/expenseRequests`),
      where('status', '==', 'requested'),
    );
    return onSnapshot(
      q,
      snap => {
        const docs = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as ExpenseRequest))
          .sort((a, b) => {
            const ta = (a.submittedAt as unknown as { toMillis?: () => number })?.toMillis?.() ?? 0;
            const tb = (b.submittedAt as unknown as { toMillis?: () => number })?.toMillis?.() ?? 0;
            return ta - tb; // oldest first
          });
        setRequests(docs);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [societyId]);

  return { requests, loading };
}
