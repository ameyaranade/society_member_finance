import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../lib/admin';
import { refreshUserClaims } from '../lib/claims';
import { writeAudit } from '../lib/audit';
import type { AuditAction } from '../lib/audit';
import type { AuthClaims, Membership, Role } from '../lib/types';

interface UpdateMembershipInput {
  membershipId: string;
  /** Provide to change the role */
  role?: Role;
  /** Provide to deactivate or reactivate */
  status?: 'active' | 'deactivated';
}

const VALID_ROLES: Role[] = ['admin', 'mc', 'fm', 'resident'];

/** Counts active admins in a society, optionally excluding one membership. */
async function countActiveAdmins(societyId: string, excludeId?: string): Promise<number> {
  const snap = await db
    .collection('memberships')
    .where('societyId', '==', societyId)
    .where('role', '==', 'admin')
    .where('status', '==', 'active')
    .get();
  return snap.docs.filter(d => d.id !== excludeId).length;
}

/**
 * Admin only (within their society).
 * Handles role changes + activation/deactivation.
 * Enforces: a society must always have at least one active admin.
 */
export const updateMembership = onCall(
  { region: 'asia-south1' },
  async (request): Promise<{ ok: boolean }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in.');
    }

    const callerClaims = request.auth.token as AuthClaims;
    const input = request.data as UpdateMembershipInput;

    const membershipRef = db.doc(`memberships/${input.membershipId}`);
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
      throw new HttpsError('permission-denied', 'Only admins can update memberships.');
    }

    if (input.role !== undefined && !VALID_ROLES.includes(input.role)) {
      throw new HttpsError('invalid-argument', 'Invalid role.');
    }

    // Zero-admin guard: if this is an active admin and we're demoting or deactivating
    const isLastAdminAction =
      membership.role === 'admin' &&
      membership.status === 'active' &&
      (input.status === 'deactivated' || (input.role && input.role !== 'admin'));

    if (isLastAdminAction) {
      const remainingAdmins = await countActiveAdmins(societyId, input.membershipId);
      if (remainingAdmins === 0) {
        throw new HttpsError(
          'failed-precondition',
          'Cannot remove the last admin from a society.',
        );
      }
    }

    const updates: Partial<Membership> & Record<string, unknown> = {};
    if (input.role !== undefined) updates.role = input.role;
    if (input.status !== undefined) updates.status = input.status;
    if (input.status === 'active' && membership.status !== 'active') {
      updates.activatedAt = FieldValue.serverTimestamp();
    }

    await membershipRef.update(updates);

    // Determine audit action
    let auditAction: AuditAction = 'role_changed';
    if (input.status === 'deactivated')  auditAction = 'user_deactivated';
    else if (input.status === 'active')  auditAction = 'user_reactivated';

    await writeAudit({
      societyId,
      actorUid: request.auth.uid,
      actorRole: callerClaims.role ?? 'unknown',
      action: auditAction,
      targetType: 'membership',
      targetId: input.membershipId,
      before: { role: membership.role, status: membership.status },
      after: { role: input.role ?? membership.role, status: input.status ?? membership.status },
    });

    // Refresh claims for the affected user (if they have a UID)
    if (membership.uid) {
      await refreshUserClaims(membership.uid);
    }

    return { ok: true };
  },
);
