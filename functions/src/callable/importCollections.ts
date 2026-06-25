import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../lib/admin';
import { requireCaller } from '../lib/context';
import { FieldValue } from 'firebase-admin/firestore';

export type CollectionEntryStatus = 'paid' | 'pending' | 'overdue';

interface ImportRow {
  flatNumber: string;
  tower?: string;
  status: CollectionEntryStatus;
  amountReceivedPaise: number;
  paymentDate?: string;   // "YYYY-MM-DD"
  referenceNo?: string;
  notes?: string;
}

interface ImportInput {
  period: string;  // "YYYY-MM"
  dueDate: string; // "YYYY-MM-DD"
  accountId: string;
  fundHead: string;
  rows: ImportRow[];
}

export const importCollections = onCall(async (request) => {
  const { uid, societyId, role } = requireCaller(request);
  if (role !== 'admin' && role !== 'fm')
    throw new HttpsError('permission-denied', 'Only Admin or FM can import collections.');

  const data = request.data as ImportInput;

  if (!data.period?.match(/^\d{4}-\d{2}$/))
    throw new HttpsError('invalid-argument', 'period must be "YYYY-MM".');
  if (!data.dueDate?.match(/^\d{4}-\d{2}-\d{2}$/))
    throw new HttpsError('invalid-argument', 'dueDate must be "YYYY-MM-DD".');
  if (!data.accountId?.trim())
    throw new HttpsError('invalid-argument', 'accountId is required.');
  if (!Array.isArray(data.rows) || data.rows.length === 0)
    throw new HttpsError('invalid-argument', 'rows must be a non-empty array.');

  // Load units to look up unitId by flatNumber+tower
  const unitsSnap = await db.collection(`societies/${societyId}/units`).get();
  const unitByKey = new Map<string, { id: string; maintenancePaise: number; commonElecPaise: number; ownerName: string; tower?: string }>();
  for (const d of unitsSnap.docs) {
    const u = d.data();
    const key = `${(u.tower ?? '').toLowerCase()}_${String(u.flatNumber).toLowerCase()}`;
    unitByKey.set(key, {
      id: d.id,
      maintenancePaise: u.maintenanceAmountPaise ?? 0,
      commonElecPaise:  u.commonElectricityAmountPaise ?? 0,
      ownerName:        u.owner?.name ?? '',
      tower:            u.tower,
    });
  }

  const errors: Array<{ row: number; message: string }> = [];
  const written: string[] = [];
  let expectedPaise = 0;
  let receivedPaise = 0;
  let paidCount = 0;

  const BATCH_SIZE = 400;
  const periodRef = db.doc(`societies/${societyId}/collections/${data.period}`);

  for (let i = 0; i < data.rows.length; i += BATCH_SIZE) {
    const chunk = data.rows.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (let j = 0; j < chunk.length; j++) {
      const row = chunk[j];
      const rowNum = i + j + 2; // 1-indexed, +1 for header
      if (!row.flatNumber?.trim()) {
        errors.push({ row: rowNum, message: 'Missing flat number' });
        continue;
      }

      const key = `${(row.tower ?? '').toLowerCase()}_${row.flatNumber.toLowerCase()}`;
      const unit = unitByKey.get(key);
      if (!unit) {
        errors.push({ row: rowNum, message: `Flat ${row.flatNumber}: not found in units registry` });
        continue;
      }

      const billedPaise = unit.maintenancePaise + unit.commonElecPaise;
      expectedPaise += billedPaise;
      if (row.status === 'paid') {
        receivedPaise += row.amountReceivedPaise;
        paidCount++;
      }

      const entryRef = db.doc(`societies/${societyId}/collections/${data.period}/entries/${unit.id}`);
      const entry: Record<string, unknown> = {
        societyId,
        period:      data.period,
        unitId:      unit.id,
        flatNumber:  row.flatNumber,
        tower:       unit.tower,
        ownerName:   unit.ownerName,
        maintenancePaise: unit.maintenancePaise,
        commonElectricityPaise: unit.commonElecPaise,
        billedPaise,
        status:      row.status,
        dueDate:     data.dueDate,
        accountId:   data.accountId,
        fundHead:    data.fundHead,
        updatedAt:   FieldValue.serverTimestamp(),
        updatedBy:   uid,
      };
      if (row.status === 'paid') {
        entry.amountReceivedPaise = row.amountReceivedPaise;
        entry.paidAt              = row.paymentDate ?? null;
        entry.referenceNo         = row.referenceNo ?? null;
      }
      if (row.notes) entry.notes = row.notes;

      batch.set(entryRef, entry, { merge: true });
      written.push(unit.id);
    }

    await batch.commit();
  }

  // Upsert the period summary doc
  await periodRef.set({
    societyId,
    period:        data.period,
    expectedPaise,
    receivedPaise,
    unitCount:     written.length,
    paidCount,
    updatedAt:     FieldValue.serverTimestamp(),
    createdAt:     FieldValue.serverTimestamp(),
  }, { merge: true });

  return {
    period:   data.period,
    imported: written.length,
    errors,
  };
});
