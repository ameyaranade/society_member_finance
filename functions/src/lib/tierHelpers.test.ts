import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────────
const { mockDb } = vi.hoisted(() => {
  const mockGet = vi.fn();
  const mockColChain = {
    where: vi.fn().mockReturnThis(),
    get:   mockGet,
  };
  const mockDb = {
    collection: vi.fn(() => mockColChain),
    doc:        vi.fn(() => ({ get: mockGet })),
  };
  return { mockDb, mockGet };
});

vi.mock('./admin', () => ({ db: mockDb }));
vi.mock('firebase-admin/app', () => ({ initializeApp: vi.fn() }));
vi.mock('firebase-admin/firestore', () => ({}));

import { resolveTier, getActiveMCCount, fetchApprovalTiers } from './tierHelpers';
import type { ApprovalTier } from './types';

const tiers: ApprovalTier[] = [
  { minPaise: 0,       maxPaise: 2500000,  requiredApprovers: 1 },
  { minPaise: 2500000, maxPaise: 5000000,  requiredApprovers: 2 },
  { minPaise: 5000000, maxPaise: null,      requiredApprovers: 3 },
];

// ── resolveTier ────────────────────────────────────────────────────────────────

describe('resolveTier (server)', () => {
  it('matches the first tier', () => {
    expect(resolveTier(0, tiers)).toBe(1);
  });

  it('matches the middle tier', () => {
    expect(resolveTier(3000000, tiers)).toBe(2);
  });

  it('matches the open-ended last tier', () => {
    expect(resolveTier(10000000, tiers)).toBe(3);
  });

  // ── Boundary contract: server uses EXCLUSIVE max (< maxPaise), matching client ─
  // An amount exactly equal to a tier's maxPaise falls through to the next tier.

  it('EXCLUSIVE: amount == tier[0].maxPaise falls through to tier[1]', () => {
    expect(resolveTier(2500000, tiers)).toBe(2);
  });

  it('EXCLUSIVE: amount == tier[1].maxPaise falls through to open-ended tier[2]', () => {
    expect(resolveTier(5000000, tiers)).toBe(3);
  });

  it('matches the open-ended last tier for amounts at or above tier[1].maxPaise', () => {
    expect(resolveTier(5000001, tiers)).toBe(3);
  });

  it('throws when no tier covers the amount', () => {
    expect(() => resolveTier(0, [])).toThrow('No approval tier covers this amount');
  });
});

// ── getActiveMCCount ───────────────────────────────────────────────────────────

describe('getActiveMCCount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('queries memberships for active mc members in the society', async () => {
    const colChain = mockDb.collection();
    (colChain.get as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 3 });

    const count = await getActiveMCCount('soc1');
    expect(count).toBe(3);
    expect(mockDb.collection).toHaveBeenCalledWith('memberships');
    expect(colChain.where).toHaveBeenCalledWith('societyId', '==', 'soc1');
    expect(colChain.where).toHaveBeenCalledWith('role', '==', 'mc');
    expect(colChain.where).toHaveBeenCalledWith('status', '==', 'active');
  });

  it('returns 0 when no MC members exist', async () => {
    const colChain = mockDb.collection();
    (colChain.get as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 0 });
    expect(await getActiveMCCount('soc1')).toBe(0);
  });
});

// ── fetchApprovalTiers ─────────────────────────────────────────────────────────

describe('fetchApprovalTiers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads tiers from the society document config', async () => {
    const mockDocGet = vi.fn().mockResolvedValue({
      data: () => ({ config: { approvalTiers: tiers } }),
    });
    mockDb.doc.mockReturnValue({ get: mockDocGet });

    const result = await fetchApprovalTiers('soc1');
    expect(result).toEqual(tiers);
    expect(mockDb.doc).toHaveBeenCalledWith('societies/soc1');
  });

  it('returns [] when config.approvalTiers is absent', async () => {
    const mockDocGet = vi.fn().mockResolvedValue({ data: () => ({}) });
    mockDb.doc.mockReturnValue({ get: mockDocGet });
    expect(await fetchApprovalTiers('soc1')).toEqual([]);
  });
});
