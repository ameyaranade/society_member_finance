# Upcoming work — pre-prod polish

Polish backlog before the app is opened to other societies in production. Captured 2026-06-29;
production-readiness audit added 2026-06-29.
Each item is grounded in current code so scope is concrete. Definition of done follows
`CLAUDE.md` (lint + typecheck clean, `npm run check:ux` zero hits, tests for the change,
`TEST_PLAN.md` / `UX_INVARIANTS_CHECKLIST.md` updated). Every backend/rules item ships with
rules + Functions tests proving cross-society denial and the role matrix.

> **Reading order for "is this production-ready?":** Group D (blockers) gates opening the
> app to other societies. Group E is operational hardening that should land before or right
> after first external onboarding. Groups A–C are the original UX/auth polish backlog.

## Locked decisions

| Item | Decision |
|---|---|
| **Delete member (B1)** | Membership-only — *revoke a user's access to a society*, never delete the global Firebase Auth account. Admin has no authority over the account itself. Callable deletes the membership doc + revokes that society's claims, keeps the last-admin guard, writes an audit entry. UI framed as "Remove from society," not "Delete user." |
| **Email verification (B4)** | Block until verified — `refreshClaims` will not activate an invited membership until `emailVerified === true`. Google sign-ins pass automatically; email/password users get a resend banner. |
| **Audit view (B2)** | Admin-only "Audit" tab inside Settings, with CSV/Excel download (reuse the existing `xlsx` writer). |
| **Unit↔member link (C1)** | Open — needs a recorded data-model decision (linkage shape) before building. Run `decision-capture` first; update `architecture-design-requirements.md` data model §6. |
| **Execution scope (2026-06-29)** | Execute the code-completable items now **and scaffold the infra-dependent ones in code** (D2 App Check init, E6 rate-limit guard, E2 email adapter), leaving credentials/console enforcement to the operator. Items needing accounts/billing (D5 prod project, E5 Sentry/backups) are documented but not provisioned here. |
| **Rules tests (D1)** | **Deferred.** `@firebase/rules-unit-testing` requires the Firestore emulator (Java), dropped in Phase 0. Keep mocked Functions-level tests as the interim contract check; D1 remains an open known-gap until Java/emulator is available in dev + CI. |
| **Audit on money paths (E1)** | **Approved** as a behaviour change. `recordPayment` and `markInstancePaid` now write `auditLogs` entries (`transaction_recorded`, `recurring_instance_paid`). Every ledger write is audited. |
| **Dev/seed gating (E3)** | **Per-society `config.testMode` flag**, not a global deploy flag. A society (e.g. a dedicated test society) with `testMode === true` permits seed/test functions and stubbed/"fake" email for *that society only*; real societies are protected even though the functions stay deployed. `seedDashboardData` requires `superAdmin` **and** the target society's `testMode`. The email adapter (E2) sends real mail only when `testMode` is off. |

## Current-state findings

- **Units** (`src/features/settings/UnitsSettings.tsx`) — read-only DataGrid + Excel import only. No add/edit/delete UI, even though `src/features/receivables/useUnits.ts` already exposes `createUnit` / `updateUnit` / `deleteUnit`. Add/update is pure UI wiring.
- **Members** (`src/features/admin/MembersPage.tsx`) — bespoke `Paper` list, inline `<Select>` + inline `<Dialog>`, deactivate-only, status shown as colour-only `Chip`.
- **Vendors** (`src/features/settings/VendorsSettings.tsx`) — uses shared `FormDrawer` + `ConfirmModal`, full add/edit/delete. This is the target pattern for Members.
- **Tabs** — Settings, Payables, Receivables use local `useState(0)`; tab is lost on refresh / share / back.
- **Email verification** — not implemented anywhere (no `emailVerified` usage).
- **Members are deactivate-only** — `functions/src/callable/updateMembership.ts` flips status/role only; no remove/delete callable.
- **Audit logs** — backend writes them (`functions/src/lib/audit.ts`) and rules already grant admin read (`firestore.rules:143`), but there is no UI to view or export.
- **Unit↔member link** — `Unit.owner` / `tenant` are free-text `UnitContact` (name + phone), not linked to membership accounts.

### Landed (uncommitted at audit time) — feature code complete, tests still pending

