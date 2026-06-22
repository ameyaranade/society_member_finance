import type { ApprovalTier } from '../types/config';

/**
 * Resolve the approval tier for a given amount.
 * minPaise inclusive, maxPaise exclusive (null = open-ended last tier).
 */
export function resolveTier(
  amountPaise: number,
  tiers: ApprovalTier[],
): ApprovalTier | null {
  return (
    tiers.find(
      t =>
        amountPaise >= t.minPaise &&
        (t.maxPaise === null || amountPaise < t.maxPaise),
    ) ?? null
  );
}

/**
 * Validate tiers array before saving to Firestore:
 * - At least one tier
 * - Each requiredApprovers ≥ 1
 * - No requiredApprovers exceeds activeMCCount (quorum rule, D9)
 * - Tiers are contiguous: max[n] === min[n+1]
 * - Only the last tier is open-ended (maxPaise === null)
 * Returns an error message string, or null if valid.
 */
export function validateTiers(
  tiers: ApprovalTier[],
  activeMCCount: number,
): string | null {
  if (tiers.length === 0) return 'At least one approval tier is required.';

  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    if (!Number.isInteger(t.requiredApprovers) || t.requiredApprovers < 1)
      return `Tier ${i + 1}: required approvers must be ≥ 1.`;
    if (t.requiredApprovers > activeMCCount)
      return `Tier ${i + 1}: needs ${t.requiredApprovers} approver(s) but only ${activeMCCount} active MC member(s).`;
    if (i < tiers.length - 1) {
      if (t.maxPaise === null)
        return `Only the last tier can be open-ended.`;
      const next = tiers[i + 1];
      if (t.maxPaise !== next.minPaise)
        return `Tiers must be contiguous: tier ${i + 1} max must equal tier ${i + 2} min.`;
    } else {
      if (t.maxPaise !== null)
        return 'The last tier must be open-ended (no upper limit).';
    }
  }
  return null;
}
