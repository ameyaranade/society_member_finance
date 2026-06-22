# UX Invariants Checklist (draft)

A review gate for any feature touching UI or user data. The goal: catch the
inconsistencies *before* handoff, so they don't become review iterations.

Two halves:
- **Reusable core** — generic invariants for any app with users + data.
- **Project layer** — society-finance specifics (multi-tenant, RBAC, money/ledger, approval workflow). Swap this section per project.

Each item is yes/no/N-A. If N/A, say why in one line — an explicit "N/A because…" is the signal it was considered, not skipped.

Companion: [DESIGN_LANGUAGE.md](DESIGN_LANGUAGE.md) · [architecture-design-requirements.md](architecture-design-requirements.md) (decisions D1–D9d) · [TEST_PLAN.md](TEST_PLAN.md).

---

## REUSABLE CORE

### 1. Data lifecycle & user control
*Principle: every piece of user data must be reachable, editable, exportable, and erasable, within the actor's authority.*

For each **new data type / collection / field**:
- [ ] **Create** — produced through the UI (not only seeded/imported).
- [ ] **Read** — visible somewhere; nothing write-only or orphaned.
- [ ] **Update** — editable, or explicitly immutable by design (state the reason).
- [ ] **Delete / withdraw** — removable by the authorised role, with confirmation for destructive actions.
- [ ] **Cascade** — removing a parent cleans up *all* children incl. non-obvious states (scheduled, withdrawn, draft). No orphans behind a status filter.
- [ ] **Export / retrievable** — included in the relevant export/report path; a new type invisible to export is a silent gap.
- [ ] **Erase / offboarding** — included in the society-offboarding/delete path; new collections added, not forgotten.
- [ ] **Cache copies** — any cached/local copy is cleared on sign-out and on society switch (no cross-society bleed on a shared device).

### 2. Visual & interaction consistency
*Principle: a new surface should look and behave like it was always part of the app.*
- [ ] **Tokens only** — colours/spacing/typography from the MUI theme tokens; no one-off hardcoded values.
- [ ] **Theme correctness** — correct in **light and dark**; native controls (date/select) respect the theme.
- [ ] **Reuse over reinvent** — uses shared primitives (Button, StatusChip, FormDrawer, Modal, DataGrid wrapper, MetricTile, empty/loading/error).
- [ ] **Spacing & rhythm** — matches the spacing scale; aligns with sibling sections.
- [ ] **Affordance parity** — same action looks the same everywhere (all destructive buttons alike; all "add"/"record" entry points alike).
- [ ] **Touch targets** — ≥ 44px touch / ≥ 24px pointer.
- [ ] **Copy & casing** — sentence case, app voice; all strings via i18n (no hardcoded literals).
- [ ] **Loading/disabled/active states** — every interactive element has visible feedback per state.

### 3. State-machine test coverage
*Principle: test the states and transitions, not one happy-path click-through.*
- [ ] **Empty** · **Loading** · **Populated** · **Boundary** (long strings, 0 / huge / missing optionals, one vs many).
- [ ] **Error** — write fails / offline / permission denied → recoverable message, UI not dead.
- [ ] **Role-variant** — surface rendered for each role that can reach it (different affordances/visibility). *(project: §A)*
- [ ] **Permission-denied** — a forbidden action is **not offered** in the UI **and** is rejected by rules/Functions if forced.
- [ ] **Server-validated rejection** — a server rule (cap, tier, self-approval) rejects → clear recoverable message.
- [ ] **Concurrency** — same data changed in another tab/device; the Firestore snapshot reconciles without dupes/loss.
- [ ] **Transitions** — each action moves states predictably; back/forward doesn't replay one-shot signals; no transition strands the user (ghost row, reappearing item).

### 4. Accessibility & robustness (WCAG 2.1 AA — see DESIGN_LANGUAGE.md §2)
- [ ] Keyboard reachable; focus visible and trapped in modals/drawers/grids.
- [ ] Meaningful labels on icon-only buttons.
- [ ] **Colour is not the only carrier of meaning** (status = icon + label).
- [ ] Readable at the Large text setting / 200% zoom; min text 13px.
- [ ] Numbers/dates/currency locale-formatted; multi-script text renders (no tofu).
- [ ] Respects reduced-motion.

### 5. Definition of done (process)
- [ ] Ran the deterministic check script (Layer A) — zero hits.
- [ ] Walked §§1–4 and answered each item or marked N/A with a reason.
- [ ] Verified in the running app exercising the **state list** in §3 — across **every role** that reaches the surface, not one flow.
- [ ] Rules/Functions tests cover the new permission + validation paths.
- [ ] Listed what was verified vs. what couldn't be.

---

## MECHANICAL CHECKS (Layer A — script + hook: `npm run check:ux`)
*Pass/fail by grep; never depends on the model remembering.*

Generic:
- [ ] No hardcoded colour literals (hex/rgb/hsl) outside the theme token file.
- [ ] No `console.log` in shipped code (warn).
- [ ] No TODO/FIXME without an issue reference (warn).
- [ ] Icon-only buttons have an `aria-label` (lint).
- [ ] No font-size literal below 13px; sizes are theme/rem-based.

