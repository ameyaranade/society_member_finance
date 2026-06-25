import { HttpsError } from 'firebase-functions/v2/https';
import { db } from './admin';
import type { ApprovalTier } from './types';

/** Find the tier covering `estCostPaise` and return its `requiredApprovers`. */
export function resolveTier(estCostPaise: number, tiers: ApprovalTier[]): number {
  const tier = tiers.find(
    t => estCostPaise >= t.minPaise && (t.maxPaise === null || estCostPaise < t.maxPaise),
  );
  if (!tier) {
    throw new Error(
      `No approval tier covers this amount. Update approval tiers in Settings.`,
    );
  }
  return tier.requiredApprovers;
}

/** Count active MC members for a society (root memberships collection). */
export async function getActiveMCCount(societyId: string): Promise<number> {
  const snap = await db
    .collection('memberships')
    .where('societyId', '==', societyId)
    .where('role', '==', 'mc')
    .where('status', '==', 'active')
    .get();
  return snap.size;
}

/** Read approvalTiers from the society config document. */
export async function fetchApprovalTiers(societyId: string): Promise<ApprovalTier[]> {
  const snap = await db.doc(`societies/${societyId}`).get();
  return ((snap.data()?.config?.approvalTiers) ?? []) as ApprovalTier[];
}

/**
 * Fetches tiers and MC count in parallel, resolves the required approver count,
 * and enforces MC-quorum (D9). Throws failed-precondition on any failure.
 */
export async function resolveRequiredApprovers(societyId: string, estCostPaise: number): Promise<number> {
  const [tiers, activeMCCount] = await Promise.all([
    fetchApprovalTiers(societyId),
    getActiveMCCount(societyId),
  ]);

  let requiredApprovers: number;
  try {
    requiredApprovers = resolveTier(estCostPaise, tiers);
  } catch (e: unknown) {
    throw new HttpsError('failed-precondition', e instanceof Error ? e.message : 'Tier error.');
  }

  if (requiredApprovers > activeMCCount)
    throw new HttpsError(
      'failed-precondition',
      `This request needs ${requiredApprovers} MC approver(s) but the society only has ${activeMCCount} active MC member(s).`,
    );

  return requiredApprovers;
}
