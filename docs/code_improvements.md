# code_improvements.md — refactor & de-duplication plan

> **Purpose.** A self-contained, implementable backlog of refactors to remove
> redundancy and duplicated logic in the code completed so far. Written so an LLM
> coding agent (GPT or otherwise) can execute each item in isolation.
>
> **Hard constraints (from `CLAUDE.md`).** Every refactor below MUST preserve:
> - `societyId`-scoping on every read/write (tenant isolation).
> - The role matrix / separation-of-duties checks exactly as they are today.
> - Integer-paise money math (no float math introduced).
> - Functions-only writes to `transactions` / `balances` / `accounts.currentBalance` / `auditLogs`.
> - `npm run check:ux`, `lint`, `typecheck`, and existing tests all green.
>
> **Rule for the implementer:** these are *behaviour-preserving* refactors unless an
> item is explicitly tagged **[BEHAVIOUR CHANGE]** or **[BUG]**. Do not change
> observable behaviour, error codes, or error messages except where called out.
> Land each numbered item as its own PR/commit; run the full check suite per item.

---

## ⛔ Testing gate — MANDATORY before every check-in / deploy

> **This is a hard gate for the implementing agent (Claude Code / GPT). Do not
> commit, open a PR, or deploy any item below until ALL of the following pass for
> the code you touched. "It compiles" is not "it's tested."**

For **each** item you implement, before check-in you MUST:

1. **Run the full local suite and paste the results into the PR/commit description.**
   Currently-wired scripts (verified against `package.json`):
   - Root: `npm run lint`, `npm run typecheck`, `npm test` (Vitest unit/component +
     any rules tests), `npm run check:ux` (must report **zero** hits).
   - Functions: `cd functions && npm run lint && npm run typecheck && npm test`
     (callable/trigger logic — run the Firebase emulators where a test needs them).
   > **Tooling not yet wired:** `TEST_PLAN.md` references `@firebase/rules-unit-testing`,
   > a Functions-emulator suite, and Playwright e2e, but there are no
   > `test:rules` / `test:functions` / `test:e2e` scripts yet. If the item you are
   > implementing touches a surface or rule those layers should cover, **wire the
   > missing script and add the test as part of the item** — do not check the
   > corresponding `TEST_PLAN.md` box on the strength of a manual click-through.
   > Always read `package.json` first and run the real script names.
2. **Prove the refactor is behaviour-preserving.** For behaviour-preserving items,
   the *existing* tests for the affected surface/function must pass **unchanged**.
   If you had to edit an existing test's assertions, that means behaviour changed —
   stop, and either revert or re-tag the item as **[BEHAVIOUR CHANGE]** and get
   sign-off.
3. **Add the tests the item calls for.** Items tagged **[BUG]** or
   **[BEHAVIOUR CHANGE]** (X-3, X-4) and any new shared module (FE-1, FN-1…FN-5,
   X-1, X-2) MUST ship with new/updated tests. A shared helper is not "done" until
   it has its own unit test **and** the call sites it replaced still pass their
   tests. New collections/actions ship with rules + Functions tests proving
   cross-society denial and the role matrix (per `CLAUDE.md`).
4. **Update `TEST_PLAN.md` in the same PR.** If the item adds a state, transition,
   shared module, or test, record it in `docs/TEST_PLAN.md` and check the box only
   when actually verified. See the *"Shared modules & refactor regression"* section
   there — it is the checklist for this backlog.
5. **Never deploy a partially-tested item.** No `--force`, no skipping hooks
   (`--no-verify`), no disabling tests to make CI green. If a test is flaky or
   wrong, fix the test; don't bypass it.

**Definition of "tested" for a refactor:** the behaviour is pinned by a test that
would fail if the behaviour regressed — not merely exercised once by hand. Manual
emulator/browser checks are a complement to automated tests, never a replacement.

---

## How to use this document

Items are ordered by **value ÷ risk** (highest first). Each item has:
- **Where** — the files affected.
- **Problem** — the duplication/redundancy.
- **Fix** — the concrete change, with code sketches.
- **Verify** — how to prove it's safe.

