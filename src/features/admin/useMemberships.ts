import { useState, useEffect, useCallback } from 'react';
import { query, where, getDocs, collection } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { membershipConverter } from '../../lib/converters';
import type { Membership } from '../../types/auth';

export function useMemberships(societyId: string | null) {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  const fetch = useCallback(async () => {
    if (!societyId) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const q = query(
        collection(db, 'memberships').withConverter(membershipConverter),
        where('societyId', '==', societyId),
      );
      const snap = await getDocs(q);
      setMemberships(snap.docs.map(d => d.data()));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [societyId]);

  useEffect(() => { void fetch(); }, [fetch]);

  return { memberships, loading, error, refetch: fetch };
}
