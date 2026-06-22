"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleSnag = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
const audit_1 = require("../lib/audit");
const VALID_PRIORITIES = new Set(['low', 'medium', 'high']);
const VALID_CATEGORIES = new Set([
    'electrical', 'plumbing', 'civil', 'mechanical',
    'landscaping', 'security', 'housekeeping', 'other',
]);
const VALID_FUND_HEADS = new Set(['general', 'sinking', 'corpus', 'repair']);
const VALID_PLAN_MODES = new Set([
    'month', 'quarter', 'year', 'custom', 'by_date',
]);
exports.scheduleSnag = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Not signed in.');
    const token = request.auth?.token;
    const societyId = token?.societyId;
    const role = token?.role;
    if (!societyId)
        throw new https_1.HttpsError('failed-precondition', 'No active society.');
    if (role !== 'admin')
        throw new https_1.HttpsError('permission-denied', 'Only Admin can schedule a snag.');
    const input = request.data;
    // ── Validate ──────────────────────────────────────────────────────────────
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
    // Validate budget window (D9c)
    const plan = input.plan;
    if (!plan || !VALID_PLAN_MODES.has(plan.mode))
        throw new https_1.HttpsError('invalid-argument', 'plan.mode must be one of: month, quarter, year, custom, by_date.');
    if (!plan.startDate?.trim() || !plan.endDate?.trim())
        throw new https_1.HttpsError('invalid-argument', 'plan.startDate and plan.endDate are required.');
    if (!plan.label?.trim())
        throw new https_1.HttpsError('invalid-argument', 'plan.label is required.');
    // ── Write ─────────────────────────────────────────────────────────────────
    const requestRef = admin_1.db.collection(`societies/${societyId}/expenseRequests`).doc();
    const requestId = requestRef.id;
    const reqData = {
        societyId,
        type: 'snag',
        title: input.title.trim(),
        description: input.description.trim(),
        ...(input.location?.trim() && { location: input.location.trim() }),
        priority: input.priority,
        category: input.category,
        fundHead: input.fundHead,
        estCostPaise: input.estCostPaise,
        status: 'scheduled',
        plan: {
            mode: plan.mode,
            startDate: plan.startDate.trim(),
            endDate: plan.endDate.trim(),
            label: plan.label.trim(),
        },
        ...(input.parentRequestId?.trim() && { parentRequestId: input.parentRequestId.trim() }),
        createdBy: uid,
        createdRole: role,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    };
    await requestRef.set(reqData);
    await (0, audit_1.writeAudit)({
        societyId,
        actorUid: uid,
        actorRole: role,
        action: 'snag_scheduled',
        targetType: 'expenseRequest',
        targetId: requestId,
        after: { type: 'snag', title: input.title.trim(), estCostPaise: input.estCostPaise, plan: reqData.plan },
    });
    return { requestId };
});
