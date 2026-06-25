import { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { COLLECTIONS } from '../../lib/db';
import { useSocietyCollection } from '../../lib/hooks';
import { useAuth } from '../auth/useAuth';
import type { Vendor, VendorRelation, VendorRelationKind } from '../../types/config';

export function useVendors() {
  const { societyId, user } = useAuth();
  const { items: vendors, loading } = useSocietyCollection<Vendor>(societyId, COLLECTIONS.vendors);

  async function createVendor(data: {
    name: string;
    contact?: string;
    notes?: string;
  }): Promise<void> {
    if (!societyId || !user) return;
    await addDoc(collection(db, COLLECTIONS.vendors(societyId)), {
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
    await updateDoc(doc(db, COLLECTIONS.vendors(societyId), id), data);
  }

  async function deleteVendor(id: string): Promise<void> {
    if (!societyId) return;
    await deleteDoc(doc(db, COLLECTIONS.vendors(societyId), id));
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
      collection(db, COLLECTIONS.vendorRelations(societyId)),
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
    await addDoc(collection(db, COLLECTIONS.vendorRelations(societyId)), {
      societyId,
      vendorId,
      ...data,
      createdAt: serverTimestamp(),
      createdBy: user.uid,
    });
  }

  async function deleteRelation(id: string): Promise<void> {
    if (!societyId) return;
    await deleteDoc(doc(db, COLLECTIONS.vendorRelations(societyId), id));
  }

  return { relations, loading, createRelation, deleteRelation };
}
