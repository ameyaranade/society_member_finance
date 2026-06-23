"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withdrawExpenseRequest = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
const audit_1 = require("../lib/audit");
const notify_1 = require("../lib/notify");
exports.withdrawExpenseRequest = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Not signed in.');
    const token = request.auth?.token;
    const societyId = token?.societyId;
    const role = token?.role;
    if (!societyId)
        throw new https_1.HttpsError('failed-precondition', 'No active society.');
    if (role !== 'fm' && role !== 'admin')
        throw new https_1.HttpsError('permission-denied', 'Only FM or Admin can withdraw a request.');
    const { requestId } = request.data;
    if (!requestId?.trim())
        throw new https_1.HttpsError('invalid-argument', 'requestId is required.');
    const requestRef = admin_1.db.doc(`societies/${societyId}/expenseRequests/${requestId}`);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists)
        throw new https_1.HttpsError('not-found', 'Expense request not found.');
    const data = requestSnap.data();
    if (data.societyId !== societyId)
        throw new https_1.HttpsError('permission-denied', 'Cross-society access denied.');
    if (data.status === 'withdrawn')
        throw new https_1.HttpsError('failed-precondition', 'Request is already withdrawn.');
    if (data.status === 'completed')
        throw new https_1.HttpsError('failed-precondition', 'Cannot withdraw a completed request.');
    if (data.status === 'disbursed')
        throw new https_1.HttpsError('failed-precondition', 'Cannot withdraw after disbursement has started.');
    // D9b separation of duties
    if (data.type === 'snag' && role !== 'admin')
        throw new https_1.HttpsError('permission-denied', 'Only Admin can withdraw a snag request.');
    if (data.type === 'maintenance' && role !== 'fm')
        throw new https_1.HttpsError('permission-denied', 'Only FM can withdraw a maintenance request.');
    await requestRef.update({
        status: 'withdrawn',
        withdrawnAt: firestore_1.FieldValue.serverTimestamp(),
        withdrawnBy: uid,
    });
    await (0, audit_1.writeAudit)({
        societyId,
        actorUid: uid,
        actorRole: role,
        action: 'expense_request_withdrawn',
        targetType: 'expenseRequest',
        targetId: requestId,
        before: { status: data.status },
        after: { status: 'withdrawn' },
    });
    void (0, notify_1.dispatchNotification)({
        societyId,
        type: 'expense_request_withdrawn',
        toRole: 'mc',
        payload: { requestId, title: data.title, requestType: data.type },
    }).catch(e => console.error('notify error:', e));
    return { ok: true };
});
