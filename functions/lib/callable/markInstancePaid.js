"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markInstancePaid = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
const context_1 = require("../lib/context");
const audit_1 = require("../lib/audit");
const transactions_1 = require("../lib/transactions");
const validate_1 = require("../lib/validate");
exports.markInstancePaid = (0, https_1.onCall)(async (request) => {
    const { uid, societyId, role } = (0, context_1.requireCaller)(request);
    if (role !== 'admin' && role !== 'fm')
        throw new https_1.HttpsError('permission-denied', 'Must be Admin or FM.');
    const { instanceId, occurredAt, mode, referenceNo } = request.data;
    if (!instanceId?.trim())
        throw new https_1.HttpsError('invalid-argument', 'instanceId required.');
    (0, validate_1.requireDateString)(occurredAt, 'occurredAt');
    (0, validate_1.requirePaymentMode)(mode, 'mode');
    // Load instance
    const instanceRef = admin_1.db.doc(`societies/${societyId}/recurringInstances/${instanceId}`);
    const instanceSnap = await instanceRef.get();
    if (!instanceSnap.exists)
        throw new https_1.HttpsError('not-found', 'Instance not found.');
    const instance = instanceSnap.data();
    (0, context_1.assertSameSociety)(instance.societyId, societyId);
    if (instance.status === 'paid')
        throw new https_1.HttpsError('failed-precondition', 'Instance is already paid.');
    // Write the transaction
    const txnRef = admin_1.db.collection(`societies/${societyId}/transactions`).doc();
    const txnId = txnRef.id;
    const txnData = (0, transactions_1.buildTransaction)({
        txnId, societyId, direction: 'out',
        amountPaise: instance.amountPaise,
        accountId: instance.accountId,
        fundHead: instance.fundHead,
        mode,
        description: `${instance.name} — ${instance.period}`,
        occurredAt: firestore_1.Timestamp.fromDate(new Date(`${occurredAt}T00:00:00.000Z`)),
        sourceType: 'recurringPayment',
        sourceId: instanceId,
        createdBy: uid,
        referenceNo,
    });
    // Mark instance paid + write transaction atomically
    const batch = admin_1.db.batch();
    batch.set(txnRef, txnData);
    batch.update(instanceRef, {
        status: 'paid',
        transactionId: txnId,
        paidAt: firestore_1.FieldValue.serverTimestamp(),
    });
    await batch.commit();
    await (0, audit_1.writeAudit)({
        societyId,
        actorUid: uid,
        actorRole: role,
        action: 'recurring_instance_paid',
        targetType: 'recurringInstance',
        targetId: instanceId,
        after: {
            transactionId: txnId,
            amountPaise: instance.amountPaise,
            accountId: instance.accountId,
            fundHead: instance.fundHead,
            period: instance.period,
        },
    });
    return { txnId };
});
