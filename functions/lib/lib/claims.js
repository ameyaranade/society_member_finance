"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshUserClaims = refreshUserClaims;
const admin_1 = require("./admin");
/**
 * Fetch all active/invited memberships for a uid, then set custom claims.
 * The first active membership becomes the default societyId.
 * All society IDs are listed in claims.societies for the future switcher.
 */
async function refreshUserClaims(uid) {
    // Always preserve superAdmin — it is set out-of-band by ops and must survive any claim refresh.
    const existing = await admin_1.adminAuth.getUser(uid);
    const isSuperAdmin = existing.customClaims?.superAdmin === true;
    const snap = await admin_1.db.collection('memberships').where('uid', '==', uid).get();
    const active = snap.docs
        .map(d => d.data())
        .filter(m => m.status === 'active');
    if (active.length === 0) {
        const claims = isSuperAdmin ? { superAdmin: true } : {};
        await admin_1.adminAuth.setCustomUserClaims(uid, claims);
        return claims;
    }
    // Use the most recently activated membership as the active one.
    // activatedAt is WriteTimestamp in the type but always a real Timestamp when read back.
    const sorted = active.sort((a, b) => {
        const ta = a.activatedAt?.toMillis() ?? 0;
        const tb = b.activatedAt?.toMillis() ?? 0;
        return tb - ta;
    });
    const primary = sorted[0];
    const claims = {
        ...(isSuperAdmin && { superAdmin: true }),
        societyId: primary.societyId,
        role: primary.role,
        societies: sorted.map(m => m.societyId),
    };
    await admin_1.adminAuth.setCustomUserClaims(uid, claims);
    return claims;
}
