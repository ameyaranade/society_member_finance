import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordApproval as _recordApproval } from './recordApproval';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const recordApproval = _recordApproval as unknown as (req: object) => Promise<any>;

// ── Hoisted mocks ──────────────────────────────────────────────────────────────
const { mockTxn, mockApprovalRef, mockRequestRef, mockDb } = vi.hoisted(() => {
  const mockTxn = {
    get:    vi.fn(),
    set:    vi.fn(),
    update: vi.fn(),
  };

  const mockApprovalRef = {};
  const mockRequestRef = {
    collection: vi.fn(() => ({ doc: vi.fn(() => mockApprovalRef) })),
  };

  const mockDb = {
    doc:            vi.fn(() => mockRequestRef),
    runTransaction: vi.fn(async (cb: (txn: typeof mockTxn) => Promise<unknown>) => cb(mockTxn)),
  };

  return { mockTxn, mockApprovalRef, mockRequestRef, mockDb };
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

const mcAuth = { uid: 'mc1', token: { role: 'mc', societyId: 'soc1' } };

function makeRequest(data: object, auth: object = mcAuth) {
  return { auth, data };
}

function mockSnap(data: Record<string, unknown>) {
  mockTxn.get.mockResolvedValue({ exists: true, data: () => data });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: a request in 'requested' state, needs 2 approvers, none yet
  mockSnap({
    societyId: 'soc1',
    status: 'requested',
    approvedBy: [],
    approvalCount: 0,
    requiredApprovers: 2,
    estCostPaise: 50000,
    title: 'Fix roof',
  });
});

// ── Auth guards (pins FN-1 extraction contract) ────────────────────────────────

describe('recordApproval — auth guards', () => {
  it('throws unauthenticated when no auth', async () => {
    await expect(
      recordApproval({ auth: null, data: { requestId: 'req1' } }),
    ).rejects.toThrow('Not signed in');
  });

  it('throws failed-precondition when societyId missing from token', async () => {
    await expect(
      recordApproval(makeRequest({ requestId: 'req1' }, { uid: 'u1', token: {} })),
    ).rejects.toThrow('No active society');
  });

  it('throws permission-denied for FM role', async () => {
    await expect(
      recordApproval(makeRequest({ requestId: 'req1' }, { uid: 'fm1', token: { role: 'fm', societyId: 'soc1' } })),
    ).rejects.toThrow('Only MC members can approve');
  });

  it('throws permission-denied for Admin role', async () => {
    await expect(
      recordApproval(makeRequest({ requestId: 'req1' }, { uid: 'a1', token: { role: 'admin', societyId: 'soc1' } })),
    ).rejects.toThrow('Only MC members can approve');
  });
});

// ── Cross-society guard (pins FN-2 extraction contract) ───────────────────────

describe('recordApproval — cross-society guard', () => {
  it('throws permission-denied when doc.societyId differs from caller', async () => {
    mockSnap({ societyId: 'other_soc', status: 'requested', approvedBy: [], approvalCount: 0 });
    await expect(
      recordApproval(makeRequest({ requestId: 'req1' })),
    ).rejects.toThrow('Cross-society access denied');
  });
});

// ── Business rules ─────────────────────────────────────────────────────────────

describe('recordApproval — business rules', () => {
  it('throws failed-precondition when request is not in requested status', async () => {
    mockSnap({ societyId: 'soc1', status: 'approved', approvedBy: [] });
    await expect(
      recordApproval(makeRequest({ requestId: 'req1' })),
    ).rejects.toThrow('Cannot approve a request with status');
  });

  it('throws failed-precondition on self-approval (same uid already approved)', async () => {
    mockSnap({
      societyId: 'soc1', status: 'requested',
      approvedBy: ['mc1'], // mc1 is the caller
      approvalCount: 1, requiredApprovers: 2,
    });
    await expect(
      recordApproval(makeRequest({ requestId: 'req1' })),
    ).rejects.toThrow('already approved this request');
  });

  it('returns ok:true and approved:false for a partial approval', async () => {
    const result = await recordApproval(makeRequest({ requestId: 'req1' }));
    // requiredApprovers is 2, approvalCount goes from 0 → 1
    expect(result).toEqual({ ok: true, approved: false });
  });

  it('returns ok:true and approved:true when approval count reaches the threshold', async () => {
    mockSnap({
      societyId: 'soc1', status: 'requested',
      approvedBy: ['mc2'], // mc2 already approved; mc1 (caller) is about to be the 2nd
      approvalCount: 1,
      requiredApprovers: 2,
      estCostPaise: 50000,
      title: 'Fix roof',
    });
    const result = await recordApproval(makeRequest({ requestId: 'req1' }));
    expect(result).toEqual({ ok: true, approved: true });
  });

  it('writes an approval subdoc inside the transaction', async () => {
    await recordApproval(makeRequest({ requestId: 'req1' }));
    expect(mockTxn.set).toHaveBeenCalledWith(
      mockApprovalRef,
      expect.objectContaining({ mcUid: 'mc1', societyId: 'soc1', requestId: 'req1' }),
    );
  });

  it('increments approvalCount on the request doc', async () => {
    await recordApproval(makeRequest({ requestId: 'req1' }));
    expect(mockTxn.update).toHaveBeenCalledWith(
      mockRequestRef,
      expect.objectContaining({ approvalCount: 1 }),
    );
  });

  it('throws not-found when the request document does not exist', async () => {
    mockTxn.get.mockResolvedValue({ exists: false });
    await expect(
      recordApproval(makeRequest({ requestId: 'req1' })),
    ).rejects.toThrow('not found');
  });
});
