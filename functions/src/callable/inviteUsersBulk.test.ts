import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inviteUsersBulk as _inviteUsersBulk } from './inviteUsersBulk';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inviteUsersBulk = _inviteUsersBulk as unknown as (req: object) => Promise<any>;

const { mockDocGet, mockDocSet, mockDocUpdate, mockWriteAudit, mockDb } = vi.hoisted(() => {
  const mockDocGet    = vi.fn().mockResolvedValue({ exists: false });
  const mockDocSet    = vi.fn().mockResolvedValue(undefined);
  const mockDocUpdate = vi.fn().mockResolvedValue(undefined);
  const mockWriteAudit = vi.fn().mockResolvedValue(undefined);

  const mockDocRef = { get: mockDocGet, set: mockDocSet, update: mockDocUpdate };
  const mockDb = { doc: vi.fn(() => mockDocRef) };

  return { mockDocGet, mockDocSet, mockDocUpdate, mockWriteAudit, mockDb };
});

vi.mock('../lib/admin', () => ({ db: mockDb, adminAuth: {} }));
vi.mock('../lib/audit', () => ({ writeAudit: mockWriteAudit }));
vi.mock('../lib/rateLimit', () => ({ checkRateLimit: vi.fn().mockResolvedValue(undefined) }));
vi.mock('firebase-admin/app', () => ({ initializeApp: vi.fn() }));
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'SERVER_TS', delete: () => 'DELETE' },
}));
vi.mock('firebase-functions/v2/https', () => ({
  onCall: (optsOrHandler: unknown, maybeHandler?: unknown) => maybeHandler ?? optsOrHandler,
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) { super(message); }
  },
}));

const adminAuth = { uid: 'admin1', token: { role: 'admin', societyId: 'soc1' } };

function makeRequest(data: object, auth: object | null = adminAuth) {
  return { auth, data };
}

describe('inviteUsersBulk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocGet.mockResolvedValue({ exists: false });
  });

  it('invites all valid rows and writes audit entries', async () => {
    const result = await inviteUsersBulk(makeRequest({
      societyId: 'soc1',
      rows: [
        { email: 'a@test.com', role: 'mc' },
        { email: 'b@test.com', role: 'fm' },
      ],
    }));
    expect(result.invited).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(mockDocSet).toHaveBeenCalledTimes(2);
    expect(mockWriteAudit).toHaveBeenCalledTimes(2);
  });

  it('denies a non-admin caller', async () => {
    await expect(
      inviteUsersBulk(makeRequest(
        { societyId: 'soc1', rows: [{ email: 'x@y.com', role: 'mc' }] },
        { uid: 'fm1', token: { role: 'fm', societyId: 'soc1' } },
      )),
    ).rejects.toThrow('Only admins');
  });

  it('denies cross-society invites', async () => {
    await expect(
      inviteUsersBulk(makeRequest(
        { societyId: 'other-soc', rows: [{ email: 'x@y.com', role: 'mc' }] },
        { uid: 'admin1', token: { role: 'admin', societyId: 'soc1' } },
      )),
    ).rejects.toThrow('Only admins');
  });

  it('rejects an unauthenticated caller', async () => {
    await expect(
      inviteUsersBulk(makeRequest({ societyId: 'soc1', rows: [] }, null)),
    ).rejects.toThrow('Must be signed in');
  });

  it('reports invalid email as a row error, not a thrown exception', async () => {
    const result = await inviteUsersBulk(makeRequest({
      societyId: 'soc1',
      rows: [
        { email: 'not-an-email', role: 'mc' },
        { email: 'good@test.com', role: 'mc' },
      ],
    }));
    expect(result.invited).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toMatch(/Invalid email/);
  });

  it('reports an invalid role as a row error', async () => {
    const result = await inviteUsersBulk(makeRequest({
      societyId: 'soc1',
      rows: [{ email: 'x@test.com', role: 'superuser' }],
    }));
    expect(result.invited).toBe(0);
    expect(result.errors[0].message).toMatch(/Invalid role/);
  });

  it('skips an already-active membership and reports it as an error', async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'active' }),
    });
    const result = await inviteUsersBulk(makeRequest({
      societyId: 'soc1',
      rows: [{ email: 'existing@test.com', role: 'mc' }],
    }));
    expect(result.invited).toBe(0);
    expect(result.errors[0].message).toMatch(/active or invited/);
  });

  it('re-invites a deactivated membership via update', async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'deactivated' }),
    });
    const result = await inviteUsersBulk(makeRequest({
      societyId: 'soc1',
      rows: [{ email: 'lapsed@test.com', role: 'fm' }],
    }));
    expect(result.invited).toBe(1);
    expect(mockDocUpdate).toHaveBeenCalledOnce();
    expect(mockDocSet).not.toHaveBeenCalled();
  });

  it('rejects more than 200 rows', async () => {
    const rows = Array.from({ length: 201 }, (_, i) => ({
      email: `u${i}@test.com`, role: 'resident' as const,
    }));
    await expect(
      inviteUsersBulk(makeRequest({ societyId: 'soc1', rows })),
    ).rejects.toThrow('Maximum 200');
  });
});
