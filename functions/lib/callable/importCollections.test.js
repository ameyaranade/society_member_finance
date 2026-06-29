"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const importCollections_1 = require("./importCollections");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const importCollections = importCollections_1.importCollections;
const { mockUnitsSnap, mockBatchSet, mockPeriodSet, mockDb } = vitest_1.vi.hoisted(() => {
    const mockUnitsSnap = { docs: [] };
    const mockBatchSet = vitest_1.vi.fn();
    const mockBatchCommit = vitest_1.vi.fn().mockResolvedValue(undefined);
    const mockPeriodSet = vitest_1.vi.fn().mockResolvedValue(undefined);
    const mockDb = {
        collection: vitest_1.vi.fn((path) => {
            if (path.includes('/units')) {
                return { get: vitest_1.vi.fn(() => Promise.resolve(mockUnitsSnap)) };
            }
            return { get: vitest_1.vi.fn(() => Promise.resolve({ docs: [] })) };
        }),
        doc: vitest_1.vi.fn((path) => {
            if (path.includes('/collections/')) {
                return { set: mockPeriodSet };
            }
            // collection entry docs
            return {};
        }),
        batch: vitest_1.vi.fn(() => ({
            set: mockBatchSet,
            commit: mockBatchCommit,
        })),
    };
    return { mockUnitsSnap, mockBatchSet, mockPeriodSet, mockDb };
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
const fmAuth = { uid: 'fm1', token: { role: 'fm', societyId: 'soc1' } };
const baseInput = {
    period: '2026-06',
    dueDate: '2026-06-30',
    accountId: 'acc1',
    fundHead: 'general',
};
function makeRequest(data, auth = adminAuth) {
    return { auth, data };
}
(0, vitest_1.describe)('importCollections', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        // Two units in registry
        mockUnitsSnap.docs = [
            {
                id: 'A_101',
                data: () => ({
                    tower: 'A', flatNumber: '101',
                    maintenanceAmountPaise: 150000, commonElectricityAmountPaise: 10000,
                    owner: { name: 'Owner One' },
                }),
            },
            {
                id: 'A_102',
                data: () => ({
                    tower: 'A', flatNumber: '102',
                    maintenanceAmountPaise: 150000, commonElectricityAmountPaise: 10000,
                    owner: { name: 'Owner Two' },
                }),
            },
        ];
    });
    (0, vitest_1.it)('denies MC role', async () => {
        await (0, vitest_1.expect)(importCollections(makeRequest({ ...baseInput, rows: [] }, { uid: 'mc1', token: { role: 'mc', societyId: 'soc1' } }))).rejects.toThrow('Only Admin or FM');
    });
    (0, vitest_1.it)('denies cross-society access (caller from soc2 targeting soc1 data)', async () => {
        // requireCaller returns societyId from token; units collection uses that societyId.
        // A caller from soc2 won't find soc1's units → all rows become errors.
        mockUnitsSnap.docs = []; // soc2 has no units
        const result = await importCollections(makeRequest({
            ...baseInput,
            rows: [{ flatNumber: '101', tower: 'A', status: 'pending', amountReceivedPaise: 0 }],
        }, { uid: 'admin2', token: { role: 'admin', societyId: 'soc2' } }));
        (0, vitest_1.expect)(result.imported).toBe(0);
        (0, vitest_1.expect)(result.errors[0].message).toMatch(/not found in units registry/);
    });
    (0, vitest_1.it)('allows FM role', async () => {
        const result = await importCollections(makeRequest({
            ...baseInput,
            rows: [{ flatNumber: '101', tower: 'A', status: 'pending', amountReceivedPaise: 0 }],
        }, fmAuth));
        (0, vitest_1.expect)(result.imported).toBe(1);
    });
    (0, vitest_1.it)('imports valid rows and upserts the period summary', async () => {
        const result = await importCollections(makeRequest({
            ...baseInput,
            rows: [
                { flatNumber: '101', tower: 'A', status: 'paid', amountReceivedPaise: 160000 },
                { flatNumber: '102', tower: 'A', status: 'pending', amountReceivedPaise: 0 },
            ],
        }));
        (0, vitest_1.expect)(result.imported).toBe(2);
        (0, vitest_1.expect)(result.errors).toHaveLength(0);
        (0, vitest_1.expect)(mockBatchSet).toHaveBeenCalledTimes(2);
        (0, vitest_1.expect)(mockPeriodSet).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ paidCount: 1, unitCount: 2 }), { merge: true });
    });
    (0, vitest_1.it)('reports a row error for an unknown flat, without failing the import', async () => {
        const result = await importCollections(makeRequest({
            ...baseInput,
            rows: [
                { flatNumber: '999', tower: 'A', status: 'pending', amountReceivedPaise: 0 },
                { flatNumber: '101', tower: 'A', status: 'pending', amountReceivedPaise: 0 },
            ],
        }));
        (0, vitest_1.expect)(result.imported).toBe(1);
        (0, vitest_1.expect)(result.errors).toHaveLength(1);
        (0, vitest_1.expect)(result.errors[0].message).toMatch(/not found/);
    });
    (0, vitest_1.it)('rejects a missing flat number as a row error', async () => {
        const result = await importCollections(makeRequest({
            ...baseInput,
            rows: [{ flatNumber: '', tower: 'A', status: 'pending', amountReceivedPaise: 0 }],
        }));
        (0, vitest_1.expect)(result.imported).toBe(0);
        (0, vitest_1.expect)(result.errors[0].message).toMatch(/Missing flat number/);
    });
    (0, vitest_1.it)('rejects invalid period format', async () => {
        await (0, vitest_1.expect)(importCollections(makeRequest({ ...baseInput, period: '06-2026', rows: [] }))).rejects.toThrow('period must be');
    });
    (0, vitest_1.it)('rejects invalid dueDate format', async () => {
        await (0, vitest_1.expect)(importCollections(makeRequest({ ...baseInput, dueDate: '30/06/2026', rows: [] }))).rejects.toThrow('dueDate must be');
    });
    (0, vitest_1.it)('rejects empty rows array', async () => {
        await (0, vitest_1.expect)(importCollections(makeRequest({ ...baseInput, rows: [] }))).rejects.toThrow('non-empty array');
    });
});
