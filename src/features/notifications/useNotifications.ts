import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../auth/useAuth';
import { tsToDate } from '../../lib/date';

export interface AppNotification {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: Date | null;
}

export function useNotifications() {
  const { user, societyId } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || !societyId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    // Single-field equality query (no composite index needed).
    // Filter unread and sort client-side.
    const q = query(
      collection(db, `societies/${societyId}/notifications`),
      where('toUid', '==', user.uid),
    );

    const unsub = onSnapshot(q, snap => {
      const unread = snap.docs
        .filter(d => d.data().readAt === null)
        .map(d => ({
          id: d.id,
          type: d.data().type as string,
          payload: (d.data().payload ?? {}) as Record<string, unknown>,
          createdAt: tsToDate(d.data().createdAt),
        }))
        .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
      setNotifications(unread);
      setLoading(false);
    });

    return unsub;
  }, [user?.uid, societyId]);

  async function markRead(notificationId: string) {
    if (!societyId) return;
    await updateDoc(doc(db, `societies/${societyId}/notifications/${notificationId}`), {
      readAt: serverTimestamp(),
    });
  }

  async function markAllRead() {
    await Promise.all(notifications.map(n => markRead(n.id)));
  }

  return {
    notifications,
    unreadCount: notifications.length,
    loading,
    markRead,
    markAllRead,
  };
}
