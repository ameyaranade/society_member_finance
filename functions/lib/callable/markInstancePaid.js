"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markInstancePaid = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
const VALID_MODES = new Set(['cash', 'upi', 'cheque', 'bank']);
exports.markInstancePaid = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Not signed in.');
    const token = request.auth?.token;
    const societyId = token?.societyId;
    const role = token?.role;
    if (!societyId)
        throw new https_1.HttpsError('failed-precondition', 'No active society.');
    if (role !== 'admin' && role !== 'fm')
        throw new https_1.HttpsError('permission-denied', 'Must be Admin or FM.');
    const { instanceId, occurredAt, mode, referenceNo } = request.data;
    if (!instanceId?.trim())
        throw new https_1.HttpsError('invalid-argument', 'instanceId required.');
    if (!occurredAt?.match(/^\d{4}-\d{2}-\d{2}$/))
        throw new https_1.HttpsError('invalid-argument', 'occurredAt must be "YYYY-MM-DD".');
    if (!VALID_MODES.has(mode))
        throw new https_1.HttpsError('invalid-argument', 'mode must be cash, upi, cheque, or bank.');
    // Load instance
    const instanceRef = admin_1.db.doc(`societies/${societyId}/recurringInstances/${instanceId}`);
    const instanceSnap = await instanceRef.get();
    if (!instanceSnap.exists)
        throw new https_1.HttpsError('not-found', 'Instance not found.');
    const instance = instanceSnap.data();
    if (instance.societyId !== societyId)
        throw new https_1.HttpsError('permission-denied', 'Cross-society access denied.');
    if (instance.status === 'paid')
        throw new https_1.HttpsError('failed-precondition', 'Instance is already paid.');
    // Write the transaction
    const txnRef = admin_1.db.collection(`societies/${societyId}/transactions`).doc();
    const txnId = txnRef.id;
    const txnData = {
        id: txnId,
        societyId,
        direction: 'out',
        amountPaise: instance.amountPaise,
        accountId: instance.accountId,
        fundHead: instance.fundHead,
        mode,
        description: `${instance.name} — ${instance.period}`,
        occurredAt: firestore_1.Timestamp.fromDate(new Date(`${occurredAt}T00:00:00.000Z`)),
        sourceType: 'recurringPayment',
        sourceId: instanceId,
        createdBy: uid,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    };
    if (referenceNo?.trim())
        txnData.referenceNo = referenceNo.trim();
    // Mark instance paid + write transaction atomically
    const batch = admin_1.db.batch();
    batch.set(txnRef, txnData);
    batch.update(instanceRef, {
        status: 'paid',
        transactionId: txnId,
        paidAt: firestore_1.FieldValue.serverTimestamp(),
    });
    await batch.commit();
    return { txnId };
});
