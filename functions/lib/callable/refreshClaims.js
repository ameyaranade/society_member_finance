"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshClaims = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
const claims_1 = require("../lib/claims");
const audit_1 = require("../lib/audit");
/**
 * Called by the client immediately after sign-in.
 * 1. Upserts a /users/{uid} profile doc.
 * 2. Links any membership docs whose email matches (invited → active).
 * 3. Recomputes and sets custom claims.
 * 4. Returns the new claims so the client can force-refresh the token.
 */
exports.refreshClaims = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const { uid, token } = request.auth;
    const email = token.email ?? '';
    // 1. Upsert global user profile
    await admin_1.db.doc(`users/${uid}`).set({
        uid,
        email,
        displayName: token.name ?? '',
        photoURL: token.picture ?? undefined,
        lastLoginAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    // 2. Link invited memberships — but only if the email is verified.
    //    Google sign-ins are always verified; email/password accounts require
    //    the user to click the verification link first.
    const signInProvider = token.firebase?.sign_in_provider;
    const isEmailPassword = signInProvider === 'password';
    const emailVerified = token.email_verified === true;
    if (isEmailPassword && !emailVerified) {
        // Skip activation until the user verifies their email.
        // Still return (possibly empty) claims so the client can proceed to the
        // verify-your-email screen rather than seeing a blank/error state.
        return (0, claims_1.refreshUserClaims)(uid);
    }
    console.log(`refreshClaims: uid=${uid} email="${email}"`);
    const invitedSnap = await admin_1.db
        .collection('memberships')
        .where('email', '==', email)
        .where('status', '==', 'invited')
        .get();
    console.log(`refreshClaims: found ${invitedSnap.size} invited membership(s) for ${email}`);
    const batch = admin_1.db.batch();
    for (const doc of invitedSnap.docs) {
        batch.update(doc.ref, {
            uid,
            status: 'active',
            activatedAt: firestore_1.FieldValue.serverTimestamp(),
            displayName: token.name ?? '',
            photoURL: token.picture ?? undefined,
        });
    }
    if (!invitedSnap.empty) {
        await batch.commit();
        // Audit each newly activated membership
        for (const doc of invitedSnap.docs) {
            const m = doc.data();
            await (0, audit_1.writeAudit)({
                societyId: m.societyId,
                actorUid: uid,
                action: 'user_activated',
                targetType: 'membership',
                targetId: doc.id,
                after: { email, role: m.role },
            });
        }
    }
    // 3. Recompute claims — refreshUserClaims preserves superAdmin if set
    return (0, claims_1.refreshUserClaims)(uid);
});
