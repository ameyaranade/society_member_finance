"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyChargeModel = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin_1 = require("../lib/admin");
const context_1 = require("../lib/context");
const firestore_1 = require("firebase-admin/firestore");
function computeMaintenance(model, areaSqft) {
    switch (model.type) {
        case 'per_sqft':
            if (!model.ratePerSqftPaise || !areaSqft)
                return null;
            return Math.round(model.ratePerSqftPaise * areaSqft);
        case 'flat':
            return model.flatAmountPaise ?? null;
        case 'tier':
            return model.tiers?.[0]?.amountPaise ?? null;
        default:
            return null;
    }
}
exports.applyChargeModel = (0, https_1.onCall)(async (request) => {
    const { uid, societyId, role } = (0, context_1.requireCaller)(request);
    if (role !== 'admin' && role !== 'mc')
        throw new https_1.HttpsError('permission-denied', 'Only Admin or MC can apply the charge model.');
    const societySnap = await admin_1.db.doc(`societies/${societyId}`).get();
    const chargeModel = societySnap.data()?.config?.chargeModel;
    if (!chargeModel)
        throw new https_1.HttpsError('failed-precondition', 'No charge model configured. Set it in Settings first.');
    const unitsSnap = await admin_1.db.collection(`societies/${societyId}/units`).get();
    if (unitsSnap.empty)
        return { updated: 0 };
    const BATCH_SIZE = 400;
    let updated = 0;
    let skipped = 0;
    const docs = unitsSnap.docs;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const chunk = docs.slice(i, i + BATCH_SIZE);
        const batch = admin_1.db.batch();
        for (const d of chunk) {
            const data = d.data();
            const paise = computeMaintenance(chargeModel, data.areaSqft);
            if (paise === null) {
                skipped++;
                continue;
            }
            batch.update(d.ref, {
                maintenanceAmountPaise: paise,
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
                updatedBy: uid,
            });
            updated++;
        }
        await batch.commit();
    }
    return { updated, skipped };
});
