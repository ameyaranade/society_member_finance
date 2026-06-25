/**
 * Typed data-access layer.
 * Every query MUST be scoped to societyId — this is the primary tenant isolation guard.
 * The repository hooks auto-inject societyId from AuthContext (wired in S2).
 * During S1 scaffolding, societyId is passed explicitly.
 */
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  type Query,
  type DocumentReference,
  type CollectionReference,
  type QueryConstraint,
  type DocumentData,
  type WithFieldValue,
  type UpdateData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
} from 'firebase/firestore';
import { db } from './firebase';

export type { FirestoreDataConverter, QueryDocumentSnapshot, SnapshotOptions };
export { where, orderBy, limit };

// ─── Collection paths ───────────────────────────────────────────────────────

export const COLLECTIONS = {
  societies:        'societies',
  users:            'users',
  // Top-level memberships: id = uid_societyId; supports multi-society per user queries
  memberships:      'memberships',
  accounts:         (societyId: string) => `societies/${societyId}/accounts`,
  fundHeads:        (societyId: string) => `societies/${societyId}/fundHeads`,
  vendors:          (societyId: string) => `societies/${societyId}/vendors`,
  vendorRelations:  (societyId: string) => `societies/${societyId}/vendorRelations`,
  // ── Receivables ──────────────────────────────────────────────────────────────
  units:            (societyId: string) => `societies/${societyId}/units`,
  collections:      (societyId: string) => `societies/${societyId}/collections`,
  collectionEntries:(societyId: string, period: string) => `societies/${societyId}/collections/${period}/entries`,
  vendorIncome:     (societyId: string) => `societies/${societyId}/vendorIncome`,
  // ── Payables ─────────────────────────────────────────────────────────────────
  recurringPayments:  (societyId: string) => `societies/${societyId}/recurringPayments`,
  recurringInstances: (societyId: string) => `societies/${societyId}/recurringInstances`,
  expenseRequests:    (societyId: string) => `societies/${societyId}/expenseRequests`,
  quotations:  (societyId: string, requestId: string) => `societies/${societyId}/expenseRequests/${requestId}/quotations`,
  approvals:   (societyId: string, requestId: string) => `societies/${societyId}/expenseRequests/${requestId}/approvals`,
  requestNotes:(societyId: string, requestId: string) => `societies/${societyId}/expenseRequests/${requestId}/notes`,
  disbursements:(societyId: string, requestId: string) => `societies/${societyId}/expenseRequests/${requestId}/disbursements`,
  // ── Ledger ───────────────────────────────────────────────────────────────────
  transactions:     (societyId: string) => `societies/${societyId}/transactions`,
  balances:         (societyId: string) => `societies/${societyId}/balances`,
  notifications:    (societyId: string) => `societies/${societyId}/notifications`,
  auditLogs:        (societyId: string) => `societies/${societyId}/auditLogs`,
} as const;

// ─── Generic helpers (always society-scoped) ─────────────────────────────────

/** Typed collection ref scoped to a society. */
export function societyCollection<T extends DocumentData>(
  societyId: string,
  path: (id: string) => string,
  converter?: FirestoreDataConverter<T>,
): CollectionReference<T> {
  const ref = collection(db, path(societyId));
  return converter ? ref.withConverter(converter) : (ref as CollectionReference<T>);
}

/** Typed doc ref scoped to a society. */
export function societyDoc<T extends DocumentData>(
  societyId: string,
  path: (id: string) => string,
  docId: string,
  converter?: FirestoreDataConverter<T>,
): DocumentReference<T> {
  const ref = doc(db, path(societyId), docId);
  return converter ? ref.withConverter(converter) : (ref as DocumentReference<T>);
}

/** Run a society-scoped query with optional constraints. */
export function societyQuery<T extends DocumentData>(
  societyId: string,
  path: (id: string) => string,
  constraints: QueryConstraint[] = [],
  converter?: FirestoreDataConverter<T>,
): Query<T> {
  const colRef = societyCollection(societyId, path, converter);
  return query(colRef, ...constraints);
}

// ─── Top-level collection helpers ────────────────────────────────────────────

/** Typed ref for a top-level (non-society-scoped) collection. */
export function topCollection<T extends DocumentData>(
  path: string,
  converter?: FirestoreDataConverter<T>,
): CollectionReference<T> {
  const ref = collection(db, path);
  return converter ? ref.withConverter(converter) : (ref as CollectionReference<T>);
}

/** Typed doc ref for a top-level collection. */
export function topDoc<T extends DocumentData>(
  path: string,
  docId: string,
  converter?: FirestoreDataConverter<T>,
): DocumentReference<T> {
  const ref = doc(db, path, docId);
  return converter ? ref.withConverter(converter) : (ref as DocumentReference<T>);
}

// ─── CRUD helpers ─────────────────────────────────────────────────────────────

export async function fetchDocs<T extends DocumentData>(q: Query<T>) {
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fetchDoc<T extends DocumentData>(ref: DocumentReference<T>) {
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function createDoc<T extends DocumentData>(
  ref: CollectionReference<T>,
  data: WithFieldValue<T>,
) {
  return addDoc(ref, data);
}

export async function upsertDoc<T extends DocumentData>(
  ref: DocumentReference<T>,
  data: WithFieldValue<T>,
) {
  return setDoc(ref, data, { merge: true });
}

export async function patchDoc<T extends DocumentData>(
  ref: DocumentReference<T>,
  data: UpdateData<T>,
) {
  return updateDoc(ref, data);
}

export async function removeDoc<T extends DocumentData>(ref: DocumentReference<T>) {
  return deleteDoc(ref);
}
