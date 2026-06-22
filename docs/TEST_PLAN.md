# society-finance — Test Plan (state machine)

Tests treat each surface as a **state machine**: enumerate the data + UX states,
assert each *looks and behaves as expected*, then assert each *transition*. A
single happy-path click-through proves one edge of the graph and ignores the rest.

For this app every surface also has two extra axes beyond data state:
**role** (Super / Admin / FM / MC / Resident) and **tenant** (the active
`societyId`). A surface is not covered until it is verified **per reachable role**
and proven **isolated across societies**.

Enforced by the `ux-invariants-build` skill. When a change adds a state or
transition, add it here and verify it. Tooling: **Vitest** (`npm test`) unit/component,
**@firebase/rules-unit-testing** (`npm run test:rules`) rules, **Firebase emulators**
(`npm run test:functions`) for callable/trigger logic, **Playwright** (`npm run test:e2e`) flows, **axe** for a11y.

**Coverage:** every route, every drawer/modal, every Cloud Function, and the
cross-cutting systems (tenant isolation, RBAC, ledger, theme/i18n/a11y, auth, audit,
notifications). A surface not listed here is untested by definition — add it before shipping.

**Scope:** P0 (auth) + P1 (payables) are detailed below. Later surfaces (receivables,
dashboard, forecasting, residents) are stubbed under *Backlog surfaces* and detailed when built.

---

## Baseline state set (every data-driven surface must consider these)
| State | Meaning | What to assert |
|-------|---------|----------------|
| **empty** | no data (first run / last item removed) | EmptyState shows, no broken layout |
| **loading** | in-flight, no data yet | skeleton, no layout shift on resolve |
| **populated** | typical data | correct ordering, grouping, counts |
| **boundary** | long strings / 0 / huge / one / many / missing optionals | no overflow, no NaN, paise formats correctly |
| **role-variant** | same surface as each reachable role | affordances/visibility match the RBAC matrix; forbidden actions absent |
| **permission-denied** | forbidden action forced (deep link / API) | rules/Function denies; UI shows recoverable message; nothing mutated |
| **server-rejection** | a server validation fails (cap, tier, self-approval) | clear recoverable Toast; state unchanged |
| **error** | write fail / offline | recoverable Toast, UI not dead |
| **concurrency** | same data changed elsewhere | snapshot reconciles, no dupes/loss |
| **tenant-isolation** | another society's data exists | never visible; cross-society request denied |

## Baseline transitions (every mutating surface)
- create → populated · remove-last → empty · edit → populated(updated)
- submit → server-validate → populated | rejection → fix → populated
- navigate away + back → state preserved; one-shot signals not replayed
- destructive/financial action → Confirm → (confirm → effect + Toast) | (cancel → unchanged)

**Transition assertions:** no flash of wrong intermediate UI, no ghost rows, no
item reappearing after the next snapshot, ledger/rollups reconcile after any posting.

---

# Page surfaces

## Surface: LoginPage (`/login`) — P0
**States**
- [ ] unauthenticated — email/password + Google + phone-OTP options; no app chrome.
- [ ] in-progress — provider flow running; controls disabled/spinner.
- [ ] otp-pending — *(deferred to Phase 4 / S4I; P0 ships email + Google only)*.
- [ ] error — wrong password / popup blocked / OTP fail → recoverable message, controls usable again.
- [ ] already-authed — visiting `/login` while signed in → redirect into app for the user's society.
**Transitions**
- [ ] sign-in success → claims (`societyId`,`role`) resolved → land on role's home.
- [ ] password reset → email sent (emulator), confirmation shown.
- [ ] sign-out → session + cache cleared, back to `/login`, no stale data flash.

