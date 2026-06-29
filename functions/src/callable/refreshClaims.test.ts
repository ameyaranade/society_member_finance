import { describe, it, expect, vi, beforeEach } from 'vitest';
import { refreshClaims as _refreshClaims } from './refreshClaims';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const refreshClaims = _refreshClaims as unknown as (req: object) => Promise<any>;

const { mockInvitedSnap, mockBatchCommit, mockUserSet, mockRefreshUserClaims, mockWriteAudit, mockDb } =
  vi.hoisted(() => {
    const mockInvitedSnap  = { empty: true, size: 0, docs: [] as { id: string; ref: object; data: () => Record<string, unknown> }[] };
    const mockBatchUpdate  = vi.fn();
    const mockBatchCommit  = vi.fn().mockResolvedValue(undefined);
    const mockUserSet      = vi.fn().mockResolvedValue(undefined);
    const mockRefreshUserClaims = vi.fn().mockResolvedValue({ societyId: 'soc1', role: 'mc' });
    const mockWriteAudit   = vi.fn().mockResolvedValue(undefined);

    const mockDb = {
      doc: vi.fn(() => ({ set: mockUserSet })),
      collection: vi.fn(() => ({
        where: vi.fn().mockReturnThis(),
        get:   vi.fn(() => Promise.resolve(mockInvitedSnap)),
      })),
      batch: vi.fn(() => ({ update: mockBatchUpdate, commit: mockBatchCommit })),
    };

    return { mockInvitedSnap, mockBatchCommit, mockUserSet, mockRefreshUserClaims, mockWriteAudit, mockDb };
  });

vi.mock('../lib/admin', () => ({ db: mockDb, adminAuth: {} }));
vi.mock('../lib/audit',  () => ({ writeAudit: mockWriteAudit }));
vi.mock('../lib/claims', () => ({ refreshUserClaims: mockRefreshUserClaims }));
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

function makeRequest({
  uid = 'user1',
  email = 'user@test.com',
  emailVerified = true,
  signInProvider = 'google.com',
  name = 'Test User',
} = {}) {
  return {
    auth: {
      uid,
      token: {
        email,
        email_verified: emailVerified,
        name,
        firebase: { sign_in_provider: signInProvider },
      },
    },
  };
}

describe('refreshClaims — email verification gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvitedSnap.empty = true;
    mockInvitedSnap.docs  = [];
    mockInvitedSnap.size  = 0;
  });

  it('activates an invited membership for a verified Google sign-in', async () => {
    mockInvitedSnap.empty = false;
    mockInvitedSnap.size  = 1;
    mockInvitedSnap.docs  = [{
      id:  'user_soc1',
      ref: {},
      data: () => ({ societyId: 'soc1', role: 'mc', email: 'user@test.com' }),
    }];

    await refreshClaims(makeRequest({ signInProvider: 'google.com', emailVerified: true }));

    expect(mockBatchCommit).toHaveBeenCalledOnce();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user_activated' }),
    );
  });

  it('does NOT activate a membership when email/password user is unverified', async () => {
    mockInvitedSnap.empty = false;
    mockInvitedSnap.size  = 1;
    mockInvitedSnap.docs  = [{
      id:  'user_soc1',
      ref: {},
      data: () => ({ societyId: 'soc1', role: 'mc', email: 'user@test.com' }),
    }];

    await refreshClaims(makeRequest({ signInProvider: 'password', emailVerified: false }));

    // Batch should not have been committed — no membership activation
    expect(mockBatchCommit).not.toHaveBeenCalled();
    expect(mockWriteAudit).not.toHaveBeenCalled();
    // Claims refresh still called (so client gets current token state)
    expect(mockRefreshUserClaims).toHaveBeenCalledWith('user1');
  });

  it('activates a membership for a verified email/password user', async () => {
    mockInvitedSnap.empty = false;
    mockInvitedSnap.size  = 1;
    mockInvitedSnap.docs  = [{
      id:  'user_soc1',
      ref: {},
      data: () => ({ societyId: 'soc1', role: 'fm', email: 'user@test.com' }),
    }];

    await refreshClaims(makeRequest({ signInProvider: 'password', emailVerified: true }));

    expect(mockBatchCommit).toHaveBeenCalledOnce();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user_activated', societyId: 'soc1' }),
    );
  });

  it('unauthenticated request throws', async () => {
    await expect(
      refreshClaims({ auth: null }),
    ).rejects.toThrow('Must be signed in');
  });

  it('still upserts user profile even when no invited memberships exist', async () => {
    await refreshClaims(makeRequest());
    expect(mockUserSet).toHaveBeenCalledOnce();
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });
});
