import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, type Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { COLLECTIONS } from '../../lib/db';
import { useAuth } from '../auth/useAuth';

export interface AuditLogEntry {
  id: string;
  societyId: string;
  actorUid: string;
  actorRole?: string;
  action: string;
  targetType: string;
  targetId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  at: Timestamp;
}

const PAGE_SIZE = 500;

export function useAuditLogs() {
  const { societyId, role } = useAuth();
  const [logs,    setLogs]    = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!societyId || role !== 'admin') { setLoading(false); return; }

    setLoading(true);
    const q = query(
      collection(db, COLLECTIONS.auditLogs(societyId)),
      orderBy('at', 'desc'),
      limit(PAGE_SIZE),
    );

    getDocs(q)
      .then(snap => {
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLogEntry)));
      })
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [societyId, role]);

  return { logs, loading, error };
}
