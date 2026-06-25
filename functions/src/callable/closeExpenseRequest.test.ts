import { describe, it, expect, vi, beforeEach } from 'vitest';
import { closeExpenseRequest as _closeExpenseRequest } from './closeExpenseRequest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const closeExpenseRequest = _closeExpenseRequest as unknown as (req: object) => Promise<any>;

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

const fmAuth = { uid: 'fm1', token: { role: 'fm', societyId: 'soc1' } };

function makeRequest(data: object, auth: object = fmAuth) {
  return { auth, data };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequestData.mockReturnValue({ societyId: 'soc1', status: 'disbursed', title: 'Fix roof' });
});

// ── Auth guards (pins FN-1 extraction contract) ────────────────────────────────

describe('closeExpenseRequest — auth guards', () => {
  it('throws unauthenticated when no auth', async () => {
    await expect(
      closeExpenseRequest({ auth: null, data: { requestId: 'req1' } }),
    ).rejects.toThrow('Not signed in');
  });

  it('throws failed-precondition when societyId is missing from token', async () => {
    await expect(
      closeExpenseRequest(makeRequest({ requestId: 'req1' }, { uid: 'u1', token: {} })),
    ).rejects.toThrow('No active society');
  });

  it('throws permission-denied for non-FM roles', async () => {
    const mcAuth = { uid: 'mc1', token: { role: 'mc', societyId: 'soc1' } };
    await expect(
      closeExpenseRequest(makeRequest({ requestId: 'req1' }, mcAuth)),
    ).rejects.toThrow('Only FM can close expense requests');
  });
});

// ── Input validation ───────────────────────────────────────────────────────────

describe('closeExpenseRequest — input validation', () => {
  it('throws invalid-argument when requestId is missing', async () => {
    await expect(
      closeExpenseRequest(makeRequest({ requestId: '' })),
    ).rejects.toThrow('requestId is required');
  });
});

// ── Cross-society guard (pins FN-2 extraction contract) ───────────────────────

describe('closeExpenseRequest — cross-society guard', () => {
  it('throws permission-denied when doc.societyId does not match caller', async () => {
    mockRequestData.mockReturnValue({ societyId: 'other_soc', status: 'disbursed' });
    await expect(
      closeExpenseRequest(makeRequest({ requestId: 'req1' })),
    ).rejects.toThrow('Cross-society access denied');
  });
});

// ── Status gate ────────────────────────────────────────────────────────────────

describe('closeExpenseRequest — status gate', () => {
  it('throws failed-precondition when status is not disbursed', async () => {
    mockRequestData.mockReturnValue({ societyId: 'soc1', status: 'approved' });
    await expect(
      closeExpenseRequest(makeRequest({ requestId: 'req1' })),
    ).rejects.toThrow('Cannot close');
  });

  it('returns ok:true when request is disbursed', async () => {
    const result = await closeExpenseRequest(makeRequest({ requestId: 'req1' }));
    expect(result).toEqual({ ok: true });
  });

  it('sets status to completed', async () => {
    await closeExpenseRequest(makeRequest({ requestId: 'req1' }));
    expect(mockRequestRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
    );
  });
});
