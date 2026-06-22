import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../auth/useAuth';
import type { Vendor, VendorRelation, VendorRelationKind } from '../../types/config';

export function useVendors() {
  const { societyId, user } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!societyId) return;
    const q = query(
      collection(db, `societies/${societyId}/vendors`),
      orderBy('createdAt', 'asc'),
    );
    return onSnapshot(q, snap => {
      setVendors(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vendor)));
      setLoading(false);
    });
  }, [societyId]);

  async function createVendor(data: {
    name: string;
    contact?: string;
    notes?: string;
  }): Promise<void> {
    if (!societyId || !user) return;
    await addDoc(collection(db, `societies/${societyId}/vendors`), {
      societyId,
      ...data,
      createdAt: serverTimestamp(),
      createdBy: user.uid,
    });
  }

  async function updateVendor(
    id: string,
    data: Partial<Pick<Vendor, 'name' | 'contact' | 'notes'>>,
  ): Promise<void> {
    if (!societyId) return;
    await updateDoc(doc(db, `societies/${societyId}/vendors`, id), data);
  }

  async function deleteVendor(id: string): Promise<void> {
    if (!societyId) return;
    await deleteDoc(doc(db, `societies/${societyId}/vendors`, id));
  }

  return { vendors, loading, createVendor, updateVendor, deleteVendor };
}

export function useVendorRelations(vendorId: string | null) {
  const { societyId, user } = useAuth();
  const [relations, setRelations] = useState<VendorRelation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!societyId || !vendorId) { setLoading(false); return; }
    const q = query(
      collection(db, `societies/${societyId}/vendorRelations`),
      orderBy('createdAt', 'asc'),
    );
    return onSnapshot(q, snap => {
      setRelations(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() } as VendorRelation))
          .filter(r => r.vendorId === vendorId),
      );
      setLoading(false);
    });
  }, [societyId, vendorId]);

  async function createRelation(data: {
    kind: VendorRelationKind;
    description: string;
    agreementAmountPaise?: number;
    periodicity?: string;
  }): Promise<void> {
    if (!societyId || !vendorId || !user) return;
    await addDoc(collection(db, `societies/${societyId}/vendorRelations`), {
      societyId,
      vendorId,
      ...data,
      createdAt: serverTimestamp(),
      createdBy: user.uid,
    });
  }

  async function deleteRelation(id: string): Promise<void> {
    if (!societyId) return;
    await deleteDoc(doc(db, `societies/${societyId}/vendorRelations`, id));
  }

  return { relations, loading, createRelation, deleteRelation };
}
