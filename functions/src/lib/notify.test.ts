import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────────
const { mockBatch, mockMemberDocs, mockDb } = vi.hoisted(() => {
  const mockBatch = {
    set:    vi.fn().mockReturnThis(),
    commit: vi.fn().mockResolvedValue(undefined),
  };
  const mockMemberDocs: { data: () => { uid?: string } }[] = [];

  const memberChain = {
    where: vi.fn().mockReturnThis(),
    get:   vi.fn(async () => ({ docs: mockMemberDocs })),
  };

  let notifDocCounter = 0;
  const notifChain = {
    doc: vi.fn(() => ({ id: `notif_${notifDocCounter++}` })),
  };

  const mockDb = {
    collection: vi.fn((path: string) => (path === 'memberships' ? memberChain : notifChain)),
    batch:      vi.fn(() => mockBatch),
  };

  return { mockBatch, mockMemberDocs, memberChain, mockDb };
});

vi.mock('./admin', () => ({ db: mockDb }));
vi.mock('firebase-admin/app', () => ({ initializeApp: vi.fn() }));
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'SERVER_TS' },
}));

import { dispatchNotification } from './notify';

beforeEach(() => {
  vi.clearAllMocks();
  mockMemberDocs.length = 0;
  mockBatch.set.mockReturnThis();
  mockBatch.commit.mockResolvedValue(undefined);
});

describe('dispatchNotification', () => {
  it('fans out to all active members with the specified role', async () => {
    mockMemberDocs.push({ data: () => ({ uid: 'mc1' }) });
    mockMemberDocs.push({ data: () => ({ uid: 'mc2' }) });

    await dispatchNotification({
      societyId: 'soc1',
      type: 'expense_request_submitted',
      payload: { requestId: 'req1' },
      toRole: 'mc',
    });

    expect(mockBatch.set).toHaveBeenCalledTimes(2);
    expect(mockBatch.commit).toHaveBeenCalledOnce();
  });

  it('sends directly to specific UIDs when toUids is provided', async () => {
    await dispatchNotification({
      societyId: 'soc1',
      type: 'expense_request_approved',
      payload: { requestId: 'req1' },
      toUids: ['fm1'],
    });

    expect(mockBatch.set).toHaveBeenCalledTimes(1);
    // notification doc contains the right shape
    const [, notifData] = mockBatch.set.mock.calls[0];
    expect(notifData).toMatchObject({
      societyId: 'soc1',
      toUid: 'fm1',
      type: 'expense_request_approved',
      readAt: null,
    });
  });

  it('writes to the correct society-scoped collection path', async () => {
    await dispatchNotification({
      societyId: 'soc1',
      type: 'expense_request_completed',
      payload: {},
      toUids: ['uid1'],
    });

    expect(mockDb.collection).toHaveBeenCalledWith('societies/soc1/notifications');
  });

  it('returns without writing when there are no recipients', async () => {
    // No members returned, no toUids
    await dispatchNotification({
      societyId: 'soc1',
      type: 'expense_request_submitted',
      payload: {},
      toRole: 'mc',
    });

    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  it('skips members with no uid field', async () => {
    mockMemberDocs.push({ data: () => ({}) }); // no uid
    mockMemberDocs.push({ data: () => ({ uid: 'mc1' }) });

    await dispatchNotification({
      societyId: 'soc1',
      type: 'expense_request_submitted',
      payload: {},
      toRole: 'mc',
    });

    expect(mockBatch.set).toHaveBeenCalledTimes(1);
  });
});
