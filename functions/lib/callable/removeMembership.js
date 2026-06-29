"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeMembership = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin_1 = require("../lib/admin");
const claims_1 = require("../lib/claims");
const audit_1 = require("../lib/audit");
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
 * Admin only. Removes a membership from a society — deletes the doc and
 * revokes the affected user's society claims. Never touches the Firebase
 * Auth account itself (the user may belong to other societies).
 */
exports.removeMembership = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const callerClaims = request.auth.token;
    const { membershipId } = request.data;
    if (!membershipId) {
        throw new https_1.HttpsError('invalid-argument', 'membershipId is required.');
    }
    const membershipRef = admin_1.db.doc(`memberships/${membershipId}`);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Membership not found.');
    }
    const membership = membershipSnap.data();
    const { societyId } = membership;
    const isAdmin = callerClaims.superAdmin ||
        (callerClaims.role === 'admin' && callerClaims.societyId === societyId);
    if (!isAdmin) {
        throw new https_1.HttpsError('permission-denied', 'Only admins can remove memberships.');
    }
    // Cannot remove the last active admin
    if (membership.role === 'admin' && membership.status === 'active') {
        const remaining = await countActiveAdmins(societyId, membershipId);
        if (remaining === 0) {
            throw new https_1.HttpsError('failed-precondition', 'Cannot remove the last admin from a society.');
        }
    }
    const snapshot = {
        email: membership.email,
        role: membership.role,
        status: membership.status,
    };
    await membershipRef.delete();
    await (0, audit_1.writeAudit)({
        societyId,
        actorUid: request.auth.uid,
        actorRole: callerClaims.role ?? 'unknown',
        action: 'user_removed',
        targetType: 'membership',
        targetId: membershipId,
        before: snapshot,
    });
    // Revoke this society's claims from the user's token (does not delete the auth account)
    if (membership.uid) {
        await (0, claims_1.refreshUserClaims)(membership.uid);
    }
    return { ok: true };
});
