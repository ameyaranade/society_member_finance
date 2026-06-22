# Dev Design & Architecture Requirements

**Project:** Multi‑Society Financial Management Web Application
**Source spec:** [functional-spec-draft.md](functional-spec-draft.md) (single‑society draft)
**Status:** Draft v0.3 — + Payables redesign (tiered approvals, 4‑stage expense requests, recurring payments)
**Last updated:** 2026-06-21

> The functional spec is written for **one** 564‑apartment community. This document re‑frames it as a **multi‑tenant (multi‑society) platform** on Firebase and captures the technical design/architecture requirements.

---

## 1. Decisions Locked

**Foundational**

| # | Decision | Choice |
|---|----------|--------|
| D1 | Tenancy isolation | Single Firebase project, **society‑scoped data**; isolation via Firestore/Storage rules + Auth custom claims. |
| D2 | Frontend stack | **React 18 + TypeScript + Vite**, Firebase JS SDK v10, **MUI + MUI X DataGrid**. |
| D3 | Society onboarding | **Central super‑admin** creates a society + its first Society Admin. |
| D3a | Auth methods | **P0: email/password + Google sign‑in.** Phone OTP **deferred** (needs Blaze + App Check/reCAPTCHA) to a Phase‑4 follow‑up. |
| D3b | Data layer | **Firestore** for the operational/transactional app + real‑time + rollups; **managed Firestore→BigQuery export** added in Phase 2/3 for SQL reporting & forecasting. No relational DB in v1. |

**Domain / accounting**

| # | Topic | Decision |
|---|-------|----------|
| D4 | Maintenance charge basis | **Configurable per society** by the MC (per‑sqft / flat amount / tier). Stored as a society `chargeModel`. |
| D5 | Payments | **Full payment only** in v1 (Paid / Pending / Overdue). Partial payments + arrears = later. |
| D6 | Collection import | Generic **Excel/CSV upload → parse → process** (no hard‑coded NBH format; map columns at import). |
| D7 | Occupants | Track **owner + optional tenant**, with a **configurable billed party** per flat. |
| D8 | Vendors | **One vendor entity**; its income/expense role is a **relationship edge** (a vendor can be both payer and payee). |
| D9 | Approvals | **Amount‑tiered, configurable** approver counts (e.g. ≤₹25k→1, ₹25–50k→3, ₹50k–1L→5, >₹1L→admin‑set), single‑level MC. Applies to **maintenance + snag only** (recurring payments need none). Bands are open‑ended; every band is **≥ 1 approval** (no auto‑process path). **Quorum rule:** a band's `requiredApprovers` must be **≤ the society's active MC count** — validated at tier‑config save **and** at submit (else, with no reject, the request would be un‑approvable). |
| D9a | Spend cap | An expense request's **approved amount is a hard ceiling** — disbursements (incl. partials) cannot exceed it. Needing more spend = a **new linked top‑up request** through its own tiered approval, never an in‑place raise. |
| D9b | Payables ownership | **Recurring** scheduled payments: Admin CRUD, FM executes (status/invoice/txn), MC view‑only. **Maintenance** request: created + run by FM. **Snag** (>₹1L): Admin **only** creates (schedules) and withdraws it; **all other snag work — quotations, take‑up, disburse, close — is FM**. Maintenance withdraw: FM. |
| D9c | Snag scheduling | Admin creates snags in a **`scheduled`** state with a planned **budget window** — selector `mode`: Month / Quarter / Year / Custom range / by‑date — surfaced in a **Scheduled items** view. When the period arrives **FM takes it up** (adds quotations, submits), entering the normal tiered‑approval flow. |
| D9e | Spend gate + trust circle | **No expenditure/disbursement may be posted before the request is `approved`** (required MC approvals met). FM prepares everything (quotations, invoices, evidence) and posts the disbursement, but **cannot spend until approved**. The **money trust circle is MC + Admin**: MC authorise (approve), and **manual/non‑request ledger entries** (opening balances, bank interest) are **Admin‑only** — FM never posts money outside an approved request. `approvedAmountPaise` = the requested amount **as‑is** (no reduced/partial approval yet — future). |
| D9d | Requested queue + no reject | There is **no MC‑reject action** — approval is the only happy path; otherwise an item **stays `requested`**. Pending items live in a shared **Requested queue** sorted by age (oldest↔newest, via `submittedAt`), visible to Admin/FM/MC with approval progress (X of N). MC approve there; **withdraw** (per offline MC/FM agreement) = FM (maintenance) / Admin (snag), allowed only before any disbursement. Needs a `(status, submittedAt)` index. |
| D10 | Tax (GST/TDS) | **Not in v1.** Gross amounts only. |
| D11 | FY & currency | **Apr–Mar, INR**, both stored **per society** (`fyStartMonth`, `currency`). |
| D12 | Transactions | Record **payment mode + reference** on every money movement. |
| D13 | Cash accounts | **Multiple named accounts** per society (main bank, sinking, petty cash…); each txn references an account. |
| D14 | Fund heads | Track **fund heads** (general / sinking / corpus / repair); txns tagged + reportable per fund. |

