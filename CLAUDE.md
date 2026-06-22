# CLAUDE.md — society-finance binding contract

This file is the **enforced contract** for working in this repo. It overrides defaults. Read it before any change; honour it in every PR. The detailed source of truth lives in `/docs` — this file points to it and states the non-negotiables.

## Source-of-truth docs
- `docs/functional-spec-draft.md` — original functional spec.
- `docs/architecture-design-requirements.md` — architecture + locked decisions **D1–D9d** (data model §6, functions §7, rules §9).
- `docs/DESIGN_LANGUAGE.md` — visual + interaction system (accessibility, dark/light, consistency).
- `docs/DEVELOPMENT_PLAN.md` — the build order; one step = one PR = one verifiable outcome.
- `docs/TEST_PLAN.md` — every surface as a state machine (data-state × **role** × **tenant**).
- `docs/UX_INVARIANTS_CHECKLIST.md` — per-change review gate + the `npm run check:ux` mechanical floor.

## The product is multi-society and financial. Non-negotiables:

1. **Access control & tenant isolation are THE critical constraint.**
   - The **UI never decides access** — Firestore rules + Cloud Functions are the boundary; UI gating is UX only.
   - Everything derives from the auth **custom claim** `{ societyId, role, superAdmin }`.
   - Every read/write is `societyId`-scoped via the data-access layer; **no query omits it**.
   - Honour the role matrix and separation of duties (creator ≠ approver; FM can't approve; snag create/withdraw Admin-only).
   - Any new collection/action ships with **rules + Functions tests** proving cross-society denial and the role matrix. No exceptions.

2. **Money & ledger integrity.**
   - Amounts are **integer paise** end-to-end; format (₹, locale) only at the UI edge; never float math.
   - Every money movement writes exactly one `transactions` doc; `balances` / `accounts.currentBalance` / `auditLogs` are **Functions-only** (clients cannot write them).
   - Approval workflow rules (D9–D9d): tiered + snapshotted approvers, **no reject** (stays `requested`), **spend cap** (disbursements ≤ approved), withdraw only pre-disbursement, MC-quorum (`requiredApprovers ≤ active MC count`).

3. **Design language & accessibility** (`DESIGN_LANGUAGE.md`).
   - MUI theme tokens only (no hardcoded colours); correct in **light + dark**.
   - Status = **icon + label**, never colour alone. Shared components (DataGrid wrapper, FormDrawer, Modal, StatusChip). All copy via i18n; ₹/dates via `Intl`. WCAG 2.1 AA; min 13px; changeable font size.

4. **Test as a state machine** (`TEST_PLAN.md`).
   - Cover empty/loading/populated/boundary/error **plus role-variant, permission-denied, server-rejection, tenant-isolation** — per reachable role.
   - Tooling: Vitest, @firebase/rules-unit-testing, Firebase emulators, Playwright, axe.

## Definition of done (every PR)
- `lint` + `typecheck` clean; `npm run check:ux` zero hits.
- Tests for the change pass (unit + rules + functions + e2e where UI).
- New surfaces/states added to `TEST_PLAN.md` and verified; change passes `UX_INVARIANTS_CHECKLIST.md`.
- No client writes to derived/ledger/audit collections; trusted mutations go through Cloud Functions.

## Stack (fixed — D1–D3b)
React 18 + TS + Vite · MUI v6 + MUI X DataGrid · Firebase (Auth, Firestore Native, Functions Node 20 Gen 2, Storage, Hosting) · region `asia-south1` · Emulator Suite · react-i18next + `Intl`.
Auth providers: **email/password + Google** (phone OTP deferred — see plan S4I).

## Priorities
**P0 = Authentication + Authorization** (Phase 2) → **P1 = Payables** (Phase 3) → rest (Phase 4). Start at **S0.0**.
