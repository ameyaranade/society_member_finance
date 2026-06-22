"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordPayment = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
const VALID_MODES = new Set(['cash', 'upi', 'cheque', 'bank']);
const VALID_SOURCE_TYPES = new Set([
    'collection', 'vendorIncome', 'recurringPayment', 'expenseRequest', 'manual',
]);
exports.recordPayment = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
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
    const input = request.data;
    if (input.direction !== 'in' && input.direction !== 'out')
        throw new https_1.HttpsError('invalid-argument', 'direction must be "in" or "out".');
    if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0)
        throw new https_1.HttpsError('invalid-argument', 'amountPaise must be a positive integer.');
    if (!VALID_MODES.has(input.mode))
        throw new https_1.HttpsError('invalid-argument', 'mode must be cash, upi, cheque, or bank.');
    if (!VALID_SOURCE_TYPES.has(input.sourceType))
        throw new https_1.HttpsError('invalid-argument', 'Invalid sourceType.');
    if (!input.description?.trim())
        throw new https_1.HttpsError('invalid-argument', 'description is required.');
    if (!input.occurredAt?.match(/^\d{4}-\d{2}-\d{2}$/))
        throw new https_1.HttpsError('invalid-argument', 'occurredAt must be "YYYY-MM-DD".');
    // Manual entries (opening balances, interest, adjustments) require Admin
    if (input.sourceType === 'manual' && role !== 'admin')
        throw new https_1.HttpsError('permission-denied', 'Manual entries require Admin role.');
    // Verify account belongs to this society
    const accountSnap = await admin_1.db.doc(`societies/${societyId}/accounts/${input.accountId}`).get();
    if (!accountSnap.exists)
        throw new https_1.HttpsError('not-found', 'Account not found.');
    const txnRef = admin_1.db.collection(`societies/${societyId}/transactions`).doc();
    const txnId = txnRef.id;
    const txnData = {
        id: txnId,
        societyId,
        direction: input.direction,
        amountPaise: input.amountPaise,
        accountId: input.accountId,
        fundHead: input.fundHead,
        mode: input.mode,
        description: input.description.trim(),
        occurredAt: firestore_1.Timestamp.fromDate(new Date(`${input.occurredAt}T00:00:00.000Z`)),
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? txnId,
        createdBy: uid,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    };
    if (input.referenceNo?.trim())
        txnData.referenceNo = input.referenceNo.trim();
    await txnRef.set(txnData);
    return { txnId };
});
