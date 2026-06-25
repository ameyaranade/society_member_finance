"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const recordApproval_1 = require("./recordApproval");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const recordApproval = recordApproval_1.recordApproval;
// ── Hoisted mocks ──────────────────────────────────────────────────────────────
const { mockTxn, mockApprovalRef, mockRequestRef, mockDb } = vitest_1.vi.hoisted(() => {
    const mockTxn = {
        get: vitest_1.vi.fn(),
        set: vitest_1.vi.fn(),
        update: vitest_1.vi.fn(),
    };
    const mockApprovalRef = {};
    const mockRequestRef = {
        collection: vitest_1.vi.fn(() => ({ doc: vitest_1.vi.fn(() => mockApprovalRef) })),
    };
    const mockDb = {
        doc: vitest_1.vi.fn(() => mockRequestRef),
        runTransaction: vitest_1.vi.fn(async (cb) => cb(mockTxn)),
    };
    return { mockTxn, mockApprovalRef, mockRequestRef, mockDb };
});
vitest_1.vi.mock('../lib/admin', () => ({ db: mockDb }));
vitest_1.vi.mock('../lib/audit', () => ({ writeAudit: vitest_1.vi.fn().mockResolvedValue(undefined) }));
vitest_1.vi.mock('../lib/notify', () => ({ dispatchNotification: vitest_1.vi.fn().mockResolvedValue(undefined), dispatchNotificationSafe: vitest_1.vi.fn() }));
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
const mcAuth = { uid: 'mc1', token: { role: 'mc', societyId: 'soc1' } };
function makeRequest(data, auth = mcAuth) {
    return { auth, data };
}
function mockSnap(data) {
    mockTxn.get.mockResolvedValue({ exists: true, data: () => data });
}
(0, vitest_1.beforeEach)(() => {
    vitest_1.vi.clearAllMocks();
    // Default: a request in 'requested' state, needs 2 approvers, none yet
    mockSnap({
        societyId: 'soc1',
        status: 'requested',
        approvedBy: [],
        approvalCount: 0,
        requiredApprovers: 2,
        estCostPaise: 50000,
        title: 'Fix roof',
    });
});
// ── Auth guards (pins FN-1 extraction contract) ────────────────────────────────
(0, vitest_1.describe)('recordApproval — auth guards', () => {
    (0, vitest_1.it)('throws unauthenticated when no auth', async () => {
        await (0, vitest_1.expect)(recordApproval({ auth: null, data: { requestId: 'req1' } })).rejects.toThrow('Not signed in');
    });
    (0, vitest_1.it)('throws failed-precondition when societyId missing from token', async () => {
        await (0, vitest_1.expect)(recordApproval(makeRequest({ requestId: 'req1' }, { uid: 'u1', token: {} }))).rejects.toThrow('No active society');
    });
    (0, vitest_1.it)('throws permission-denied for FM role', async () => {
        await (0, vitest_1.expect)(recordApproval(makeRequest({ requestId: 'req1' }, { uid: 'fm1', token: { role: 'fm', societyId: 'soc1' } }))).rejects.toThrow('Only MC members can approve');
    });
    (0, vitest_1.it)('throws permission-denied for Admin role', async () => {
        await (0, vitest_1.expect)(recordApproval(makeRequest({ requestId: 'req1' }, { uid: 'a1', token: { role: 'admin', societyId: 'soc1' } }))).rejects.toThrow('Only MC members can approve');
    });
});
// ── Cross-society guard (pins FN-2 extraction contract) ───────────────────────
(0, vitest_1.describe)('recordApproval — cross-society guard', () => {
    (0, vitest_1.it)('throws permission-denied when doc.societyId differs from caller', async () => {
        mockSnap({ societyId: 'other_soc', status: 'requested', approvedBy: [], approvalCount: 0 });
        await (0, vitest_1.expect)(recordApproval(makeRequest({ requestId: 'req1' }))).rejects.toThrow('Cross-society access denied');
    });
});
// ── Business rules ─────────────────────────────────────────────────────────────
(0, vitest_1.describe)('recordApproval — business rules', () => {
    (0, vitest_1.it)('throws failed-precondition when request is not in requested status', async () => {
        mockSnap({ societyId: 'soc1', status: 'approved', approvedBy: [] });
        await (0, vitest_1.expect)(recordApproval(makeRequest({ requestId: 'req1' }))).rejects.toThrow('Cannot approve a request with status');
    });
    (0, vitest_1.it)('throws failed-precondition on self-approval (same uid already approved)', async () => {
        mockSnap({
            societyId: 'soc1', status: 'requested',
            approvedBy: ['mc1'], // mc1 is the caller
            approvalCount: 1, requiredApprovers: 2,
        });
        await (0, vitest_1.expect)(recordApproval(makeRequest({ requestId: 'req1' }))).rejects.toThrow('already approved this request');
    });
    (0, vitest_1.it)('returns ok:true and approved:false for a partial approval', async () => {
        const result = await recordApproval(makeRequest({ requestId: 'req1' }));
        // requiredApprovers is 2, approvalCount goes from 0 → 1
        (0, vitest_1.expect)(result).toEqual({ ok: true, approved: false });
    });
    (0, vitest_1.it)('returns ok:true and approved:true when approval count reaches the threshold', async () => {
        mockSnap({
            societyId: 'soc1', status: 'requested',
            approvedBy: ['mc2'], // mc2 already approved; mc1 (caller) is about to be the 2nd
            approvalCount: 1,
            requiredApprovers: 2,
            estCostPaise: 50000,
            title: 'Fix roof',
        });
        const result = await recordApproval(makeRequest({ requestId: 'req1' }));
        (0, vitest_1.expect)(result).toEqual({ ok: true, approved: true });
    });
    (0, vitest_1.it)('writes an approval subdoc inside the transaction', async () => {
        await recordApproval(makeRequest({ requestId: 'req1' }));
        (0, vitest_1.expect)(mockTxn.set).toHaveBeenCalledWith(mockApprovalRef, vitest_1.expect.objectContaining({ mcUid: 'mc1', societyId: 'soc1', requestId: 'req1' }));
    });
    (0, vitest_1.it)('increments approvalCount on the request doc', async () => {
        await recordApproval(makeRequest({ requestId: 'req1' }));
        (0, vitest_1.expect)(mockTxn.update).toHaveBeenCalledWith(mockRequestRef, vitest_1.expect.objectContaining({ approvalCount: 1 }));
    });
    (0, vitest_1.it)('throws not-found when the request document does not exist', async () => {
        mockTxn.get.mockResolvedValue({ exists: false });
        await (0, vitest_1.expect)(recordApproval(makeRequest({ requestId: 'req1' }))).rejects.toThrow('not found');
    });
});
