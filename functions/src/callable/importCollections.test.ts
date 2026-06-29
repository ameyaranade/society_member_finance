import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importCollections as _importCollections } from './importCollections';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const importCollections = _importCollections as unknown as (req: object) => Promise<any>;

const { mockUnitsSnap, mockBatchSet, mockPeriodSet, mockDb } = vi.hoisted(() => {
  const mockUnitsSnap  = { docs: [] as { id: string; data: () => Record<string, unknown> }[] };
  const mockBatchSet   = vi.fn();
  const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
  const mockPeriodSet  = vi.fn().mockResolvedValue(undefined);

  const mockDb = {
    collection: vi.fn((path: string) => {
      if (path.includes('/units')) {
        return { get: vi.fn(() => Promise.resolve(mockUnitsSnap)) };
      }
      return { get: vi.fn(() => Promise.resolve({ docs: [] })) };
    }),
    doc: vi.fn((path: string) => {
      if (path.includes('/collections/')) {
        return { set: mockPeriodSet };
      }
      // collection entry docs
      return {};
    }),
    batch: vi.fn(() => ({
      set:    mockBatchSet,
      commit: mockBatchCommit,
    })),
  };

  return { mockUnitsSnap, mockBatchSet, mockPeriodSet, mockDb };
});

vi.mock('../lib/admin', () => ({ db: mockDb }));
vi.mock('../lib/context', () => ({
  requireCaller: vi.fn((req: { auth?: { uid: string; token: Record<string, unknown> } }) => ({
    uid:       req.auth?.uid ?? '',
    societyId: req.auth?.token?.societyId ?? '',
    role:      req.auth?.token?.role ?? '',
  })),
}));
vi.mock('firebase-admin/app', () => ({ initializeApp: vi.fn() }));
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'SERVER_TS' },
}));
vi.mock('firebase-functions/v2/https', () => ({
  onCall: (optsOrHandler: unknown, maybeHandler?: unknown) => maybeHandler ?? optsOrHandler,
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) { super(message); }
  },
}));

const adminAuth = { uid: 'admin1', token: { role: 'admin', societyId: 'soc1' } };
const fmAuth    = { uid: 'fm1',    token: { role: 'fm',    societyId: 'soc1' } };

const baseInput = {
  period:    '2026-06',
  dueDate:   '2026-06-30',
  accountId: 'acc1',
  fundHead:  'general',
};

function makeRequest(data: object, auth = adminAuth) {
  return { auth, data };
}

describe('importCollections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('denies MC role', async () => {
    await expect(
      importCollections(makeRequest(
        { ...baseInput, rows: [] },
        { uid: 'mc1', token: { role: 'mc', societyId: 'soc1' } },
      )),
    ).rejects.toThrow('Only Admin or FM');
  });

  it('denies cross-society access (caller from soc2 targeting soc1 data)', async () => {
    // requireCaller returns societyId from token; units collection uses that societyId.
    // A caller from soc2 won't find soc1's units → all rows become errors.
    mockUnitsSnap.docs = []; // soc2 has no units
    const result = await importCollections(makeRequest(
      {
        ...baseInput,
        rows: [{ flatNumber: '101', tower: 'A', status: 'pending', amountReceivedPaise: 0 }],
      },
      { uid: 'admin2', token: { role: 'admin', societyId: 'soc2' } },
    ));
    expect(result.imported).toBe(0);
    expect(result.errors[0].message).toMatch(/not found in units registry/);
  });

  it('allows FM role', async () => {
    const result = await importCollections(makeRequest(
      {
        ...baseInput,
        rows: [{ flatNumber: '101', tower: 'A', status: 'pending', amountReceivedPaise: 0 }],
      },
      fmAuth,
    ));
    expect(result.imported).toBe(1);
  });

  it('imports valid rows and upserts the period summary', async () => {
    const result = await importCollections(makeRequest({
      ...baseInput,
      rows: [
        { flatNumber: '101', tower: 'A', status: 'paid',    amountReceivedPaise: 160000 },
        { flatNumber: '102', tower: 'A', status: 'pending', amountReceivedPaise: 0 },
      ],
    }));
    expect(result.imported).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(mockBatchSet).toHaveBeenCalledTimes(2);
    expect(mockPeriodSet).toHaveBeenCalledWith(
      expect.objectContaining({ paidCount: 1, unitCount: 2 }),
      { merge: true },
    );
  });

  it('reports a row error for an unknown flat, without failing the import', async () => {
    const result = await importCollections(makeRequest({
      ...baseInput,
      rows: [
        { flatNumber: '999', tower: 'A', status: 'pending', amountReceivedPaise: 0 },
        { flatNumber: '101', tower: 'A', status: 'pending', amountReceivedPaise: 0 },
      ],
    }));
    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toMatch(/not found/);
  });

  it('rejects a missing flat number as a row error', async () => {
    const result = await importCollections(makeRequest({
      ...baseInput,
      rows: [{ flatNumber: '', tower: 'A', status: 'pending', amountReceivedPaise: 0 }],
    }));
    expect(result.imported).toBe(0);
    expect(result.errors[0].message).toMatch(/Missing flat number/);
  });

  it('rejects invalid period format', async () => {
    await expect(
      importCollections(makeRequest({ ...baseInput, period: '06-2026', rows: [] })),
    ).rejects.toThrow('period must be');
  });

  it('rejects invalid dueDate format', async () => {
    await expect(
      importCollections(makeRequest({ ...baseInput, dueDate: '30/06/2026', rows: [] })),
    ).rejects.toThrow('dueDate must be');
  });

  it('rejects empty rows array', async () => {
    await expect(
      importCollections(makeRequest({ ...baseInput, rows: [] })),
    ).rejects.toThrow('non-empty array');
  });
});