## Surface: Super-admin onboarding (`/admin/societies`) — P0
**States**
- [ ] role-variant — only `superAdmin` reaches it; others → denied/redirect.
- [ ] empty — no societies yet → EmptyState + "Create society".
- [ ] populated — society list.
- [ ] boundary — long society name; many societies.
**Transitions**
- [ ] create society → society + default fund heads/accounts bootstrapped; first admin invited (claims set).
- [ ] permission-denied — non-super forcing `createSociety` is rejected (Function test).

## Surface: User management (`/admin/users`) — P0
**States**
- [ ] role-variant — Admin full; FM/MC/Resident no access.
- [ ] empty — only the admin exists → list shows self.
- [ ] populated — users with name/email/role/status/last-login.
- [ ] boundary — many users; pending invite; deactivated user.
- [ ] permission-denied — FM deep-links here → blocked.
**Transitions**
- [ ] invite user (FM/MC/Resident) → membership + claims set; appears in list.
- [ ] change role → claims refresh; audit entry written.
- [ ] deactivate user → access revoked; audit entry.
- [ ] tenant-isolation — invited users scoped to this society only.

## Surface: Admin settings — Approval tiers (`/settings/approvals`) — P1
**States**
- [ ] role-variant — Admin edit; others none.
- [ ] populated — tier bands table (≤25k→1, 25–50k→3, 50k–1L→5, >1L→admin-set).
- [ ] boundary — single band; overlapping/edge amounts; open-ended top band; ₹0 boundary.
- [ ] validation — non-contiguous or <1 approver gated; **a band requiring more approvers than the society's active MC count is blocked** (quorum rule); save blocked with message.
**Transitions**
- [ ] edit a band's approver count → saved; `resolveTier` reflects it for **new** submissions only (snapshot rule).
- [ ] permission-denied — FM forcing the write is denied (rules test).

## Surface: Admin settings — Accounts & Fund heads (`/settings/accounts`, `/settings/funds`) — P1
**States**
- [ ] role-variant — Admin CRUD; others read where relevant.
- [ ] empty — defaults seeded at society creation → at least one account/fund.
- [ ] populated — accounts (bank/cash/sinking/petty) with balances; fund heads.
- [ ] boundary — account with 0 opening balance; many accounts.
**Transitions**
- [ ] create/edit account → appears; balance derived from ledger (not hand-set after opening).
- [ ] delete fund head in use → blocked or reassign flow (no orphaned txns).

## Surface: Payables shell + sub-tabs (`/payables`) — P1
**States**
- [ ] role-variant — tabs Recurring | Maintenance | Snags visible per role; Resident has no access.
- [ ] populated — correct default tab per role (FM → Maintenance, Admin → Recurring).
**Transitions**
- [ ] switch tabs → content + filters swap; URL reflects tab.

## Surface: Recurring payments (monthly view) — P1
**States**
- [ ] role-variant — Admin CRUD; FM execute (status/invoice/txn); MC view-only; Resident none.
- [ ] empty — no templates → EmptyState + (Admin) "New recurring".
- [ ] populated — current month instances with status; past months materialised; future months projected.
- [ ] boundary — template starting mid-FY; ended template; many templates; ₹ huge amount.
- [ ] permission-denied — FM tries to edit a template → denied; MC tries to mark paid → denied.
**Transitions**
- [ ] Admin create template → instance generated for due period (scheduledRecurring).
- [ ] FM mark instance paid → `recordPayment` posts one txn; account/fund/period rollups reconcile; status → paid.
- [ ] month switcher → past (instances) vs future (projection) render correctly.

## Surface: Maintenance list + filters — P1
**States**
- [ ] role-variant — FM create + act; MC view + approve + note; Admin view.
- [ ] empty — no maintenance requests → EmptyState + (FM) "New request".
- [ ] populated — requests grouped/sorted; status chips (icon+label).
- [ ] boundary — date-range filter with no matches; status filter; many requests.
**Transitions**
- [ ] apply date-range + status filter → list narrows correctly.
- [ ] open a request → 4-stage detail.

