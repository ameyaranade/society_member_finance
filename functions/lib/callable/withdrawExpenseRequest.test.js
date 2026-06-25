"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const withdrawExpenseRequest_1 = require("./withdrawExpenseRequest");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withdrawExpenseRequest = withdrawExpenseRequest_1.withdrawExpenseRequest;
// ── Hoisted mocks ──────────────────────────────────────────────────────────────
const { mockRequestData, mockRequestRef, mockDb } = vitest_1.vi.hoisted(() => {
    const mockRequestData = vitest_1.vi.fn();
    const mockRequestRef = {
        get: vitest_1.vi.fn(async () => ({ exists: true, data: mockRequestData })),
        update: vitest_1.vi.fn().mockResolvedValue(undefined),
    };
    const mockDb = { doc: vitest_1.vi.fn(() => mockRequestRef) };
    return { mockRequestData, mockRequestRef, mockDb };
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
const fmAuth = { uid: 'fm1', token: { role: 'fm', societyId: 'soc1' } };
const adminAuth = { uid: 'admin1', token: { role: 'admin', societyId: 'soc1' } };
function makeRequest(data, auth = fmAuth) {
    return { auth, data };
}
(0, vitest_1.beforeEach)(() => {
    vitest_1.vi.clearAllMocks();
    // Default: a maintenance request in 'requested' state
    mockRequestData.mockReturnValue({
        societyId: 'soc1',
        type: 'maintenance',
        status: 'requested',
        title: 'Fix elevator',
    });
});
// ── Auth guards (pins FN-1 extraction contract) ────────────────────────────────
(0, vitest_1.describe)('withdrawExpenseRequest — auth guards', () => {
    (0, vitest_1.it)('throws unauthenticated when no auth', async () => {
        await (0, vitest_1.expect)(withdrawExpenseRequest({ auth: null, data: { requestId: 'req1' } })).rejects.toThrow('Not signed in');
    });
    (0, vitest_1.it)('throws failed-precondition when societyId missing', async () => {
        await (0, vitest_1.expect)(withdrawExpenseRequest(makeRequest({ requestId: 'req1' }, { uid: 'u1', token: {} }))).rejects.toThrow('No active society');
    });
    (0, vitest_1.it)('throws permission-denied for a role that cannot withdraw at all (MC)', async () => {
        const mcAuth = { uid: 'mc1', token: { role: 'mc', societyId: 'soc1' } };
        await (0, vitest_1.expect)(withdrawExpenseRequest(makeRequest({ requestId: 'req1' }, mcAuth))).rejects.toThrow('Only FM or Admin can withdraw');
    });
});
// ── Cross-society guard (pins FN-2 extraction contract) ───────────────────────
(0, vitest_1.describe)('withdrawExpenseRequest — cross-society guard', () => {
    (0, vitest_1.it)('throws permission-denied when doc.societyId differs', async () => {
        mockRequestData.mockReturnValue({
            societyId: 'other_soc', type: 'maintenance', status: 'requested',
        });
        await (0, vitest_1.expect)(withdrawExpenseRequest(makeRequest({ requestId: 'req1' }))).rejects.toThrow('Cross-society access denied');
    });
});
// ── Status gates ───────────────────────────────────────────────────────────────
(0, vitest_1.describe)('withdrawExpenseRequest — status gates', () => {
    (0, vitest_1.it)('throws failed-precondition when already withdrawn', async () => {
        mockRequestData.mockReturnValue({ societyId: 'soc1', type: 'maintenance', status: 'withdrawn' });
        await (0, vitest_1.expect)(withdrawExpenseRequest(makeRequest({ requestId: 'req1' }))).rejects.toThrow('already withdrawn');
    });
    (0, vitest_1.it)('throws failed-precondition when completed', async () => {
        mockRequestData.mockReturnValue({ societyId: 'soc1', type: 'maintenance', status: 'completed' });
        await (0, vitest_1.expect)(withdrawExpenseRequest(makeRequest({ requestId: 'req1' }))).rejects.toThrow('Cannot withdraw a completed request');
    });
    (0, vitest_1.it)('throws failed-precondition when disbursed', async () => {
        mockRequestData.mockReturnValue({ societyId: 'soc1', type: 'maintenance', status: 'disbursed' });
        await (0, vitest_1.expect)(withdrawExpenseRequest(makeRequest({ requestId: 'req1' }))).rejects.toThrow('Cannot withdraw after disbursement');
    });
});
// ── Separation of duties (D9b) ─────────────────────────────────────────────────
// This is the most critical pin for this callable. FN-1 must preserve these
// role-specific guards exactly — they enforce the separation-of-duties rule.
(0, vitest_1.describe)('withdrawExpenseRequest — separation of duties', () => {
    (0, vitest_1.it)('snag: FM cannot withdraw (only Admin)', async () => {
        mockRequestData.mockReturnValue({
            societyId: 'soc1', type: 'snag', status: 'requested',
        });
        await (0, vitest_1.expect)(withdrawExpenseRequest(makeRequest({ requestId: 'req1' }, fmAuth))).rejects.toThrow('Only Admin can withdraw a snag request');
    });
    (0, vitest_1.it)('snag: Admin can withdraw', async () => {
        mockRequestData.mockReturnValue({
            societyId: 'soc1', type: 'snag', status: 'requested',
        });
        const result = await withdrawExpenseRequest(makeRequest({ requestId: 'req1' }, adminAuth));
        (0, vitest_1.expect)(result).toEqual({ ok: true });
    });
    (0, vitest_1.it)('maintenance: Admin cannot withdraw (only FM)', async () => {
        await (0, vitest_1.expect)(withdrawExpenseRequest(makeRequest({ requestId: 'req1' }, adminAuth))).rejects.toThrow('Only FM can withdraw a maintenance request');
    });
    (0, vitest_1.it)('maintenance: FM can withdraw', async () => {
        const result = await withdrawExpenseRequest(makeRequest({ requestId: 'req1' }, fmAuth));
        (0, vitest_1.expect)(result).toEqual({ ok: true });
    });
});
// ── Write ─────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('withdrawExpenseRequest — write', () => {
    (0, vitest_1.it)('sets status to withdrawn', async () => {
        await withdrawExpenseRequest(makeRequest({ requestId: 'req1' }, fmAuth));
        (0, vitest_1.expect)(mockRequestRef.update).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ status: 'withdrawn' }));
    });
});
