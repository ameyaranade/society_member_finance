"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTier = resolveTier;
exports.getActiveMCCount = getActiveMCCount;
exports.fetchApprovalTiers = fetchApprovalTiers;
exports.resolveRequiredApprovers = resolveRequiredApprovers;
const https_1 = require("firebase-functions/v2/https");
const admin_1 = require("./admin");
/** Find the tier covering `estCostPaise` and return its `requiredApprovers`. */
function resolveTier(estCostPaise, tiers) {
    const tier = tiers.find(t => estCostPaise >= t.minPaise && (t.maxPaise === null || estCostPaise < t.maxPaise));
    if (!tier) {
        throw new Error(`No approval tier covers this amount. Update approval tiers in Settings.`);
    }
    return tier.requiredApprovers;
}
/** Count active MC members for a society (root memberships collection). */
async function getActiveMCCount(societyId) {
    const snap = await admin_1.db
        .collection('memberships')
        .where('societyId', '==', societyId)
        .where('role', '==', 'mc')
        .where('status', '==', 'active')
        .get();
    return snap.size;
}
/** Read approvalTiers from the society config document. */
async function fetchApprovalTiers(societyId) {
    const snap = await admin_1.db.doc(`societies/${societyId}`).get();
    return ((snap.data()?.config?.approvalTiers) ?? []);
}
/**
 * Fetches tiers and MC count in parallel, resolves the required approver count,
 * and enforces MC-quorum (D9). Throws failed-precondition on any failure.
 */
async function resolveRequiredApprovers(societyId, estCostPaise) {
    const [tiers, activeMCCount] = await Promise.all([
        fetchApprovalTiers(societyId),
        getActiveMCCount(societyId),
    ]);
    let requiredApprovers;
    try {
        requiredApprovers = resolveTier(estCostPaise, tiers);
    }
    catch (e) {
        throw new https_1.HttpsError('failed-precondition', e instanceof Error ? e.message : 'Tier error.');
    }
    if (requiredApprovers > activeMCCount)
        throw new https_1.HttpsError('failed-precondition', `This request needs ${requiredApprovers} MC approver(s) but the society only has ${activeMCCount} active MC member(s).`);
    return requiredApprovers;
}
