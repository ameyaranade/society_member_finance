import type { Timestamp } from 'firebase-admin/firestore';
import { adminAuth, db } from './admin';
import type { AuthClaims, Membership } from './types';

/**
 * Fetch all active/invited memberships for a uid, then set custom claims.
 * The first active membership becomes the default societyId.
 * All society IDs are listed in claims.societies for the future switcher.
 */
export async function refreshUserClaims(uid: string): Promise<AuthClaims> {
  // Always preserve superAdmin — it is set out-of-band by ops and must survive any claim refresh.
  const existing = await adminAuth.getUser(uid);
  const isSuperAdmin = (existing.customClaims as AuthClaims)?.superAdmin === true;

  const snap = await db.collection('memberships').where('uid', '==', uid).get();

  const active = snap.docs
    .map(d => d.data() as Membership)
    .filter(m => m.status === 'active');

  if (active.length === 0) {
    const claims: AuthClaims = isSuperAdmin ? { superAdmin: true } : {};
    await adminAuth.setCustomUserClaims(uid, claims);
    return claims;
  }

  // Use the most recently activated membership as the active one.
  // activatedAt is WriteTimestamp in the type but always a real Timestamp when read back.
  const sorted = active.sort((a, b) => {
    const ta = (a.activatedAt as Timestamp | undefined)?.toMillis() ?? 0;
    const tb = (b.activatedAt as Timestamp | undefined)?.toMillis() ?? 0;
    return tb - ta;
  });
  const primary = sorted[0];

  const claims: AuthClaims = {
    ...(isSuperAdmin && { superAdmin: true }),
    societyId: primary.societyId,
    role: primary.role,
    societies: sorted.map(m => m.societyId),
  };

  await adminAuth.setCustomUserClaims(uid, claims);
  return claims;
}