Tags: **[FE]** frontend, **[FN]** Cloud Functions, **[X]** cross-cutting,
**[BUG]** latent defect found while analysing, **[BEHAVIOUR CHANGE]** intentional.

---

## FE-1 — Collapse the five near-identical CRUD subscription hooks **[FE]**

**Where**
- `src/features/settings/useAccounts.ts`
- `src/features/settings/useFundHeads.ts`
- `src/features/settings/useVendors.ts` (`useVendors` + `useVendorRelations`)
- `src/features/settings/useRecurringPayments.ts`
- (pattern also in `src/features/payables/useExpenseRequests.ts`, `useRecurringInstances.ts`, `useRequestedQueue.ts`)

**Problem**
Each hook re-implements the identical lifecycle: `useAuth()` → `societyId` guard →
build `collection(db, 'societies/${societyId}/<name>')` → `onSnapshot` →
`snap.docs.map(d => ({ id: d.id, ...d.data() }))` → `setLoading(false)`. The
`create*/update*/delete*` methods are also copy-paste: `if (!societyId) return`,
`addDoc(..., { societyId, ...data, createdAt: serverTimestamp(), createdBy: user.uid })`,
`updateDoc(doc(...id), data)`, `deleteDoc(doc(...id))`.

**Fix**
Add a generic realtime-collection hook and a generic CRUD hook in
`src/features/_shared/useSocietyCollection.ts`:

```ts
// useSocietyCollection.ts
export function useSocietyCollection<T extends { id: string }>(
  pathFn: (societyId: string) => string,
  opts?: {
    constraints?: QueryConstraint[];          // where/orderBy
    sort?: (a: T, b: T) => number;            // client-side sort
    filter?: (row: T) => boolean;             // client-side filter
    enabled?: boolean;                        // gate (e.g. vendorId present)
  },
): { rows: T[]; loading: boolean } { /* onSnapshot + map + sort/filter */ }

export function useSocietyCrud<T extends { id: string }>(
  pathFn: (societyId: string) => string,
) {
  // returns { create, update, remove } with the
  // societyId + createdAt + createdBy stamping baked in.
}
```

Then each settings hook becomes a thin wrapper, e.g.:

```ts
export function useAccounts() {
  const { rows: accounts, loading } = useSocietyCollection<Account>(
    COLLECTIONS.accounts, { constraints: [orderBy('createdAt', 'asc')] });
  const { create, update, remove } = useSocietyCrud<Account>(COLLECTIONS.accounts);
  const createAccount = (d: NewAccount) =>
    create({ ...d, currentBalancePaise: d.openingBalancePaise });
  return { accounts, loading, createAccount,
           updateAccount: update, deleteAccount: remove };
}
```

Notes for the implementer:
- Reuse `COLLECTIONS` path builders from `src/lib/db.ts` (see X-1) instead of
  inlining template strings.
- Preserve per-hook specifics: `useAccounts.createAccount` sets
  `currentBalancePaise`; `useVendorRelations` is gated on `vendorId` and stamps
  `vendorId`; `useRecurringPayments` strips/​nulls optional fields on update
  (`vendorId`/`endYearMonth`/`description`). Keep that logic in the wrapper, not
  the generic.
- Keep each hook's public return shape **identical** so call sites don't change.

**Verify** `typecheck` + existing settings tests; manually exercise create/edit/
delete in the Settings UI. No call site outside the hook files should change.

---

## FE-2 — Extract a Firestore-timestamp millis helper **[FE] [BUG-adjacent]**

**Where** `useExpenseRequests.ts`, `useRequestedQueue.ts`, `useNotifications.ts`,
`RequestDetailDrawer.tsx`, `PayablesPage.tsx`, `RequestNotesDialog.tsx`.

**Problem** The same defensive cast is copy-pasted everywhere:
```ts
(a.createdAt as unknown as { toMillis?: () => number })?.toMillis?.() ?? 0
```
and a `.toDate?.()` variant in `useNotifications`.

