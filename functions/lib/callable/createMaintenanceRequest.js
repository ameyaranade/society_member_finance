"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMaintenanceRequest = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
const audit_1 = require("../lib/audit");
const notify_1 = require("../lib/notify");
const tierHelpers_1 = require("../lib/tierHelpers");
const VALID_PRIORITIES = new Set(['low', 'medium', 'high']);
const VALID_CATEGORIES = new Set([
    'electrical', 'plumbing', 'civil', 'mechanical',
    'landscaping', 'security', 'housekeeping', 'other',
]);
const VALID_FUND_HEADS = new Set(['general', 'sinking', 'corpus', 'repair']);
exports.createMaintenanceRequest = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Not signed in.');
    const token = request.auth?.token;
    const societyId = token?.societyId;
    const role = token?.role;
    if (!societyId)
        throw new https_1.HttpsError('failed-precondition', 'No active society.');
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
    if (!Number.isInteger(input.estCostPaise) || input.estCostPaise <= 0)
        throw new https_1.HttpsError('invalid-argument', 'estCostPaise must be a positive integer.');
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
    // ── Tier resolution + quorum check (D9) ─────────────────────────────────
    const [tiers, activeMCCount] = await Promise.all([
        (0, tierHelpers_1.fetchApprovalTiers)(societyId),
        (0, tierHelpers_1.getActiveMCCount)(societyId),
    ]);
    let requiredApprovers;
    try {
        requiredApprovers = (0, tierHelpers_1.resolveTier)(input.estCostPaise, tiers);
    }
    catch (e) {
        throw new https_1.HttpsError('failed-precondition', e instanceof Error ? e.message : 'Tier error.');
    }
    if (requiredApprovers > activeMCCount) {
        throw new https_1.HttpsError('failed-precondition', `This request needs ${requiredApprovers} MC approver(s) but the society only has ${activeMCCount} active MC member(s). Add more MC members or adjust approval tiers in Settings.`);
    }
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
        action: 'expense_request_created',
        targetType: 'expenseRequest',
        targetId: requestId,
        after: { type: 'maintenance', title: input.title.trim(), estCostPaise: input.estCostPaise },
    });
    void (0, notify_1.dispatchNotification)({
        societyId,
        type: 'expense_request_created',
        toRole: 'mc',
        payload: { requestId, title: input.title.trim(), requestType: 'maintenance' },
    }).catch(e => console.error('notify error:', e));
    return { requestId };
});
