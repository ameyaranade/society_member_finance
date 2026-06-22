# Design Language

**Project:** Multi‑Society Financial Management Web Application
**Stack:** React + TypeScript + **MUI v6** (+ MUI X DataGrid / Charts)
**Status:** v0.1 — establishes the shared visual + interaction system every screen must follow.
**Last updated:** 2026-06-20

> This is the single source of truth for look, feel, and behaviour. Every feature uses these shared tokens and components — no per‑screen one‑offs. The mockups in chat (admin settings, FM payments, MC approval, resident view, scheduled expense, multi‑row sheet) all conform to this.

Three non‑negotiables, set by the product owner:
1. **Accessible** — high contrast, scalable/changeable fonts, non‑English locales, comfortable for older readers.
2. **Dark & light mode** — every colour works in both.
3. **Consistency** — shared tokens + components; the app looks like one product everywhere.

---

## 1. Foundations

### 1.1 Implementation model
- A single **MUI `ThemeProvider`** holds all tokens (palette, typography, spacing, shape, components). **Screens never hard‑code colours, fonts, or sizes** — they read from the theme (`sx`, `theme.palette.*`, `theme.typography.*`).
- Two palettes — `light` and `dark` — share the **same semantic token names**, so components are theme‑agnostic.
- Tokens are also exposed as **CSS variables** (MUI `cssVariables: true`) for non‑MUI surfaces.
- The mockup hexes are illustrative; the **semantic tokens below are authoritative** and colours/themes can be retuned later without touching components.

### 1.2 Theme switching
- Modes: **System (default) · Light · Dark**, user‑selectable, **persisted per user** (profile setting + `prefers-color-scheme` fallback).
- No flash on load (resolve mode before first paint).

---

## 2. Accessibility (WCAG 2.1 AA baseline)

This is a requirement, not a nice‑to‑have. Target **AA everywhere; AAA for body text where feasible.**

| Concern | Rule |
|---------|------|
| **Contrast** | Text ≥ **4.5:1** (≥ 3:1 for ≥ 18.66px bold / 24px regular). UI borders/icons ≥ **3:1**. Verify every token pair in both themes. |
| **Don't rely on colour alone** | Status, errors, and meaning always pair colour with an **icon and/or text label** (e.g. status chips show a tick + "Paid"). |
| **Scalable type** | All sizes in **rem**; layouts reflow to **200% zoom** and to a user font‑size setting (see §3). Never px‑locked text. |
| **Readable for older users** | Generous default sizes (body ≥ 16px), line‑height ≥ 1.5, ample spacing, **min usable text 13px** (captions only). |
| **Target size** | Interactive targets ≥ **44×44px** on touch, ≥ 24px on pointer; adequate spacing between hit areas. |
| **Keyboard** | Full keyboard operability incl. the DataGrid (cell nav, edit, bulk‑select); visible **focus ring** (2px, `palette.focus`), logical tab order, no traps. |
| **Screen readers** | Semantic HTML + ARIA; every icon‑only button has `aria-label`; tables/grids have headers; live regions announce import/approval/save results. |
| **Forms** | Labels always visible (not placeholder‑only); errors described in text + `aria-describedby`, not colour only. |
| **Motion** | Respect `prefers-reduced-motion`; keep transitions ≤ 200ms, no essential info conveyed by motion. |
| **Tooling** | axe / Lighthouse a11y checks in CI; manual screen‑reader pass on core flows. |

---

## 3. Typography

### 3.1 Font family (multi‑script by design)
Societies are in India → the stack must render **Latin + Indic scripts** cleanly:

```
"Inter", "Noto Sans", "Noto Sans Devanagari", "Noto Sans Telugu",
"Noto Sans Tamil", system-ui, sans-serif
```
- **Noto** family guarantees coverage for Devanagari/Telugu/Tamil/etc. so non‑English locales never show tofu (□).
- Numerals/currency use the same stack; tabular figures for aligned amounts in grids.

### 3.2 User‑changeable size
- A **text‑size control** (Default / Large / Extra‑large) scales the **root rem**; because all type is rem‑based, the whole UI scales proportionally. Persisted per user. (Shown as the "Aa" control in the resident header.)

### 3.3 Scale (rem @ 16px root)
| Role | Size | Weight | Line‑height |
|------|------|--------|-------------|
| Display / page title | 1.5rem (24px) | 500 | 1.3 |
| Section title | 1.125rem (18px) | 500 | 1.4 |
| Subtitle | 1rem (16px) | 500 | 1.5 |
| **Body (default)** | **1rem (16px)** | 400 | 1.6 |
| Secondary / label | 0.875rem (14px) | 400 | 1.5 |
| Caption (min) | 0.8125rem (13px) | 400 | 1.4 |

- **Two weights only: 400 / 500.** No 600+/uppercase. Sentence case everywhere.
- Key figures (amounts, balances) may go 1.25–1.5rem/500 for scannability.

---

## 4. Colour

Colour is defined as **semantic tokens** (same names in both themes), never raw hex in components.

### 4.1 Core semantic tokens
| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `primary` | `#185FA5` | `#85B7EB` | Brand, primary actions, active nav |
| `primary.contrastText` | `#FFFFFF` | `#042C53` | Text/icon on primary |
| `appBar` | `#185FA5` | `#0C447C` | Top bar (white text both modes) |
| `background.default` | `#FFFFFF` | `#1E1F1C` | Page |
| `background.surface` | `#F7F6F2` | `#26271F`* | Cards, drawers, metric tiles |
| `text.primary` | `#1F1F1D`* | `#ECEAE3` | Body |
| `text.secondary` | `#5F5E5A` | `#B4B2A9` | Labels, hints |
| `divider` | `#D3D1C7` | `#444441` | Borders, rules |
| `focus` | `#185FA5` | `#85B7EB` | Focus ring |