**Fix** Add to `src/lib/date.ts`:
```ts
export function tsMillis(v: unknown): number {
  return (v as { toMillis?: () => number } | null)?.toMillis?.() ?? 0;
}
export function tsToDate(v: unknown): Date | null {
  return (v as { toDate?: () => Date } | null)?.toDate?.() ?? null;
}
```
Replace inline casts with `tsMillis(a.createdAt)` etc. Sorters become
`(a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt)`.

**Verify** `typecheck`; ordering in Payables queue and Notifications unchanged.

---

## FE-3 — Centralise typed `httpsCallable` declarations **[FE]**

**Where** `PayablesPage.tsx`, `RequestDetailDrawer.tsx`, `SnagTakeUpDrawer.tsx`,
`MaintenanceCreateDrawer.tsx`, `SnagScheduleDrawer.tsx`, `DisbursementDialog.tsx`,
`MembersPage.tsx`, `SuperAdminPage.tsx`, `useRefreshClaims.ts`.

**Problem** `withdrawExpenseRequest`, `recordApproval`, and `closeExpenseRequest`
callables are each declared (with their generic types) in **both** `PayablesPage`
and `RequestDetailDrawer`. Other callables are declared ad hoc per component. The
input/output types are restated by hand and can drift from the Functions side.

**Fix** Create `src/lib/callables.ts` as the single typed registry:
```ts
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export const callables = {
  recordApproval:   httpsCallable<{ requestId: string; note?: string }, { ok: true; approved: boolean }>(functions, 'recordApproval'),
  withdrawExpenseRequest: httpsCallable<{ requestId: string }, { ok: true }>(functions, 'withdrawExpenseRequest'),
  closeExpenseRequest:    httpsCallable<{ requestId: string; closingNote?: string }, { ok: true }>(functions, 'closeExpenseRequest'),
  // …recordDisbursement, scheduleSnag, submitExpenseRequest,
  //   createMaintenanceRequest, inviteUser, updateMembership, createSociety, refreshClaims
} as const;
```
Replace per-component `const fooFn = httpsCallable(...)` with
`callables.foo(...)`. The argument/return types come from one place.

**Stretch (X-2):** type these from the shared types package so the client cannot
drift from the server contract.

**Verify** `typecheck`; each mutating action still works end-to-end against the
emulator.

---

## FE-4 — Factor the repeated CRUD-settings page scaffold **[FE]**

**Where** `AccountsSettings.tsx`, `FundHeadsSettings.tsx`, `VendorsSettings.tsx`
(and partially `RecurringSettings.tsx`).

**Problem** These pages are ~80% identical: same imports, same
`drawerOpen/editing/form/submitting/formError/deleteTarget` state machine, same
`openCreate/openEdit/handleSubmit/handleDelete` handlers, same
`Stack header + Button` → `Table` → `FormDrawer` → `ConfirmModal` layout, same
`isAdmin` gating, same loading spinner.

