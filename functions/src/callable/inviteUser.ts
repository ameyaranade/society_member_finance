import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../lib/admin';
import { writeAudit } from '../lib/audit';
import type { AuthClaims, Membership, Role } from '../lib/types';

interface InviteUserInput {
  email: string;
  role: Role;
  societyId: string;
}

const VALID_ROLES: Role[] = ['admin', 'mc', 'fm', 'resident'];

/**
 * Admin only (within their society).
 * Creates a membership doc with status:'invited'.
 * The user activates it on first sign-in via refreshClaims.
 */
export const inviteUser = onCall(async (request): Promise<{ membershipId: string }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in.');
    }

    const callerClaims = request.auth.token as AuthClaims;
    const input = request.data as InviteUserInput;

    // Must be admin of the target society (or super-admin)
    const isAdmin =
      callerClaims.superAdmin ||
      (callerClaims.role === 'admin' && callerClaims.societyId === input.societyId);

    if (!isAdmin) {
      throw new HttpsError('permission-denied', 'Only admins can invite users.');
    }

    if (!input.email?.includes('@')) {
      throw new HttpsError('invalid-argument', 'Valid email required.');
    }
    if (!VALID_ROLES.includes(input.role)) {
      throw new HttpsError('invalid-argument', `Role must be one of: ${VALID_ROLES.join(', ')}.`);
    }

    const email = input.email.toLowerCase();
    const membershipId = `${email.replace(/[^a-z0-9]/gi, '_')}_${input.societyId}`;
    const membershipRef = db.doc(`memberships/${membershipId}`);

    const existing = await membershipRef.get();
    if (existing.exists) {
      const data = existing.data() as Membership;
      if (data.status !== 'deactivated') {
        throw new HttpsError('already-exists', 'This user already has a membership.');
      }
      // Re-invite a previously deactivated user
      await membershipRef.update({
        role: input.role,
        status: 'invited',
        invitedBy: request.auth.uid,
        invitedAt: FieldValue.serverTimestamp(),
        uid: FieldValue.delete(),
        activatedAt: FieldValue.delete(),
      });
      return { membershipId };
    }

    await membershipRef.set({
      id: membershipId,
      societyId: input.societyId,
      email,
      role: input.role,
      status: 'invited',
      invitedBy: request.auth.uid,
      invitedAt: FieldValue.serverTimestamp(),
    } satisfies Omit<Membership, 'uid' | 'activatedAt' | 'displayName' | 'photoURL'>);

    await writeAudit({
      societyId: input.societyId,
      actorUid: request.auth.uid,
      actorRole: callerClaims.role ?? 'unknown',
      action: 'user_invited',
      targetType: 'membership',
      targetId: membershipId,
      after: { email, role: input.role },
    });

    return { membershipId };
  },
);