## Surface: Snag list + Scheduled items — P1
**States**
- [ ] role-variant — Admin create/schedule + withdraw; FM take-up/act; MC approve/note.
- [ ] empty — no snags → EmptyState + (Admin) "Schedule snag".
- [ ] populated — scheduled items grouped by budget window; active snags by status.
- [ ] boundary — window modes (month/quarter/year/custom/by_date); past-window scheduled item; many items.
**Transitions**
- [ ] Admin schedule snag → appears under its window in Scheduled items.
- [ ] FM take-up (add quotations + submit) → moves to Requested.
- [ ] Admin withdraw a scheduled snag → removed; FM cannot withdraw (permission-denied).

## Surface: Schedule-snag form (Admin) — P1
**States**
- [ ] create — budget window selector (Month/Quarter/Year/Custom/by-date) + estCost + fund.
- [ ] validation — window required; estCost > ₹1L (snag threshold) or flagged; required fields gate submit.
- [ ] boundary — custom range start>end rejected; by-date in the past.
**Transitions**
- [ ] save → `scheduleSnag` creates a `scheduled` request with the window.
- [ ] cancel → no write.

## Surface: Expense-request detail (4-stage) — P1
The core workflow surface; verify **per stage × role**.
**States (by status)**
- [ ] scheduled (snag) — budget window shown; FM "take up" affordance; Admin "withdraw".
- [ ] requested — quotations; approvals X-of-N; MC "approve" + "add note"; FM/Admin "withdraw"; **no reject affordance anywhere**; **no disbursement affordance (spend gate — not yet approved)**.
- [ ] approved — `approvedAmountPaise` cap shown; FM "record disbursement" **now enabled (spend gate lifted)**; withdraw no longer offered.
- [ ] disbursed — partial-disbursement list; remaining vs cap; FM "record disbursement"/"close".
- [ ] completed — read-only history; ledger links.
- [ ] withdrawn — terminal; read-only.
- [ ] boundary — quotations: snag <3 (warn) vs ≥3; huge estCost; long scope notes; many disbursements.
- [ ] role-variant — MC sees approve/note only; FM sees operational actions; Admin sees snag create/withdraw; Resident no access.
**Transitions**
- [ ] submit (FM) → tier resolved, `requiredApprovers` snapshotted, `submittedAt` set, → requested.
- [ ] approve (MC) → progress increments; at N → approved; **self-approval denied**; FM/Admin approve denied.
- [ ] add note (MC) → note visible to FM/Admin.
- [ ] record disbursement (FM) → ledger txn posted; cumulative ≤ cap; **over-cap rejected (server-rejection)** → suggests new ticket.
- [ ] withdraw (FM maint / Admin snag) → allowed only pre-disbursement; **blocked after first disbursement** (server-rejection).
- [ ] close (FM) → completed; no further disbursements.
- [ ] tier-config changed after submit → this request keeps its snapshotted `requiredApprovers`.

## Surface: Requested queue (`/payables/requested`) — P1
**States**
- [ ] role-variant — visible to Admin/FM/MC; actions per role.
- [ ] empty — nothing pending → EmptyState.
- [ ] populated — items ordered oldest→newest by `submittedAt`; aging indicator; X-of-N progress.
- [ ] boundary — very old pending item; many pending; mixed maintenance + snag.
**Transitions**
- [ ] approve from queue (MC) → progresses / approves; leaves queue at N.
- [ ] withdraw from queue (FM maint / Admin snag) per offline agreement → leaves queue.
- [ ] new submission → enters at the correct age position.

## Surface: Record-payment / disbursement drawer — P1
**States**
- [ ] form — amount, mode (UPI/cheque/cash/bank), reference, account, fund (+ invoice/evidence for disbursement).
- [ ] boundary — partial amount; amount over cap (blocked); missing reference; huge amount.
- [ ] server-rejection — over-cap or wrong-role submit → recoverable message.
**Transitions**
- [ ] save → exactly one `transactions` doc; rollups reconcile; domain doc `txnId` linked.
- [ ] cancel / Escape → no write (focus-trapped modal/drawer).

