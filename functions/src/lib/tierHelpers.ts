import { db } from './admin';
import type { ApprovalTier } from './types';

/** Find the tier covering `estCostPaise` and return its `requiredApprovers`. */
export function resolveTier(estCostPaise: number, tiers: ApprovalTier[]): number {
  const tier = tiers.find(
    t => estCostPaise >= t.minPaise && (t.maxPaise === null || estCostPaise <= t.maxPaise),
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
