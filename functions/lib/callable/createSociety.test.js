"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const createSociety_1 = require("./createSociety");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createSociety = createSociety_1.createSociety;
// ── Hoisted mocks (vi.mock is hoisted; vars must be too) ──────────────────────
const { mockBatch, mockSocietyGet, mockDb } = vitest_1.vi.hoisted(() => {
    const mockBatch = {
        set: vitest_1.vi.fn().mockReturnThis(),
        update: vitest_1.vi.fn().mockReturnThis(),
        delete: vitest_1.vi.fn().mockReturnThis(),
        commit: vitest_1.vi.fn().mockResolvedValue(undefined),
    };
    const mockSocietyGet = vitest_1.vi.fn();
    const mockSocietyDoc = { get: mockSocietyGet, id: 'test-society' };
    const mockMembershipDoc = { set: vitest_1.vi.fn().mockResolvedValue(undefined) };
    const mockDb = {
        doc: vitest_1.vi.fn((path) => path.startsWith('societies/') ? mockSocietyDoc : mockMembershipDoc),
        batch: vitest_1.vi.fn(() => mockBatch),
    };
    return { mockBatch, mockSocietyGet, mockDb };
});
vitest_1.vi.mock('../lib/admin', () => ({
    db: mockDb,
    adminAuth: { getUser: vitest_1.vi.fn(), setCustomUserClaims: vitest_1.vi.fn() },
}));
vitest_1.vi.mock('../lib/audit', () => ({ writeAudit: vitest_1.vi.fn().mockResolvedValue(undefined) }));
vitest_1.vi.mock('firebase-admin/app', () => ({ initializeApp: vitest_1.vi.fn() }));
vitest_1.vi.mock('firebase-admin/firestore', () => ({
    FieldValue: { serverTimestamp: () => 'SERVER_TS', delete: () => 'DELETE' },
}));
vitest_1.vi.mock('firebase-functions/v2/https', () => ({
    onCall: (optsOrHandler, maybeHandler) => maybeHandler ?? optsOrHandler,
    HttpsError: class HttpsError extends Error {
        code;
        constructor(code, message) {
            super(message);
            this.code = code;
        }
    },
}));
const superAdminAuth = { uid: 'super1', token: { superAdmin: true } };
function makeRequest(data, auth = superAdminAuth) {
    return { auth, data };
}
(0, vitest_1.describe)('createSociety', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        mockSocietyGet.mockResolvedValue({ exists: false });
    });
    (0, vitest_1.it)('creates society and admin membership', async () => {
        const result = await createSociety(makeRequest({
            societyId: 'test-society',
            name: 'Test Society',
            totalUnits: 100,
            adminEmail: 'admin@test.com',
        }));
        (0, vitest_1.expect)(result).toEqual({ societyId: 'test-society' });
        (0, vitest_1.expect)(mockBatch.commit).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(mockBatch.set).toHaveBeenCalledTimes(2);
    });
    (0, vitest_1.it)('rejects non-super-admin', async () => {
        await (0, vitest_1.expect)(createSociety(makeRequest({ societyId: 'x', name: 'X', totalUnits: 1, adminEmail: 'a@b.com' }, { uid: 'user1', token: { role: 'admin', societyId: 'other' } }))).rejects.toThrow('Super-admin only');
    });
    (0, vitest_1.it)('rejects invalid societyId', async () => {
        await (0, vitest_1.expect)(createSociety(makeRequest({
            societyId: 'UPPER_CASE!',
            name: 'X',
            totalUnits: 1,
            adminEmail: 'a@b.com',
        }))).rejects.toThrow('societyId must be');
    });
    (0, vitest_1.it)('rejects duplicate societyId', async () => {
        mockSocietyGet.mockResolvedValue({ exists: true });
        await (0, vitest_1.expect)(createSociety(makeRequest({
            societyId: 'test-society',
            name: 'X',
            totalUnits: 1,
            adminEmail: 'a@b.com',
        }))).rejects.toThrow('already exists');
    });
});