**UX**

| # | Topic | Decision |
|---|-------|----------|
| D15 | Primary surface | **Desktop‑first, mobile‑friendly** (FM heavy work on desktop; MC approvals on mobile). |
| D16 | Bulk editing | **Spreadsheet‑like inline data grid** for big tables (bulk select, keyboard nav). |
| D17 | Notifications | v1 channels: **in‑app + email**. WhatsApp deferred (provider + cost decided later). |
| D18 | Resident access | **Phase 2**: aggregate published dashboards **+ their own flat ledger**. |

Remaining open items in [§14](#14-open-decisions--to-confirm).

---

## 2. Architecture Overview

React SPA (Firebase Hosting) talks directly to Firebase for most reads/writes; **Cloud Functions** handle everything trusted, aggregated, or server‑side (claims, imports, approvals, ledger rollups, exports, notifications, scheduled jobs).

```
                ┌──────────────────────────────┐
   Browser ───▶ │  React SPA (Vite, Firebase    │
   (SPA)        │  Hosting / CDN)               │
                └───────────┬──────────────────┘
                            │ Firebase JS SDK (authenticated)
        ┌───────────────────┼─────────────────────────────┐
        ▼                   ▼                               ▼
  Firebase Auth        Cloud Firestore                Cloud Storage
  (+ custom claims)    (society‑scoped docs,          (invoices, quotations,
                        rule isolation)                imports, exports)
        │                   ▲                               ▲
        └─────────┐         │ triggers / callable           │
                  ▼         │                               │
            Cloud Functions (Node 20 + TS) ──────────────────┘
              • setClaims  • importCollections  • approval state machine
              • ledger rollups  • exports  • notifications (in‑app/email/WhatsApp)
              • scheduled jobs
                  │
                  ▼
          (Future) BigQuery export, bank‑reconciliation, FCM
```

**Principles**
- **Tenant scoping is non‑negotiable** — no query/file path omits `societyId`; rules are the backstop, not app code.
- **Trusted writes go through Functions** — status transitions, approvals, claims, imports, and ledger/balance math are validated server‑side. Clients never compute authoritative balances.
- **Money is integer paise** (₹1 = 100). Never floats.
- **The ledger is the source of truth** — every actual money movement is one `transactions` record (account + fund tagged); balances are derived from it.
- **Append‑only audit** for all financial state changes.
- **Reporting split:** Firestore stays the transactional/operational store with Function‑maintained rollups for in‑app dashboards; **ad‑hoc/SQL reporting & forecasting run on BigQuery** (managed Firestore export, added Phase 2/3). Firestore is never used for ad‑hoc aggregation.

---

## 3. Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | React 18, TypeScript, Vite | SPA; route‑based code splitting |
| Data/state | TanStack Query + Firebase SDK; Zustand/Context for app state | Real‑time Firestore listeners where useful |
| UI library | MUI v6 (Material) | Theming to de‑emphasise stock Material look |
| Data grid | MUI X DataGrid | Inline edit, bulk select, virtualization (D16) |
| Auth | Firebase Authentication — email/password + Google (phone OTP later) | Custom claims: `societyId`, `role`, `superAdmin` |
| Database | Cloud Firestore (Native) | Society‑scoped collections + composite indexes |
| Backend | Cloud Functions for Firebase (Node 20, TS, Gen 2) | callable + triggers + scheduled |
| Storage | Cloud Storage for Firebase | Path‑scoped by `societyId` |
| Hosting | Firebase Hosting | SPA rewrites, CDN, preview channels |
| Notifications | In‑app (Firestore) · Email (SendGrid/Firebase ext) · *WhatsApp later* | D17 |
| Region | `asia-south1` (Mumbai) | India residency; ₹ / NBH context |
| CI/CD | GitHub Actions → Firebase deploy | dev / staging / prod projects |
| Local dev | Firebase Emulator Suite | Auth + Firestore + Functions + Storage |

---

## 4. Multi‑Tenancy Model

- **Tenant = Society** (`societyId`). Users belong via a **membership**; active `societyId` + `role` mirrored into **Auth custom claims** for zero‑read checks in rules.
- Claims: `{ "societyId": "soc_abc", "role": "fm", "superAdmin": false }`.
- **Super‑admin** is a platform claim (`superAdmin:true`), not society‑bound; onboarding/support only.
- Claims set **only** by a Cloud Function (on membership create / role change). Client never sets claims.
- v1 assumes **one society per user**; `memberships` model leaves room for multi‑society later.

---

## 5. Roles & RBAC

| Role | Claim `role` | Scope |
|------|--------------|-------|
| Super Admin | `superAdmin:true` | Platform |
| Society Admin | `admin` | One society |
| MC Member | `mc` | One society |
| FM Team | `fm` | One society |
| Resident | `resident` | One society (Phase 2) |

Enforced in **two layers**: Firestore security rules (hard gate) + UI gating (UX only).

Key invariants:
- Read/write only where `resource.data.societyId == request.auth.token.societyId`.
- **Separation of duties:** `fm` creates expenses but cannot approve; an MC member cannot approve their own submission.
- **Payables (D9b):** `recurringPayments` — Admin CRUD, FM executes (status/invoice/txn), MC view‑only. `expenseRequests` — maintenance created by `fm`; snag **scheduled by `admin`** (create + withdraw only, D9c), with **quotations, take‑up, disburse, close all by `fm`**; `mc` **approves (no reject** — stays pending until approved or withdrawn**)** + adds notes; withdraw (only before any disbursement) = `fm` (maintenance) / `admin` (snag). **Spend gate (D9e):** FM cannot post any disbursement before `approved`; **manual/non‑request ledger entries are Admin‑only** (money trust circle = MC + Admin).
- **Spend ceiling (D9a):** disbursement sum ≤ `approvedAmountPaise` enforced server‑side; overflow requires a new linked request.
- Only `admin`/`super` manage users, accounts, fund heads, `chargeModel`, and the `approvalTiers` config.
- `resident` is read‑only on **published** data + own flat ledger; never vendor documents.

---

## 6. Data Model (Firestore)

```
/platform/config                         # global settings, feature flags
/users/{uid}                             # global profile (name, email, photo)
/memberships/{uid}_{societyId}           # societyId, uid, role, status  → source of truth for claims

/societies/{societyId}
  config: {                              # society-level configuration
    currency: "INR", fyStartMonth: 4,
    chargeModel: { type: "per_sqft"|"flat"|"tier",
                   ratePerSqftPaise?, tiers?: [{name, amountPaise}] },   # D4 (MC-configurable)
    approvalTiers: [ { minPaise, maxPaise, requiredApprovers }, ... ],   # D9 tiered, open-ended, ≥1 each
                                                                         #   applies to maintenance + snag only
    billing:  { defaultBilledParty: "owner"|"tenant" }                   # D7
  }

  /accounts/{accountId}      # D13  name, type(bank|cash|sinking|petty),
                             #      openingBalancePaise, currentBalancePaise(derived)
  /fundHeads/{fundId}        # D14  name, code (general|sinking|corpus|repair), description

  /units/{unitId}            # flatNumber, tower, areaSqft?,
                             # owner:{name,contact}, tenant?:{name,contact},
                             # billedParty:"owner"|"tenant",
                             # maintenanceAmountPaise (set or derived from chargeModel),
                             # commonElectricityAmountPaise

  /vendors/{vendorId}        # D8  name, contact, notes
  /vendorRelations/{relId}   #     vendorId, kind:"income"|"expense",
                             #     description, agreementAmountPaise?, periodicity
                             #     (a vendor may have both an income and an expense relation)

  /collections/{periodId}    # period "YYYY-MM", expectedPaise, receivedPaise, status
    /entries/{unitId}        #   unitId, billedPaise, status:"paid"|"pending"|"overdue",  # D5
                             #   dueDate, txnId? (link to ledger when paid)

  /vendorIncome/{recordId}   # vendorId/relId, period, expectedPaise, receivedPaise,
                             # status, txnId?, remarks
  /recurringPayments/{id}    # D9b  Admin CRUD: category, vendorId, monthlyAmountPaise, dueDay,
                             #      fundHead, accountId, active, startPeriod, endPeriod?
    /instances/{period}      #   period "YYYY-MM", amountPaise, status:"pending"|"paid",
                             #   dueDate, invoiceRef?, txnId?, paidAt?  (FM executes; MC views;
                             #   past = materialized, future = projected from template)

  /expenseRequests/{id}      # unified maintenance + snag workflow (4-stage state machine)
                             # type:"maintenance"|"snag", title, description, location, priority,
                             # category, fundHead, estCostPaise, approvedAmountPaise? (HARD CAP, D9a),
                             # requiredApprovers (snapshot from tier at submit), createdBy, createdRole,
                             # submittedAt (enters "requested" — drives the shared Requested-queue aging, D9d),
                             # status:"scheduled"|"requested"|"approved"|"disbursed"|"completed"|"withdrawn",  # NO "rejected"
                             #   snag starts "scheduled"; FM "takes up" → "requested". maintenance starts "requested".
                             #   no reject — a request stays "requested" until approved or withdrawn (offline MC/FM call)
                             # plan?:{ mode:"month"|"quarter"|"year"|"custom"|"by_date",   # snag only: budget window
                             #         startDate, endDate, label },
                             # parentRequestId?  # top-up link when more spend needed (D9a)
    /quotations/{quoteId}    #   vendorId, amountPaise, scopeNotes, documentRef   (snag: ≥3)
    /approvals/{approvalId}  #   mcUid, note?, approvedAt   (each = one MC approval; no reject decision)
    /notes/{noteId}          #   authorUid, role, text, at        (MC can add notes)
    /disbursements/{disbId}  #   amountPaise, txnId, invoiceRef, evidenceRef, kind:"partial"|"final", paidAt

  /transactions/{txnId}      # D12/D13/D14 — UNIFIED LEDGER (source of truth for cash)
                             # direction:"in"|"out", amountPaise, accountId, fundHead,
                             # mode:"cash"|"upi"|"cheque"|"bank", referenceNo, occurredAt,
                             # sourceType:"collection"|"vendorIncome"|"recurringPayment"|"expenseRequest"|"manual",
                             # sourceId, createdBy

  /forecasts/{id}            # Phase 3: type(income|expense), period, amountPaise, note
  /balances/{periodId}       # derived: per account, per fund, and total (Functions-written)
  /auditLogs/{id}            # append-only (§10)
  /notifications/{id}        # toUid, type, payload, channels[], readAt
  /reports/{id}              # generated export metadata + storage ref
```

**Modeling notes**
- **Ledger‑centric:** receiving a collection / vendor income, or paying an expense, writes a `transactions` doc (account + fund tagged) and links back via `txnId`. `balances` and `accounts.currentBalancePaise` are **derived only by Functions**.
- **`chargeModel`** lets each society's MC pick how the monthly charge is computed; `units.maintenanceAmountPaise` is the resolved per‑flat figure.
- **Amounts:** integer paise everywhere; format only at the UI edge.
- **Periods:** canonical `YYYY-MM` keys; FY derived from `fyStartMonth`.
- **564 per‑flat docs/month** under `collections/{period}/entries` keep data queryable & rule‑scoped (no giant arrays).
- Denormalize `societyId` onto **every** document (incl. subcollections) for simple rules + collection‑group queries.

---

## 7. Backend Logic (Cloud Functions)

| Function | Type | Purpose |
|----------|------|---------|
| `onMembershipWrite` | Firestore trigger | Set/refresh custom claims. |
| `createSociety` | callable (super) | Bootstrap society, default fund heads/accounts, first admin invite. |
| `inviteUser` | callable (admin) | Membership + Auth user/invite. |
| `importCollections` | callable + Storage trigger | Parse uploaded Excel/CSV → map columns → write `collections/{period}/entries`; validate, dedupe, report row errors. (D6) |
| `applyChargeModel` | callable (admin/MC) | Recompute `units.maintenanceAmountPaise` from `chargeModel`. (D4) |
| `recordPayment` | callable | Mark collection/vendor‑income/expense paid → write `transactions` (mode+ref+account+fund) atomically. (D12) |
| `scheduleSnag` | callable (admin) | Create a snag in **`scheduled`** state with its budget window (`plan`) — no quotations/approval yet. (D9c) |
| `submitExpenseRequest` | callable (FM) | Resolve the **approval tier** from `estCostPaise` (D9), snapshot `requiredApprovers`, **validate `requiredApprovers ≤ active MC count`** (block otherwise), move → `requested`. Also serves as snag **take‑up** (`scheduled`→`requested`). FM-only for both maintenance and snag (snag is only Admin‑created/withdrawn). |
| `recordApproval` | callable | MC records an **approval** (+ optional note); on reaching `requiredApprovers` → `approved` (sets `approvedAmountPaise`). **No reject** — item stays `requested` until approved or withdrawn. Enforce separation of duties (no self‑approval). (D9) |
| `recordDisbursement` | callable (FM) | Post a (partial/final) disbursement → `transactions` (out) with invoice/evidence; **reject unless `status` is `approved`/`disbursed`** (spend gate, D9e); **reject if sum would exceed `approvedAmountPaise`** (D9a); set `disbursed`. |
| `withdrawExpenseRequest` / `closeExpenseRequest` | callable | Withdraw (FM maint / Admin snag) — **only while no disbursement posted**; close/complete (FM). |
| `recomputeBalances` | Firestore trigger on `transactions` | Maintain `accounts.currentBalance` + `balances/{period}` per account & fund (idempotent). |
| `generateReport` | callable | Build Excel/PDF export → Storage; return signed URL. |
| `dispatchNotification` | shared/trigger | Fan out in‑app + email + WhatsApp per recipient prefs. (D17) |
| `scheduledRecurring` | scheduled (monthly) | Materialise the month's `recurringPayments/{id}/instances`; open new collection period. |
| `writeAudit` | shared helper | Emit immutable audit entries from trusted paths. |

**Requirements**
- Callables verify `context.auth` + claims server‑side; never trust client‑sent `societyId`/`role`.
- Financial mutations run in **transactions/batched writes** and are **idempotent** (safe to retry).
- Import + payment posting are the highest‑risk paths → strict validation, partial‑failure reporting.

---

## 8. Document Storage

```
/societies/{societyId}/expense-requests/{requestId}/quotations/{quoteId}/{file}
/societies/{societyId}/expense-requests/{requestId}/disbursements/{disbId}/{file}   # invoice + txn copy + evidence
/societies/{societyId}/recurring/{instanceId}/{file}                                # invoice + txn copy
/societies/{societyId}/payment-proofs/{txnId}/{file}
/societies/{societyId}/imports/{uploadId}/{file}
/societies/{societyId}/exports/{reportId}/{file}
```

- Formats: PDF, Excel, images. Enforce content‑type + size limits in Storage rules.
- Access only if claim `societyId` matches the path; residents have **no** access to `expense-requests/` (quotations, invoices, evidence).
- Store only a `storagePath` reference + metadata (uploader, size, type, uploadedAt) in Firestore.
- Hardening: malware scan + signed‑URL expiry.

---

## 9. Security Rules Strategy

- **Default deny.** Every collection requires `isMember(societyId)` + role checks.
- Helpers: `isSignedIn()`, `isSuper()`, `societyOf()`, `hasRole(r)`, `isMember(sid)`.
- Reads scoped to caller's `societyId`; residents limited to `published == true` docs + own unit/ledger.
- Derived/ledger collections (`balances`, `transactions`, `auditLogs`, `accounts.currentBalance`) are **read‑only to clients**; Functions write via Admin SDK.
- Immutable fields (`societyId`, `createdBy`) can't change on update.
- **Rules test suite** (emulator + `@firebase/rules-unit-testing`) in CI — tenant isolation is a *tested* invariant.

---

## 10. Audit Trail (spec §5.6)

- Append‑only `/societies/{societyId}/auditLogs`; client cannot write/edit.
- Entry: `{ actorUid, actorRole, action, targetType, targetId, before, after, at, societyId }`.
- Emitted from trusted paths: expense created, invoice uploaded, quotation replaced, approval granted/rejected, payment recorded, charge model changed, role changed.
- Phase 1 covers financial mutations; full coverage = Phase 2.

---

## 11. Frontend Architecture

- **Desktop‑first, mobile‑friendly** (D15): rich desktop tables/dashboards; approval + dashboard flows fully responsive for MC on mobile.
- **Routing:** `react-router`; tenant context from claims at sign‑in held in `AuthContext` (current `societyId`, `role`).
- **Feature modules** mirror spec: `receivables/`, `payables/`, `dashboard/`, `forecasting/`, `admin/` (users, accounts, funds, config), `auth/`.
- **Data access layer:** typed repository hooks wrapping the SDK; all queries auto‑inject the active `societyId` (single choke point — no scattered `where('societyId', …)`).
- **Spreadsheet‑style grid** (D16) for collections/expenses: inline editing, bulk select, keyboard nav, import‑driven population.
- **Shared design language:** shared components, one theme, central money/date formatting → document in `DESIGN_LANGUAGE.md`.
- **RBAC in UI:** `<RequireRole>` guards + conditional rendering (UX only, not the security boundary).
- **Visualisation:** Sankey for Cash Balance dashboard (`@nivo/sankey` / ECharts — TBD).
- **Exports:** client‑side simple Excel (SheetJS); server‑side Function for heavy/PDF.
- **Full data control:** every user‑owned entity viewable / editable / deletable / exportable from the UI within role limits.

---

## 12. Non‑Functional Requirements

| Area | Requirement |
|------|-------------|
| Security | Tenant isolation via rules + claims; separation of duties; least‑privilege roles; secrets in Functions config. |
| Performance | Smooth at 564 units × many months × many societies. Virtualised grids; paginate; rely on rollups for dashboards. |
| Scalability | N societies from day one (sharded by `societyId`); no global hotspots; collection‑group queries indexed. |
| Cost | Minimise reads via rollups + TanStack Query cache; batch imports; avoid per‑keystroke writes. |
| Reliability | Idempotent Functions; transactional financial writes; emulator tests in CI. |
| Usability | Desktop‑first responsive; dashboard‑first nav; easy export. |
| Observability | Function logs + error reporting; import/approval/payment outcomes surfaced to users. |
| Environments | Separate dev / staging / prod projects; seed + emulator data locally. |

---

## 13. Phasing

| Phase | Scope |
|-------|-------|
| **Phase 1 (MVP)** | Tenancy + Auth + RBAC; super‑admin onboarding; society config (chargeModel, FY, accounts, fund heads, approval); Account Receivables (collection import, full‑payment tracking, vendor income); Account Payables (recurring scheduled payments [Admin CRUD / FM execute / monthly view], maintenance + snag expense requests on the 4‑stage workflow with tiered approvals, partial disbursements, MC notes, date/status filters; snag **scheduling** with budget windows + a **Scheduled items** view; a shared **Requested queue** (aged oldest‑first) driving offline approve/withdraw calls); ledger/transactions + multi‑account & fund balances; document upload; in‑app + email notifications; Excel/PDF reports; financial‑mutation audit. |
| **Phase 2** | Cash Balance Dashboard (Sankey, rollups); **resident access** (published dashboards + own flat ledger); full audit trail; reminders; **WhatsApp notifications**; **Firestore→BigQuery export for SQL reporting**; **partial payments + arrears**. |
| **Phase 3** | Cash Flow Forecasting (future income/expense, monthly/quarterly/yearly, surplus/deficit) — analytics powered by BigQuery. |
| **Future** | Resident mobile app, payment gateway, bank reconciliation, GST/TDS, AI expense analysis, budget planning. |

---

## 14. Open Decisions / To Confirm

1. **Charting lib** for Sankey/dashboards — MUI X Charts (natural fit now that MUI is locked) vs `@nivo` vs ECharts.
3. **Phone OTP (deferred):** Phase‑4 follow‑up — needs Blaze + App Check/reCAPTCHA + SMS cost/region. P0 ships **email + Google** only.
4. **WhatsApp provider** + budget (Twilio vs Gupshup vs Meta Cloud API) — deferred to Phase 2; has per‑message cost.
5. **Collection import:** stays a generic Excel/CSV table parser with configurable column mapping; a real sample file will be provided later to finalise the default mapping.
6. **PDF generation** approach (Function + headless renderer vs library).
7. ~~Manual ledger entries~~ — **resolved (D9e):** manual/non‑request `transactions` (opening balances, bank interest) are **Admin‑only**; FM never posts money outside an approved request.
8. **Data retention / export‑all & delete** policy per society (offboarding).
9. **Platform billing model** (per‑society subscription?) — affects super‑admin module.

---

*Next step: confirm §14 items, then expand into (a) a concrete Firestore schema + security‑rules skeleton and (b) a Phase‑1 build plan / repo scaffold.*
