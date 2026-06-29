"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const removeMembership_1 = require("./removeMembership");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const removeMembership = removeMembership_1.removeMembership;
const { mockMembershipData, mockMembershipExists, mockDelete, mockAdminCountDocs, mockWriteAudit, mockRefreshClaims, mockDb } = vitest_1.vi.hoisted(() => {
    const mockMembershipData = vitest_1.vi.fn();
    const mockMembershipExists = { value: true };
    const mockDelete = vitest_1.vi.fn().mockResolvedValue(undefined);
    const mockAdminCountDocs = [];
    const mockWriteAudit = vitest_1.vi.fn().mockResolvedValue(undefined);
    const mockRefreshClaims = vitest_1.vi.fn().mockResolvedValue({});
    const mockMembershipRef = {
        get: vitest_1.vi.fn(() => Promise.resolve({ exists: mockMembershipExists.value, data: mockMembershipData })),
        delete: mockDelete,
    };
    const mockColChain = {
        where: vitest_1.vi.fn().mockReturnThis(),
        get: vitest_1.vi.fn(() => Promise.resolve({ docs: mockAdminCountDocs })),
    };
    const mockDb = {
        doc: vitest_1.vi.fn(() => mockMembershipRef),
        collection: vitest_1.vi.fn(() => mockColChain),
    };
    return { mockMembershipData, mockMembershipExists, mockDelete, mockAdminCountDocs, mockWriteAudit, mockRefreshClaims, mockDb };
});
vitest_1.vi.mock('../lib/admin', () => ({ db: mockDb, adminAuth: {} }));
vitest_1.vi.mock('../lib/audit', () => ({ writeAudit: mockWriteAudit }));
vitest_1.vi.mock('../lib/claims', () => ({ refreshUserClaims: mockRefreshClaims }));
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
const adminAuth = { uid: 'admin1', token: { role: 'admin', societyId: 'soc1' } };
function makeRequest(data, auth = adminAuth) {
    return { auth, data };
}
(0, vitest_1.describe)('removeMembership', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        mockMembershipExists.value = true;
        mockAdminCountDocs.length = 0;
        // Default: a removable MC member in soc1
        mockMembershipData.mockReturnValue({
            email: 'mc@test.com', role: 'mc', status: 'active', societyId: 'soc1', uid: 'mcUid',
        });
    });
    (0, vitest_1.it)('removes a membership, writes an audit entry, and revokes claims', async () => {
        const result = await removeMembership(makeRequest({ membershipId: 'mc_soc1' }));
        (0, vitest_1.expect)(result).toEqual({ ok: true });
        (0, vitest_1.expect)(mockDelete).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(mockWriteAudit).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ action: 'user_removed', societyId: 'soc1', targetId: 'mc_soc1' }));
        (0, vitest_1.expect)(mockRefreshClaims).toHaveBeenCalledWith('mcUid');
    });
    (0, vitest_1.it)('rejects an unauthenticated caller', async () => {
        await (0, vitest_1.expect)(removeMembership(makeRequest({ membershipId: 'mc_soc1' }, null))).rejects.toThrow('Must be signed in');
    });
    (0, vitest_1.it)('denies a non-admin caller', async () => {
        await (0, vitest_1.expect)(removeMembership(makeRequest({ membershipId: 'mc_soc1' }, { uid: 'fm1', token: { role: 'fm', societyId: 'soc1' } }))).rejects.toThrow('Only admins');
    });
    (0, vitest_1.it)('denies cross-society removal (admin of another society)', async () => {
        // Caller is admin of soc2; target membership belongs to soc1
        await (0, vitest_1.expect)(removeMembership(makeRequest({ membershipId: 'mc_soc1' }, { uid: 'admin2', token: { role: 'admin', societyId: 'soc2' } }))).rejects.toThrow('Only admins');
        (0, vitest_1.expect)(mockDelete).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('blocks removing the last active admin', async () => {
        mockMembershipData.mockReturnValue({
            email: 'admin1@test.com', role: 'admin', status: 'active', societyId: 'soc1', uid: 'admin1',
        });
        // mockAdminCountDocs empty → 0 other admins remain
        await (0, vitest_1.expect)(removeMembership(makeRequest({ membershipId: 'admin1_soc1' }))).rejects.toThrow('Cannot remove the last admin');
        (0, vitest_1.expect)(mockDelete).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('allows removing an admin when another active admin exists', async () => {
        mockMembershipData.mockReturnValue({
            email: 'admin1@test.com', role: 'admin', status: 'active', societyId: 'soc1', uid: 'admin1',
        });
        mockAdminCountDocs.push({ id: 'admin2_soc1' });
        const result = await removeMembership(makeRequest({ membershipId: 'admin1_soc1' }));
        (0, vitest_1.expect)(result).toEqual({ ok: true });
        (0, vitest_1.expect)(mockDelete).toHaveBeenCalledOnce();
    });
    (0, vitest_1.it)('returns not-found for a missing membership', async () => {
        mockMembershipExists.value = false;
        await (0, vitest_1.expect)(removeMembership(makeRequest({ membershipId: 'ghost_soc1' }))).rejects.toThrow('Membership not found');
    });
});