**Fix (incremental, two layers — do the hook first, it's low-risk):**

1. **Extract the form/CRUD state machine** into `useCrudFormState<T, Form>()` in
   `src/features/_shared/useCrudFormState.ts`, returning
   `{ drawerOpen, editing, form, setForm, submitting, formError, deleteTarget,
   setDeleteTarget, openCreate, openEdit, submit, confirmDelete, closeDrawer }`.
   Each page passes `{ emptyForm, toForm(entity), onCreate, onUpdate, onDelete }`.
   This removes ~50 lines of identical handler code per page.

2. **(Optional, higher effort) Extract a `<CrudTableSection>`** presentational
   component taking `columns`, `rows`, `renderActions`, header title/button, and
   empty-state text. Only do this if it doesn't fight per-page cell rendering
   (chips, descriptions). If it gets awkward, stop at step 1.

Keep all copy going through i18n (per `DESIGN_LANGUAGE.md`) — do not hardcode the
strings that the components already pass through `t(...)` (audit this while
touching them; some literals like "No accounts yet" appear hardcoded — see FE-6).

**Verify** Visual parity in light + dark; `npm run check:ux` zero hits; axe clean;
create/edit/delete still gated to Admin.

---

## FN-1 — Extract the callable auth/role guard **[FN]**

**Where** every file in `functions/src/callable/*.ts`.

**Problem** Each callable opens with the identical ~12 lines:
```ts
const uid = request.auth?.uid;
if (!uid) throw new HttpsError('unauthenticated', 'Not signed in.');
const token = request.auth?.token as Record<string, unknown> | undefined;
const societyId = token?.societyId as string | undefined;
const role = token?.role as string | undefined;
if (!societyId) throw new HttpsError('failed-precondition', 'No active society.');
if (role !== 'fm') throw new HttpsError('permission-denied', '…');
```

**Fix** Add `functions/src/lib/context.ts`:
```ts
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import type { Role } from './types';

export interface CallerContext { uid: string; societyId: string; role: Role; }

export function requireCaller(
  request: CallableRequest,
  allowedRoles?: Role[],
): CallerContext {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Not signed in.');
  const token = request.auth?.token as Record<string, unknown> | undefined;
  const societyId = token?.societyId as string | undefined;
  const role = token?.role as Role | undefined;
  if (!societyId) throw new HttpsError('failed-precondition', 'No active society.');
  if (allowedRoles && (!role || !allowedRoles.includes(role)))
    throw new HttpsError('permission-denied', 'You do not have permission to perform this action.');
  return { uid, societyId, role: role! };
}
```
Then each callable starts with e.g.
`const { uid, societyId, role } = requireCaller(request, ['fm']);`.

**⚠️ Preserve exact error messages where they are role-specific.** Several
callables use bespoke permission messages ("Only FM can take up a request.",
"Only Admin can schedule a snag.", "Must be Admin or FM."). If tests assert on
these strings, either (a) pass an optional `message` arg to `requireCaller`, or
(b) keep the role check inline and only extract the uid/societyId part. Grep the
`*.test.ts` files first and match whatever they assert.

**Verify** Run `functions` vitest suite — the rules/functions tests are the
contract. All role-matrix and cross-society denials must still pass.

---

## FN-2 — Extract the cross-society guard **[FN]**

**Where** `recordApproval.ts`, `recordDisbursement.ts`, `withdrawExpenseRequest.ts`,
`closeExpenseRequest.ts`, `submitExpenseRequest.ts`, `markInstancePaid.ts`.

**Problem** Repeated:
```ts
if (data.societyId !== societyId)
  throw new HttpsError('permission-denied', 'Cross-society access denied.');
```

**Fix** In `functions/src/lib/context.ts`:
```ts
export function assertSameSociety(docData: { societyId?: string } | undefined, societyId: string): void {
  if (!docData || docData.societyId !== societyId)
    throw new HttpsError('permission-denied', 'Cross-society access denied.');
}
```
Use after every `snap.data()`. This is a tenant-isolation invariant — centralising
it makes the guarantee auditable in one place.

**Verify** Cross-society denial tests in the functions suite stay green.

---

## FN-3 — Centralise enum/validation constants and field validators **[FN]**

**Where** `recordDisbursement.ts`, `recordPayment.ts`, `markInstancePaid.ts`
(`VALID_MODES`); `createMaintenanceRequest.ts`, `scheduleSnag.ts`
(`VALID_PRIORITIES`, `VALID_CATEGORIES`, `VALID_FUND_HEADS`); `recordPayment.ts`
(`VALID_SOURCE_TYPES`).

**Problem** The same `Set` literals are redefined in multiple files, and the same
validators are inlined repeatedly:
- requestId/instanceId required + trim
- `Number.isInteger(x) && x > 0` for paise
- `/^\d{4}-\d{2}-\d{2}$/` date format
- quotation-array validation (identical in `createMaintenanceRequest` and
  `submitExpenseRequest`)

**Fix** Add `functions/src/lib/validate.ts`:
```ts
export const PAYMENT_MODES   = new Set<PaymentMode>(['cash','upi','cheque','bank']);
export const PRIORITIES      = new Set<ExpensePriority>(['low','medium','high']);
export const CATEGORIES      = new Set<ExpenseCategory>([...]);
export const FUND_HEADS      = new Set(['general','sinking','corpus','repair']);
export const SOURCE_TYPES    = new Set<TransactionSourceType>([...]);

export function requireString(v: unknown, field: string): string { /* trim or throw invalid-argument */ }
export function requirePositiveIntPaise(v: unknown, field: string): number { /* … */ }
export function requireISODate(v: unknown, field: string): string { /* regex or throw */ }
export function validateQuotations(qs: unknown): QuotationInput[] { /* the shared loop */ }
```
All throw `HttpsError('invalid-argument', …)` with the **same messages** used
today. Replace inline checks with these calls.

**Verify** functions suite; spot-check that invalid-argument messages are
unchanged (tests may assert them).

---

## FN-4 — De-duplicate the tier-resolution + MC-quorum block **[FN]**

**Where** `createMaintenanceRequest.ts` (lines ~79–97) and
`submitExpenseRequest.ts` (lines ~66–84) — **verbatim duplicate**.

**Problem** Both run the identical sequence: `Promise.all([fetchApprovalTiers,
getActiveMCCount])` → `resolveTier` (wrapped in try/catch → failed-precondition)
→ quorum check (`requiredApprovers > activeMCCount`).

**Fix** Add to `functions/src/lib/tierHelpers.ts`:
```ts
export async function resolveRequiredApprovers(
  societyId: string, estCostPaise: number,
): Promise<number> {
  const [tiers, activeMCCount] = await Promise.all([
    fetchApprovalTiers(societyId), getActiveMCCount(societyId),
  ]);
  let required: number;
  try { required = resolveTier(estCostPaise, tiers); }
  catch (e) { throw new HttpsError('failed-precondition', e instanceof Error ? e.message : 'Tier error.'); }
  if (required > activeMCCount)
    throw new HttpsError('failed-precondition',
      `This request needs ${required} MC approver(s) but the society only has ${activeMCCount} active MC member(s).`);
  return required;
}
```
Keep the two slightly different trailing messages if a test depends on them;
otherwise standardise on one (note `createMaintenanceRequest` appends "Add more
MC members…" — decide and apply consistently).

**Verify** functions suite (tier + quorum tests).

---

## FN-5 — Extract a transaction-doc builder **[FN]**

**Where** `recordPayment.ts`, `recordDisbursement.ts`, `markInstancePaid.ts`.

**Problem** All three construct a near-identical `txnData` object (id, societyId,
direction, amountPaise, accountId, fundHead, mode, description, occurredAt,
sourceType, sourceId, createdBy, createdAt) and conditionally attach
`referenceNo`/`notes`.

**Fix** Add `functions/src/lib/transactions.ts`:
```ts
export function buildTransaction(input: {
  id: string; societyId: string; direction: TransactionDirection;
  amountPaise: number; accountId: string; fundHead: string; mode: PaymentMode;
  description: string; occurredAt: Timestamp; sourceType: TransactionSourceType;
  sourceId: string; createdBy: string; referenceNo?: string; notes?: string;
}): Record<string, unknown> { /* assemble + serverTimestamp createdAt + optional fields */ }
```
Each callable calls `buildTransaction({...})` then `txn.set(txnRef, ...)`. Do
**not** move the ledger-write side effects — only the object shape. (Balances are
still recomputed by the `recomputeBalances` trigger.)

**Verify** functions suite; confirm a posted disbursement/payment/instance still
produces one `transactions` doc with identical fields.

---

## FN-6 — Fold the notify error-swallow into `dispatchNotification` **[FN]**

**Where** every callable that notifies repeats
`.catch(e => console.error('notify error:', e))`.

**Problem** The "notifications must never block the main op" contract is
re-implemented at every call site and easy to forget.

**Fix** Either (a) export a `dispatchNotificationSafe(params)` that wraps
`dispatchNotification(...).catch(...)` internally, or (b) keep `dispatchNotification`
returning a promise but document that callers use `void dispatchNotificationSafe(...)`.
Replace the repeated `.catch` with the safe variant.

**Verify** functions suite; a notify failure still must not fail the parent call
(add/keep a test that stubs notify to throw).

---

## FN-7 — Default the region once for all callables **[FN]**

**Where** every `onCall({ region: 'asia-south1' }, …)` and the trigger/scheduled
functions.

**Problem** The region string is repeated in ~12 files; a region change means a
12-file edit and risks one being missed (a mis-regioned function is a real outage
risk).

**Fix** Use `setGlobalOptions({ region: 'asia-south1' })` once in
`functions/src/index.ts` (before the exports), OR export a small wrapper
`export const onCallInRegion = (h) => onCall({ region: REGION }, h)`. Prefer
`setGlobalOptions` — it also covers triggers/scheduled. Keep `REGION` in one
constant shared with any per-function overrides.

**Verify** `firebase emulators:start` lists every function under `asia-south1`;
functions suite green.

---

## X-1 — Actually use the data-access layer (`db.ts`) or delete it **[X]**

**Where** `src/lib/db.ts`, `src/lib/converters.ts` vs. every hook.

**Problem** `db.ts` provides `COLLECTIONS`, `societyCollection/Doc/Query`,
`fetchDocs/createDoc/patchDoc/...` and `converters.ts` provides typed converters —
but **almost no hook uses them**. Hooks inline `collection(db, 'societies/${id}/x')`
and re-map snapshots by hand. Only `useMemberships` uses a converter. This is the
single biggest source of drift risk: the "no query omits societyId" guarantee is
asserted by `db.ts` but bypassed in practice.

**Fix** Adopt `db.ts` as the mandatory path layer:
- Route the generic hook from **FE-1** through `COLLECTIONS.*` +
  `societyQuery/societyCollection` so the societyId-scoping invariant lives in one
  place.
- Use the converters from `converters.ts` (extend `makeConverter` to the
  remaining types) so `snap.docs.map(d => ({ id, ...d.data() }))` disappears.
- If after FE-1 some `db.ts` helpers are still unused, delete them rather than
  leaving dead code (keep the surface honest).

**Verify** `typecheck`; tenant-isolation behaviour unchanged. This item should be
done **together with / right after FE-1** since they touch the same code.

---

## X-2 — Share types between client and Functions **[X]**

**Where** `src/types/*.ts` vs. `functions/src/lib/types.ts` (the latter literally
says *"Mirrored types … no shared package yet"*).

**Problem** `ExpenseRequest`, `Quotation`, `RequestApproval`, `RequestNote`,
`Disbursement`, `BudgetWindow`, `ApprovalTier`, `Role`, `PaymentMode`,
`TransactionSourceType`, etc. are defined twice with hand-kept parity. They have
already diverged in small ways (e.g. client `ExpenseRequest` has
`approvalCount`/`approvedBy`; server omits them — and `fundHead` is `FundCode` on
the client but `string` on the server).

**Fix** Create a shared package (e.g. `packages/shared-types` or a `src/shared`
referenced by both via tsconfig path / workspace). Move the domain types and the
callable input/output contracts there; import from both sides. This also unblocks
X-3 and FE-3's "stretch".

**Caveat for the implementer:** timestamp types differ by SDK
(`firebase/firestore` `Timestamp` vs `firebase-admin` `Timestamp`/`FieldValue`).
Keep timestamp fields generic (e.g. a `TimestampLike` alias) in shared types and
specialise at the edges, or keep write-vs-read variants. Don't force-merge the
timestamp unions in a way that breaks either SDK's typings.

**Verify** Both `typecheck` (root) and `cd functions && tsc` pass; no behavioural
change.

---

## X-3 — Unify `resolveTier` — the two copies disagree **[X] [BUG]**

**Where** `src/lib/approvalTiers.ts` (client) and
`functions/src/lib/tierHelpers.ts` (server).

**Problem** Two implementations of the same rule with a **semantic divergence at
tier boundaries**:
- Client: `amountPaise < t.maxPaise` (max **exclusive**).
- Server: `estCostPaise <= t.maxPaise` (max **inclusive**).

For an amount exactly equal to a tier's `maxPaise`, the UI can show one required-
approver count while the server enforces a different one. Since approvals are the
core financial control, this is a correctness bug, not just duplication.

**Fix** Move one canonical `resolveTier` into the shared package (X-2) and import
it on both sides. **Decide the boundary semantics deliberately** and document it in
`architecture-design-requirements.md` (D9). Given tiers are validated as
contiguous (`max[n] === min[n+1]`, client `validateTiers`), the half-open
convention `min <= x < max` (last tier open-ended) is the consistent choice — make
**both** sides use it. Add a unit test at the exact boundary value.

**⚠️** This is the one item that *changes behaviour* on the server for boundary
amounts. Call it out in the PR and add a regression test
(`estCostPaise === tier.maxPaise`).

**Verify** New boundary unit test passes on both sides; existing tier tests
updated to match the documented convention.

---

## X-4 — Consistent audit logging across money mutations **[X] [BEHAVIOUR CHANGE]**

**Where** `recordPayment.ts` and `markInstancePaid.ts` write a `transactions` doc
but **do not** call `writeAudit`, whereas every expense-request mutation does.

**Problem** Not duplication, but an inconsistency surfaced by reading all
callables side by side: two money-movement paths skip the audit trail. For a
financial product the audit log should cover every ledger write.

**Fix** Add `writeAudit(...)` to `recordPayment` and `markInstancePaid` (new
`AuditAction` values, e.g. `'transaction_recorded'`, `'recurring_instance_paid'`).
Extend the `AuditAction` union in `audit.ts`. Confirm with the spec owner that
these belong in scope before landing (tag as behaviour change).

**Verify** functions suite + a new test asserting an `auditLogs` doc is written
for each path.

---

## Minor / low-priority cleanups

- **money.ts `addPaise`/`subtractPaise`** are `(a, b) => a + b` / `a - b`. They
  add no safety over the operator and are barely used — either inline them or give
  them real validation (e.g. assert integer inputs). Don't expand the API for its
  own sake.
- **`toISODate` in `date.ts`** uses `toISOString().slice(0,10)`, which is **UTC**.
  In `asia-south1`/IST this can render the previous day near midnight. Not a
  duplication issue, but worth a `[BUG]` follow-up: format using local date parts.
- **Hardcoded empty-state copy** ("No accounts yet.", "No fund heads yet.")
  bypasses i18n in the settings pages — fold into the EmptyState component / `t()`
  while doing FE-4 (`DESIGN_LANGUAGE.md` requires all copy via i18n).
- **`useNotifications.AppNotification`** is a bespoke local type; once X-2 exists,
  source it from shared types.

---

## Suggested execution order (dependency-aware)

1. **FE-2**, **FN-2**, **FN-3**, **FN-6**, **FN-7** — pure, low-risk, no API
   surface change. Quick wins.
2. **FN-1** — guard extraction (watch error-message assertions).
3. **FN-4**, **FN-5** — functions logic de-dup.
4. **X-2** (shared types) — unlocks the rest.
5. **FE-3** (typed callables, now from shared types).
6. **X-1 + FE-1** (data-access layer + generic hooks) — do together.
7. **FE-4** (settings page scaffold).
8. **X-3** (resolveTier unification) — **[BUG]**, needs a decision + regression test.
9. **X-4** (audit consistency) — **[BEHAVIOUR CHANGE]**, needs spec sign-off.
10. Minor cleanups.

## Definition of done for each item
- **The Testing gate at the top of this file passes in full** — and the results are
  recorded in the PR. This is non-negotiable; treat an item as not-done until it does.
- `lint` + `typecheck` clean (root **and** `functions/`).
- `npm run check:ux` zero hits.
- Affected unit / rules / functions / e2e tests pass; new tests added where an
  item says so (every **[BUG]**, **[BEHAVIOUR CHANGE]**, and new shared module).
- `docs/TEST_PLAN.md` updated and the relevant boxes checked **only when verified**.
- No new client writes to derived/ledger/audit collections.
- Public hook/return shapes and (unless tagged) error codes & messages unchanged.
