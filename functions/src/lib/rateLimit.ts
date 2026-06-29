import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { db } from './admin';

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
export async function checkRateLimit(
  uid: string,
  action: string,
  maxCalls: number,
  windowMs: number,
): Promise<void> {
  const key = `${uid}_${action}`;
  const ref = db.collection('rateLimits').doc(key);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();

    if (!snap.exists) {
      tx.set(ref, { uid, action, count: 1, windowStart: now, updatedAt: FieldValue.serverTimestamp() });
      return;
    }

    const data = snap.data()!;
    const windowStart = (data.windowStart as number) ?? now;

    if (now - windowStart > windowMs) {
      // Window expired — reset
      tx.update(ref, { count: 1, windowStart: now, updatedAt: FieldValue.serverTimestamp() });
      return;
    }

    const count = (data.count as number) ?? 0;
    if (count >= maxCalls) {
      throw new HttpsError(
        'resource-exhausted',
        `Rate limit exceeded. Maximum ${maxCalls} ${action} calls per ${Math.round(windowMs / 1000)}s.`,
      );
    }

    tx.update(ref, { count: count + 1, updatedAt: FieldValue.serverTimestamp() });
  });
}