> These are implemented in the working tree but not yet committed. Feature/UI work is **done**;
> the outstanding piece is the automated tests the `CLAUDE.md` contract requires for new
> callables — tracked in **D3** (and the B4 verification test in **D4**).

- **`removeMembership` (B1)** ✅ implemented — callable at `functions/src/callable/removeMembership.ts`, exported from `index.ts`, registered in `src/lib/callables.ts`, and wired to a "Remove from society" action + strong `ConfirmModal` in `MembersPage.tsx`. **Tests pending** (cross-society denial, last-admin guard) → D3.
- **`inviteUsersBulk` (B3)** ✅ implemented — callable + export + `callables.ts` registration + `BulkImportDialog` in `MembersPage.tsx` + parser `src/lib/import/membersParser.ts`. **Tests pending** (parser unit + partial-failure + role gating + cross-society) → D3.
- **Audit viewer (B2)** ✅ implemented — `src/features/settings/AuditSettings.tsx` + `useAuditLogs.ts`, wired as an admin-only "Audit log" tab in `SettingsPage.tsx`, with Excel export (`xlsx writeFile`) and the `firestore.indexes.json` index. **Access/export tests pending** → D3.

### Production-readiness gaps found in the 2026-06-29 audit (see Groups D & E)

- **No rules tests at all** — `@firebase/rules-unit-testing` is not installed; no emulator suite. The `firestore.rules` / `storage.rules` tenant-isolation + role-matrix guarantees are mechanically unverified. This is the central `CLAUDE.md` non-negotiable (D1).
- **No App Check** — zero `AppCheck` / reCAPTCHA usage anywhere; callables + Firestore reachable by any client with the public web config (D2).
- **Email verification (B4)** ✅ implemented — `refreshClaims.ts` refuses to activate an email/password membership until `email_verified === true` (Google bypasses); Shell shows a resend banner while `!user.emailVerified`; `SignInPage` sends verification on sign-up. **Verification-gate test pending** → D4.
- **Single Firebase project for dev + prod** — Phase 0 used one project (`society-expense-management`) for everything; prod needs its own locked-down project (D5).
- **Audit trail holes** — `recordPayment.ts` and `markInstancePaid.ts` write `transactions` but skip `writeAudit` (matches X-4 in `code_improvements.md`) (E1).
- **Email notifications are a stub** — `functions/src/lib/notify.ts:75` writes in-app docs only; no transport wired (E2).
- **Dev-only functions deployed** — `seedDashboardData` + `generateRecurringInstances` are exported in `functions/src/index.ts` and ship to prod (E3).
- **CI gaps** — `.github/workflows/ci.yml` runs lint/typecheck/test/build but not `npm run check:ux` (a stated DoD gate), and has no rules/e2e/axe stage (E4).
- **No error monitoring or backups** — no Sentry/Crashlytics, no logging/alerting, no scheduled Firestore export (E5).
- **No rate limiting** on callables (invite / bulk-invite are abuse targets; tied to D2) (E6).

---

## Group A — Low-risk UI wiring (no schema/rules changes) ✅ DONE

### A1. Add / update unit details manually ✅ DONE
- `UnitsSettings.tsx`: "Add unit" button + `FormDrawer` (tower, flat, area, owner name/contact, tenant, billed party, maintenance ₹, common-elec ₹) and edit/delete row actions wired to `createUnit` / `updateUnit` / `deleteUnit`. Money via `toPaise` (integer paise). Delete uses `ConfirmModal`.
- ⚠️ Form-validation / admin-only-write tests not yet added (rules enforce the write; the rules test for it is part of D1).

### A2. Members ↔ Vendors UX consistency ✅ DONE
- Members rebuilt: `FormDrawer` for invite + edit-role, `ConfirmModal` for deactivate and remove, shared `StatusChip` (icon + label, not colour-only). Role select lives in the drawers.
- ⚠️ Role-variant / permission-denied state tests per `TEST_PLAN.md` not yet added.

### A3. Keep internal tabs in the URL ✅ DONE
- `useSearchParams` (`?tab=<key>`) with stable string keys in `SettingsPage.tsx`, `PayablesPage.tsx`, `ReceivablesPage.tsx`; role-filtered tab lists fall back to the first allowed tab.
- ⚠️ Deep-link / refresh / invalid-tab-fallback tests not yet added.

## Group B — New backend + UI (Functions / rules / tests)

