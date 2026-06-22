"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const updateMembership_1 = require("./updateMembership");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const updateMembership = updateMembership_1.updateMembership;
const { mockMembershipData, mockAdminCountDocs, mockDb } = vitest_1.vi.hoisted(() => {
    const mockUpdate = vitest_1.vi.fn().mockResolvedValue(undefined);
    const mockMembershipData = vitest_1.vi.fn();
    const mockAdminCountDocs = [];
    const mockMembershipRef = { update: mockUpdate };
    const mockMembershipSnap = {
        exists: true,
        data: mockMembershipData,
        ref: mockMembershipRef,
        id: 'admin1_soc1',
    };
    const mockColChain = {
        where: vitest_1.vi.fn().mockReturnThis(),
        get: vitest_1.vi.fn().mockResolvedValue({ docs: mockAdminCountDocs }),
    };
    const mockDb = {
        doc: vitest_1.vi.fn(() => ({
            get: vitest_1.vi.fn().mockResolvedValue(mockMembershipSnap),
            update: mockUpdate,
        })),
        collection: vitest_1.vi.fn(() => mockColChain),
    };
    return { mockUpdate, mockMembershipData, mockAdminCountDocs, mockDb };
});
vitest_1.vi.mock('../lib/admin', () => ({
    db: mockDb,
    adminAuth: { getUser: vitest_1.vi.fn(), setCustomUserClaims: vitest_1.vi.fn() },
}));
vitest_1.vi.mock('../lib/claims', () => ({ refreshUserClaims: vitest_1.vi.fn().mockResolvedValue({}) }));
vitest_1.vi.mock('firebase-admin/app', () => ({ initializeApp: vitest_1.vi.fn() }));
vitest_1.vi.mock('firebase-admin/firestore', () => ({
    FieldValue: { serverTimestamp: () => 'SERVER_TS', delete: () => 'DELETE' },
}));
vitest_1.vi.mock('firebase-functions/v2/https', () => ({
    onCall: (_opts, handler) => handler,
    HttpsError: class HttpsError extends Error {
        code;
        constructor(code, message) {
            super(message);
            this.code = code;
        }
    },
}));
const adminAuth = { uid: 'admin1', token: { role: 'admin', societyId: 'soc1' } };
function makeRequest(data, auth = adminAuth) {
    return { auth, data };
}
(0, vitest_1.describe)('updateMembership — zero-admin guard', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        mockMembershipData.mockReturnValue({
            role: 'admin', status: 'active', societyId: 'soc1',
        });
        // Clear the mutable array
        mockAdminCountDocs.length = 0;
    });
    (0, vitest_1.it)('blocks deactivating the last admin', async () => {
        // mockAdminCountDocs is empty → 0 other admins
        await (0, vitest_1.expect)(updateMembership(makeRequest({ membershipId: 'admin1_soc1', status: 'deactivated' }))).rejects.toThrow('Cannot remove the last admin');
    });
    (0, vitest_1.it)('allows deactivation when another admin exists', async () => {
        mockAdminCountDocs.push({ id: 'admin2_soc1' });
        const result = await updateMembership(makeRequest({
            membershipId: 'admin1_soc1',
            status: 'deactivated',
        }));
        (0, vitest_1.expect)(result).toEqual({ ok: true });
    });
    (0, vitest_1.it)('blocks demoting last admin to non-admin role', async () => {
        await (0, vitest_1.expect)(updateMembership(makeRequest({ membershipId: 'admin1_soc1', role: 'mc' }))).rejects.toThrow('Cannot remove the last admin');
    });
    (0, vitest_1.it)('denies non-admin caller', async () => {
        await (0, vitest_1.expect)(updateMembership(makeRequest({ membershipId: 'admin1_soc1', role: 'mc' }, { uid: 'fm1', token: { role: 'fm', societyId: 'soc1' } }))).rejects.toThrow('Only admins');
    });
});
