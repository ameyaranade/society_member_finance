"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const inviteUsersBulk_1 = require("./inviteUsersBulk");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inviteUsersBulk = inviteUsersBulk_1.inviteUsersBulk;
const { mockDocGet, mockDocSet, mockDocUpdate, mockWriteAudit, mockDb } = vitest_1.vi.hoisted(() => {
    const mockDocGet = vitest_1.vi.fn().mockResolvedValue({ exists: false });
    const mockDocSet = vitest_1.vi.fn().mockResolvedValue(undefined);
    const mockDocUpdate = vitest_1.vi.fn().mockResolvedValue(undefined);
    const mockWriteAudit = vitest_1.vi.fn().mockResolvedValue(undefined);
    const mockDocRef = { get: mockDocGet, set: mockDocSet, update: mockDocUpdate };
    const mockDb = { doc: vitest_1.vi.fn(() => mockDocRef) };
    return { mockDocGet, mockDocSet, mockDocUpdate, mockWriteAudit, mockDb };
});
vitest_1.vi.mock('../lib/admin', () => ({ db: mockDb, adminAuth: {} }));
vitest_1.vi.mock('../lib/audit', () => ({ writeAudit: mockWriteAudit }));
vitest_1.vi.mock('../lib/rateLimit', () => ({ checkRateLimit: vitest_1.vi.fn().mockResolvedValue(undefined) }));
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
(0, vitest_1.describe)('inviteUsersBulk', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        mockDocGet.mockResolvedValue({ exists: false });
    });
    (0, vitest_1.it)('invites all valid rows and writes audit entries', async () => {
        const result = await inviteUsersBulk(makeRequest({
            societyId: 'soc1',
            rows: [
                { email: 'a@test.com', role: 'mc' },
                { email: 'b@test.com', role: 'fm' },
            ],
        }));
        (0, vitest_1.expect)(result.invited).toBe(2);
        (0, vitest_1.expect)(result.errors).toHaveLength(0);
        (0, vitest_1.expect)(mockDocSet).toHaveBeenCalledTimes(2);
        (0, vitest_1.expect)(mockWriteAudit).toHaveBeenCalledTimes(2);
    });
    (0, vitest_1.it)('denies a non-admin caller', async () => {
        await (0, vitest_1.expect)(inviteUsersBulk(makeRequest({ societyId: 'soc1', rows: [{ email: 'x@y.com', role: 'mc' }] }, { uid: 'fm1', token: { role: 'fm', societyId: 'soc1' } }))).rejects.toThrow('Only admins');
    });
    (0, vitest_1.it)('denies cross-society invites', async () => {
        await (0, vitest_1.expect)(inviteUsersBulk(makeRequest({ societyId: 'other-soc', rows: [{ email: 'x@y.com', role: 'mc' }] }, { uid: 'admin1', token: { role: 'admin', societyId: 'soc1' } }))).rejects.toThrow('Only admins');
    });
    (0, vitest_1.it)('rejects an unauthenticated caller', async () => {
        await (0, vitest_1.expect)(inviteUsersBulk(makeRequest({ societyId: 'soc1', rows: [] }, null))).rejects.toThrow('Must be signed in');
    });
    (0, vitest_1.it)('reports invalid email as a row error, not a thrown exception', async () => {
        const result = await inviteUsersBulk(makeRequest({
            societyId: 'soc1',
            rows: [
                { email: 'not-an-email', role: 'mc' },
                { email: 'good@test.com', role: 'mc' },
            ],
        }));
        (0, vitest_1.expect)(result.invited).toBe(1);
        (0, vitest_1.expect)(result.errors).toHaveLength(1);
        (0, vitest_1.expect)(result.errors[0].message).toMatch(/Invalid email/);
    });
    (0, vitest_1.it)('reports an invalid role as a row error', async () => {
        const result = await inviteUsersBulk(makeRequest({
            societyId: 'soc1',
            rows: [{ email: 'x@test.com', role: 'superuser' }],
        }));
        (0, vitest_1.expect)(result.invited).toBe(0);
        (0, vitest_1.expect)(result.errors[0].message).toMatch(/Invalid role/);
    });
    (0, vitest_1.it)('skips an already-active membership and reports it as an error', async () => {
        mockDocGet.mockResolvedValue({
            exists: true,
            data: () => ({ status: 'active' }),
        });
        const result = await inviteUsersBulk(makeRequest({
            societyId: 'soc1',
            rows: [{ email: 'existing@test.com', role: 'mc' }],
        }));
        (0, vitest_1.expect)(result.invited).toBe(0);
        (0, vitest_1.expect)(result.errors[0].message).toMatch(/active or invited/);
    });
    (0, vitest_1.it)('re-invites a deactivated membership via update', async () => {
        mockDocGet.mockResolvedValue({
            exists: true,
            data: () => ({ status: 'deactivated' }),
        });
        const result = await inviteUsersBulk(makeRequest({
            societyId: 'soc1',
            rows: [{ email: 'lapsed@test.com', role: 'fm' }],
        }));
        (0, vitest_1.expect)(result.invited).toBe(1);
        (0, vitest_1.expect)(mockDocUpdate).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(mockDocSet).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('rejects more than 200 rows', async () => {
        const rows = Array.from({ length: 201 }, (_, i) => ({
            email: `u${i}@test.com`, role: 'resident',
        }));
        await (0, vitest_1.expect)(inviteUsersBulk(makeRequest({ societyId: 'soc1', rows }))).rejects.toThrow('Maximum 200');
    });
});
