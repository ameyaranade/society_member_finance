"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeExpenseRequest = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
const audit_1 = require("../lib/audit");
const notify_1 = require("../lib/notify");
exports.closeExpenseRequest = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Not signed in.');
    const token = request.auth?.token;
    const societyId = token?.societyId;
    const role = token?.role;
    if (!societyId)
        throw new https_1.HttpsError('failed-precondition', 'No active society.');
    if (role !== 'fm')
        throw new https_1.HttpsError('permission-denied', 'Only FM can close expense requests.');
    const { requestId, closingNote } = request.data;
    if (!requestId?.trim())
        throw new https_1.HttpsError('invalid-argument', 'requestId is required.');
    const requestRef = admin_1.db.doc(`societies/${societyId}/expenseRequests/${requestId}`);
    const reqSnap = await requestRef.get();
    if (!reqSnap.exists)
        throw new https_1.HttpsError('not-found', 'Expense request not found.');
    const data = reqSnap.data();
    if (data.societyId !== societyId)
        throw new https_1.HttpsError('permission-denied', 'Cross-society access denied.');
    if (data.status !== 'disbursed')
        throw new https_1.HttpsError('failed-precondition', `Cannot close: request is "${data.status}", must be "disbursed".`);
    const update = {
        status: 'completed',
        completedAt: firestore_1.FieldValue.serverTimestamp(),
        completedBy: uid,
    };
    if (closingNote?.trim())
        update.closingNote = closingNote.trim();
    await requestRef.update(update);
    await (0, audit_1.writeAudit)({
        societyId,
        actorUid: uid,
        actorRole: role,
        action: 'expense_request_completed',
        targetType: 'expenseRequest',
        targetId: requestId,
        after: { status: 'completed' },
    });
    void (0, notify_1.dispatchNotification)({
        societyId,
        type: 'expense_request_completed',
        toRole: 'admin',
        payload: { requestId, title: data.title },
    }).catch(e => console.error('notify error:', e));
    return { ok: true };
});
