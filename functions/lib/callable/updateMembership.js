"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMembership = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
const claims_1 = require("../lib/claims");
const audit_1 = require("../lib/audit");
const VALID_ROLES = ['admin', 'mc', 'fm', 'resident'];
/** Counts active admins in a society, optionally excluding one membership. */
async function countActiveAdmins(societyId, excludeId) {
    const snap = await admin_1.db
        .collection('memberships')
        .where('societyId', '==', societyId)
        .where('role', '==', 'admin')
        .where('status', '==', 'active')
        .get();
    return snap.docs.filter(d => d.id !== excludeId).length;
}
/**
 * Admin only (within their society).
 * Handles role changes + activation/deactivation.
 * Enforces: a society must always have at least one active admin.
 */
exports.updateMembership = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const callerClaims = request.auth.token;
    const input = request.data;
    const membershipRef = admin_1.db.doc(`memberships/${input.membershipId}`);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Membership not found.');
    }
    const membership = membershipSnap.data();
    const { societyId } = membership;
    const isAdmin = callerClaims.superAdmin ||
        (callerClaims.role === 'admin' && callerClaims.societyId === societyId);
    if (!isAdmin) {
        throw new https_1.HttpsError('permission-denied', 'Only admins can update memberships.');
    }
    if (input.role !== undefined && !VALID_ROLES.includes(input.role)) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid role.');
    }
    // Zero-admin guard: if this is an active admin and we're demoting or deactivating
    const isLastAdminAction = membership.role === 'admin' &&
        membership.status === 'active' &&
        (input.status === 'deactivated' || (input.role && input.role !== 'admin'));
    if (isLastAdminAction) {
        const remainingAdmins = await countActiveAdmins(societyId, input.membershipId);
        if (remainingAdmins === 0) {
            throw new https_1.HttpsError('failed-precondition', 'Cannot remove the last admin from a society.');
        }
    }
    const updates = {};
    if (input.role !== undefined)
        updates.role = input.role;
    if (input.status !== undefined)
        updates.status = input.status;
    if (input.status === 'active' && membership.status !== 'active') {
        updates.activatedAt = firestore_1.FieldValue.serverTimestamp();
    }
    await membershipRef.update(updates);
    // Determine audit action
    let auditAction = 'role_changed';
    if (input.status === 'deactivated')
        auditAction = 'user_deactivated';
    else if (input.status === 'active')
        auditAction = 'user_reactivated';
    await (0, audit_1.writeAudit)({
        societyId,
        actorUid: request.auth.uid,
        actorRole: callerClaims.role ?? 'unknown',
        action: auditAction,
        targetType: 'membership',
        targetId: input.membershipId,
        before: { role: membership.role, status: membership.status },
        after: { role: input.role ?? membership.role, status: input.status ?? membership.status },
    });
    // Refresh claims for the affected user (if they have a UID)
    if (membership.uid) {
        await (0, claims_1.refreshUserClaims)(membership.uid);
    }
    return { ok: true };
});
