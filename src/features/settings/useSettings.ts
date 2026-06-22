import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../auth/useAuth';
import type { SocietyConfig } from '../../types/config';

export function useSettings() {
  const { societyId } = useAuth();
  const [config, setConfig] = useState<SocietyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!societyId) return;
    const ref = doc(db, 'societies', societyId);
    const unsub = onSnapshot(
      ref,
      snap => {
        const data = snap.data();
        setConfig((data?.config as SocietyConfig) ?? null);
        setLoading(false);
      },
      err => {
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [societyId]);

  async function updateConfig(patch: Partial<SocietyConfig>): Promise<void> {
    if (!societyId) return;
    const ref = doc(db, 'societies', societyId);
    // Use dot-notation keys so only the patched sub-fields are overwritten
    const updates: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(patch)) {
      updates[`config.${key}`] = val;
    }
    await updateDoc(ref, updates);
  }

  return { config, loading, error, updateConfig };
}
