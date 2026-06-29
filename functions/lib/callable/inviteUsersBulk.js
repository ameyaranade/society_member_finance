"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inviteUsersBulk = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
const audit_1 = require("../lib/audit");
const rateLimit_1 = require("../lib/rateLimit");
const VALID_ROLES = ['admin', 'mc', 'fm', 'resident'];
/**
 * Admin only. Bulk-invite up to 200 members in one call.
 * Each row is attempted independently — partial success is normal and reported.
 */
exports.inviteUsersBulk = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const callerClaims = request.auth.token;
    const input = request.data;
    const isAdmin = callerClaims.superAdmin ||
        (callerClaims.role === 'admin' && callerClaims.societyId === input.societyId);
    if (!isAdmin) {
        throw new https_1.HttpsError('permission-denied', 'Only admins can bulk-invite members.');
    }
    await (0, rateLimit_1.checkRateLimit)(request.auth.uid, 'inviteBulk', 5, 60_000);
    if (!Array.isArray(input.rows) || input.rows.length === 0) {
        throw new https_1.HttpsError('invalid-argument', 'rows must be a non-empty array.');
    }
    if (input.rows.length > 200) {
        throw new https_1.HttpsError('invalid-argument', 'Maximum 200 rows per bulk invite.');
    }
    let invited = 0;
    const errors = [];
    for (const row of input.rows) {
        const email = row.email?.toLowerCase()?.trim();
        if (!email?.includes('@')) {
            errors.push({ email: email ?? '', message: 'Invalid email address.' });
            continue;
        }
        if (!VALID_ROLES.includes(row.role)) {
            errors.push({ email, message: `Invalid role "${row.role}".` });
            continue;
        }
        const membershipId = `${email.replace(/[^a-z0-9]/gi, '_')}_${input.societyId}`;
        const membershipRef = admin_1.db.doc(`memberships/${membershipId}`);
        try {
            const existing = await membershipRef.get();
            if (existing.exists) {
                const data = existing.data();
                if (data.status !== 'deactivated') {
                    errors.push({ email, message: 'Already has an active or invited membership.' });
                    continue;
                }
                await membershipRef.update({
                    role: row.role,
                    status: 'invited',
                    invitedBy: request.auth.uid,
                    invitedAt: firestore_1.FieldValue.serverTimestamp(),
                    uid: firestore_1.FieldValue.delete(),
                    activatedAt: firestore_1.FieldValue.delete(),
                });
            }
            else {
                await membershipRef.set({
                    id: membershipId,
                    societyId: input.societyId,
                    email,
                    role: row.role,
                    status: 'invited',
                    invitedBy: request.auth.uid,
                    invitedAt: firestore_1.FieldValue.serverTimestamp(),
                });
            }
            await (0, audit_1.writeAudit)({
                societyId: input.societyId,
                actorUid: request.auth.uid,
                actorRole: callerClaims.role ?? 'unknown',
                action: 'user_invited',
                targetType: 'membership',
                targetId: membershipId,
                after: { email, role: row.role },
            });
            invited++;
        }
        catch (err) {
            errors.push({ email, message: err.message });
        }
    }
    return { invited, errors };
});
