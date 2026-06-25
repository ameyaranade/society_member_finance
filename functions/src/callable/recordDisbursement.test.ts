import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordDisbursement as _recordDisbursement } from './recordDisbursement';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const recordDisbursement = _recordDisbursement as unknown as (req: object) => Promise<any>;

// ── Hoisted mocks ──────────────────────────────────────────────────────────────
const { mockTxn, mockDb } = vi.hoisted(() => {
  const mockTxn = { get: vi.fn(), set: vi.fn(), update: vi.fn() };

  const mockAccountData = vi.fn();

  // doc() returns different objects based on path
  const mockRequestRef  = { collection: vi.fn(() => ({ doc: vi.fn(() => ({})) })) };
  const mockAccountRef  = { get: vi.fn(async () => ({ exists: true, data: mockAccountData })) };
  const mockTxnDocRef   = {};

  const mockTxnCollection = { doc: vi.fn(() => mockTxnDocRef) };

  const mockDb = {
    doc: vi.fn((path: string) => {
      if (path.includes('/accounts/')) return mockAccountRef;
      return mockRequestRef;
    }),
    collection: vi.fn(() => mockTxnCollection),
    runTransaction: vi.fn(async (cb: (txn: typeof mockTxn) => Promise<unknown>) => cb(mockTxn)),
  };

  return { mockTxn, mockDb };
});

vi.mock('../lib/admin', () => ({ db: mockDb }));
vi.mock('../lib/audit',  () => ({ writeAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../lib/notify', () => ({ dispatchNotification: vi.fn().mockResolvedValue(undefined), dispatchNotificationSafe: vi.fn() }));
vi.mock('firebase-admin/app', () => ({ initializeApp: vi.fn() }));
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'SERVER_TS' },
  Timestamp:  { fromDate: (d: Date) => ({ _d: d }) },
}));
vi.mock('firebase-functions/v2/https', () => ({
  onCall: (optsOrHandler: unknown, maybeHandler?: unknown) => maybeHandler ?? optsOrHandler,
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) { super(message); }
  },
}));

const fmAuth = { uid: 'fm1', token: { role: 'fm', societyId: 'soc1' } };

const VALID_INPUT = {
  requestId:    'req1',
  amountPaise:  10000,
  accountId:    'acc1',
  kind:         'partial' as const,
  paymentMode:  'upi' as const,
  paidAt:       '2026-06-01',
};

function makeRequest(data: object, auth: object = fmAuth) {
  return { auth, data };
}

function mockReqSnap(data: Record<string, unknown>) {
  mockTxn.get.mockResolvedValue({ exists: true, data: () => data });
}

beforeEach(() => {
  vi.clearAllMocks();
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

describe('recordDisbursement — auth guards', () => {
  it('throws unauthenticated when no auth', async () => {
    await expect(
      recordDisbursement({ auth: null, data: VALID_INPUT }),
    ).rejects.toThrow('Not signed in');
  });

  it('throws failed-precondition when societyId missing', async () => {
    await expect(
      recordDisbursement(makeRequest(VALID_INPUT, { uid: 'u1', token: {} })),
    ).rejects.toThrow('No active society');
  });

  it('throws permission-denied for MC role', async () => {
    await expect(
      recordDisbursement(makeRequest(VALID_INPUT, { uid: 'mc1', token: { role: 'mc', societyId: 'soc1' } })),
    ).rejects.toThrow('Only FM can record disbursements');
  });
});

// ── Cross-society guard (pins FN-2 extraction contract) ───────────────────────

describe('recordDisbursement — cross-society guard', () => {
  it('throws permission-denied when doc.societyId differs', async () => {
    mockReqSnap({
      societyId: 'other_soc', status: 'approved',
      approvedAmountPaise: 50000, disbursedAmountPaise: 0,
    });
    await expect(
      recordDisbursement(makeRequest(VALID_INPUT)),
    ).rejects.toThrow('Cross-society access denied');
  });
});

// ── Input validation ───────────────────────────────────────────────────────────

describe('recordDisbursement — input validation', () => {
  it('rejects missing requestId', async () => {
    await expect(
      recordDisbursement(makeRequest({ ...VALID_INPUT, requestId: '' })),
    ).rejects.toThrow('requestId is required');
  });

  it('rejects non-integer amountPaise', async () => {
    await expect(
      recordDisbursement(makeRequest({ ...VALID_INPUT, amountPaise: 100.5 })),
    ).rejects.toThrow('amountPaise must be a positive integer');
  });

  it('rejects zero amountPaise', async () => {
    await expect(
      recordDisbursement(makeRequest({ ...VALID_INPUT, amountPaise: 0 })),
    ).rejects.toThrow('amountPaise must be a positive integer');
  });

  it('rejects invalid paymentMode', async () => {
    await expect(
      recordDisbursement(makeRequest({ ...VALID_INPUT, paymentMode: 'crypto' })),
    ).rejects.toThrow('paymentMode must be');
  });

  it('rejects malformed paidAt date', async () => {
    await expect(
      recordDisbursement(makeRequest({ ...VALID_INPUT, paidAt: '01-06-2026' })),
    ).rejects.toThrow('paidAt must be');
  });
});

// ── Status gate (spend gate D9e) ───────────────────────────────────────────────

describe('recordDisbursement — status gate', () => {
  it('throws failed-precondition when request is in requested (not yet approved)', async () => {
    mockReqSnap({
      societyId: 'soc1', status: 'requested',
      approvedAmountPaise: 0, disbursedAmountPaise: 0,
    });
    await expect(
      recordDisbursement(makeRequest(VALID_INPUT)),
    ).rejects.toThrow('Cannot disburse');
  });

  it('allows disbursement when status is already disbursed (partial → next partial)', async () => {
    mockReqSnap({
      societyId: 'soc1', status: 'disbursed',
      approvedAmountPaise: 50000, disbursedAmountPaise: 10000,
      fundHead: 'general', title: 'Fix gate',
    });
    const result = await recordDisbursement(makeRequest(VALID_INPUT));
    expect(result).toMatchObject({ ok: true });
  });
});

// ── Spend cap (D9a) ────────────────────────────────────────────────────────────

describe('recordDisbursement — spend cap', () => {
  it('rejects when new total would exceed approvedAmountPaise', async () => {
    mockReqSnap({
      societyId: 'soc1', status: 'approved',
      approvedAmountPaise: 15000,
      disbursedAmountPaise: 10000,
      fundHead: 'general', title: 'Fix gate',
    });
    // 10000 already disbursed + 10000 requested = 20000 > 15000 cap
    await expect(
      recordDisbursement(makeRequest({ ...VALID_INPUT, amountPaise: 10000 })),
    ).rejects.toThrow('exceed approved amount');
  });

  it('allows disbursement that exactly meets the cap', async () => {
    mockReqSnap({
      societyId: 'soc1', status: 'approved',
      approvedAmountPaise: 10000, disbursedAmountPaise: 0,
      fundHead: 'general', title: 'Fix gate',
    });
    const result = await recordDisbursement(makeRequest({ ...VALID_INPUT, amountPaise: 10000 }));
    expect(result).toMatchObject({ ok: true });
  });
});
