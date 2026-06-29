"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const refreshClaims_1 = require("./refreshClaims");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const refreshClaims = refreshClaims_1.refreshClaims;
const { mockInvitedSnap, mockBatchCommit, mockUserSet, mockRefreshUserClaims, mockWriteAudit, mockDb } = vitest_1.vi.hoisted(() => {
    const mockInvitedSnap = { empty: true, size: 0, docs: [] };
    const mockBatchUpdate = vitest_1.vi.fn();
    const mockBatchCommit = vitest_1.vi.fn().mockResolvedValue(undefined);
    const mockUserSet = vitest_1.vi.fn().mockResolvedValue(undefined);
    const mockRefreshUserClaims = vitest_1.vi.fn().mockResolvedValue({ societyId: 'soc1', role: 'mc' });
    const mockWriteAudit = vitest_1.vi.fn().mockResolvedValue(undefined);
    const mockDb = {
        doc: vitest_1.vi.fn(() => ({ set: mockUserSet })),
        collection: vitest_1.vi.fn(() => ({
            where: vitest_1.vi.fn().mockReturnThis(),
            get: vitest_1.vi.fn(() => Promise.resolve(mockInvitedSnap)),
        })),
        batch: vitest_1.vi.fn(() => ({ update: mockBatchUpdate, commit: mockBatchCommit })),
    };
    return { mockInvitedSnap, mockBatchCommit, mockUserSet, mockRefreshUserClaims, mockWriteAudit, mockDb };
});
vitest_1.vi.mock('../lib/admin', () => ({ db: mockDb, adminAuth: {} }));
vitest_1.vi.mock('../lib/audit', () => ({ writeAudit: mockWriteAudit }));
vitest_1.vi.mock('../lib/claims', () => ({ refreshUserClaims: mockRefreshUserClaims }));
vitest_1.vi.mock('firebase-admin/app', () => ({ initializeApp: vitest_1.vi.fn() }));
vitest_1.vi.mock('firebase-admin/firestore', () => ({
    FieldValue: { serverTimestamp: () => 'SERVER_TS' },
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
function makeRequest({ uid = 'user1', email = 'user@test.com', emailVerified = true, signInProvider = 'google.com', name = 'Test User', } = {}) {
    return {
        auth: {
            uid,
            token: {
                email,
                email_verified: emailVerified,
                name,
                firebase: { sign_in_provider: signInProvider },
            },
        },
    };
}
(0, vitest_1.describe)('refreshClaims — email verification gate', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        mockInvitedSnap.empty = true;
        mockInvitedSnap.docs = [];
        mockInvitedSnap.size = 0;
    });
    (0, vitest_1.it)('activates an invited membership for a verified Google sign-in', async () => {
        mockInvitedSnap.empty = false;
        mockInvitedSnap.size = 1;
        mockInvitedSnap.docs = [{
                id: 'user_soc1',
                ref: {},
                data: () => ({ societyId: 'soc1', role: 'mc', email: 'user@test.com' }),
            }];
        await refreshClaims(makeRequest({ signInProvider: 'google.com', emailVerified: true }));
        (0, vitest_1.expect)(mockBatchCommit).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(mockWriteAudit).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ action: 'user_activated' }));
    });
    (0, vitest_1.it)('does NOT activate a membership when email/password user is unverified', async () => {
        mockInvitedSnap.empty = false;
        mockInvitedSnap.size = 1;
        mockInvitedSnap.docs = [{
                id: 'user_soc1',
                ref: {},
                data: () => ({ societyId: 'soc1', role: 'mc', email: 'user@test.com' }),
            }];
        await refreshClaims(makeRequest({ signInProvider: 'password', emailVerified: false }));
        // Batch should not have been committed — no membership activation
        (0, vitest_1.expect)(mockBatchCommit).not.toHaveBeenCalled();
        (0, vitest_1.expect)(mockWriteAudit).not.toHaveBeenCalled();
        // Claims refresh still called (so client gets current token state)
        (0, vitest_1.expect)(mockRefreshUserClaims).toHaveBeenCalledWith('user1');
    });
    (0, vitest_1.it)('activates a membership for a verified email/password user', async () => {
        mockInvitedSnap.empty = false;
        mockInvitedSnap.size = 1;
        mockInvitedSnap.docs = [{
                id: 'user_soc1',
                ref: {},
                data: () => ({ societyId: 'soc1', role: 'fm', email: 'user@test.com' }),
            }];
        await refreshClaims(makeRequest({ signInProvider: 'password', emailVerified: true }));
        (0, vitest_1.expect)(mockBatchCommit).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(mockWriteAudit).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ action: 'user_activated', societyId: 'soc1' }));
    });
    (0, vitest_1.it)('unauthenticated request throws', async () => {
        await (0, vitest_1.expect)(refreshClaims({ auth: null })).rejects.toThrow('Must be signed in');
    });
    (0, vitest_1.it)('still upserts user profile even when no invited memberships exist', async () => {
        await refreshClaims(makeRequest());
        (0, vitest_1.expect)(mockUserSet).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(mockBatchCommit).not.toHaveBeenCalled();
    });
});
