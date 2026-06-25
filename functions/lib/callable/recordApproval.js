"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordApproval = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
const context_1 = require("../lib/context");
const audit_1 = require("../lib/audit");
const notify_1 = require("../lib/notify");
exports.recordApproval = (0, https_1.onCall)(async (request) => {
    const { uid, societyId, role } = (0, context_1.requireCaller)(request);
    if (role !== 'mc')
        throw new https_1.HttpsError('permission-denied', 'Only MC members can approve requests.');
    const { requestId, note } = request.data;
    if (!requestId?.trim())
        throw new https_1.HttpsError('invalid-argument', 'requestId is required.');
    const requestRef = admin_1.db.doc(`societies/${societyId}/expenseRequests/${requestId}`);
    // Use a transaction to avoid race conditions on the approval count
    const { fullyApproved, requestTitle, approvalCount, requiredApprovers } = await admin_1.db.runTransaction(async (txn) => {
        const reqSnap = await txn.get(requestRef);
        if (!reqSnap.exists)
            throw new https_1.HttpsError('not-found', 'Expense request not found.');
        const data = reqSnap.data();
        (0, context_1.assertSameSociety)(data.societyId, societyId);
        if (data.status !== 'requested')
            throw new https_1.HttpsError('failed-precondition', `Cannot approve a request with status "${data.status}".`);
        // No self-approval
        const approvedBy = data.approvedBy ?? [];
        if (approvedBy.includes(uid))
            throw new https_1.HttpsError('failed-precondition', 'You have already approved this request.');
        const newCount = (data.approvalCount ?? 0) + 1;
        const reqApprovers = data.requiredApprovers ?? 1;
        const approved = newCount >= reqApprovers;
        // Write approval subdoc
        const approvalRef = requestRef.collection('approvals').doc();
        txn.set(approvalRef, {
            societyId,
            requestId,
            mcUid: uid,
            ...(note?.trim() ? { note: note.trim() } : {}),
            approvedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        // Update request doc
        txn.update(requestRef, {
            approvalCount: newCount,
            approvedBy: [...approvedBy, uid],
            ...(approved
                ? { status: 'approved', approvedAmountPaise: data.estCostPaise }
                : {}),
        });
        return {
            fullyApproved: approved,
            requestTitle: data.title,
            approvalCount: newCount,
            requiredApprovers: reqApprovers,
        };
    });
    await (0, audit_1.writeAudit)({
        societyId,
        actorUid: uid,
        actorRole: role,
        action: fullyApproved ? 'expense_request_approved' : 'expense_approval_recorded',
        targetType: 'expenseRequest',
        targetId: requestId,
        after: fullyApproved ? { status: 'approved' } : { approvalRecorded: true },
    });
    (0, notify_1.dispatchNotificationSafe)({
        societyId,
        type: fullyApproved ? 'expense_request_approved' : 'expense_approval_recorded',
        toRole: 'fm',
        payload: {
            requestId,
            title: requestTitle,
            approvalCount,
            requiredApprovers,
        },
    });
    return { ok: true, approved: fullyApproved };
});
