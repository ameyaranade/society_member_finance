"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inviteUser = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
const audit_1 = require("../lib/audit");
const VALID_ROLES = ['admin', 'mc', 'fm', 'resident'];
/**
 * Admin only (within their society).
 * Creates a membership doc with status:'invited'.
 * The user activates it on first sign-in via refreshClaims.
 */
exports.inviteUser = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const callerClaims = request.auth.token;
    const input = request.data;
    // Must be admin of the target society (or super-admin)
    const isAdmin = callerClaims.superAdmin ||
        (callerClaims.role === 'admin' && callerClaims.societyId === input.societyId);
    if (!isAdmin) {
        throw new https_1.HttpsError('permission-denied', 'Only admins can invite users.');
    }
    if (!input.email?.includes('@')) {
        throw new https_1.HttpsError('invalid-argument', 'Valid email required.');
    }
    if (!VALID_ROLES.includes(input.role)) {
        throw new https_1.HttpsError('invalid-argument', `Role must be one of: ${VALID_ROLES.join(', ')}.`);
    }
    const email = input.email.toLowerCase();
    const membershipId = `${email.replace(/[^a-z0-9]/gi, '_')}_${input.societyId}`;
    const membershipRef = admin_1.db.doc(`memberships/${membershipId}`);
    const existing = await membershipRef.get();
    if (existing.exists) {
        const data = existing.data();
        if (data.status !== 'deactivated') {
            throw new https_1.HttpsError('already-exists', 'This user already has a membership.');
        }
        // Re-invite a previously deactivated user
        await membershipRef.update({
            role: input.role,
            status: 'invited',
            invitedBy: request.auth.uid,
            invitedAt: firestore_1.FieldValue.serverTimestamp(),
            uid: firestore_1.FieldValue.delete(),
            activatedAt: firestore_1.FieldValue.delete(),
        });
        return { membershipId };
    }
    await membershipRef.set({
        id: membershipId,
        societyId: input.societyId,
        email,
        role: input.role,
        status: 'invited',
        invitedBy: request.auth.uid,
        invitedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    await (0, audit_1.writeAudit)({
        societyId: input.societyId,
        actorUid: request.auth.uid,
        actorRole: callerClaims.role ?? 'unknown',
        action: 'user_invited',
        targetType: 'membership',
        targetId: membershipId,
        after: { email, role: input.role },
    });
    return { membershipId };
});
