"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordPayment = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
const context_1 = require("../lib/context");
const audit_1 = require("../lib/audit");
const transactions_1 = require("../lib/transactions");
const validate_1 = require("../lib/validate");
const VALID_SOURCE_TYPES = new Set([
    'collection', 'vendorIncome', 'recurringPayment', 'expenseRequest', 'manual',
]);
exports.recordPayment = (0, https_1.onCall)(async (request) => {
    const { uid, societyId, role } = (0, context_1.requireCaller)(request);
    if (role !== 'admin' && role !== 'fm')
        throw new https_1.HttpsError('permission-denied', 'Must be Admin or FM.');
    const input = request.data;
    if (input.direction !== 'in' && input.direction !== 'out')
        throw new https_1.HttpsError('invalid-argument', 'direction must be "in" or "out".');
    (0, validate_1.requirePositivePaise)(input.amountPaise, 'amountPaise');
    (0, validate_1.requirePaymentMode)(input.mode, 'mode');
    if (!VALID_SOURCE_TYPES.has(input.sourceType))
        throw new https_1.HttpsError('invalid-argument', 'Invalid sourceType.');
    if (!input.description?.trim())
        throw new https_1.HttpsError('invalid-argument', 'description is required.');
    (0, validate_1.requireDateString)(input.occurredAt, 'occurredAt');
    // Manual entries (opening balances, interest, adjustments) require Admin
    if (input.sourceType === 'manual' && role !== 'admin')
        throw new https_1.HttpsError('permission-denied', 'Manual entries require Admin role.');
    // Verify account belongs to this society
    const accountSnap = await admin_1.db.doc(`societies/${societyId}/accounts/${input.accountId}`).get();
    if (!accountSnap.exists)
        throw new https_1.HttpsError('not-found', 'Account not found.');
    const txnRef = admin_1.db.collection(`societies/${societyId}/transactions`).doc();
    const txnId = txnRef.id;
    const txnData = (0, transactions_1.buildTransaction)({
        txnId, societyId,
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
        referenceNo: input.referenceNo,
    });
    await txnRef.set(txnData);
    await (0, audit_1.writeAudit)({
        societyId,
        actorUid: uid,
        actorRole: role,
        action: 'transaction_recorded',
        targetType: 'transaction',
        targetId: txnId,
        after: {
            direction: input.direction,
            amountPaise: input.amountPaise,
            accountId: input.accountId,
            fundHead: input.fundHead,
            sourceType: input.sourceType,
        },
    });
    return { txnId };
});
