"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importCollections = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin_1 = require("../lib/admin");
const context_1 = require("../lib/context");
const firestore_1 = require("firebase-admin/firestore");
exports.importCollections = (0, https_1.onCall)(async (request) => {
    const { uid, societyId, role } = (0, context_1.requireCaller)(request);
    if (role !== 'admin' && role !== 'fm')
        throw new https_1.HttpsError('permission-denied', 'Only Admin or FM can import collections.');
    const data = request.data;
    if (!data.period?.match(/^\d{4}-\d{2}$/))
        throw new https_1.HttpsError('invalid-argument', 'period must be "YYYY-MM".');
    if (!data.dueDate?.match(/^\d{4}-\d{2}-\d{2}$/))
        throw new https_1.HttpsError('invalid-argument', 'dueDate must be "YYYY-MM-DD".');
    if (!data.accountId?.trim())
        throw new https_1.HttpsError('invalid-argument', 'accountId is required.');
    if (!Array.isArray(data.rows) || data.rows.length === 0)
        throw new https_1.HttpsError('invalid-argument', 'rows must be a non-empty array.');
    // Load units to look up unitId by flatNumber+tower
    const unitsSnap = await admin_1.db.collection(`societies/${societyId}/units`).get();
    const unitByKey = new Map();
    for (const d of unitsSnap.docs) {
        const u = d.data();
        const key = `${(u.tower ?? '').toLowerCase()}_${String(u.flatNumber).toLowerCase()}`;
        unitByKey.set(key, {
            id: d.id,
            maintenancePaise: u.maintenanceAmountPaise ?? 0,
            commonElecPaise: u.commonElectricityAmountPaise ?? 0,
            ownerName: u.owner?.name ?? '',
            tower: u.tower,
        });
    }
    const errors = [];
    const written = [];
    let expectedPaise = 0;
    let receivedPaise = 0;
    let paidCount = 0;
    const BATCH_SIZE = 400;
    const periodRef = admin_1.db.doc(`societies/${societyId}/collections/${data.period}`);
    for (let i = 0; i < data.rows.length; i += BATCH_SIZE) {
        const chunk = data.rows.slice(i, i + BATCH_SIZE);
        const batch = admin_1.db.batch();
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
            const entryRef = admin_1.db.doc(`societies/${societyId}/collections/${data.period}/entries/${unit.id}`);
            const entry = {
                societyId,
                period: data.period,
                unitId: unit.id,
                flatNumber: row.flatNumber,
                tower: unit.tower,
                ownerName: unit.ownerName,
                maintenancePaise: unit.maintenancePaise,
                commonElectricityPaise: unit.commonElecPaise,
                billedPaise,
                status: row.status,
                dueDate: data.dueDate,
                accountId: data.accountId,
                fundHead: data.fundHead,
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
                updatedBy: uid,
            };
            if (row.status === 'paid') {
                entry.amountReceivedPaise = row.amountReceivedPaise;
                entry.paidAt = row.paymentDate ?? null;
                entry.referenceNo = row.referenceNo ?? null;
            }
            if (row.notes)
                entry.notes = row.notes;
            batch.set(entryRef, entry, { merge: true });
            written.push(unit.id);
        }
        await batch.commit();
    }
    // Upsert the period summary doc
    await periodRef.set({
        societyId,
        period: data.period,
        expectedPaise,
        receivedPaise,
        unitCount: written.length,
        paidCount,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    return {
        period: data.period,
        imported: written.length,
        errors,
    };
});
