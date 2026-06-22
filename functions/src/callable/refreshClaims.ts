import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../lib/admin';
import { refreshUserClaims } from '../lib/claims';
import { writeAudit } from '../lib/audit';
import type { Membership, AuthClaims } from '../lib/types';

/**
 * Called by the client immediately after sign-in.
 * 1. Upserts a /users/{uid} profile doc.
 * 2. Links any membership docs whose email matches (invited → active).
 * 3. Recomputes and sets custom claims.
 * 4. Returns the new claims so the client can force-refresh the token.
 */
export const refreshClaims = onCall(
  { region: 'asia-south1' },
  async (request): Promise<AuthClaims> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in.');
    }

    const { uid, token } = request.auth;
    const email = token.email ?? '';

    // 1. Upsert global user profile
    await db.doc(`users/${uid}`).set(
      {
        uid,
        email,
        displayName: token.name ?? '',
        photoURL: token.picture ?? undefined,
        lastLoginAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    // 2. Link invited memberships that match this email → stamp uid + activate
    console.log(`refreshClaims: uid=${uid} email="${email}"`);
    const invitedSnap = await db
      .collection('memberships')
      .where('email', '==', email)
      .where('status', '==', 'invited')
      .get();

    console.log(`refreshClaims: found ${invitedSnap.size} invited membership(s) for ${email}`);
    const batch = db.batch();
    for (const doc of invitedSnap.docs) {
      batch.update(doc.ref, {
        uid,
        status: 'active',
        activatedAt: FieldValue.serverTimestamp(),
        displayName: token.name ?? '',
        photoURL: token.picture ?? undefined,
      } satisfies Partial<Membership>);
    }
    if (!invitedSnap.empty) {
      await batch.commit();
      // Audit each newly activated membership
      for (const doc of invitedSnap.docs) {
        const m = doc.data() as Membership;
        await writeAudit({
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
    return refreshUserClaims(uid);
  },
);
