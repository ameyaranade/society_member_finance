import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase/firestore before importing db
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, path: string) => ({ _path: path })),
  doc:        vi.fn((_db: unknown, path: string, id: string) => ({ _path: `${path}/${id}` })),
  query:      vi.fn((ref: unknown, ...constraints: unknown[]) => ({ _ref: ref, _constraints: constraints })),
  where:      vi.fn((field: string, op: string, val: unknown) => ({ field, op, val })),
  orderBy:    vi.fn((field: string) => ({ orderBy: field })),
  limit:      vi.fn((n: number) => ({ limit: n })),
  getDocs:    vi.fn(),
  getDoc:     vi.fn(),
  addDoc:     vi.fn(),
  setDoc:     vi.fn(),
  updateDoc:  vi.fn(),
  deleteDoc:  vi.fn(),
}));

vi.mock('./firebase', () => ({ db: { _isMock: true } }));

import { societyCollection, societyDoc, societyQuery, COLLECTIONS, where } from './db';

const SOCIETY = 'society_abc';

describe('societyCollection', () => {
  it('scopes path to societyId', () => {
    const ref = societyCollection(SOCIETY, COLLECTIONS.requests);
    expect((ref as unknown as { _path: string })._path).toBe(`societies/${SOCIETY}/requests`);
  });
});

describe('societyDoc', () => {
  it('scopes doc path to societyId', () => {
    const ref = societyDoc(SOCIETY, COLLECTIONS.requests, 'req_1');
    expect((ref as unknown as { _path: string })._path).toBe(
      `societies/${SOCIETY}/requests/req_1`,
    );
  });
});

describe('societyQuery', () => {
  beforeEach(() => vi.clearAllMocks());

  it('builds a query on the society-scoped collection', () => {
    const q = societyQuery(SOCIETY, COLLECTIONS.requests);
    const inner = q as unknown as { _ref: { _path: string } };
    expect(inner._ref._path).toBe(`societies/${SOCIETY}/requests`);
  });

  it('includes provided constraints', () => {
    // where is already vi.fn() from the top-level mock — call it directly
    const constraint = where('status', '==', 'requested');
    const q = societyQuery(SOCIETY, COLLECTIONS.requests, [constraint]);
    const inner = q as unknown as { _constraints: unknown[] };
    expect(inner._constraints).toHaveLength(1);
  });
});
