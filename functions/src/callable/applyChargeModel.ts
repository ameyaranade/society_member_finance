import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../lib/admin';
import { requireCaller } from '../lib/context';
import { FieldValue } from 'firebase-admin/firestore';

interface ChargeModelTier { name: string; amountPaise: number; }
interface ChargeModel {
  type: 'per_sqft' | 'flat' | 'tier';
  ratePerSqftPaise?: number;
  flatAmountPaise?: number;
  tiers?: ChargeModelTier[];
}

function computeMaintenance(model: ChargeModel, areaSqft: number | undefined): number | null {
  switch (model.type) {
    case 'per_sqft':
      if (!model.ratePerSqftPaise || !areaSqft) return null;
      return Math.round(model.ratePerSqftPaise * areaSqft);
    case 'flat':
      return model.flatAmountPaise ?? null;
    case 'tier':
      return model.tiers?.[0]?.amountPaise ?? null;
    default:
      return null;
  }
}

export const applyChargeModel = onCall(async (request) => {
  const { uid, societyId, role } = requireCaller(request);
  if (role !== 'admin' && role !== 'mc')
    throw new HttpsError('permission-denied', 'Only Admin or MC can apply the charge model.');

  const societySnap = await db.doc(`societies/${societyId}`).get();
  const chargeModel = societySnap.data()?.config?.chargeModel as ChargeModel | undefined;
  if (!chargeModel)
    throw new HttpsError('failed-precondition', 'No charge model configured. Set it in Settings first.');

  const unitsSnap = await db.collection(`societies/${societyId}/units`).get();
  if (unitsSnap.empty)
    return { updated: 0 };

  const BATCH_SIZE = 400;
  let updated = 0;
  let skipped = 0;

  const docs = unitsSnap.docs;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const d of chunk) {
      const data = d.data();
      const paise = computeMaintenance(chargeModel, data.areaSqft as number | undefined);
      if (paise === null) { skipped++; continue; }
      batch.update(d.ref, {
        maintenanceAmountPaise: paise,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
      });
      updated++;
    }
    await batch.commit();
  }

  return { updated, skipped };
});
