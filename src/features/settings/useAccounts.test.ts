import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Hoist mock functions so they're available when vi.mock factories run ───────
const {
  mockUnsubscribe, mockOnSnapshot, mockAddDoc, mockUpdateDoc,
  mockDeleteDoc, mockDoc, mockCollection, mockQuery, mockOrderBy,
} = vi.hoisted(() => ({
  mockUnsubscribe:  vi.fn(),
  mockOnSnapshot:   vi.fn(),
  mockAddDoc:       vi.fn(),
  mockUpdateDoc:    vi.fn(),
  mockDeleteDoc:    vi.fn(),
  mockDoc:          vi.fn(),
  mockCollection:   vi.fn(),
  mockQuery:        vi.fn((ref: unknown) => ref),
  mockOrderBy:      vi.fn(() => ({ orderBy: 'createdAt' })),
}));

vi.mock('firebase/firestore', () => ({
  collection:      mockCollection,
  doc:             mockDoc,
  query:           mockQuery,
  orderBy:         mockOrderBy,
  onSnapshot:      mockOnSnapshot,
  addDoc:          mockAddDoc,
  updateDoc:       mockUpdateDoc,
  deleteDoc:       mockDeleteDoc,
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
}));

vi.mock('../../lib/firebase', () => ({ db: { _isMock: true } }));

vi.mock('../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

import { useAccounts } from './useAccounts';
import { useAuth } from '../auth/useAuth';

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

function setupAuth(societyId: string | null = 'soc1', uid = 'uid1') {
  mockUseAuth.mockReturnValue({ societyId, user: societyId ? { uid } : null });
}

function callSnapshotWith(docs: { id: string; data: Record<string, unknown> }[]) {
  const [, callback] = mockOnSnapshot.mock.calls[0];
  act(() => {
    callback({ docs: docs.map(d => ({ id: d.id, data: () => d.data })) });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCollection.mockReturnValue({ _path: 'mocked_col' });
  mockDoc.mockReturnValue({ _ref: 'mock_doc_ref' });
  mockOnSnapshot.mockReturnValue(mockUnsubscribe);
  mockAddDoc.mockResolvedValue({ id: 'new_acc' });
  mockUpdateDoc.mockResolvedValue(undefined);
  mockDeleteDoc.mockResolvedValue(undefined);
});

// ── Tenant isolation: societyId-scoped query path ─────────────────────────────

describe('useAccounts — societyId scoping (tenant isolation)', () => {
  it('uses the correct society-scoped collection path', () => {
    setupAuth('soc1');
    renderHook(() => useAccounts());

    expect(mockCollection).toHaveBeenCalledWith(
      expect.anything(),
      'societies/soc1/accounts',
    );
  });

  it('does NOT subscribe when societyId is null', () => {
    setupAuth(null);
    renderHook(() => useAccounts());
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });
});

// ── Data mapping: snapshot → state ────────────────────────────────────────────

describe('useAccounts — data mapping', () => {
  it('maps snapshot docs to { id, ...data } and sets loading false', () => {
    setupAuth('soc1');
    const { result } = renderHook(() => useAccounts());

    callSnapshotWith([
      { id: 'acc1', data: { name: 'Main Bank', type: 'bank', currentBalancePaise: 100000 } },
      { id: 'acc2', data: { name: 'Petty Cash', type: 'cash', currentBalancePaise: 5000 } },
    ]);

    expect(result.current.loading).toBe(false);
    expect(result.current.accounts).toHaveLength(2);
    expect(result.current.accounts[0]).toMatchObject({ id: 'acc1', name: 'Main Bank' });
    expect(result.current.accounts[1]).toMatchObject({ id: 'acc2', name: 'Petty Cash' });
  });

  it('starts in loading state', () => {
    setupAuth('soc1');
    // Don't trigger the snapshot callback
    const { result } = renderHook(() => useAccounts());
    expect(result.current.loading).toBe(true);
  });
});

// ── CRUD: stamps societyId, createdAt, createdBy ──────────────────────────────

describe('useAccounts — createAccount', () => {
  it('stamps societyId, createdAt, createdBy, and currentBalancePaise', async () => {
    setupAuth('soc1', 'fm_uid');
    const { result } = renderHook(() => useAccounts());

    await act(async () => {
      await result.current.createAccount({
        name: 'Reserve Fund',
        type: 'sinking',
        openingBalancePaise: 50000,
      });
    });

    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        societyId:           'soc1',
        name:                'Reserve Fund',
        type:                'sinking',
        openingBalancePaise: 50000,
        currentBalancePaise: 50000,
        createdAt:           'SERVER_TS',
        createdBy:           'fm_uid',
      }),
    );
  });

  it('adds to the correct society-scoped collection', async () => {
    setupAuth('soc1');
    const { result } = renderHook(() => useAccounts());
    await act(async () => {
      await result.current.createAccount({ name: 'X', type: 'cash', openingBalancePaise: 0 });
    });
    expect(mockCollection).toHaveBeenCalledWith(expect.anything(), 'societies/soc1/accounts');
  });
});

describe('useAccounts — updateAccount', () => {
  it('calls updateDoc on the correct doc path', async () => {
    setupAuth('soc1');
    const { result } = renderHook(() => useAccounts());
    await act(async () => {
      await result.current.updateAccount('acc1', { name: 'New Name' });
    });
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'societies/soc1/accounts', 'acc1');
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'New Name' }),
    );
  });
});

describe('useAccounts — deleteAccount', () => {
  it('calls deleteDoc on the correct doc path', async () => {
    setupAuth('soc1');
    const { result } = renderHook(() => useAccounts());
    await act(async () => {
      await result.current.deleteAccount('acc1');
    });
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'societies/soc1/accounts', 'acc1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});
