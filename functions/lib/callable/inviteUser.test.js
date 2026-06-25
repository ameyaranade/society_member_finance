"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const inviteUser_1 = require("./inviteUser");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inviteUser = inviteUser_1.inviteUser;
const { mockMembershipGet, mockMembershipSet, mockDb } = vitest_1.vi.hoisted(() => {
    const mockMembershipGet = vitest_1.vi.fn();
    const mockMembershipSet = vitest_1.vi.fn().mockResolvedValue(undefined);
    const mockMembershipRef = {
        get: mockMembershipGet,
        set: mockMembershipSet,
        update: vitest_1.vi.fn().mockResolvedValue(undefined),
    };
    const mockDb = { doc: vitest_1.vi.fn(() => mockMembershipRef) };
    return { mockMembershipGet, mockMembershipSet, mockDb };
});
vitest_1.vi.mock('../lib/admin', () => ({ db: mockDb, adminAuth: {} }));
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
const adminAuth = { uid: 'admin1', token: { role: 'admin', societyId: 'soc1' } };
function makeRequest(data, auth = adminAuth) {
    return { auth, data };
}
(0, vitest_1.describe)('inviteUser', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        mockMembershipGet.mockResolvedValue({ exists: false });
    });
    (0, vitest_1.it)('creates a membership for a new user', async () => {
        const result = await inviteUser(makeRequest({
            email: 'fm@test.com',
            role: 'fm',
            societyId: 'soc1',
        }));
        (0, vitest_1.expect)(result.membershipId).toBeTruthy();
        (0, vitest_1.expect)(mockMembershipSet).toHaveBeenCalledOnce();
    });
    (0, vitest_1.it)('denies a non-admin caller', async () => {
        await (0, vitest_1.expect)(inviteUser(makeRequest({ email: 'x@y.com', role: 'mc', societyId: 'soc1' }, { uid: 'fm1', token: { role: 'fm', societyId: 'soc1' } }))).rejects.toThrow('Only admins');
    });
    (0, vitest_1.it)('denies cross-society invite', async () => {
        await (0, vitest_1.expect)(inviteUser(makeRequest({
            email: 'x@y.com',
            role: 'mc',
            societyId: 'other-society',
        }))).rejects.toThrow('Only admins');
    });
    (0, vitest_1.it)('rejects an already-active membership', async () => {
        mockMembershipGet.mockResolvedValue({
            exists: true,
            data: () => ({ status: 'active' }),
        });
        await (0, vitest_1.expect)(inviteUser(makeRequest({ email: 'x@y.com', role: 'mc', societyId: 'soc1' }))).rejects.toThrow('already has a membership');
    });
});
