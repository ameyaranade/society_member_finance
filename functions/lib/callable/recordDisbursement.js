"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordDisbursement = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
const audit_1 = require("../lib/audit");
const notify_1 = require("../lib/notify");
const VALID_MODES = new Set(['cash', 'upi', 'cheque', 'bank']);
exports.recordDisbursement = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Not signed in.');
    const token = request.auth?.token;
    const societyId = token?.societyId;
    const role = token?.role;
    if (!societyId)
        throw new https_1.HttpsError('failed-precondition', 'No active society.');
    if (role !== 'fm')
        throw new https_1.HttpsError('permission-denied', 'Only FM can record disbursements.');
    const input = request.data;
    if (!input.requestId?.trim())
        throw new https_1.HttpsError('invalid-argument', 'requestId is required.');
    if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0)
        throw new https_1.HttpsError('invalid-argument', 'amountPaise must be a positive integer.');
    if (!input.accountId?.trim())
        throw new https_1.HttpsError('invalid-argument', 'accountId is required.');
    if (input.kind !== 'partial' && input.kind !== 'final')
        throw new https_1.HttpsError('invalid-argument', 'kind must be "partial" or "final".');
    if (!VALID_MODES.has(input.paymentMode))
        throw new https_1.HttpsError('invalid-argument', 'paymentMode must be cash, upi, cheque, or bank.');
    if (!input.paidAt?.match(/^\d{4}-\d{2}-\d{2}$/))
        throw new https_1.HttpsError('invalid-argument', 'paidAt must be "YYYY-MM-DD".');
    const requestRef = admin_1.db.doc(`societies/${societyId}/expenseRequests/${input.requestId}`);
    const accountRef = admin_1.db.doc(`societies/${societyId}/accounts/${input.accountId}`);
    // Pre-read account outside transaction (just for existence check — low-contention)
    const accountSnap = await accountRef.get();
    if (!accountSnap.exists)
        throw new https_1.HttpsError('not-found', 'Account not found.');
    // Pre-allocate IDs so we can return them after the transaction
    const txnRef = admin_1.db.collection(`societies/${societyId}/transactions`).doc();
    const disbRef = requestRef.collection('disbursements').doc();
    const txnId = txnRef.id;
    const disbId = disbRef.id;
    const paidAtTs = firestore_1.Timestamp.fromDate(new Date(`${input.paidAt}T00:00:00.000Z`));
    const { requestTitle } = await admin_1.db.runTransaction(async (txn) => {
        const reqSnap = await txn.get(requestRef);
        if (!reqSnap.exists)
            throw new https_1.HttpsError('not-found', 'Expense request not found.');
        const data = reqSnap.data();
        if (data.societyId !== societyId)
            throw new https_1.HttpsError('permission-denied', 'Cross-society access denied.');
        // D9e spend gate — only approved or disbursed requests can receive disbursement
        if (data.status !== 'approved' && data.status !== 'disbursed')
            throw new https_1.HttpsError('failed-precondition', `Cannot disburse: request is "${data.status}", must be "approved" or "disbursed".`);
        // D9a spend cap — cumulative disbursements must not exceed approvedAmountPaise
        const approvedAmount = data.approvedAmountPaise;
        const alreadyDisbursed = data.disbursedAmountPaise ?? 0;
        const newTotal = alreadyDisbursed + input.amountPaise;
        if (newTotal > approvedAmount)
            throw new https_1.HttpsError('failed-precondition', `Disbursement would exceed approved amount. ` +
                `Approved: ${approvedAmount} paise, already disbursed: ${alreadyDisbursed} paise, ` +
                `requested: ${input.amountPaise} paise.`);
        // Write transaction doc (triggers recomputeBalances)
        const txnData = {
            id: txnId,
            societyId,
            direction: 'out',
            amountPaise: input.amountPaise,
            accountId: input.accountId,
            fundHead: data.fundHead,
            mode: input.paymentMode,
            description: `Disbursement: ${data.title}`,
            occurredAt: paidAtTs,
            sourceType: 'expenseRequest',
            sourceId: input.requestId,
            createdBy: uid,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        };
        if (input.referenceNo?.trim())
            txnData.referenceNo = input.referenceNo.trim();
        if (input.notes?.trim())
            txnData.notes = input.notes.trim();
        txn.set(txnRef, txnData);
        // Write disbursement subdoc
        const disbData = {
            id: disbId,
            societyId,
            requestId: input.requestId,
            amountPaise: input.amountPaise,
            txnId,
            kind: input.kind,
            paidAt: paidAtTs,
            createdBy: uid,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        };
        if (input.invoiceRef?.trim())
            disbData.invoiceRef = input.invoiceRef.trim();
        txn.set(disbRef, disbData);
        // Update request: increment disbursedAmountPaise, set status to 'disbursed'
        txn.update(requestRef, {
            disbursedAmountPaise: newTotal,
            status: 'disbursed',
        });
        return { requestTitle: data.title };
    });
    await (0, audit_1.writeAudit)({
        societyId,
        actorUid: uid,
        actorRole: role,
        action: 'expense_request_disbursed',
        targetType: 'expenseRequest',
        targetId: input.requestId,
        after: {
            disbursedAmountPaise: input.amountPaise,
            kind: input.kind,
            txnId,
        },
    });
    void (0, notify_1.dispatchNotification)({
        societyId,
        type: 'expense_request_disbursed',
        toRole: 'admin',
        payload: { requestId: input.requestId, title: requestTitle, amountPaise: input.amountPaise },
    }).catch(e => console.error('notify error:', e));
    return { ok: true, txnId, disbId };
});
