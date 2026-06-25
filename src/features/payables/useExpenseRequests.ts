import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../auth/useAuth';
import { tsMillis } from '../../lib/date';
import type { ExpenseRequest, ExpenseRequestStatus, ExpenseRequestType } from '../../types/requests';

export function useExpenseRequests(type: ExpenseRequestType, statuses?: ExpenseRequestStatus[]) {
  const { societyId } = useAuth();
  const [requests, setRequests] = useState<ExpenseRequest[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!societyId) return;
    const constraints = [
      where('type', '==', type),
      ...(statuses?.length ? [where('status', 'in', statuses)] : []),
    ];
    const q = query(collection(db, `societies/${societyId}/expenseRequests`), ...constraints);
    return onSnapshot(
      q,
      snap => {
        const docs = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as ExpenseRequest))
          .sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt));
        setRequests(docs);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [societyId, type, statuses?.join(',')]);  // eslint-disable-line react-hooks/exhaustive-deps

  return { requests, loading };
}
