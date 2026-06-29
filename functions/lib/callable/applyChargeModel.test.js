"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const applyChargeModel_1 = require("./applyChargeModel");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const applyChargeModel = applyChargeModel_1.applyChargeModel;
const { mockSocietyData, mockUnitsSnap, mockBatchUpdate, mockBatchCommit, mockDb } = vitest_1.vi.hoisted(() => {
    const mockSocietyData = vitest_1.vi.fn();
    const mockUnitsSnap = { empty: false, docs: [], skipped: 0 };
    const mockBatchUpdate = vitest_1.vi.fn();
    const mockBatchCommit = vitest_1.vi.fn().mockResolvedValue(undefined);
    const mockDb = {
        doc: vitest_1.vi.fn(() => ({ get: vitest_1.vi.fn(() => Promise.resolve({ data: mockSocietyData })) })),
        collection: vitest_1.vi.fn(() => ({
            get: vitest_1.vi.fn(() => Promise.resolve(mockUnitsSnap)),
        })),
        batch: vitest_1.vi.fn(() => ({ update: mockBatchUpdate, commit: mockBatchCommit })),
    };
    return { mockSocietyData, mockUnitsSnap, mockBatchUpdate, mockBatchCommit, mockDb };
});
vitest_1.vi.mock('../lib/admin', () => ({ db: mockDb }));
vitest_1.vi.mock('../lib/context', () => ({
    requireCaller: vitest_1.vi.fn((req) => ({
        uid: req.auth?.uid ?? '',
        societyId: req.auth?.token?.societyId ?? '',
        role: req.auth?.token?.role ?? '',
    })),
}));
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
const adminAuth = { uid: 'admin1', token: { role: 'admin', societyId: 'soc1' } };
const mcAuth = { uid: 'mc1', token: { role: 'mc', societyId: 'soc1' } };
function makeRequest(auth = adminAuth) {
    return { auth, data: {} };
}
(0, vitest_1.describe)('applyChargeModel', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        mockUnitsSnap.docs = [];
        mockUnitsSnap.empty = false;
        mockSocietyData.mockReturnValue({
            config: { chargeModel: { type: 'flat', flatAmountPaise: 100000 } },
        });
    });
    (0, vitest_1.it)('denies FM role', async () => {
        await (0, vitest_1.expect)(applyChargeModel({ auth: { uid: 'fm1', token: { role: 'fm', societyId: 'soc1' } }, data: {} })).rejects.toThrow('Only Admin or MC');
    });
    (0, vitest_1.it)('allows MC role', async () => {
        const result = await applyChargeModel(makeRequest(mcAuth));
        (0, vitest_1.expect)(result.updated).toBe(0);
    });
    (0, vitest_1.it)('throws when no charge model is configured', async () => {
        mockSocietyData.mockReturnValue({ config: {} });
        await (0, vitest_1.expect)(applyChargeModel(makeRequest())).rejects.toThrow('No charge model configured');
    });
    (0, vitest_1.it)('returns 0 updated when society has no units', async () => {
        mockUnitsSnap.empty = true;
        const result = await applyChargeModel(makeRequest());
        (0, vitest_1.expect)(result).toEqual({ updated: 0 });
        mockUnitsSnap.empty = false;
    });
    (0, vitest_1.it)('updates each unit with flat amount paise (integer, not float)', async () => {
        mockUnitsSnap.docs = [
            { data: () => ({ areaSqft: 1000 }), ref: { id: 'u1' } },
            { data: () => ({ areaSqft: 1500 }), ref: { id: 'u2' } },
        ];
        const result = await applyChargeModel(makeRequest());
        (0, vitest_1.expect)(result.updated).toBe(2);
        (0, vitest_1.expect)(result.skipped).toBe(0);
        const calls = mockBatchUpdate.mock.calls;
        calls.forEach(([, update]) => {
            (0, vitest_1.expect)(Number.isInteger(update.maintenanceAmountPaise)).toBe(true);
        });
        (0, vitest_1.expect)(mockBatchCommit).toHaveBeenCalledOnce();
    });
    (0, vitest_1.it)('skips units where charge model cannot compute an amount', async () => {
        // per_sqft with no areaSqft → null → skip
        mockSocietyData.mockReturnValue({
            config: { chargeModel: { type: 'per_sqft', ratePerSqftPaise: 500 } },
        });
        mockUnitsSnap.docs = [
            { data: () => ({}), ref: { id: 'u-no-area' } },
        ];
        const result = await applyChargeModel(makeRequest());
        (0, vitest_1.expect)(result.updated).toBe(0);
        (0, vitest_1.expect)(result.skipped).toBe(1);
        (0, vitest_1.expect)(mockBatchUpdate).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('computes per_sqft amount as integer paise (rounds correctly)', async () => {
        mockSocietyData.mockReturnValue({
            config: { chargeModel: { type: 'per_sqft', ratePerSqftPaise: 333 } },
        });
        mockUnitsSnap.docs = [
            { data: () => ({ areaSqft: 1000 }), ref: { id: 'u1' } },
        ];
        await applyChargeModel(makeRequest());
        const [, update] = mockBatchUpdate.mock.calls[0];
        (0, vitest_1.expect)(update.maintenanceAmountPaise).toBe(333000); // 333 * 1000, integer
        (0, vitest_1.expect)(Number.isInteger(update.maintenanceAmountPaise)).toBe(true);
    });
});