\* Indicative; final values tuned to hit AA. All pairs above target ≥ 4.5:1 for text.

### 4.2 Status (semantic + always icon‑paired)
| Status | Icon | Light (bg / text) | Dark (bg / text) |
|--------|------|-------------------|------------------|
| Paid / Approved / Success | `circle-check` | `#E1F5EE` / `#085041` | `#0F3A2E` / `#5DCAA5` |
| Pending / Warning | `clock` | `#FAEEDA` / `#633806` | `#3A2F12` / `#FAC775` |
| Overdue / Rejected / Error | `alert-triangle` | `#FCEBEB` / `#791F1F` | `#3A1414` / `#F09595` |
| Neutral / Draft | `point` | `#F1EFE8` / `#444441` | `#2C2C2A` / `#B4B2A9` |
| Info | `info-circle` | `#E6F1FB` / `#0C447C` | `#0C2A45` / `#85B7EB` |

**Rule:** a status is **never** communicated by colour alone — always chip background **+** icon **+** text label.

### 4.3 Categorical (charts only)
A fixed, colour‑blind‑considerate ordered palette for expense/income categories (Sankey, breakdowns), defined once in the theme and reused so a category is the same colour everywhere. Pair chart segments with labels/legend, never colour‑only.

---

## 5. Layout, spacing & shape

- **Spacing scale:** 8px base (`theme.spacing`): 4, 8, 12, 16, 24, 32. Use tokens, not magic numbers.
- **Radius:** `sm` 8px (controls, chips), `md` 12px (cards/drawers/modals), `pill` for avatars only.
- **Elevation:** flat, border‑first. Cards = surface + 1px divider border; reserve real shadow for transient overlays (menus, dialogs).
- **Density:** comfortable by default (older‑reader friendly); the DataGrid offers a compact toggle for power users — never below 13px / 40px row height.
- **Breakpoints (MUI):** desktop‑first shells (admin, FM, sheet) collapse the side‑nav to a drawer < `md`; **mobile‑first** flows (MC approval, resident) are designed at 360px up.

---

## 6. Component inventory (shared, MUI‑based)

One canonical implementation each — features compose these, never fork them.

- **App shell:** top `AppBar` (brand, society switcher, user menu) + responsive side `Navigation`.
- **Buttons:** `primary` (contained), `secondary` (outlined), `text`/ghost, `danger` (outlined error). One primary action per view.
- **Status chip:** the §4.2 component (bg + icon + label).
- **DataGrid (MUI X):** the standard for all tabular data — sorting, filtering, column show/hide, inline edit, checkbox multi‑select, bulk‑action bar, CSV export. Stage‑then‑save (see §7).
- **Form drawer** (right) for record/edit; **Modal dialog** (centered) for create‑with‑preview and confirms.
- **Fields:** labelled `TextField`/`Select`/date pickers; money input formats to the society currency; helper/error text below.
- **Metric tile:** surface tile, secondary label + large figure (amounts).
- **Empty / loading / error states:** every list/table defines all three (skeletons, not spinners, for tables).
- **Toasts/Snackbars** for async outcomes; **inline banners** for read‑only/published notices.

---

## 7. Interaction patterns (consistency)

| Pattern | Standard |
|---------|----------|
| Record / edit a single item | **Right form drawer** (FM record‑payment). |
| Create with consequences | **Centered modal** with a live preview (new recurring expense → "next runs"). |
| Bulk table editing | DataGrid: select rows → **bulk‑action bar**; inline edits show a **dirty dot**; **stage‑then‑save** with an unsaved‑changes bar (never autosave financial cells). |
| Approvals | Detail view with quote comparison + **vote progress**; actions: Approve / Reject / Request clarification (reject & clarify require a comment). |
| Destructive / financial confirm | Confirmation dialog naming the exact effect. |
| Async result | Snackbar + (for long jobs like import) a result summary with per‑row errors. |
| Read‑only context | Inline "Published · read only" banner (resident, locked periods). |

---

## 8. Internationalisation

- **All UI strings externalised** (`react-i18next`); no hard‑coded copy. English first; structure ready for additional locales (incl. Indian languages).
- **Locale‑aware formatting** via `Intl`: numbers, **₹ currency**, and dates respect locale; amounts stored as integer paise, formatted at the edge.
- **RTL‑ready:** MUI `direction` + `stylis-plugin-rtl`; use logical CSS (`marginInlineStart`, not `left`) so a future RTL locale needs no rework.
- **No text baked into images/icons** (icons are decorative + `aria-label`).

---

## 9. Definition of done (per screen)

A screen is consistent + accessible only when:
- [ ] Uses theme tokens + shared components — zero hard‑coded colours/fonts/sizes.
- [ ] Renders correctly in **light and dark**, and at the **Large** text setting / 200% zoom.
- [ ] All contrast pairs ≥ AA; status conveyed by icon **+** label, not colour alone.
- [ ] Fully keyboard operable with visible focus; icon‑only controls labelled.
- [ ] All copy via i18n; numbers/dates/currency locale‑formatted.
- [ ] Empty / loading / error states defined.
- [ ] axe/Lighthouse a11y check passes in CI.
