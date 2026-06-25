import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inviteUser as _inviteUser } from './inviteUser';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inviteUser = _inviteUser as unknown as (req: object) => Promise<any>;

const { mockMembershipGet, mockMembershipSet, mockDb } = vi.hoisted(() => {
  const mockMembershipGet = vi.fn();
  const mockMembershipSet = vi.fn().mockResolvedValue(undefined);
  const mockMembershipRef = {
    get:    mockMembershipGet,
    set:    mockMembershipSet,
    update: vi.fn().mockResolvedValue(undefined),
  };
  const mockDb = { doc: vi.fn(() => mockMembershipRef) };
  return { mockMembershipGet, mockMembershipSet, mockDb };
});

vi.mock('../lib/admin', () => ({ db: mockDb, adminAuth: {} }));
vi.mock('../lib/audit', () => ({ writeAudit: vi.fn().mockResolvedValue(undefined) }));
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

function makeRequest(data: object, auth: object = adminAuth) {
  return { auth, data };
}

describe('inviteUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMembershipGet.mockResolvedValue({ exists: false });
  });

  it('creates a membership for a new user', async () => {
    const result = await inviteUser(makeRequest({
      email: 'fm@test.com',
      role: 'fm',
      societyId: 'soc1',
    }));
    expect(result.membershipId).toBeTruthy();
    expect(mockMembershipSet).toHaveBeenCalledOnce();
  });

  it('denies a non-admin caller', async () => {
    await expect(
      inviteUser(makeRequest(
        { email: 'x@y.com', role: 'mc', societyId: 'soc1' },
        { uid: 'fm1', token: { role: 'fm', societyId: 'soc1' } },
      )),
    ).rejects.toThrow('Only admins');
  });

  it('denies cross-society invite', async () => {
    await expect(
      inviteUser(makeRequest({
        email: 'x@y.com',
        role: 'mc',
        societyId: 'other-society',
      })),
    ).rejects.toThrow('Only admins');
  });

  it('rejects an already-active membership', async () => {
    mockMembershipGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'active' }),
    });
    await expect(
      inviteUser(makeRequest({ email: 'x@y.com', role: 'mc', societyId: 'soc1' })),
    ).rejects.toThrow('already has a membership');
  });
});
