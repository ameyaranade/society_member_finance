"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const recordDisbursement_1 = require("./recordDisbursement");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const recordDisbursement = recordDisbursement_1.recordDisbursement;
// ── Hoisted mocks ──────────────────────────────────────────────────────────────
const { mockTxn, mockDb } = vitest_1.vi.hoisted(() => {
    const mockTxn = { get: vitest_1.vi.fn(), set: vitest_1.vi.fn(), update: vitest_1.vi.fn() };
    const mockAccountData = vitest_1.vi.fn();
    // doc() returns different objects based on path
    const mockRequestRef = { collection: vitest_1.vi.fn(() => ({ doc: vitest_1.vi.fn(() => ({})) })) };
    const mockAccountRef = { get: vitest_1.vi.fn(async () => ({ exists: true, data: mockAccountData })) };
    const mockTxnDocRef = {};
    const mockTxnCollection = { doc: vitest_1.vi.fn(() => mockTxnDocRef) };
    const mockDb = {
        doc: vitest_1.vi.fn((path) => {
            if (path.includes('/accounts/'))
                return mockAccountRef;
            return mockRequestRef;
        }),
        collection: vitest_1.vi.fn(() => mockTxnCollection),
        runTransaction: vitest_1.vi.fn(async (cb) => cb(mockTxn)),
    };
    return { mockTxn, mockDb };
});
vitest_1.vi.mock('../lib/admin', () => ({ db: mockDb }));
vitest_1.vi.mock('../lib/audit', () => ({ writeAudit: vitest_1.vi.fn().mockResolvedValue(undefined) }));
vitest_1.vi.mock('../lib/notify', () => ({ dispatchNotification: vitest_1.vi.fn().mockResolvedValue(undefined), dispatchNotificationSafe: vitest_1.vi.fn() }));
vitest_1.vi.mock('firebase-admin/app', () => ({ initializeApp: vitest_1.vi.fn() }));
vitest_1.vi.mock('firebase-admin/firestore', () => ({
    FieldValue: { serverTimestamp: () => 'SERVER_TS' },
    Timestamp: { fromDate: (d) => ({ _d: d }) },
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
const VALID_INPUT = {
    requestId: 'req1',
    amountPaise: 10000,
    accountId: 'acc1',
    kind: 'partial',
    paymentMode: 'upi',
    paidAt: '2026-06-01',
};
function makeRequest(data, auth = fmAuth) {
    return { auth, data };
}
function mockReqSnap(data) {
    mockTxn.get.mockResolvedValue({ exists: true, data: () => data });
}
(0, vitest_1.beforeEach)(() => {
    vitest_1.vi.clearAllMocks();
    mockReqSnap({
        societyId: 'soc1',
        status: 'approved',
        approvedAmountPaise: 50000,
        disbursedAmountPaise: 0,
        fundHead: 'general',
        title: 'Fix gate',
    });
});
// ── Auth guards (pins FN-1 extraction contract) ────────────────────────────────
(0, vitest_1.describe)('recordDisbursement — auth guards', () => {
    (0, vitest_1.it)('throws unauthenticated when no auth', async () => {
        await (0, vitest_1.expect)(recordDisbursement({ auth: null, data: VALID_INPUT })).rejects.toThrow('Not signed in');
    });
    (0, vitest_1.it)('throws failed-precondition when societyId missing', async () => {
        await (0, vitest_1.expect)(recordDisbursement(makeRequest(VALID_INPUT, { uid: 'u1', token: {} }))).rejects.toThrow('No active society');
    });
    (0, vitest_1.it)('throws permission-denied for MC role', async () => {
        await (0, vitest_1.expect)(recordDisbursement(makeRequest(VALID_INPUT, { uid: 'mc1', token: { role: 'mc', societyId: 'soc1' } }))).rejects.toThrow('Only FM can record disbursements');
    });
});
// ── Cross-society guard (pins FN-2 extraction contract) ───────────────────────
(0, vitest_1.describe)('recordDisbursement — cross-society guard', () => {
    (0, vitest_1.it)('throws permission-denied when doc.societyId differs', async () => {
        mockReqSnap({
            societyId: 'other_soc', status: 'approved',
            approvedAmountPaise: 50000, disbursedAmountPaise: 0,
        });
        await (0, vitest_1.expect)(recordDisbursement(makeRequest(VALID_INPUT))).rejects.toThrow('Cross-society access denied');
    });
});
// ── Input validation ───────────────────────────────────────────────────────────
(0, vitest_1.describe)('recordDisbursement — input validation', () => {
    (0, vitest_1.it)('rejects missing requestId', async () => {
        await (0, vitest_1.expect)(recordDisbursement(makeRequest({ ...VALID_INPUT, requestId: '' }))).rejects.toThrow('requestId is required');
    });
    (0, vitest_1.it)('rejects non-integer amountPaise', async () => {
        await (0, vitest_1.expect)(recordDisbursement(makeRequest({ ...VALID_INPUT, amountPaise: 100.5 }))).rejects.toThrow('amountPaise must be a positive integer');
    });
    (0, vitest_1.it)('rejects zero amountPaise', async () => {
        await (0, vitest_1.expect)(recordDisbursement(makeRequest({ ...VALID_INPUT, amountPaise: 0 }))).rejects.toThrow('amountPaise must be a positive integer');
    });
    (0, vitest_1.it)('rejects invalid paymentMode', async () => {
        await (0, vitest_1.expect)(recordDisbursement(makeRequest({ ...VALID_INPUT, paymentMode: 'crypto' }))).rejects.toThrow('paymentMode must be');
    });
    (0, vitest_1.it)('rejects malformed paidAt date', async () => {
        await (0, vitest_1.expect)(recordDisbursement(makeRequest({ ...VALID_INPUT, paidAt: '01-06-2026' }))).rejects.toThrow('paidAt must be');
    });
});
// ── Status gate (spend gate D9e) ───────────────────────────────────────────────
(0, vitest_1.describe)('recordDisbursement — status gate', () => {
    (0, vitest_1.it)('throws failed-precondition when request is in requested (not yet approved)', async () => {
        mockReqSnap({
            societyId: 'soc1', status: 'requested',
            approvedAmountPaise: 0, disbursedAmountPaise: 0,
        });
        await (0, vitest_1.expect)(recordDisbursement(makeRequest(VALID_INPUT))).rejects.toThrow('Cannot disburse');
    });
    (0, vitest_1.it)('allows disbursement when status is already disbursed (partial → next partial)', async () => {
        mockReqSnap({
            societyId: 'soc1', status: 'disbursed',
            approvedAmountPaise: 50000, disbursedAmountPaise: 10000,
            fundHead: 'general', title: 'Fix gate',
        });
        const result = await recordDisbursement(makeRequest(VALID_INPUT));
        (0, vitest_1.expect)(result).toMatchObject({ ok: true });
    });
});
// ── Spend cap (D9a) ────────────────────────────────────────────────────────────
(0, vitest_1.describe)('recordDisbursement — spend cap', () => {
    (0, vitest_1.it)('rejects when new total would exceed approvedAmountPaise', async () => {
        mockReqSnap({
            societyId: 'soc1', status: 'approved',
            approvedAmountPaise: 15000,
            disbursedAmountPaise: 10000,
            fundHead: 'general', title: 'Fix gate',
        });
        // 10000 already disbursed + 10000 requested = 20000 > 15000 cap
        await (0, vitest_1.expect)(recordDisbursement(makeRequest({ ...VALID_INPUT, amountPaise: 10000 }))).rejects.toThrow('exceed approved amount');
    });
    (0, vitest_1.it)('allows disbursement that exactly meets the cap', async () => {
        mockReqSnap({
            societyId: 'soc1', status: 'approved',
            approvedAmountPaise: 10000, disbursedAmountPaise: 0,
            fundHead: 'general', title: 'Fix gate',
        });
        const result = await recordDisbursement(makeRequest({ ...VALID_INPUT, amountPaise: 10000 }));
        (0, vitest_1.expect)(result).toMatchObject({ ok: true });
    });
});
