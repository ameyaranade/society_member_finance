"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitExpenseRequest = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
const context_1 = require("../lib/context");
const validate_1 = require("../lib/validate");
const audit_1 = require("../lib/audit");
const notify_1 = require("../lib/notify");
const tierHelpers_1 = require("../lib/tierHelpers");
exports.submitExpenseRequest = (0, https_1.onCall)(async (request) => {
    const { uid, societyId, role } = (0, context_1.requireCaller)(request);
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
        (0, validate_1.requirePositivePaise)(q.amountPaise, 'amountPaise');
        if (!q.scopeNotes?.trim())
            throw new https_1.HttpsError('invalid-argument', 'Each quotation must have scopeNotes.');
    }
    // ── Fetch and validate the expense request ───────────────────────────────
    const requestRef = admin_1.db.doc(`societies/${societyId}/expenseRequests/${input.requestId}`);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists)
        throw new https_1.HttpsError('not-found', 'Expense request not found.');
    const data = requestSnap.data();
    (0, context_1.assertSameSociety)(data.societyId, societyId);
    if (data.type !== 'snag')
        throw new https_1.HttpsError('invalid-argument', 'submitExpenseRequest is for snag take-up only.');
    if (data.status !== 'scheduled')
        throw new https_1.HttpsError('failed-precondition', `Cannot take up a snag in status "${data.status}".`);
    // ── Tier resolution + quorum check (D9) ─────────────────────────────────
    const requiredApprovers = await (0, tierHelpers_1.resolveRequiredApprovers)(societyId, data.estCostPaise);
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
            ...(Array.isArray(q.documentRefs) && q.documentRefs.length > 0
                ? { documentRefs: q.documentRefs.map((r) => r.trim()).filter(Boolean) }
                : {}),
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
    (0, notify_1.dispatchNotificationSafe)({
        societyId,
        type: 'expense_request_submitted',
        toRole: 'mc',
        payload: { requestId: input.requestId, title: data.title, requestType: 'snag' },
    });
    return { ok: true };
});
