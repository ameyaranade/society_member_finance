# Development Plan

**Project:** Multi‑Society Financial Management Web Application
**For:** an AI coding agent (e.g. GPT) to execute step‑by‑step.
**Companion docs:** [architecture-design-requirements.md](architecture-design-requirements.md) (data model §6, functions §7, rules §9, decisions D1–D9d), [DESIGN_LANGUAGE.md](DESIGN_LANGUAGE.md), [TEST_PLAN.md](TEST_PLAN.md) (state-machine test coverage), [UX_INVARIANTS_CHECKLIST.md](UX_INVARIANTS_CHECKLIST.md) (per-change review gate), [functional-spec-draft.md](functional-spec-draft.md).
**Last updated:** 2026-06-22

---

## How to use this plan

- Execute steps **in order** — each builds on the previous. Dependencies are noted where they cross phases.
- **One step = one PR = one verifiable outcome.** Do not start the next step until the current step's **Verify** passes.
- Every step lists **Do** (the single action) and **Verify** (objective, testable acceptance).
- Treat the companion docs as the source of truth for schema, function contracts, rules, roles, and visual design. This plan references them rather than repeating them.

### Priorities
- **P0 (must‑have first):** Authentication + Authorization → Phase 2.
- **P1 (next):** Payables / Payments tab → Phase 3.
- **Later:** Receivables, dashboard, forecasting, residents, BigQuery, WhatsApp → Phase 4.
- Phases 0 and 1 are prerequisites that unblock P0.

### Stack (fixed — see D1–D3b)
React 18 + TypeScript + Vite · MUI v6 + MUI X DataGrid · Firebase (Auth, Firestore Native, Cloud Functions Node 20 Gen 2, Storage, Hosting) · region `asia-south1` · Firebase Emulator Suite · i18n via react‑i18next + `Intl`.

### Definition of done (applies to EVERY step)
1. TypeScript compiles, `lint` + `typecheck` clean.
2. Tests for the step pass: **Vitest** (units), **@firebase/rules-unit-testing** (rules), **Firebase emulators** (functions/integration), and e2e (Playwright) where UI is involved. New surfaces/states are added to [TEST_PLAN.md](TEST_PLAN.md) and verified; the change passes [UX_INVARIANTS_CHECKLIST.md](UX_INVARIANTS_CHECKLIST.md).
3. Money is integer **paise**; amounts never use floats.
4. UI steps use **theme tokens + shared components** (no hard‑coded colours/sizes), pass **axe** a11y, render in **light + dark**, and use **i18n** strings.
5. No client writes to derived/ledger/audit collections; trusted mutations go through Cloud Functions.
6. CI is green.

---

## Phase 0 — Project & infrastructure setup ✅ DONE

> **Simplification applied:** Firebase Emulator Suite dropped (requires Java). Testing uses Vitest with mocks; rules deployed and tested against real Firebase project. Single Firebase project for dev.

**S0.0 — Guardrail wiring.** ✅
CLAUDE.md, `npm run check:ux` (Layer A checks), husky pre-commit hook wired.

**S0.1 — Scaffold the web app.** ✅
Vite + React + TS, `src/{app,features,components,lib,theme,i18n,types}` folder structure, ESLint + Prettier + strict tsconfig, Firebase SDK init (`src/lib/firebase.ts`), default-deny `firestore.rules` + `storage.rules`.

**S0.2 — MUI baseline + theme mode.** ✅
MUI v6 + X DataGrid + icons installed. `ThemeModeProvider` with system-preference detection, localStorage persistence, and light/dark toggle. `S1.2` (theme mode switch) also completed here.

**S0.3/S0.4 — Firebase init + SDK connection.** ✅
Single Firebase project `society-expense-management`, `asia-south1`. Firebase SDK connected directly (no emulator gating). `.firebaserc` + `firebase.json` committed.

**S0.5 — Functions workspace + ping.** ✅
`functions/` workspace (TS, Node 20, Gen 2). `ping` callable at `asia-south1`. Predeploy build hook in `firebase.json`. Unit test with mocked handler passes.

**S0.6 — Test harness.** ✅
Vitest for web (jsdom + matchMedia stub + @testing-library/react) and functions (node env, mocked Firebase). `functions/` excluded from root Vitest. 5 tests passing across both workspaces.

**S0.7 — CI pipeline.** ✅
`.github/workflows/ci.yml`: install → lint → typecheck (web + functions) → test (web + functions) → build, on push/PR to main.

