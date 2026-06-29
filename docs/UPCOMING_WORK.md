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

### D1. Security-rules test harness + coverage *(central `CLAUDE.md` requirement)*
- Install `@firebase/rules-unit-testing`; wire a `test:rules` script and (if feasible) the Firestore + Storage emulators. Phase 0 dropped emulators for lacking Java — revisit: either install Java in CI or use the rules-unit-testing in-memory harness.
- Author rules tests for **every** collection in `firestore.rules` and path in `storage.rules`: cross-society read/write denial, the role matrix (admin/fm/mc/resident), and Functions-only collections (`transactions` / `balances` / `auditLogs` / `expenseRequests` writes = denied for clients).
- Add the stage to `.github/workflows/ci.yml` (see E4). Update `TEST_PLAN.md`.
- **Done when:** a rules test would fail if any society could read/write another's data or escalate role.

### D2. App Check on callables + Firestore + Storage
- Enable Firebase App Check (reCAPTCHA Enterprise/v3 for web; debug provider for local). Initialise in `src/lib/firebase.ts`; set `enforceAppCheck: true` on callable functions; turn on enforcement for Firestore + Storage in console.
- **Done when:** requests without a valid App Check token are rejected at all three boundaries; local dev uses the debug token.

### D3. Test the already-landed admin callables *(B1 / B2 / B3 are coded; tests are the gap)*
- `removeMembership` (B1): Functions tests for cross-society denial, last-admin guard, claim revocation, `user_removed` audit entry.
- `inviteUsersBulk` (B3): parser unit tests (`membersParser.ts`) + partial-failure reporting + role gating + cross-society denial.
- `importCollections` and `applyChargeModel` also ship without tests — add role-matrix + cross-society + paise-integrity tests.
- Audit viewer (B2): admin-only access / non-admin denied / export shape.
- **Done when:** no deployed callable lacks the cross-society + role-matrix tests the contract mandates.

### D4. Email-verification test *(B4 is implemented; test is the gap)*
- B4 feature is done (see Group B). Add the automated test: unverified email/password membership is **not** activated by `refreshClaims`; verified one is; Google sign-in bypasses.
- **Done when:** the verification gate is pinned by a test that would fail if activation no longer required `email_verified`.

### D5. Separate production Firebase project
- Create a dedicated prod project; move `.firebaserc` to multi-target (`dev` / `prod`); parameterise web config via env. Lock prod IAM; enable Firestore PITR/backups (see E5). Keep seed/dev data out of prod (see E3).
- **Done when:** dev/test and prod are isolated projects with separate data, IAM, and deploy targets.

## Group E — Operational hardening (before / shortly after first external society)

### E1. Close audit-trail holes on money movement *(matches X-4)*
- Add `writeAudit(...)` to `recordPayment.ts` and `markInstancePaid.ts` (new `AuditAction` values, e.g. `transaction_recorded`, `recurring_instance_paid`). Tests assert an `auditLogs` doc per ledger write.

### E2. Wire transactional email transport
- Replace the `notify.ts` email stub with a real adapter (e.g. Firebase "Trigger Email" extension or a provider) behind `dispatchNotification`, so approval/disbursement events reach members who aren't in-app. Respect opt-in. (WhatsApp stays deferred — S4F.)

### E3. Strip dev-only functions from prod
- Gate or remove `seedDashboardData` and `generateRecurringInstances` from the prod deploy (env flag, or exclude from `functions/src/index.ts` in prod). Keep them for dev only.

### E4. Harden CI to the definition of done
- Add `npm run check:ux` (zero hits) and the `test:rules` stage (D1) to `.github/workflows/ci.yml`; add axe/e2e (Playwright) stages as those land. Optionally gate deploys on green CI.

### E5. Error monitoring, logging & backups
- Add error monitoring (Sentry or Firebase Crashlytics-for-web equivalent) on the client and structured logging/alerting on Functions failures. Enable scheduled Firestore exports / PITR for the prod project.

### E6. Rate limiting / abuse guards on callables
- Add per-caller rate limiting to invite/bulk-invite (and other write callables) — App Check (D2) plus a lightweight counter or Firebase App Check + quota. Prevents invite spam and enumeration.

### E7. Hosting security headers
- Add CSP/HSTS/`X-Content-Type-Options`/`Referrer-Policy` and sensible cache headers to `firebase.json` hosting config.

---

## Suggested sequencing

- **Group A** ✅ DONE — A1, A2, A3 all implemented (tests still to be added under D1/TEST_PLAN).
- **Group B** ✅ feature-complete — B1, B2, B3, B4 implemented; their tests are pulled into D3/D4.

Remaining, in order:

1. **Group D blockers** — D1 (rules tests) → D2 (App Check) → D3 (tests for the landed callables) → D4 (email-verification test) → D5 (prod project). These gate opening the app to other societies.
2. **Group E** (E1–E7) — operational hardening, around first external onboarding.
3. **C1** — last; needs the logged design decision first.
