"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const closeExpenseRequest_1 = require("./closeExpenseRequest");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const closeExpenseRequest = closeExpenseRequest_1.closeExpenseRequest;
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
function makeRequest(data, auth = fmAuth) {
    return { auth, data };
}
(0, vitest_1.beforeEach)(() => {
    vitest_1.vi.clearAllMocks();
    mockRequestData.mockReturnValue({ societyId: 'soc1', status: 'disbursed', title: 'Fix roof' });
});
// ── Auth guards (pins FN-1 extraction contract) ────────────────────────────────
(0, vitest_1.describe)('closeExpenseRequest — auth guards', () => {
    (0, vitest_1.it)('throws unauthenticated when no auth', async () => {
        await (0, vitest_1.expect)(closeExpenseRequest({ auth: null, data: { requestId: 'req1' } })).rejects.toThrow('Not signed in');
    });
    (0, vitest_1.it)('throws failed-precondition when societyId is missing from token', async () => {
        await (0, vitest_1.expect)(closeExpenseRequest(makeRequest({ requestId: 'req1' }, { uid: 'u1', token: {} }))).rejects.toThrow('No active society');
    });
    (0, vitest_1.it)('throws permission-denied for non-FM roles', async () => {
        const mcAuth = { uid: 'mc1', token: { role: 'mc', societyId: 'soc1' } };
        await (0, vitest_1.expect)(closeExpenseRequest(makeRequest({ requestId: 'req1' }, mcAuth))).rejects.toThrow('Only FM can close expense requests');
    });
});
// ── Input validation ───────────────────────────────────────────────────────────
(0, vitest_1.describe)('closeExpenseRequest — input validation', () => {
    (0, vitest_1.it)('throws invalid-argument when requestId is missing', async () => {
        await (0, vitest_1.expect)(closeExpenseRequest(makeRequest({ requestId: '' }))).rejects.toThrow('requestId is required');
    });
});
// ── Cross-society guard (pins FN-2 extraction contract) ───────────────────────
(0, vitest_1.describe)('closeExpenseRequest — cross-society guard', () => {
    (0, vitest_1.it)('throws permission-denied when doc.societyId does not match caller', async () => {
        mockRequestData.mockReturnValue({ societyId: 'other_soc', status: 'disbursed' });
        await (0, vitest_1.expect)(closeExpenseRequest(makeRequest({ requestId: 'req1' }))).rejects.toThrow('Cross-society access denied');
    });
});
// ── Status gate ────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('closeExpenseRequest — status gate', () => {
    (0, vitest_1.it)('throws failed-precondition when status is not disbursed', async () => {
        mockRequestData.mockReturnValue({ societyId: 'soc1', status: 'approved' });
        await (0, vitest_1.expect)(closeExpenseRequest(makeRequest({ requestId: 'req1' }))).rejects.toThrow('Cannot close');
    });
    (0, vitest_1.it)('returns ok:true when request is disbursed', async () => {
        const result = await closeExpenseRequest(makeRequest({ requestId: 'req1' }));
        (0, vitest_1.expect)(result).toEqual({ ok: true });
    });
    (0, vitest_1.it)('sets status to completed', async () => {
        await closeExpenseRequest(makeRequest({ requestId: 'req1' }));
        (0, vitest_1.expect)(mockRequestRef.update).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ status: 'completed' }));
    });
});
