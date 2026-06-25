import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, query, orderBy, doc,
  writeBatch, serverTimestamp, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { COLLECTIONS } from '../../lib/db';
import { useAuth } from '../auth/useAuth';
import type { Unit, BilledParty, UnitContact } from '../../types/config';

export type UnitCreateInput = {
  flatNumber: string;
  tower?: string;
  areaSqft?: number;
  owner: UnitContact;
  tenant?: UnitContact;
  billedParty: BilledParty;
  maintenanceAmountPaise: number;
  commonElectricityAmountPaise: number;
};

export function useUnits() {
  const { societyId, user } = useAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!societyId) return;
    const q = query(
      collection(db, COLLECTIONS.units(societyId)),
      orderBy('tower', 'asc'),
      orderBy('flatNumber', 'asc'),
    );
    return onSnapshot(q, snap => {
      setUnits(snap.docs.map(d => ({ id: d.id, ...d.data() } as Unit)));
      setLoading(false);
    }, () => setLoading(false));
  }, [societyId]);

  async function createUnit(data: UnitCreateInput): Promise<string> {
    if (!societyId || !user) throw new Error('Not authenticated');
    const ref = doc(collection(db, COLLECTIONS.units(societyId)));
    const batch = writeBatch(db);
    batch.set(ref, {
      ...data,
      societyId,
      createdAt: serverTimestamp(),
      createdBy: user.uid,
    });
    await batch.commit();
    return ref.id;
  }

  async function updateUnit(id: string, data: Partial<UnitCreateInput>): Promise<void> {
    if (!societyId || !user) return;
    await updateDoc(doc(db, COLLECTIONS.units(societyId), id), {
      ...data,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });
  }

  async function deleteUnit(id: string): Promise<void> {
    if (!societyId) return;
    await deleteDoc(doc(db, COLLECTIONS.units(societyId), id));
  }

  /** Bulk-import units from parsed rows — overwrites existing doc with same flatNumber+tower key. */
  async function importUnits(rows: UnitCreateInput[]): Promise<{ imported: number; errors: string[] }> {
    if (!societyId || !user) throw new Error('Not authenticated');
    const errors: string[] = [];
    let imported = 0;
    // Batch writes (max 500 per batch)
    const BATCH_SIZE = 400;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      for (const row of chunk) {
        if (!row.flatNumber?.trim()) { errors.push(`Row missing flatNumber`); continue; }
        // Deterministic ID: societyId_tower_flatNumber
        const key = `${(row.tower ?? 'A').replace(/\s+/g, '_')}_${row.flatNumber.replace(/\s+/g, '_')}`;
        const ref = doc(db, COLLECTIONS.units(societyId), key);
        const data: Record<string, unknown> = { societyId, createdAt: serverTimestamp(), createdBy: user.uid };
        for (const [k, v] of Object.entries(row)) { if (v !== undefined) data[k] = v; }
        batch.set(ref, data, { merge: true });
        imported++;
      }
      await batch.commit();
    }
    return { imported, errors };
  }

  return { units, loading, createUnit, updateUnit, deleteUnit, importUnits };
}
