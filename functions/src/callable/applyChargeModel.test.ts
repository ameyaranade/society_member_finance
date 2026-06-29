import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyChargeModel as _applyChargeModel } from './applyChargeModel';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const applyChargeModel = _applyChargeModel as unknown as (req: object) => Promise<any>;

const { mockSocietyData, mockUnitsSnap, mockBatchUpdate, mockBatchCommit, mockDb } = vi.hoisted(() => {
  const mockSocietyData  = vi.fn();
  const mockUnitsSnap    = { empty: false, docs: [] as { data: () => Record<string, unknown>; ref: object }[], skipped: 0 };
  const mockBatchUpdate  = vi.fn();
  const mockBatchCommit  = vi.fn().mockResolvedValue(undefined);

  const mockDb = {
    doc: vi.fn(() => ({ get: vi.fn(() => Promise.resolve({ data: mockSocietyData })) })),
    collection: vi.fn(() => ({
      get: vi.fn(() => Promise.resolve(mockUnitsSnap)),
    })),
    batch: vi.fn(() => ({ update: mockBatchUpdate, commit: mockBatchCommit })),
  };

  return { mockSocietyData, mockUnitsSnap, mockBatchUpdate, mockBatchCommit, mockDb };
});

vi.mock('../lib/admin', () => ({ db: mockDb }));
vi.mock('../lib/context', () => ({
  requireCaller: vi.fn((req: { auth?: { uid: string; token: Record<string, unknown> } }) => ({
    uid:      req.auth?.uid ?? '',
    societyId: req.auth?.token?.societyId ?? '',
    role:     req.auth?.token?.role ?? '',
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
const mcAuth    = { uid: 'mc1',    token: { role: 'mc',    societyId: 'soc1' } };

function makeRequest(auth = adminAuth) {
  return { auth, data: {} };
}

describe('applyChargeModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUnitsSnap.docs  = [];
    mockUnitsSnap.empty = false;
    mockSocietyData.mockReturnValue({
      config: { chargeModel: { type: 'flat', flatAmountPaise: 100000 } },
    });
  });

  it('denies FM role', async () => {
    await expect(
      applyChargeModel({ auth: { uid: 'fm1', token: { role: 'fm', societyId: 'soc1' } }, data: {} }),
    ).rejects.toThrow('Only Admin or MC');
  });

  it('allows MC role', async () => {
    const result = await applyChargeModel(makeRequest(mcAuth));
    expect(result.updated).toBe(0);
  });

  it('throws when no charge model is configured', async () => {
    mockSocietyData.mockReturnValue({ config: {} });
    await expect(applyChargeModel(makeRequest())).rejects.toThrow('No charge model configured');
  });

  it('returns 0 updated when society has no units', async () => {
    mockUnitsSnap.empty = true;
    const result = await applyChargeModel(makeRequest());
    expect(result).toEqual({ updated: 0 });
    mockUnitsSnap.empty = false;
  });

  it('updates each unit with flat amount paise (integer, not float)', async () => {
    mockUnitsSnap.docs = [
      { data: () => ({ areaSqft: 1000 }), ref: { id: 'u1' } },
      { data: () => ({ areaSqft: 1500 }), ref: { id: 'u2' } },
    ];
    const result = await applyChargeModel(makeRequest());
    expect(result.updated).toBe(2);
    expect(result.skipped).toBe(0);
    const calls = mockBatchUpdate.mock.calls as [unknown, Record<string, unknown>][];
    calls.forEach(([, update]) => {
      expect(Number.isInteger(update.maintenanceAmountPaise)).toBe(true);
    });
    expect(mockBatchCommit).toHaveBeenCalledOnce();
  });

  it('skips units where charge model cannot compute an amount', async () => {
    // per_sqft with no areaSqft → null → skip
    mockSocietyData.mockReturnValue({
      config: { chargeModel: { type: 'per_sqft', ratePerSqftPaise: 500 } },
    });
    mockUnitsSnap.docs = [
      { data: () => ({}), ref: { id: 'u-no-area' } },
    ];
    const result = await applyChargeModel(makeRequest());
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mockBatchUpdate).not.toHaveBeenCalled();
  });

  it('computes per_sqft amount as integer paise (rounds correctly)', async () => {
    mockSocietyData.mockReturnValue({
      config: { chargeModel: { type: 'per_sqft', ratePerSqftPaise: 333 } },
    });
    mockUnitsSnap.docs = [
      { data: () => ({ areaSqft: 1000 }), ref: { id: 'u1' } },
    ];
    await applyChargeModel(makeRequest());
    const [, update] = (mockBatchUpdate.mock.calls[0] as [unknown, Record<string, unknown>]);
    expect(update.maintenanceAmountPaise).toBe(333000); // 333 * 1000, integer
    expect(Number.isInteger(update.maintenanceAmountPaise)).toBe(true);
  });
});
