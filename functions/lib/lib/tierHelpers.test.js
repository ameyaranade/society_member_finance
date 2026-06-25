"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
// ── Hoisted mocks ──────────────────────────────────────────────────────────────
const { mockDb } = vitest_1.vi.hoisted(() => {
    const mockGet = vitest_1.vi.fn();
    const mockColChain = {
        where: vitest_1.vi.fn().mockReturnThis(),
        get: mockGet,
    };
    const mockDb = {
        collection: vitest_1.vi.fn(() => mockColChain),
        doc: vitest_1.vi.fn(() => ({ get: mockGet })),
    };
    return { mockDb, mockGet };
});
vitest_1.vi.mock('./admin', () => ({ db: mockDb }));
vitest_1.vi.mock('firebase-admin/app', () => ({ initializeApp: vitest_1.vi.fn() }));
vitest_1.vi.mock('firebase-admin/firestore', () => ({}));
const tierHelpers_1 = require("./tierHelpers");
const tiers = [
    { minPaise: 0, maxPaise: 2500000, requiredApprovers: 1 },
    { minPaise: 2500000, maxPaise: 5000000, requiredApprovers: 2 },
    { minPaise: 5000000, maxPaise: null, requiredApprovers: 3 },
];
// ── resolveTier ────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('resolveTier (server)', () => {
    (0, vitest_1.it)('matches the first tier', () => {
        (0, vitest_1.expect)((0, tierHelpers_1.resolveTier)(0, tiers)).toBe(1);
    });
    (0, vitest_1.it)('matches the middle tier', () => {
        (0, vitest_1.expect)((0, tierHelpers_1.resolveTier)(3000000, tiers)).toBe(2);
    });
    (0, vitest_1.it)('matches the open-ended last tier', () => {
        (0, vitest_1.expect)((0, tierHelpers_1.resolveTier)(10000000, tiers)).toBe(3);
    });
    // ── Boundary contract: server uses EXCLUSIVE max (< maxPaise), matching client ─
    // An amount exactly equal to a tier's maxPaise falls through to the next tier.
    (0, vitest_1.it)('EXCLUSIVE: amount == tier[0].maxPaise falls through to tier[1]', () => {
        (0, vitest_1.expect)((0, tierHelpers_1.resolveTier)(2500000, tiers)).toBe(2);
    });
    (0, vitest_1.it)('EXCLUSIVE: amount == tier[1].maxPaise falls through to open-ended tier[2]', () => {
        (0, vitest_1.expect)((0, tierHelpers_1.resolveTier)(5000000, tiers)).toBe(3);
    });
    (0, vitest_1.it)('matches the open-ended last tier for amounts at or above tier[1].maxPaise', () => {
        (0, vitest_1.expect)((0, tierHelpers_1.resolveTier)(5000001, tiers)).toBe(3);
    });
    (0, vitest_1.it)('throws when no tier covers the amount', () => {
        (0, vitest_1.expect)(() => (0, tierHelpers_1.resolveTier)(0, [])).toThrow('No approval tier covers this amount');
    });
});
// ── getActiveMCCount ───────────────────────────────────────────────────────────
(0, vitest_1.describe)('getActiveMCCount', () => {
    (0, vitest_1.beforeEach)(() => vitest_1.vi.clearAllMocks());
    (0, vitest_1.it)('queries memberships for active mc members in the society', async () => {
        const colChain = mockDb.collection();
        colChain.get.mockResolvedValue({ size: 3 });
        const count = await (0, tierHelpers_1.getActiveMCCount)('soc1');
        (0, vitest_1.expect)(count).toBe(3);
        (0, vitest_1.expect)(mockDb.collection).toHaveBeenCalledWith('memberships');
        (0, vitest_1.expect)(colChain.where).toHaveBeenCalledWith('societyId', '==', 'soc1');
        (0, vitest_1.expect)(colChain.where).toHaveBeenCalledWith('role', '==', 'mc');
        (0, vitest_1.expect)(colChain.where).toHaveBeenCalledWith('status', '==', 'active');
    });
    (0, vitest_1.it)('returns 0 when no MC members exist', async () => {
        const colChain = mockDb.collection();
        colChain.get.mockResolvedValue({ size: 0 });
        (0, vitest_1.expect)(await (0, tierHelpers_1.getActiveMCCount)('soc1')).toBe(0);
    });
});
// ── fetchApprovalTiers ─────────────────────────────────────────────────────────
(0, vitest_1.describe)('fetchApprovalTiers', () => {
    (0, vitest_1.beforeEach)(() => vitest_1.vi.clearAllMocks());
    (0, vitest_1.it)('reads tiers from the society document config', async () => {
        const mockDocGet = vitest_1.vi.fn().mockResolvedValue({
            data: () => ({ config: { approvalTiers: tiers } }),
        });
        mockDb.doc.mockReturnValue({ get: mockDocGet });
        const result = await (0, tierHelpers_1.fetchApprovalTiers)('soc1');
        (0, vitest_1.expect)(result).toEqual(tiers);
        (0, vitest_1.expect)(mockDb.doc).toHaveBeenCalledWith('societies/soc1');
    });
    (0, vitest_1.it)('returns [] when config.approvalTiers is absent', async () => {
        const mockDocGet = vitest_1.vi.fn().mockResolvedValue({ data: () => ({}) });
        mockDb.doc.mockReturnValue({ get: mockDocGet });
        (0, vitest_1.expect)(await (0, tierHelpers_1.fetchApprovalTiers)('soc1')).toEqual([]);
    });
});
