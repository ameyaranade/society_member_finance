import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../lib/admin';
import { refreshUserClaims } from '../lib/claims';
import { writeAudit } from '../lib/audit';
import type { AuthClaims, Membership } from '../lib/types';

interface RemoveMembershipInput {
  membershipId: string;
}

async function countActiveAdmins(societyId: string, excludeId: string): Promise<number> {
  const snap = await db
    .collection('memberships')
    .where('societyId', '==', societyId)
    .where('role', '==', 'admin')
    .where('status', '==', 'active')
    .get();
  return snap.docs.filter(d => d.id !== excludeId).length;
}

/**
 * Admin only. Removes a membership from a society — deletes the doc and
 * revokes the affected user's society claims. Never touches the Firebase
 * Auth account itself (the user may belong to other societies).
 */
export const removeMembership = onCall(async (request): Promise<{ ok: true }> => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.');
  }

  const callerClaims = request.auth.token as AuthClaims;
  const { membershipId } = request.data as RemoveMembershipInput;

  if (!membershipId) {
    throw new HttpsError('invalid-argument', 'membershipId is required.');
  }

  const membershipRef = db.doc(`memberships/${membershipId}`);
  const membershipSnap = await membershipRef.get();
  if (!membershipSnap.exists) {
    throw new HttpsError('not-found', 'Membership not found.');
  }

  const membership = membershipSnap.data() as Membership;
  const { societyId } = membership;

  const isAdmin =
    callerClaims.superAdmin ||
    (callerClaims.role === 'admin' && callerClaims.societyId === societyId);

  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Only admins can remove memberships.');
  }

  // Cannot remove the last active admin
  if (membership.role === 'admin' && membership.status === 'active') {
    const remaining = await countActiveAdmins(societyId, membershipId);
    if (remaining === 0) {
      throw new HttpsError(
        'failed-precondition',
        'Cannot remove the last admin from a society.',
      );
    }
  }

  const snapshot = {
    email: membership.email,
    role:  membership.role,
    status: membership.status,
  };

  await membershipRef.delete();

  await writeAudit({
    societyId,
    actorUid:   request.auth.uid,
    actorRole:  callerClaims.role ?? 'unknown',
    action:     'user_removed',
    targetType: 'membership',
    targetId:   membershipId,
    before:     snapshot,
  });

  // Revoke this society's claims from the user's token (does not delete the auth account)
  if (membership.uid) {
    await refreshUserClaims(membership.uid);
  }

  return { ok: true };
});
