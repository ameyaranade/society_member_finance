"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchNotification = dispatchNotification;
exports.dispatchNotificationSafe = dispatchNotificationSafe;
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("./admin");
const email_1 = require("./email");
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
    // Email delivery — real or stub depending on the society's testMode flag.
    // Fetch testMode once per dispatch call; failures are fire-and-forget.
    try {
        const societySnap = await admin_1.db.doc(`societies/${societyId}`).get();
        const testMode = societySnap.data()?.config?.testMode === true;
        const emailAdapter = (0, email_1.resolveEmailAdapter)(testMode);
        // Collect recipient emails from their user profiles
        const emailSnaps = await Promise.all(recipientUids.map(uid => admin_1.db.doc(`users/${uid}`).get()));
        const emails = emailSnaps
            .map(s => s.data()?.email)
            .filter((e) => !!e && e.includes('@'));
        if (emails.length > 0) {
            (0, email_1.sendEmailSafe)(emailAdapter, {
                to: emails,
                subject: `[Society] ${type.replace(/_/g, ' ')}`,
                text: `${payload.title ?? type}\n\n${JSON.stringify(payload)}`,
            });
        }
    }
    catch (e) {
        console.error('notify email dispatch error:', e);
    }
}
/**
 * Fire-and-forget wrapper — notification failure must never block the main operation.
 * Call sites use this instead of inlining void dispatchNotification(...).catch(...).
 */
function dispatchNotificationSafe(params) {
    void dispatchNotification(params).catch(e => console.error('notify error:', e));
}
