import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, query, where,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../auth/useAuth';
import type { RecurringInstance, RecurringPayment } from '../../types/ledger';

export function useRecurringInstances(period: string) {
  const { societyId } = useAuth();
  const [instances, setInstances] = useState<RecurringInstance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!societyId || !period) return;
    const q = query(
      collection(db, `societies/${societyId}/recurringInstances`),
      where('period', '==', period),
    );
    return onSnapshot(q, snap => {
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as RecurringInstance))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      setInstances(docs);
      setLoading(false);
    });
  }, [societyId, period]);

  return { instances, loading };
}

/** For future months: projected instances from active templates. */
export function useProjectedInstances(period: string) {
  const { societyId } = useAuth();
  const [projected, setProjected] = useState<RecurringPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!societyId || !period) return;
    const q = query(
      collection(db, `societies/${societyId}/recurringPayments`),
      where('active', '==', true),
    );
    return onSnapshot(q, snap => {
      const all = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as RecurringPayment))
        .sort((a, b) => a.dueDay - b.dueDay);  // client-side sort avoids composite index
      setProjected(all.filter(t =>
        t.startYearMonth <= period &&
        (!t.endYearMonth || t.endYearMonth >= period),
      ));
      setLoading(false);
    });
  }, [societyId, period]);

  return { projected, loading };
}
