"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchNotification = dispatchNotification;
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("./admin");
/**
 * Write in-app notification docs to /societies/{societyId}/notifications/{id}.
 * Non-critical: callers should .catch() so notification failure never blocks the main operation.
 */
async function dispatchNotification(params) {
    const { societyId, type, payload, toRole } = params;
    let recipientUids = params.toUids ?? [];
    if (toRole) {
        const snap = await admin_1.db
            .collection('memberships')
            .where('societyId', '==', societyId)
            .where('role', '==', toRole)
            .where('status', '==', 'active')
            .get();
        recipientUids = snap.docs
            .map(d => d.data().uid)
            .filter((uid) => !!uid);
    }
    if (recipientUids.length === 0)
        return;
    // Firestore batch limit is 500; for a society this will never be exceeded
    const batch = admin_1.db.batch();
    for (const toUid of recipientUids) {
        const ref = admin_1.db.collection(`societies/${societyId}/notifications`).doc();
        batch.set(ref, {
            societyId,
            toUid,
            type,
            payload,
            channels: ['in_app'],
            readAt: null,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    await batch.commit();
    // Email stub — transactional email to be implemented in a later phase
}