Society-finance (see Project layer for rationale):
- [ ] **No client writes to derived/ledger/audit collections** — grep client code for `setDoc/updateDoc/deleteDoc` on `transactions|balances|auditLogs|accounts` (these are Functions-only).
- [ ] **All Firestore access via the repo layer** — grep for raw `collection(`/`doc(` usage outside `src/lib/data/**` (forces `societyId` scoping).
- [ ] **Money is paise integers** — grep for `parseFloat`/`* 100`/`toFixed` on amount fields outside the money util; amounts typed as branded `Paise`.
- [ ] **No hardcoded user-facing strings** — lint JSX text nodes not wrapped in the i18n helper (warn).

---

## PROJECT LAYER — society-finance
*Swap this whole section for a different project. Mirrors the hard rules in the architecture doc so the gate enforces them.*

### A. Multi-tenancy & authorization (D1, D5-roles, §9 rules)
- [ ] **Tenant scoping** — every read/write carries `societyId`; no query omits it. Data from another society is never reachable in UI or by forced request (rules-tested).
- [ ] **Claims-driven** — visibility/affordances derive from the user's `{ societyId, role, superAdmin }` claim, not client state.
- [ ] **RBAC matrix honoured** — the surface matches the §5 / Payables access table for **every** role (Admin / FM / MC / Resident / Super). Forbidden actions are absent from the UI **and** denied server-side.
- [ ] **Separation of duties** — a creator cannot approve their own request; FM cannot approve; cross-role escalation blocked.
- [ ] **Society switch / sign-out** — clears in-memory + cached data; no previous-society data flashes.

### B. Money & ledger integrity (D12-D14, §6)
- [ ] **Paise only** — amounts are integer paise end-to-end; formatted (₹, locale) only at the UI edge; never float arithmetic.
- [ ] **Ledger is the source of truth** — every money movement writes exactly one `transactions` doc (account + fund + mode + ref); domain doc links via `txnId`.
- [ ] **Derived data is Functions-only** — `balances`, `accounts.currentBalance`, `auditLogs` are read-only to clients; UI never computes authoritative balances.
- [ ] **Reconciliation** — after a posting, account + period + fund rollups reconcile with the sum of transactions (idempotent on retry).

### C. Approval & expense workflow (D9-D9d)
- [ ] **Tiered approvals** — `requiredApprovers` is resolved from the amount tier at submit and **snapshotted**; later tier-config edits don't retro-change an in-flight request.
- [ ] **Quorum** — a tier's `requiredApprovers` ≤ the society's active MC count (validated at tier-config save **and** at submit); never create an un-approvable request (no reject exists).
- [ ] **No reject** — there is no reject action; an unapproved request **stays `requested`** until approved or withdrawn. UI shows no "reject" affordance.
- [ ] **Requested queue** — pending items appear in the shared aged queue (oldest-first) for Admin/FM/MC, with X-of-N progress.
- [ ] **Spend gate** — no disbursement/expenditure is posted before `approved` (required MC approvals met); the disburse affordance is absent pre-approval and the action is rejected server-side. Money trust circle = MC + Admin; **manual/non-request ledger entries are Admin-only** (FM never posts money outside an approved request).
- [ ] **Spend cap** — cumulative disbursements never exceed `approvedAmountPaise`; overflow is rejected server-side; more spend = a new linked ticket.
- [ ] **Withdraw window** — withdraw allowed **only before any disbursement**; FM (maintenance) / Admin (snag); blocked afterwards.
- [ ] **Ownership** — snag is created/withdrawn by Admin only; quotations/take-up/disburse/close are FM; recurring is Admin-CRUD / FM-execute / MC-view.
- [ ] **Stage affordances** — each `status` (scheduled/requested/approved/disbursed/completed/withdrawn) renders exactly the actions valid for that stage + role.

### D. Design language specifics (DESIGN_LANGUAGE.md)
- [ ] Only MUI theme tokens; no hardcoded hex; correct in light + dark.
- [ ] Status conveyed by **icon + label** (StatusChip), never colour alone.
- [ ] Big tables use the shared DataGrid wrapper (stage-then-save; financial cells never autosave).
- [ ] Right **FormDrawer** for record/edit; centered **Modal** for create-with-preview; consistent everywhere.
- [ ] All copy via react-i18next; ₹/date via `Intl`; multi-script font stack.
- [ ] Text-size control + 200% zoom keep layouts intact.

### State-machine tests (society-finance specifics)
- [ ] Verified empty / loading / populated / boundary / error / **role-variant** / **permission-denied** / **server-rejection** for the surface.
- [ ] Rules tests prove cross-society denial + the role matrix for any new collection.
- [ ] Functions tests prove tier resolution, no-reject, cap enforcement, withdraw window, separation of duties where touched.

### Mechanical script targets (society-finance)
- [ ] grep hex/rgb/hsl in `src/**` excluding the theme token module.
- [ ] grep client writes to `transactions|balances|auditLogs|accounts`.
- [ ] grep raw `collection(`/`doc(` outside `src/lib/data/**`.
- [ ] grep amount math (`* 100`, `parseFloat`, `toFixed`) outside `src/lib/money`.
- [ ] grep icon-only `<IconButton>` without `aria-label`.
