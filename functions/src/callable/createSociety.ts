import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../lib/admin';
import { writeAudit } from '../lib/audit';
import type { AuthClaims, Membership } from '../lib/types';

interface CreateSocietyInput {
  societyId: string;   // caller-chosen slug, e.g. "nbh-bangalore"
  name: string;
  address?: string;
  registrationNo?: string;
  totalUnits: number;
  adminEmail: string;  // email of the first admin to invite
}

/**
 * Super-admin only.
 * Creates the society doc + default config + first admin membership.
 */
export const createSociety = onCall(
  { region: 'asia-south1' },
  async (request): Promise<{ societyId: string }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in.');
    }

    const claims = request.auth.token as AuthClaims;
    if (!claims.superAdmin) {
      throw new HttpsError('permission-denied', 'Super-admin only.');
    }

    const input = request.data as CreateSocietyInput;

    if (!input.societyId || !/^[a-z0-9-]{3,40}$/.test(input.societyId)) {
      throw new HttpsError(
        'invalid-argument',
        'societyId must be 3-40 lowercase alphanumeric characters or hyphens.',
      );
    }
    if (!input.name?.trim()) {
      throw new HttpsError('invalid-argument', 'name is required.');
    }
    if (!input.adminEmail?.includes('@')) {
      throw new HttpsError('invalid-argument', 'Valid adminEmail required.');
    }

    const societyRef = db.doc(`societies/${input.societyId}`);
    const existingSnap = await societyRef.get();
    if (existingSnap.exists) {
      throw new HttpsError('already-exists', `Society ${input.societyId} already exists.`);
    }

    const batch = db.batch();

    // Society document
    batch.set(societyRef, {
      id: input.societyId,
      name: input.name.trim(),
      address: input.address?.trim() ?? null,
      registrationNo: input.registrationNo?.trim() ?? null,
      totalUnits: input.totalUnits ?? 0,
      createdAt: FieldValue.serverTimestamp(),
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
    const membershipRef = db.doc(`memberships/${membershipId}`);
    batch.set(membershipRef, {
      id: membershipId,
      societyId: input.societyId,
      email: input.adminEmail.toLowerCase(),
      role: 'admin',
      status: 'invited',
      invitedBy: request.auth.uid,
      invitedAt: FieldValue.serverTimestamp(),
    } satisfies Omit<Membership, 'uid' | 'activatedAt' | 'displayName' | 'photoURL'>);

    await batch.commit();

    await writeAudit({
      societyId: input.societyId,
      actorUid: request.auth.uid,
      actorRole: 'superAdmin',
      action: 'society_created',
      targetType: 'society',
      targetId: input.societyId,
      after: { name: input.name, adminEmail: input.adminEmail },
    });

    return { societyId: input.societyId };
  },
);
