"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSociety = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
const audit_1 = require("../lib/audit");
/**
 * Super-admin only.
 * Creates the society doc + default config + first admin membership.
 */
exports.createSociety = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const claims = request.auth.token;
    if (!claims.superAdmin) {
        throw new https_1.HttpsError('permission-denied', 'Super-admin only.');
    }
    const input = request.data;
    if (!input.societyId || !/^[a-z0-9-]{3,40}$/.test(input.societyId)) {
        throw new https_1.HttpsError('invalid-argument', 'societyId must be 3-40 lowercase alphanumeric characters or hyphens.');
    }
    if (!input.name?.trim()) {
        throw new https_1.HttpsError('invalid-argument', 'name is required.');
    }
    if (!input.adminEmail?.includes('@')) {
        throw new https_1.HttpsError('invalid-argument', 'Valid adminEmail required.');
    }
    const societyRef = admin_1.db.doc(`societies/${input.societyId}`);
    const existingSnap = await societyRef.get();
    if (existingSnap.exists) {
        throw new https_1.HttpsError('already-exists', `Society ${input.societyId} already exists.`);
    }
    const batch = admin_1.db.batch();
    // Society document
    batch.set(societyRef, {
        id: input.societyId,
        name: input.name.trim(),
        address: input.address?.trim() ?? null,
        registrationNo: input.registrationNo?.trim() ?? null,
        totalUnits: input.totalUnits ?? 0,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        createdBy: request.auth.uid,
        config: {
            currency: 'INR',
            fyStartMonth: 4,
            billing: { defaultBilledParty: 'owner' },
            approvalTiers: [],
        },
    });
    // First admin invitation (no uid yet — linked when they sign in via refreshClaims)
    const membershipId = `${input.adminEmail.replace(/[^a-z0-9]/gi, '_')}_${input.societyId}`;
    const membershipRef = admin_1.db.doc(`memberships/${membershipId}`);
    batch.set(membershipRef, {
        id: membershipId,
        societyId: input.societyId,
        email: input.adminEmail.toLowerCase(),
        role: 'admin',
        status: 'invited',
        invitedBy: request.auth.uid,
        invitedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    await batch.commit();
    await (0, audit_1.writeAudit)({
        societyId: input.societyId,
        actorUid: request.auth.uid,
        actorRole: 'superAdmin',
        action: 'society_created',
        targetType: 'society',
        targetId: input.societyId,
        after: { name: input.name, adminEmail: input.adminEmail },
    });
    return { societyId: input.societyId };
});