**Deploy status:** Hosting live at https://society-expense-management.web.app. Firestore rules + Functions pending Blaze plan upgrade + Firestore API enablement.

---

## Phase 1 — Foundations (theme, i18n, shared kit, data/rules harness) ✅ DONE

**S1.1 — Theme tokens (light + dark).**
Do: Implement the DESIGN_LANGUAGE.md semantic tokens as an MUI theme with `light`/`dark` palettes, typography (rem scale + Inter/Noto stack), shape, spacing; `cssVariables: true`.
Verify: a tokens gallery renders correctly in both modes; contrast spot‑checks meet AA.

**S1.2 — Theme mode switch.** ✅ (completed in S0.2)
System preference detection + localStorage persistence + toggle button. Verified: persists across reload, respects `prefers-color-scheme`.

**S1.3 — i18n + formatting.** ✅
`react-i18next` with `en` locale (`src/i18n/en.json`). `formatMoney`/`toPaise`/`fromPaise` (integer paise, never floats). `formatDate`/`formatMonthYear`/`toISODate` via `Intl`. 17 unit tests passing.

**S1.4 — Shared UI kit.** ✅
`StatusChip` (icon+label, all 9 variants), `MetricTile`, `FormDrawer` (right drawer), `ConfirmModal`, `EmptyState`/`LoadingRows`/`ErrorState`, `InlineBanner`. Component tests pass.

**S1.5 — App shell + routing.** ✅
`Shell` with fixed AppBar (brand, theme toggle, user menu icon), persistent side nav (desktop) / temporary drawer (mobile), `react-router-dom` v6 with routes for Dashboard/Payables/Receivables/Members/Settings/`_gallery`. `NotFound` page. Shell renders at mobile + desktop; keyboard nav works.

**S1.6 — DataGrid wrapper.** ✅
`AppDataGrid` wraps MUI X DataGrid with comfortable density, ARIA label, pagination defaults, and stage-then-save bar (shows when `isDirty=true`, save/discard callbacks).

**S1.7 — Typed data-access layer.** ✅
`src/lib/db.ts` — `societyCollection`/`societyDoc`/`societyQuery` helpers that auto-scope every query to `societyId`. CRUD helpers (`fetchDocs`, `fetchDoc`, `createDoc`, `upsertDoc`, `patchDoc`, `removeDoc`). `COLLECTIONS` registry. 4 unit tests assert society-scoped paths.

**S1.8 — Security-rules baseline.** ✅
`firestore.rules` with helpers `isSignedIn / isSuperAdmin / isMember / hasRole / isAdminOrMC / isAdminOrFM`. Per-collection rules for all 10 collections. `transactions`/`balances`/`auditLogs` are `write: if false` (Functions-only). Default-deny catch-all at bottom.

---

## Phase 2 — P0: Authentication & Authorization

> **Simplifications applied:** No emulators (no Java). `onMembershipWrite` trigger replaced by `refreshClaims` callable (called client-side after sign-in). Claims set by `refreshClaims` + `updateMembership`. Multi-society memberships stored at top-level `/memberships/{uid_societyId}`. Zero-admin guard enforced in `updateMembership`. Society switcher deferred (UI only shown if user has >1 society — data model already supports it).

**S2.1 — Identity data models.** ✅
Types + Firestore converters: `UserProfile`, `Membership`, `Society`, `SocietyConfig`, `AuthClaims` in `src/types/auth.ts`. Converters in `src/lib/converters.ts`. `topCollection`/`topDoc` helpers in `db.ts`. `COLLECTIONS.memberships` updated to top-level path.

**S2.2 — Claims callable (`refreshClaims`).** ✅
`functions/src/callable/refreshClaims.ts` — links invited memberships by email on sign-in, stamps UID, activates, sets custom claims `{ societyId, role, societies }`. Called automatically by `AuthProvider` when claims are absent. `claims.ts` helper also used by `updateMembership`.

**S2.3 — Enable auth providers.** ✅
Email/password + Google (`GoogleAuthProvider` + `signInWithPopup`). `sendPasswordResetEmail` wired. Phone OTP deferred to S4I.

**S2.4 — Auth UI + context.** ✅
`SignInPage` (email/password form + Google button + forgot-password reset flow). `AuthProvider` + `AuthContext` exposing `user`, `claims`, `societyId`, `role`, `isSuperAdmin`, `loading`. Sign-out in Shell user menu. 4 SignInPage tests pass.