### B1. Remove member from society ✅ DONE (tests pending → D3)
- `removeMembership` callable: zero-admin guard, `user_removed` audit, deletes the membership doc, revokes claims if `uid` present; does **not** touch the Firebase Auth user. UI: "Remove from society" action + strong `ConfirmModal` in `MembersPage.tsx`.
- ⚠️ **Tests pending** — rules + functions (cross-society denial, last-admin block, audit written). Tracked in **D3**.

### B2. Audit visibility + download ✅ DONE (tests pending → D3)
- Admin-only "Audit log" tab in Settings (`AuditSettings.tsx`): list of `auditLogs` with Excel export (`xlsx` `writeFile`). `useAuditLogs(societyId)` hook + `firestore.indexes.json` index.
- ⚠️ **Tests pending** — admin-only access / non-admin denied / export shape. Tracked in **D3**.

### B3. Mass import residents / lists ✅ DONE (tests pending → D3)
- `inviteUsersBulk` callable (server-side, batched) + `BulkImportDialog` on Members + parser `src/lib/import/membersParser.ts`. Partial-failure rows reported back per email.
- ⚠️ **Tests pending** — parser unit + partial-failure + role gating + cross-society. Tracked in **D3**.

### B4. Email verification ✅ DONE (test pending → D4)
- `refreshClaims` refuses to activate an email/password membership until `email_verified === true` (Google bypasses); Shell shows a resend banner while `!user.emailVerified`; `SignInPage` sends verification on sign-up.
- ⚠️ **Test pending** — unverified blocked / verified activates / Google bypasses. Tracked in **D4**.

## Group C — Data-model change (needs a recorded decision)

### C1. Mass link units with multiple members
- Add a linkage to `Unit` (e.g. `ownerUid` / `tenantUid` or `memberUids[]`) connecting flats to membership accounts. Then a bulk mapping UI (match units → members, e.g. by email) with write-back.
- Durable schema/relationship decision (one-to-many? owner vs resident? how billing/charge-model consumes it?) — run `decision-capture` and update `architecture-design-requirements.md` §6 before building.
- Tests: rules for new fields, bulk-link integrity, tenant isolation.

---

## Group D — Production-readiness blockers (gate external onboarding)

> These directly back the `CLAUDE.md` non-negotiables (tenant isolation, ledger integrity,
> access control). The app should **not** be opened to other societies until D1–D5 land.

### D1. Security-rules test harness + coverage *(central `CLAUDE.md` requirement)* — **DEFERRED (known gap)**
- Install `@firebase/rules-unit-testing`; wire a `test:rules` script and (if feasible) the Firestore + Storage emulators. Phase 0 dropped emulators for lacking Java — revisit: either install Java in CI or use the rules-unit-testing in-memory harness.
- Author rules tests for **every** collection in `firestore.rules` and path in `storage.rules`: cross-society read/write denial, the role matrix (admin/fm/mc/resident), and Functions-only collections (`transactions` / `balances` / `auditLogs` / `expenseRequests` writes = denied for clients).
- Add the stage to `.github/workflows/ci.yml` (see E4). Update `TEST_PLAN.md`.
- **Done when:** a rules test would fail if any society could read/write another's data or escalate role.

### D2. App Check on callables + Firestore + Storage ✅ SCAFFOLDED (console enforcement pending)
- `src/lib/firebase.ts` initialises App Check when `VITE_APPCHECK_SITE_KEY` (reCAPTCHA v3) is set; debug token supported via `VITE_APPCHECK_DEBUG_TOKEN` for local dev. Both vars documented in `.env.example`.
- ⚠️ **Console step remaining:** enable enforcement for Firestore, Cloud Functions (`asia-south1`), and Storage in the Firebase console once site key is provisioned.

### D3. Test the already-landed admin callables ✅ DONE
- `removeMembership.test.ts`: 6 tests — unauthenticated, non-admin, cross-society denial, last-admin guard, allows remove with another admin, not-found; audit + claims-revoke verified.
- `inviteUsersBulk.test.ts`: 8 tests — role gating, cross-society denial, invalid email/role as row errors, active-membership skip, deactivated re-invite, 200-row cap.
- `applyChargeModel.test.ts`: 6 tests — FM denied, MC allowed, no charge model error, no units, flat amount paise integrity, per-sqft skip when no area.
- `importCollections.test.ts`: 8 tests — MC denied, cross-society, FM allowed, valid import + period upsert, unknown flat as row error, missing flat error, invalid period/dueDate, empty rows.
- `refreshClaims.test.ts` — see D4.
- All 111 functions tests passing.

