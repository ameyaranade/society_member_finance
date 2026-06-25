"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMaintenanceRequest = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
const context_1 = require("../lib/context");
const validate_1 = require("../lib/validate");
const audit_1 = require("../lib/audit");
const notify_1 = require("../lib/notify");
const tierHelpers_1 = require("../lib/tierHelpers");
const VALID_PRIORITIES = new Set(['low', 'medium', 'high']);
const VALID_CATEGORIES = new Set([
    'electrical', 'plumbing', 'civil', 'mechanical',
    'landscaping', 'security', 'housekeeping', 'other',
]);
const VALID_FUND_HEADS = new Set(['general', 'sinking', 'corpus', 'repair']);
exports.createMaintenanceRequest = (0, https_1.onCall)(async (request) => {
    const { uid, societyId, role } = (0, context_1.requireCaller)(request);
    if (role !== 'fm' && role !== 'admin')
        throw new https_1.HttpsError('permission-denied', 'Only FM or Admin can create maintenance requests.');
    const input = request.data;
    // ── Validate ─────────────────────────────────────────────────────────────
    if (!input.title?.trim())
        throw new https_1.HttpsError('invalid-argument', 'title is required.');
    if (!input.description?.trim())
        throw new https_1.HttpsError('invalid-argument', 'description is required.');
    if (!VALID_PRIORITIES.has(input.priority))
        throw new https_1.HttpsError('invalid-argument', 'Invalid priority.');
    if (!VALID_CATEGORIES.has(input.category))
        throw new https_1.HttpsError('invalid-argument', 'Invalid category.');
    if (!VALID_FUND_HEADS.has(input.fundHead))
        throw new https_1.HttpsError('invalid-argument', 'Invalid fundHead.');
    (0, validate_1.requirePositivePaise)(input.estCostPaise, 'estCostPaise');
    if (!Array.isArray(input.quotations) || input.quotations.length === 0)
        throw new https_1.HttpsError('invalid-argument', 'At least one quotation is required.');
    for (const q of input.quotations) {
        if (!q.vendorId?.trim())
            throw new https_1.HttpsError('invalid-argument', 'Each quotation must have a vendorId.');
        (0, validate_1.requirePositivePaise)(q.amountPaise, 'amountPaise');
        if (!q.scopeNotes?.trim())
            throw new https_1.HttpsError('invalid-argument', 'Each quotation must have scopeNotes.');
    }
    // ── Tier resolution + quorum check (D9) ─────────────────────────────────
    const requiredApprovers = await (0, tierHelpers_1.resolveRequiredApprovers)(societyId, input.estCostPaise);
    // ── Write atomically ─────────────────────────────────────────────────────
    const requestRef = admin_1.db.collection(`societies/${societyId}/expenseRequests`).doc();
    const requestId = requestRef.id;
    const batch = admin_1.db.batch();
    const reqData = {
        societyId,
        type: 'maintenance',
        title: input.title.trim(),
        description: input.description.trim(),
        ...(input.location?.trim() && { location: input.location.trim() }),
        priority: input.priority,
        category: input.category,
        fundHead: input.fundHead,
        estCostPaise: input.estCostPaise,
        requiredApprovers,
        status: 'requested',
        createdBy: uid,
        createdRole: role,
        submittedAt: firestore_1.FieldValue.serverTimestamp(),
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    };
    batch.set(requestRef, reqData);
    for (const q of input.quotations) {
        const quoteRef = requestRef.collection('quotations').doc();
        const quoteData = {
            societyId,
            requestId,
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
        action: 'expense_request_created',
        targetType: 'expenseRequest',
        targetId: requestId,
        after: { type: 'maintenance', title: input.title.trim(), estCostPaise: input.estCostPaise },
    });
    (0, notify_1.dispatchNotificationSafe)({
        societyId,
        type: 'expense_request_created',
        toRole: 'mc',
        payload: { requestId, title: input.title.trim(), requestType: 'maintenance' },
    });
    return { requestId };
});
