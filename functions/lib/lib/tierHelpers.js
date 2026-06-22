"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTier = resolveTier;
exports.getActiveMCCount = getActiveMCCount;
exports.fetchApprovalTiers = fetchApprovalTiers;
const admin_1 = require("./admin");
/** Find the tier covering `estCostPaise` and return its `requiredApprovers`. */
function resolveTier(estCostPaise, tiers) {
    const tier = tiers.find(t => estCostPaise >= t.minPaise && (t.maxPaise === null || estCostPaise <= t.maxPaise));
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