---

# Cross-cutting systems (verified across surfaces, not one page)

## Tenant isolation (D1, §9)
- [ ] every collection access is `societyId`-scoped via the repo layer.
- [ ] rules tests: cross-society read/write denied for every collection.
- [ ] society switch / sign-out clears in-memory + cached data; no bleed.

## RBAC matrix (D5-roles, Payables access table)
- [ ] each surface tested for every reachable role; forbidden actions absent from UI **and** denied server-side.
- [ ] separation of duties: creator can't approve; FM can't approve; snag create/withdraw Admin-only.
- [ ] claims drive visibility; tampering with client role has no effect (rules win).

## Ledger & money integrity (D12-D14)
- [ ] amounts are integer paise throughout; ₹ formatting only at the edge; no float math.
- [ ] each posting writes exactly one `transactions` doc; `balances`/`accounts.currentBalance` Functions-only.
- [ ] rollups reconcile with the transaction sum; idempotent on retry.
- [ ] clients cannot write `transactions`/`balances`/`auditLogs` (rules test).

## Approval invariants (D9-D9d)
- [ ] tier resolution correct at band edges; `requiredApprovers` snapshotted at submit.
- [ ] quorum: a tier needing more approvers than active MC is blocked at config save **and** at submit (no un-approvable request).
- [ ] no reject path anywhere; unapproved stays `requested`.
- [ ] cap enforced on cumulative disbursements; withdraw only pre-disbursement.
- [ ] **spend gate** — no disbursement before `approved` (forced post rejected server-side); manual/non-request ledger entries are **Admin-only** (FM denied).

## Theme + i18n + a11y (DESIGN_LANGUAGE.md)
- [ ] light + dark correct on every surface, drawer, modal, grid, and native input.
- [ ] text-size control + 200% zoom keep layouts intact; min 13px.
- [ ] status = icon + label (never colour alone); icon-only buttons labelled.
- [ ] all copy via i18n; ₹/date locale-formatted; multi-script renders.
- [ ] keyboard reachable; focus visible + trapped in modals/drawers/grids; axe passes.

## Auth (D3a)
- [ ] email/password + Google sign in (phone OTP deferred — S4I).
- [ ] claims resolved before first protected render; no unauthorised flash.
- [ ] session expiry / sign-out → cache cleared, redirect `/login`.

## Audit (spec §5.6)
- [ ] every financial mutation + role change writes an append-only `auditLogs` entry (before/after where applicable).
- [ ] clients cannot write/edit audit entries.

## Notifications (D17)
- [ ] submit/approval/withdraw/disburse emit in-app + email; recipients per role; opt-out respected (WhatsApp later).

## Mechanical floor
- [ ] `npm run check:ux` → zero hits (see UX_INVARIANTS_CHECKLIST.md Layer A). Keep it zero.

---

# Backlog surfaces (detail when built — Phase 4)
- **Receivables:** units registry, charge-model config, collection import, collections monthly grid (multi-row sheet edit), pending list/export, vendor income.
- **Cash Balance dashboard:** metric cards + Sankey + period switch.
- **Forecasting:** forecast entries + monthly/quarterly/yearly projections.
- **Resident (mobile-first):** own-flat dues + ledger; published community view (read-only).
- **Analytics:** Firestore→BigQuery export + reports.

---

## How to add a surface here
1. List its reachable **states** (start from the baseline set; drop N/A ones with a reason). Always include role-variant + permission-denied + tenant-isolation.
2. List its **transitions** (start from baseline transitions; add workflow/ledger ones).
3. For each, write the expected look/behaviour, then cover it with a Vitest component test, a rules/Functions emulator test, or a Playwright flow. Check the box when verified.