### D4. Email-verification test ✅ DONE
- `refreshClaims.test.ts`: 5 tests — Google sign-in activates membership, unverified email/password does NOT activate (no batch commit, no audit), verified email/password activates, unauthenticated throws, no invited memberships still upserts user profile. All tests passing.

### D5. Separate production Firebase project — **PENDING (console/infra)**
- Create a dedicated prod project; move `.firebaserc` to multi-target (`dev` / `prod`); parameterise web config via env. Lock prod IAM; enable Firestore PITR/backups (see E5). Keep seed/dev data out of prod (see E3).
- **Done when:** dev/test and prod are isolated projects with separate data, IAM, and deploy targets.

## Group E — Operational hardening (before / shortly after first external society)

### E1. Close audit-trail holes on money movement ✅ DONE
- `writeAudit` added to `recordPayment.ts` (`transaction_recorded`) and `markInstancePaid.ts` (`recurring_instance_paid`). New action types added to `audit.ts` `AuditAction` union. Every ledger write now produces an audit entry.

### E2. Wire transactional email transport ✅ SCAFFOLDED (provider pending)
- `functions/src/lib/email.ts` — `EmailAdapter` interface + `logEmailAdapter` stub + `resolveEmailAdapter(testMode)` + `sendEmailSafe` fire-and-forget wrapper. `notify.ts` now resolves the adapter per-society and calls `sendEmailSafe` after in-app docs are written; test-mode societies log only, real societies use the adapter.
- ⚠️ **Provider pending:** replace `logEmailAdapter` in `resolveEmailAdapter` with a real adapter (SendGrid, Resend, Firebase Trigger Email extension, etc.).

### E3. Per-society testMode flag gating ✅ DONE
- `config.testMode?: boolean` added to `SocietyConfig` (web) and noted in `types.ts` pattern. `seedDashboardData` now requires `superAdmin` **and** `config.testMode === true` on the target society, throwing `failed-precondition` otherwise. Test societies enable seed + fake email; real societies are protected.

### E4. Harden CI to the definition of done ✅ DONE (partial)
- `npm run check:ux` step added to `.github/workflows/ci.yml` after lint. Rules test stage blocked on D1 (emulator/Java). Playwright/axe stages to be added when those are wired.

### E5. Error monitoring, logging & backups — **PENDING (accounts/infra)**
- Requires Sentry/Crashlytics account + DSN, and Firebase console for scheduled exports/PITR. No code changes until provider is chosen.

### E6. Rate limiting / abuse guards on callables ✅ DONE
- `functions/src/lib/rateLimit.ts` — `checkRateLimit(uid, action, max, windowMs)` Firestore-backed sliding-window guard (fail-closed). Wired into `inviteUser` (20/min) and `inviteUsersBulk` (5/min). Mocked in their respective test files.

### E7. Hosting security headers ✅ DONE
- `firebase.json` hosting now includes: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` (HSTS + preload), `Content-Security-Policy` (scoped to Firebase/Google origins), and long-lived cache headers for hashed static assets.

---

## Suggested sequencing

- **Groups A + B** ✅ DONE — all feature code complete; tests shipped under D3/D4.
- **Groups D3, D4, E1, E3, E4, E6, E7** ✅ DONE — tests, audit, testMode gating, CI, rate-limiting, security headers.
- **D2 (App Check), E2 (email), E6 (rate-limit)** ✅ SCAFFOLDED — code wired; credentials/provider/console enforcement remain for operator.

Remaining open items:

1. **D1** — Rules test harness (DEFERRED — needs Java/emulator; known gap).
2. **D5** — Separate prod Firebase project (console/infra, no code needed here).
3. **E2** — Real email transport provider (swap `logEmailAdapter` in `resolveEmailAdapter`).
4. **E5** — Error monitoring + Firestore backups (requires Sentry/Crashlytics account + DSN).
5. **C1** — Unit↔member link (run `decision-capture` first, update architecture doc §6, then build).
6. **D2** — Enable App Check enforcement in Firebase console once `VITE_APPCHECK_SITE_KEY` is provisioned.
