import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Subscribe to a Firestore collection scoped to societyId, ordered by createdAt asc.
 * Pass a stable path function (e.g. COLLECTIONS.accounts) — recreated on societyId change only.
 */
export function useSocietyCollection<T extends { id: string }>(
  societyId: string | null | undefined,
  path: (societyId: string) => string,
): { items: T[]; loading: boolean } {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!societyId) return;
    const q = query(collection(db, path(societyId)), orderBy('createdAt', 'asc'));
    return onSnapshot(q, snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as T)));
      setLoading(false);
    });
  }, [societyId, path]); // path must be a stable reference (module-level constant)

  return { items, loading };
}
