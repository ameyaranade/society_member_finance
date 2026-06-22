import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateMembership as _updateMembership } from './updateMembership';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const updateMembership = _updateMembership as unknown as (req: object) => Promise<any>;

const { mockMembershipData, mockAdminCountDocs, mockDb } = vi.hoisted(() => {
  const mockUpdate = vi.fn().mockResolvedValue(undefined);
  const mockMembershipData = vi.fn();
  const mockAdminCountDocs: { id: string }[] = [];

  const mockMembershipRef = { update: mockUpdate };
  const mockMembershipSnap = {
    exists: true,
    data:   mockMembershipData,
    ref:    mockMembershipRef,
    id:     'admin1_soc1',
  };

  const mockColChain = {
    where: vi.fn().mockReturnThis(),
    get:   vi.fn().mockResolvedValue({ docs: mockAdminCountDocs }),
  };

  const mockDb = {
    doc: vi.fn(() => ({
      get:    vi.fn().mockResolvedValue(mockMembershipSnap),
      update: mockUpdate,
    })),
    collection: vi.fn(() => mockColChain),
  };

  return { mockUpdate, mockMembershipData, mockAdminCountDocs, mockDb };
});

vi.mock('../lib/admin', () => ({
  db: mockDb,
  adminAuth: { getUser: vi.fn(), setCustomUserClaims: vi.fn() },
}));
vi.mock('../lib/claims', () => ({ refreshUserClaims: vi.fn().mockResolvedValue({}) }));
vi.mock('firebase-admin/app', () => ({ initializeApp: vi.fn() }));
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'SERVER_TS', delete: () => 'DELETE' },
}));
vi.mock('firebase-functions/v2/https', () => ({
  onCall: (_opts: unknown, handler: unknown) => handler,
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) { super(message); }
  },
}));

const adminAuth = { uid: 'admin1', token: { role: 'admin', societyId: 'soc1' } };

function makeRequest(data: object, auth: object = adminAuth) {
  return { auth, data };
}

describe('updateMembership — zero-admin guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMembershipData.mockReturnValue({
      role: 'admin', status: 'active', societyId: 'soc1',
    });
    // Clear the mutable array
    mockAdminCountDocs.length = 0;
  });

  it('blocks deactivating the last admin', async () => {
    // mockAdminCountDocs is empty → 0 other admins
    await expect(
      updateMembership(makeRequest({ membershipId: 'admin1_soc1', status: 'deactivated' })),
    ).rejects.toThrow('Cannot remove the last admin');
  });

  it('allows deactivation when another admin exists', async () => {
    mockAdminCountDocs.push({ id: 'admin2_soc1' });
    const result = await updateMembership(makeRequest({
      membershipId: 'admin1_soc1',
      status: 'deactivated',
    }));
    expect(result).toEqual({ ok: true });
  });

  it('blocks demoting last admin to non-admin role', async () => {
    await expect(
      updateMembership(makeRequest({ membershipId: 'admin1_soc1', role: 'mc' })),
    ).rejects.toThrow('Cannot remove the last admin');
  });

  it('denies non-admin caller', async () => {
    await expect(
      updateMembership(makeRequest(
        { membershipId: 'admin1_soc1', role: 'mc' },
        { uid: 'fm1', token: { role: 'fm', societyId: 'soc1' } },
      )),
    ).rejects.toThrow('Only admins');
  });
});
