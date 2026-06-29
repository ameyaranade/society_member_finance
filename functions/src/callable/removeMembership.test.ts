import { describe, it, expect, vi, beforeEach } from 'vitest';
import { removeMembership as _removeMembership } from './removeMembership';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const removeMembership = _removeMembership as unknown as (req: object) => Promise<any>;

const { mockMembershipData, mockMembershipExists, mockDelete, mockAdminCountDocs, mockWriteAudit, mockRefreshClaims, mockDb } =
  vi.hoisted(() => {
    const mockMembershipData   = vi.fn();
    const mockMembershipExists = { value: true };
    const mockDelete           = vi.fn().mockResolvedValue(undefined);
    const mockAdminCountDocs: { id: string }[] = [];
    const mockWriteAudit       = vi.fn().mockResolvedValue(undefined);
    const mockRefreshClaims    = vi.fn().mockResolvedValue({});

    const mockMembershipRef = {
      get:    vi.fn(() => Promise.resolve({ exists: mockMembershipExists.value, data: mockMembershipData })),
      delete: mockDelete,
    };

    const mockColChain = {
      where: vi.fn().mockReturnThis(),
      get:   vi.fn(() => Promise.resolve({ docs: mockAdminCountDocs })),
    };

    const mockDb = {
      doc:        vi.fn(() => mockMembershipRef),
      collection: vi.fn(() => mockColChain),
    };

    return { mockMembershipData, mockMembershipExists, mockDelete, mockAdminCountDocs, mockWriteAudit, mockRefreshClaims, mockDb };
  });

vi.mock('../lib/admin', () => ({ db: mockDb, adminAuth: {} }));
vi.mock('../lib/audit',  () => ({ writeAudit: mockWriteAudit }));
vi.mock('../lib/claims', () => ({ refreshUserClaims: mockRefreshClaims }));
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

describe('removeMembership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMembershipExists.value = true;
    mockAdminCountDocs.length = 0;
    // Default: a removable MC member in soc1
    mockMembershipData.mockReturnValue({
      email: 'mc@test.com', role: 'mc', status: 'active', societyId: 'soc1', uid: 'mcUid',
    });
  });

  it('removes a membership, writes an audit entry, and revokes claims', async () => {
    const result = await removeMembership(makeRequest({ membershipId: 'mc_soc1' }));
    expect(result).toEqual({ ok: true });
    expect(mockDelete).toHaveBeenCalledOnce();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user_removed', societyId: 'soc1', targetId: 'mc_soc1' }),
    );
    expect(mockRefreshClaims).toHaveBeenCalledWith('mcUid');
  });

  it('rejects an unauthenticated caller', async () => {
    await expect(
      removeMembership(makeRequest({ membershipId: 'mc_soc1' }, null)),
    ).rejects.toThrow('Must be signed in');
  });

  it('denies a non-admin caller', async () => {
    await expect(
      removeMembership(makeRequest(
        { membershipId: 'mc_soc1' },
        { uid: 'fm1', token: { role: 'fm', societyId: 'soc1' } },
      )),
    ).rejects.toThrow('Only admins');
  });

  it('denies cross-society removal (admin of another society)', async () => {
    // Caller is admin of soc2; target membership belongs to soc1
    await expect(
      removeMembership(makeRequest(
        { membershipId: 'mc_soc1' },
        { uid: 'admin2', token: { role: 'admin', societyId: 'soc2' } },
      )),
    ).rejects.toThrow('Only admins');
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('blocks removing the last active admin', async () => {
    mockMembershipData.mockReturnValue({
      email: 'admin1@test.com', role: 'admin', status: 'active', societyId: 'soc1', uid: 'admin1',
    });
    // mockAdminCountDocs empty → 0 other admins remain
    await expect(
      removeMembership(makeRequest({ membershipId: 'admin1_soc1' })),
    ).rejects.toThrow('Cannot remove the last admin');
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('allows removing an admin when another active admin exists', async () => {
    mockMembershipData.mockReturnValue({
      email: 'admin1@test.com', role: 'admin', status: 'active', societyId: 'soc1', uid: 'admin1',
    });
    mockAdminCountDocs.push({ id: 'admin2_soc1' });
    const result = await removeMembership(makeRequest({ membershipId: 'admin1_soc1' }));
    expect(result).toEqual({ ok: true });
    expect(mockDelete).toHaveBeenCalledOnce();
  });

  it('returns not-found for a missing membership', async () => {
    mockMembershipExists.value = false;
    await expect(
      removeMembership(makeRequest({ membershipId: 'ghost_soc1' })),
    ).rejects.toThrow('Membership not found');
  });
});
