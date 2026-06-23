"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitExpenseRequest = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
const audit_1 = require("../lib/audit");
const notify_1 = require("../lib/notify");
const tierHelpers_1 = require("../lib/tierHelpers");
exports.submitExpenseRequest = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Not signed in.');
    const token = request.auth?.token;
    const societyId = token?.societyId;
    const role = token?.role;
    if (!societyId)
        throw new https_1.HttpsError('failed-precondition', 'No active society.');
    if (role !== 'fm')
        throw new https_1.HttpsError('permission-denied', 'Only FM can take up a request.');
    const input = request.data;
    if (!input.requestId?.trim())
        throw new https_1.HttpsError('invalid-argument', 'requestId is required.');
    if (!Array.isArray(input.quotations) || input.quotations.length === 0)
        throw new https_1.HttpsError('invalid-argument', 'At least one quotation is required.');
    for (const q of input.quotations) {
        if (!q.vendorId?.trim())
            throw new https_1.HttpsError('invalid-argument', 'Each quotation must have a vendorId.');
        if (!Number.isInteger(q.amountPaise) || q.amountPaise <= 0)
            throw new https_1.HttpsError('invalid-argument', 'Each quotation amountPaise must be a positive integer.');
        if (!q.scopeNotes?.trim())
            throw new https_1.HttpsError('invalid-argument', 'Each quotation must have scopeNotes.');
    }
    // ── Fetch and validate the expense request ───────────────────────────────
    const requestRef = admin_1.db.doc(`societies/${societyId}/expenseRequests/${input.requestId}`);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists)
        throw new https_1.HttpsError('not-found', 'Expense request not found.');
    const data = requestSnap.data();
    if (data.societyId !== societyId)
        throw new https_1.HttpsError('permission-denied', 'Cross-society access denied.');
    if (data.type !== 'snag')
        throw new https_1.HttpsError('invalid-argument', 'submitExpenseRequest is for snag take-up only.');
    if (data.status !== 'scheduled')
        throw new https_1.HttpsError('failed-precondition', `Cannot take up a snag in status "${data.status}".`);
    // ── Tier resolution + quorum check (D9) ─────────────────────────────────
    const [tiers, activeMCCount] = await Promise.all([
        (0, tierHelpers_1.fetchApprovalTiers)(societyId),
        (0, tierHelpers_1.getActiveMCCount)(societyId),
    ]);
    let requiredApprovers;
    try {
        requiredApprovers = (0, tierHelpers_1.resolveTier)(data.estCostPaise, tiers);
    }
    catch (e) {
        throw new https_1.HttpsError('failed-precondition', e instanceof Error ? e.message : 'Tier error.');
    }
    if (requiredApprovers > activeMCCount) {
        throw new https_1.HttpsError('failed-precondition', `This request needs ${requiredApprovers} MC approver(s) but the society only has ${activeMCCount} active MC member(s).`);
    }
    // ── Write atomically ─────────────────────────────────────────────────────
    const batch = admin_1.db.batch();
    batch.update(requestRef, {
        status: 'requested',
        requiredApprovers,
        submittedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    for (const q of input.quotations) {
        const quoteRef = requestRef.collection('quotations').doc();
        const quoteData = {
            societyId,
            requestId: input.requestId,
            vendorId: q.vendorId.trim(),
            amountPaise: q.amountPaise,
            scopeNotes: q.scopeNotes.trim(),
            ...(q.documentRef?.trim() && { documentRef: q.documentRef.trim() }),
            createdBy: uid,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        };
        batch.set(quoteRef, quoteData);
    }
    await batch.commit();
    await (0, audit_1.writeAudit)({
        societyId,
        actorUid: uid,
        actorRole: role,
        action: 'expense_request_submitted',
        targetType: 'expenseRequest',
        targetId: input.requestId,
        after: { status: 'requested', requiredApprovers },
    });
    void (0, notify_1.dispatchNotification)({
        societyId,
        type: 'expense_request_submitted',
        toRole: 'mc',
        payload: { requestId: input.requestId, title: data.title, requestType: 'snag' },
    }).catch(e => console.error('notify error:', e));
    return { ok: true };
});
