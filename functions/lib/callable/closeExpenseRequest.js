"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeExpenseRequest = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
const context_1 = require("../lib/context");
const audit_1 = require("../lib/audit");
const notify_1 = require("../lib/notify");
exports.closeExpenseRequest = (0, https_1.onCall)(async (request) => {
    const { uid, societyId, role } = (0, context_1.requireCaller)(request);
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
    (0, context_1.assertSameSociety)(data.societyId, societyId);
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
    (0, notify_1.dispatchNotificationSafe)({
        societyId,
        type: 'expense_request_completed',
        toRole: 'admin',
        payload: { requestId, title: data.title },
    });
    return { ok: true };
});
