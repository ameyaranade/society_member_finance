import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withdrawExpenseRequest as _withdrawExpenseRequest } from './withdrawExpenseRequest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withdrawExpenseRequest = _withdrawExpenseRequest as unknown as (req: object) => Promise<any>;

// ── Hoisted mocks ──────────────────────────────────────────────────────────────
const { mockRequestData, mockRequestRef, mockDb } = vi.hoisted(() => {
  const mockRequestData = vi.fn();
  const mockRequestRef = {
    get:    vi.fn(async () => ({ exists: true, data: mockRequestData })),
    update: vi.fn().mockResolvedValue(undefined),
  };
  const mockDb = { doc: vi.fn(() => mockRequestRef) };
  return { mockRequestData, mockRequestRef, mockDb };
});

vi.mock('../lib/admin', () => ({ db: mockDb }));
vi.mock('../lib/audit',  () => ({ writeAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../lib/notify', () => ({ dispatchNotification: vi.fn().mockResolvedValue(undefined), dispatchNotificationSafe: vi.fn() }));
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

const fmAuth    = { uid: 'fm1',    token: { role: 'fm',    societyId: 'soc1' } };
const adminAuth = { uid: 'admin1', token: { role: 'admin', societyId: 'soc1' } };

function makeRequest(data: object, auth: object = fmAuth) {
  return { auth, data };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: a maintenance request in 'requested' state
  mockRequestData.mockReturnValue({
    societyId: 'soc1',
    type: 'maintenance',
    status: 'requested',
    title: 'Fix elevator',
  });
});

// ── Auth guards (pins FN-1 extraction contract) ────────────────────────────────

describe('withdrawExpenseRequest — auth guards', () => {
  it('throws unauthenticated when no auth', async () => {
    await expect(
      withdrawExpenseRequest({ auth: null, data: { requestId: 'req1' } }),
    ).rejects.toThrow('Not signed in');
  });

  it('throws failed-precondition when societyId missing', async () => {
    await expect(
      withdrawExpenseRequest(makeRequest({ requestId: 'req1' }, { uid: 'u1', token: {} })),
    ).rejects.toThrow('No active society');
  });

  it('throws permission-denied for a role that cannot withdraw at all (MC)', async () => {
    const mcAuth = { uid: 'mc1', token: { role: 'mc', societyId: 'soc1' } };
    await expect(
      withdrawExpenseRequest(makeRequest({ requestId: 'req1' }, mcAuth)),
    ).rejects.toThrow('Only FM or Admin can withdraw');
  });
});

// ── Cross-society guard (pins FN-2 extraction contract) ───────────────────────

describe('withdrawExpenseRequest — cross-society guard', () => {
  it('throws permission-denied when doc.societyId differs', async () => {
    mockRequestData.mockReturnValue({
      societyId: 'other_soc', type: 'maintenance', status: 'requested',
    });
    await expect(
      withdrawExpenseRequest(makeRequest({ requestId: 'req1' })),
    ).rejects.toThrow('Cross-society access denied');
  });
});

// ── Status gates ───────────────────────────────────────────────────────────────

describe('withdrawExpenseRequest — status gates', () => {
  it('throws failed-precondition when already withdrawn', async () => {
    mockRequestData.mockReturnValue({ societyId: 'soc1', type: 'maintenance', status: 'withdrawn' });
    await expect(
      withdrawExpenseRequest(makeRequest({ requestId: 'req1' })),
    ).rejects.toThrow('already withdrawn');
  });

  it('throws failed-precondition when completed', async () => {
    mockRequestData.mockReturnValue({ societyId: 'soc1', type: 'maintenance', status: 'completed' });
    await expect(
      withdrawExpenseRequest(makeRequest({ requestId: 'req1' })),
    ).rejects.toThrow('Cannot withdraw a completed request');
  });

  it('throws failed-precondition when disbursed', async () => {
    mockRequestData.mockReturnValue({ societyId: 'soc1', type: 'maintenance', status: 'disbursed' });
    await expect(
      withdrawExpenseRequest(makeRequest({ requestId: 'req1' })),
    ).rejects.toThrow('Cannot withdraw after disbursement');
  });
});

// ── Separation of duties (D9b) ─────────────────────────────────────────────────
// This is the most critical pin for this callable. FN-1 must preserve these
// role-specific guards exactly — they enforce the separation-of-duties rule.

describe('withdrawExpenseRequest — separation of duties', () => {
  it('snag: FM cannot withdraw (only Admin)', async () => {
    mockRequestData.mockReturnValue({
      societyId: 'soc1', type: 'snag', status: 'requested',
    });
    await expect(
      withdrawExpenseRequest(makeRequest({ requestId: 'req1' }, fmAuth)),
    ).rejects.toThrow('Only Admin can withdraw a snag request');
  });

  it('snag: Admin can withdraw', async () => {
    mockRequestData.mockReturnValue({
      societyId: 'soc1', type: 'snag', status: 'requested',
    });
    const result = await withdrawExpenseRequest(makeRequest({ requestId: 'req1' }, adminAuth));
    expect(result).toEqual({ ok: true });
  });

  it('maintenance: Admin cannot withdraw (only FM)', async () => {
    await expect(
      withdrawExpenseRequest(makeRequest({ requestId: 'req1' }, adminAuth)),
    ).rejects.toThrow('Only FM can withdraw a maintenance request');
  });

  it('maintenance: FM can withdraw', async () => {
    const result = await withdrawExpenseRequest(makeRequest({ requestId: 'req1' }, fmAuth));
    expect(result).toEqual({ ok: true });
  });
});

// ── Write ─────────────────────────────────────────────────────────────────────

describe('withdrawExpenseRequest — write', () => {
  it('sets status to withdrawn', async () => {
    await withdrawExpenseRequest(makeRequest({ requestId: 'req1' }, fmAuth));
    expect(mockRequestRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'withdrawn' }),
    );
  });
});
