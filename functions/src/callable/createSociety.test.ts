import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSociety as _createSociety } from './createSociety';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createSociety = _createSociety as unknown as (req: object) => Promise<any>;

// ── Hoisted mocks (vi.mock is hoisted; vars must be too) ──────────────────────
const { mockBatch, mockSocietyGet, mockDb } = vi.hoisted(() => {
  const mockBatch = {
    set:    vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    commit: vi.fn().mockResolvedValue(undefined),
  };
  const mockSocietyGet = vi.fn();
  const mockSocietyDoc  = { get: mockSocietyGet, id: 'test-society' };
  const mockMembershipDoc = { set: vi.fn().mockResolvedValue(undefined) };

  const mockDb = {
    doc:   vi.fn((path: string) => path.startsWith('societies/') ? mockSocietyDoc : mockMembershipDoc),
    batch: vi.fn(() => mockBatch),
  };
  return { mockBatch, mockSocietyGet, mockDb };
});

vi.mock('../lib/admin', () => ({
  db: mockDb,
  adminAuth: { getUser: vi.fn(), setCustomUserClaims: vi.fn() },
}));
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

const superAdminAuth = { uid: 'super1', token: { superAdmin: true } };

function makeRequest(data: object, auth: object = superAdminAuth) {
  return { auth, data };
}

describe('createSociety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocietyGet.mockResolvedValue({ exists: false });
  });

  it('creates society and admin membership', async () => {
    const result = await createSociety(makeRequest({
      societyId: 'test-society',
      name: 'Test Society',
      totalUnits: 100,
      adminEmail: 'admin@test.com',
    }));
    expect(result).toEqual({ societyId: 'test-society' });
    expect(mockBatch.commit).toHaveBeenCalledOnce();
    expect(mockBatch.set).toHaveBeenCalledTimes(2);
  });

  it('rejects non-super-admin', async () => {
    await expect(
      createSociety(makeRequest(
        { societyId: 'x', name: 'X', totalUnits: 1, adminEmail: 'a@b.com' },
        { uid: 'user1', token: { role: 'admin', societyId: 'other' } },
      )),
    ).rejects.toThrow('Super-admin only');
  });

  it('rejects invalid societyId', async () => {
    await expect(
      createSociety(makeRequest({
        societyId: 'UPPER_CASE!',
        name: 'X',
        totalUnits: 1,
        adminEmail: 'a@b.com',
      })),
    ).rejects.toThrow('societyId must be');
  });

  it('rejects duplicate societyId', async () => {
    mockSocietyGet.mockResolvedValue({ exists: true });
    await expect(
      createSociety(makeRequest({
        societyId: 'test-society',
        name: 'X',
        totalUnits: 1,
        adminEmail: 'a@b.com',
      })),
    ).rejects.toThrow('already exists');
  });
});
