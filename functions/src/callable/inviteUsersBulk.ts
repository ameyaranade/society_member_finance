import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../lib/admin';
import { writeAudit } from '../lib/audit';
import type { AuthClaims, Membership, Role } from '../lib/types';

interface BulkInviteRow {
  email: string;
  role: Role;
}

interface InviteUsersBulkInput {
  societyId: string;
  rows: BulkInviteRow[];
}

interface BulkInviteResult {
  invited: number;
  errors: Array<{ email: string; message: string }>;
}

const VALID_ROLES: Role[] = ['admin', 'mc', 'fm', 'resident'];

/**
 * Admin only. Bulk-invite up to 200 members in one call.
 * Each row is attempted independently — partial success is normal and reported.
 */
export const inviteUsersBulk = onCall(async (request): Promise<BulkInviteResult> => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.');
  }

  const callerClaims = request.auth.token as AuthClaims;
  const input = request.data as InviteUsersBulkInput;

  const isAdmin =
    callerClaims.superAdmin ||
    (callerClaims.role === 'admin' && callerClaims.societyId === input.societyId);

  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Only admins can bulk-invite members.');
  }

  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    throw new HttpsError('invalid-argument', 'rows must be a non-empty array.');
  }
  if (input.rows.length > 200) {
    throw new HttpsError('invalid-argument', 'Maximum 200 rows per bulk invite.');
  }

  let invited = 0;
  const errors: BulkInviteResult['errors'] = [];

  for (const row of input.rows) {
    const email = row.email?.toLowerCase()?.trim();

    if (!email?.includes('@')) {
      errors.push({ email: email ?? '', message: 'Invalid email address.' });
      continue;
    }
    if (!VALID_ROLES.includes(row.role)) {
      errors.push({ email, message: `Invalid role "${row.role}".` });
      continue;
    }

    const membershipId = `${email.replace(/[^a-z0-9]/gi, '_')}_${input.societyId}`;
    const membershipRef = db.doc(`memberships/${membershipId}`);

    try {
      const existing = await membershipRef.get();
      if (existing.exists) {
        const data = existing.data() as Membership;
        if (data.status !== 'deactivated') {
          errors.push({ email, message: 'Already has an active or invited membership.' });
          continue;
        }
        await membershipRef.update({
          role: row.role,
          status: 'invited',
          invitedBy: request.auth.uid,
          invitedAt: FieldValue.serverTimestamp(),
          uid: FieldValue.delete(),
          activatedAt: FieldValue.delete(),
        });
      } else {
        await membershipRef.set({
          id: membershipId,
          societyId: input.societyId,
          email,
          role: row.role,
          status: 'invited',
          invitedBy: request.auth.uid,
          invitedAt: FieldValue.serverTimestamp(),
        } satisfies Omit<Membership, 'uid' | 'activatedAt' | 'displayName' | 'photoURL'>);
      }

      await writeAudit({
        societyId: input.societyId,
        actorUid:  request.auth.uid,
        actorRole: callerClaims.role ?? 'unknown',
        action:    'user_invited',
        targetType: 'membership',
        targetId:   membershipId,
        after: { email, role: row.role },
      });

      invited++;
    } catch (err) {
      errors.push({ email, message: (err as Error).message });
    }
  }

  return { invited, errors };
});
