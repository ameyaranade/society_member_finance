import { describe, it, expect } from 'vitest';
import { resolveTier, validateTiers } from './approvalTiers';
import type { ApprovalTier } from '../types/config';

const tiers: ApprovalTier[] = [
  { minPaise: 0,       maxPaise: 2500000,  requiredApprovers: 1 }, // ₹0–₹25k
  { minPaise: 2500000, maxPaise: 5000000,  requiredApprovers: 2 }, // ₹25k–₹50k
  { minPaise: 5000000, maxPaise: null,      requiredApprovers: 3 }, // ₹50k+
];

// ── resolveTier ────────────────────────────────────────────────────────────────

describe('resolveTier (client)', () => {
  it('matches the first tier for amounts at its minimum', () => {
    expect(resolveTier(0, tiers)?.requiredApprovers).toBe(1);
  });

  it('matches the middle tier', () => {
    expect(resolveTier(3000000, tiers)?.requiredApprovers).toBe(2);
  });

  it('matches the open-ended last tier', () => {
    expect(resolveTier(10000000, tiers)?.requiredApprovers).toBe(3);
  });

  it('matches the open-ended last tier at its exact minimum', () => {
    expect(resolveTier(5000000, tiers)?.requiredApprovers).toBe(3);
  });

  // ── Boundary contract: both client and server use EXCLUSIVE max (< maxPaise) ──
  // An amount exactly equal to a tier's maxPaise does NOT match that tier —
  // it falls through to the next tier. Client and server agree (X-3 fixed).
  it('does NOT match a tier when amount equals its maxPaise (exclusive upper bound)', () => {
    // ₹25,000 exactly == tier[0].maxPaise → falls to tier[1]
    expect(resolveTier(2500000, tiers)?.requiredApprovers).toBe(2);
  });

  it('matches within the first tier just below the boundary', () => {
    expect(resolveTier(2499999, tiers)?.requiredApprovers).toBe(1);
  });

  it('returns null when no tier covers the amount', () => {
    expect(resolveTier(0, [])).toBeNull();
  });
});

// ── validateTiers ──────────────────────────────────────────────────────────────

describe('validateTiers', () => {
  it('accepts valid contiguous tiers', () => {
    expect(validateTiers(tiers, 5)).toBeNull();
  });

  it('rejects empty tiers', () => {
    expect(validateTiers([], 5)).toMatch(/at least one/i);
  });

  it('rejects requiredApprovers < 1', () => {
    const bad: ApprovalTier[] = [{ minPaise: 0, maxPaise: null, requiredApprovers: 0 }];
    expect(validateTiers(bad, 5)).toMatch(/≥ 1/);
  });

  it('rejects requiredApprovers exceeding active MC count (quorum rule)', () => {
    const exceeds: ApprovalTier[] = [{ minPaise: 0, maxPaise: null, requiredApprovers: 3 }];
    expect(validateTiers(exceeds, 2)).toMatch(/active MC/);
  });

  it('rejects non-contiguous tiers (gap between bands)', () => {
    const gap: ApprovalTier[] = [
      { minPaise: 0,       maxPaise: 1000000,  requiredApprovers: 1 },
      { minPaise: 2000000, maxPaise: null,      requiredApprovers: 2 }, // gap!
    ];
    expect(validateTiers(gap, 5)).toMatch(/contiguous/i);
  });

  it('rejects a non-final tier with open-ended maxPaise', () => {
    const openMiddle: ApprovalTier[] = [
      { minPaise: 0,       maxPaise: null,     requiredApprovers: 1 }, // open-ended in the middle
      { minPaise: 1000000, maxPaise: null,     requiredApprovers: 2 },
    ];
    expect(validateTiers(openMiddle, 5)).toMatch(/open-ended/i);
  });

  it('rejects a final tier that is not open-ended', () => {
    const closedFinal: ApprovalTier[] = [
      { minPaise: 0, maxPaise: 1000000, requiredApprovers: 1 }, // last tier has a cap → invalid
    ];
    expect(validateTiers(closedFinal, 5)).toMatch(/open-ended/i);
  });
});