**S2.5 — Route protection + RBAC guard.** ✅
`RequireAuth` (spinner while loading, redirect to `/sign-in`), `RequireSociety` (redirect to `/no-society` if no societyId in claims), `RequireRole` (redirect to `/forbidden`). `NoSociety` + `Forbidden` pages added. Routes updated.

**S2.6 — `createSociety` (super‑admin).** ✅
`functions/src/callable/createSociety.ts` — validates societyId slug, creates society doc + config skeleton + first admin membership (invited, no uid). Enforces super-admin claim. 4 unit tests pass (including cross-society deny + duplicate guard).

**S2.7 — `inviteUser` (admin).** ✅
`functions/src/callable/inviteUser.ts` — admin-only, creates membership doc with status `invited`. Re-invite of deactivated users supported. 4 unit tests (cross-society deny + active membership guard + role validation).

**S2.8 — RBAC security rules + tests.** ✅
`firestore.rules` updated: top-level `/memberships` (Functions-only writes; user reads own; admin reads society's); `/users` (own + superAdmin); `/societies` + all sub-collections. `updateMembership` callable enforces zero-admin guard (13 function tests total green). Rules deployed via `--only hosting`; Firestore rules deployment pending Blaze plan + Firestore API enablement.

**S2.9 — Super‑admin onboarding console.** ✅
`src/features/admin/SuperAdminPage.tsx` — form to create a society (ID slug, name, address, reg-no, total units, first admin email). Calls `createSociety` callable. Accessible at `/super-admin`; linked in nav for super-admins only. Super-admin claim must be set once via Firebase Admin SDK / console (`setCustomUserClaims(uid, { superAdmin: true })`).

**S2.10 — Admin user‑management screen.** ✅
`src/features/admin/MembersPage.tsx` (route `/members`) — lists all memberships in the society with status chips (active/invited/deactivated), role selector (admin-only), deactivate/reactivate action, invite-member dialog (calls `inviteUser`). `useMemberships` hook queries top-level `/memberships` by `societyId`.

**S2.11 — Audit logging (auth/role events).** ✅
`functions/src/lib/audit.ts` — `writeAudit` helper writing to `societies/{id}/auditLogs` (Functions-only). Emitted for: `society_created` (createSociety), `user_invited` (inviteUser), `user_activated` (refreshClaims on first sign-in), `role_changed` / `user_deactivated` / `user_reactivated` (updateMembership). Clients cannot write auditLogs (rules: `write: if false`).

**S2.12 — P0 acceptance gate.** ✅
**All 5 Cloud Functions deployed** to `asia-south1`: ping, refreshClaims, createSociety, inviteUser, updateMembership. Firestore rules + indexes deployed. Hosting live. **→ P0 complete.**

> **To onboard the first society:** sign in with the super-admin Google account, then in the Firebase console run `admin.auth().setCustomUserClaims(uid, { superAdmin: true })` once (or use the Admin SDK). After that, sign out + sign back in → `/super-admin` will be available in the nav.

---

## Phase 3 — P1: Payables / Payments tab

> Implements D9–D9d. Reuse the shell, grid, drawers, and StatusChip from Phase 1. Split into config/masters → ledger → recurring → expense requests → UI.

### 3a. Config & masters
**S3.1 — Society config + Settings shell.** ✅
Do: `societies/{id}.config` (currency, fyStartMonth) + Admin "General" settings panel.
Verify: e2e — admin edits FY/currency (saved); non‑admin denied (rules test).

**S3.2 — Accounts CRUD (Admin).** ✅
Do: `accounts` collection (bank/cash/sinking/petty, opening balance) + settings panel. (D13)
Verify: e2e CRUD; rules admin‑only.

**S3.3 — Fund heads CRUD (Admin).** ✅
Do: `fundHeads` collection (general/sinking/corpus/repair) + settings panel. (D14)
Verify: e2e CRUD; rules admin‑only.

**S3.4 — Approval‑tier editor + `resolveTier` util.** ✅
Do: `config.approvalTiers` editor (contiguous, ≥1 each, open‑ended top) + a pure `resolveTier(amount)` function; **quorum validation** — block saving a band whose `requiredApprovers` exceeds the society's active MC count. (D9)
Verify: unit tests at band edges (₹25k/₹50k/₹1L/>₹1L); quorum validation rejects an over‑MC band; rules admin‑only.

**S3.5 — Vendors CRUD.** ✅
Do: `vendors` collection + UI (FM/Admin write, MC read). (D8)
Verify: e2e CRUD; rules per role.

**S3.6 — Vendor relations.** ✅
Do: `vendorRelations` income/expense edge on a vendor.
Verify: e2e — a vendor carries both an income and an expense relation; rules.

### 3b. Ledger
**S3.7 — Transactions model + `recordPayment`.** ✅
Do: `transactions` model (direction, account, fund, mode, ref) + `recordPayment` callable that posts atomically; **manual/non‑request entries (opening balances, interest) are Admin‑only** (D9e). (D12)
Verify: smoke test — posted txn written with all fields; `currentBalancePaise` updated by trigger.

**S3.8 — `recomputeBalances` trigger.** ✅
Do: Firestore trigger maintaining `accounts.currentBalance` + `balances/{period}` per account & fund.
Verify: smoke test — posting a txn updates `accounts.currentBalancePaise` (opening + sum) and creates `balances/{period}` with correct `totalInPaise`.

### 3c. Recurring scheduled payments (D9b)
**S3.9 — Recurring template model + CRUD (Admin).** ✅
Do: `recurringPayments` template (category, vendor, monthlyAmount, dueDay, fund, account, active, start/end) + Admin CRUD UI.
Verify: e2e CRUD; rules admin‑only. ✅ 2 templates added via UI; active toggle verified.

**S3.10 — `scheduledRecurring` generation.** ✅
Do: Scheduled function materialising the period's `instances` from active templates. Also `generateRecurringInstances` callable for admin backfill/test.
Verify: 2 instances created for 2026-06 with correct dueDate/amountPaise; second call created 0 (idempotent). ✅

**S3.11 — Recurring monthly view.** ✅
Do: Monthly view with past + future navigation (past = instances, future = projection).
Verify: June 2026 → real instances (Pending, ₹40k total); July 2026 → projected banner; May 2026 → "no instances" warning. ✅

**S3.12 — FM execute + MC view‑only.** ✅
Do: `markInstancePaid` callable (Admin/FM) — writes transaction + marks instance paid atomically. Pay button in monthly view for Admin/FM; MC sees read-only view.
Verify: Security Guard Salary marked paid → status=paid, txnCount=2, summary shows Paid ₹15k / Pending ₹25k. ✅

### 3d. Expense requests — maintenance + snag (D9, D9a, D9c, D9d)
**S3.13 — Model + storage.** ✅
Do: `expenseRequests` + subcollections (`quotations`, `approvals`, `notes`, `disbursements`); Storage layout + rules.
Verify: types compile; storage rules tests — society‑scoped; residents denied.

**S3.14 — Maintenance create + quotations (FM).** ✅
Do: FM creates a maintenance request and uploads quotation docs.
Verify: e2e — request created in `requested` draft with quotations; FM‑only; files in scoped Storage.

**S3.15 — `submitExpenseRequest` (tier + submit).** ✅
Do: Resolve tier from `estCostPaise`, snapshot `requiredApprovers`, **validate `requiredApprovers ≤ active MC count`** (block if not), set `submittedAt`, move → `requested`. (D9)
Verify: emulator test — correct tier per amount; submit blocked when the tier needs more approvers than the society has MC members; `submittedAt` set; FM‑only.

**S3.16 — `scheduleSnag` (Admin) + budget window.** ✅
Do: Admin creates a snag in `scheduled` with `plan` (mode: month/quarter/year/custom/by_date). (D9c)
Verify: emulator test — admin schedules; FM cannot create a snag; window stored.

**S3.17 — Scheduled items view + snag withdraw.** ✅
Do: Admin "Scheduled items" view (grouped by window) + Admin withdraw of a scheduled snag.
Verify: e2e — scheduled snags grouped by window; admin withdraws; FM cannot.

**S3.18 — FM take‑up.** ✅
Do: FM adds quotations to a scheduled snag and submits (`scheduled` → `requested` via `submitExpenseRequest`).
Verify: emulator test — take‑up transitions correctly; FM‑only.

**S3.19 — Requested queue + index.**
Do: Shared **Requested queue** ordered by `submittedAt` (oldest→newest) with approval progress (X of N), visible to Admin/FM/MC; add `(status, submittedAt)` index. (D9d)
Verify: e2e — ordering by age; visible to all three roles; index deployed.

**S3.20 — `recordApproval` (MC, no reject).**
Do: Record one MC approval (+ optional note); at `requiredApprovers` → `approved` (sets `approvedAmountPaise`); no reject; no self‑approval. (D9, D9d)
Verify: emulator test — reaching N flips to approved; self‑approval denied; FM/Admin cannot approve.

**S3.21 — MC notes.**
Do: `notes` subcollection; MC adds notes on a request.
Verify: e2e — MC note visible to FM/Admin; rules enforce author/role.

**S3.22 — `recordDisbursement` (partial, capped, spend-gated).**
Do: FM posts partial/final disbursement (invoice + txn copy + evidence) → ledger txn; **reject unless status is `approved`/`disbursed`** (spend gate, D9e); reject if cumulative > `approvedAmountPaise` (D9a); set `disbursed`.
Verify: emulator test — disbursement before approval is rejected; partials accumulate; overflow rejected; ledger updated.

**S3.23 — Withdraw + close.**
Do: `withdrawExpenseRequest` (FM maintenance / Admin snag, only before any disbursement) + `closeExpenseRequest` (FM → `completed`).
Verify: emulator test — withdraw blocked after first disbursement; role checks.

**S3.24 — Notifications (in‑app + email).**
Do: `dispatchNotification` for submit/approval/withdraw/disburse events (in‑app docs + email stub). (D17)
Verify: emulator test — events fan out; in‑app docs created; email adapter invoked.

### 3e. Payables UI
**S3.25 — Payables shell + sub‑tabs.**
Do: Payables route with 3 sub‑tabs (Recurring | Maintenance | Snags) + role‑aware nav.
Verify: e2e — tabs render per role; axe.

**S3.26 — Maintenance list + filters.**
Do: Maintenance list with date‑range + status filters.
Verify: e2e — filters narrow results correctly.

**S3.27 — Snag list + scheduled integration + filters.**
Do: Snag list including scheduled items + window/status filters.
Verify: e2e — scheduled + active snags listed; filters work.

**S3.28 — 4‑stage request detail.**
Do: Request detail with stage tracker, quotation cards, approvals X/N, MC notes, partial‑disbursement list, and per‑role/stage actions.
Verify: e2e per role across the full lifecycle; matches mockups; axe; light + dark.

**S3.29 — Requested‑queue screen.**
Do: The aged Requested queue UI (from S3.19) with approve (MC) / withdraw (FM/Admin) actions.
Verify: e2e — actions work per role; ordering by age.

**S3.30 — P1 acceptance gate.**
Do: Full payables e2e across roles (tiered approvals, capped partials, requested queue, withdraw, recurring monthly).
Verify: e2e + rules + functions suites green. **→ P1 complete.**

---

## Phase 4 — Later features

### 4A. Receivables (collections + vendor income)
**S4A.1 — Units registry.**
Do: `units` model (flat, tower, area, owner + tenant, billedParty) + CRUD + bulk import of the 564 flats. (D7)
Verify: import populates units; CRUD works; rules per role.

**S4A.2 — Charge‑model config.**
Do: `config.chargeModel` editor (per_sqft / flat / tier), MC‑configurable. (D4)
Verify: config saved; tier/rate validated; rules.

**S4A.3 — `applyChargeModel`.**
Do: Function computing `units.maintenanceAmountPaise` from the charge model.
Verify: emulator test — recompute across all units; correct math per mode.

**S4A.4 — Collections model.**
Do: `collections/{period}` + `/entries/{unitId}` (billed, status, dueDate). (D5)
Verify: create a period; entries generated per unit; types.

**S4A.5 — `importCollections`.**
Do: Excel/CSV parser with configurable column mapping → write `entries`; validate + report row errors. (D6)
Verify: emulator test — imports a sample file; bad rows reported; idempotent per period.

**S4A.6 — Collections monthly grid.**
Do: DataGrid with filters (tower/flat/status/month), bulk mark‑paid, and record‑payment → ledger (`recordPayment`).
Verify: e2e — record payment posts a txn + updates status; multi‑row sheet edit; axe.

**S4A.7 — Pending list + export.**
Do: Pending‑payment list + Excel export.
Verify: e2e — pending list matches data; export downloads a valid file.

**S4A.8 — Vendor income.**
Do: `vendorIncome` model + monthly tracking + record receipt → ledger.
Verify: e2e — receipt posts a txn; report exports.

### 4B. Cash Balance Dashboard (Phase 2)
**S4B.1 — Cash position rollups.**
Do: Surface opening/income/expense/available per account + fund + total from `balances`.
Verify: emulator test — dashboard figures reconcile with the ledger.

**S4B.2 — Sankey visualization.**
Do: Income sources → allocation → balance Sankey with consistent category colours + a11y labels.
Verify: renders; legend; axe; light + dark.

**S4B.3 — Dashboard assembly.**
Do: Dashboard page = metric cards + Sankey + period switch.
Verify: e2e; numbers match; axe.

### 4C. Cash Flow Forecasting (Phase 3)
**S4C.1 — Forecast entries.**
Do: `forecasts` model + CRUD for future income/expense.
Verify: e2e CRUD; rules.

**S4C.2 — Forecast computation.**
Do: Projection of expected closing balance + surplus/deficit over month/quarter/year.
Verify: unit tests for projection math across horizons.

**S4C.3 — Forecast dashboard.**
Do: Timeline views (monthly/quarterly/yearly) + reports.
Verify: e2e; figures; axe.

### 4D. Resident access (Phase 2)
**S4D.1 — Publish mechanism + resident rules.**
Do: `published` flag on shareable dashboards/reports + resident security rules (own unit + published only).
Verify: rules tests — resident reads only published + own unit; no vendor docs.

**S4D.2 — Resident home (mobile‑first).**
Do: Own‑flat dues + payment ledger.
Verify: e2e — resident sees only their flat; axe; mobile layout.

**S4D.3 — Resident community view.**
Do: Read‑only published community summary.
Verify: e2e — no edit affordances; no confidential docs.

### 4E. Analytics (BigQuery — D3b)
**S4E.1 — Firestore→BigQuery export.**
Do: Install the managed export extension for key collections (transactions, expenseRequests, collections).
Verify: writes stream into the BQ dataset (staging).

**S4E.2 — Reporting views.**
Do: BigQuery views/queries: income vs expense, category‑wise, per‑fund, per‑account.
Verify: sample queries return expected aggregates against seeded data.

**S4E.3 — Report generation.**
Do: `generateReport` (Excel/PDF) backed by rollups/BQ → Storage + signed URL.
Verify: emulator/integration — report file produced; signed URL works.

### 4F. Notifications — WhatsApp
**S4F.1 — WhatsApp adapter.**
Do: Provider adapter (Twilio/Gupshup/Meta) behind `dispatchNotification`, with opt‑in + cost guard. (D17)
Verify: stub/integration sends; opt‑out respected; no send without consent.

### 4I. Phone OTP auth (deferred from P0)
**S4I.1 — Phone OTP provider.**
Do: Enable Firebase Phone Auth (Blaze + App Check/reCAPTCHA) as a third sign‑in provider; OTP entry + resend/timeout UI. (D3a)
Verify: phone sign‑in works; App Check enforced; rate‑limit/abuse guard configured.

### 4G. Audit (Phase 2 — full coverage)
**S4G.1 — Full audit + viewer.**
Do: Extend audit to all financial mutations (before/after) + an audit viewer with filters. (spec §5.6)
Verify: emulator test — every mutation logs; viewer filters; entries immutable.

### 4H. Receivables — partial payments + arrears
**S4H.1 — Partial collection payments.**
Do: Allow `received < billed` on entries (status Partial) with balance tracking. (relaxes D5)
Verify: unit/e2e — partial recorded; balance correct.

**S4H.2 — Arrears carry‑forward.**
Do: Roll unpaid balance into the next period + aging.
Verify: unit tests — arrears carried forward and aged correctly.

---

## Suggested milestones

| Milestone | Steps | Outcome |
|-----------|-------|---------|
| M0 Infra ready | S0.1–S0.7 | App + Firebase + CI + emulators running |
| M1 Foundations | S1.1–S1.8 | Theme, i18n, UI kit, data layer, rules harness |
| **M2 — P0 done** | S2.1–S2.12 | Auth + multi‑tenant RBAC + onboarding + user mgmt |
| **M3 — P1 done** | S3.1–S3.30 | Full Payables: config, ledger, recurring, maintenance, snag, approvals, disbursements, UI |
| M4A Receivables | S4A.1–S4A.8 | Units, charge model, collection import, grids, vendor income |
| M4B Dashboard | S4B.1–S4B.3 | Cash position + Sankey (Phase 2) |
| M4C Forecasting | S4C.1–S4C.3 | Forecast entries + projections (Phase 3) |
| M4D Residents | S4D.1–S4D.3 | Published views + own‑flat ledger (Phase 2) |
| M4E Analytics | S4E.1–S4E.3 | BigQuery export + reports |
| M4F / M4G / M4H | S4F.1 / S4G.1 / S4H.1–2 | WhatsApp · full audit · partial payments + arrears |
