"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRateLimit = checkRateLimit;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const admin_1 = require("./admin");
/**
 * Firestore-backed sliding-window rate limiter.
 * Writes a counter doc at rateLimits/{uid}_{action}; throws if the caller
 * exceeds `maxCalls` within `windowMs` milliseconds.
 *
 * Non-critical path: if the write itself fails the error bubbles up and the
 * caller is blocked (fail-closed). Always wrap in a try/catch if you want
 * fail-open behaviour.
 *
 * Usage:
 *   await checkRateLimit(uid, 'invite', 10, 60_000); // max 10 invites per minute
 */
async function checkRateLimit(uid, action, maxCalls, windowMs) {
    const key = `${uid}_${action}`;
    const ref = admin_1.db.collection('rateLimits').doc(key);
    await admin_1.db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const now = Date.now();
        if (!snap.exists) {
            tx.set(ref, { uid, action, count: 1, windowStart: now, updatedAt: firestore_1.FieldValue.serverTimestamp() });
            return;
        }
        const data = snap.data();
        const windowStart = data.windowStart ?? now;
        if (now - windowStart > windowMs) {
            // Window expired — reset
            tx.update(ref, { count: 1, windowStart: now, updatedAt: firestore_1.FieldValue.serverTimestamp() });
            return;
        }
        const count = data.count ?? 0;
        if (count >= maxCalls) {
            throw new https_1.HttpsError('resource-exhausted', `Rate limit exceeded. Maximum ${maxCalls} ${action} calls per ${Math.round(windowMs / 1000)}s.`);
        }
        tx.update(ref, { count: count + 1, updatedAt: firestore_1.FieldValue.serverTimestamp() });
    });
}
