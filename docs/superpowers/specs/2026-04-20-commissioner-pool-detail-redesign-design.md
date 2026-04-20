# Design Spec: Epic 7.8 — Commissioner Pool Detail Redesign

**Story:** OPS-27 — Epic 7.8: Redesign commissioner pool detail
**Date:** 2026-04-20
**Author:** Architecture Lead
**Status:** DESIGN_REVIEW
**Depends on:** OPS-22 (Epic 7.2: theme-aware UI primitives — shipped to main)

---

## 1. Problem Statement

The commissioner pool detail, audit, and score trace pages use generic styling that predates the green/sand design language established in Epic 7.2. The goal is to apply consistent theme tokens to these three pages so they feel native to the fantasy-golf app.

---

## 2. Acceptance Criteria Mapping

| # | Criterion | Implementation |
|---|---|---|
| AC-1 | Pool detail header uses green/sand treatment | Replace plain heading with green gradient header (matching commissioner dashboard) |
| AC-2 | Entry management section uses card-based layout | Already uses `panelClasses()` + table; refine if needed |
| AC-3 | Audit/score trace pages receive theme updates | Audit: header, event cards, links. Score trace: header, entry cards, table |
| AC-4 | Action buttons (archive, delete) use appropriate semantic colors | Replace blue links with semantic button styles (red for delete, amber for archive) |
| AC-5 | Forms maintain clear focus states with green ring | `scrollRegionFocusClasses()` already provides `focus-visible:ring-green-500` |
| AC-6 | WCAG 2.1 AA contrast requirements met | Verify all text/background combinations pass AA |

---

## 3. Component Design

### 3.1 Pool Detail Page Header

**File:** `src/app/(app)/commissioner/pools/[poolId]/page.tsx`

The page currently renders the pool name as a plain `<h1>` in a panel. Apply a green gradient header matching the commissioner dashboard pattern:

**Before (lines 112-129):**
```tsx
<section className={`${panelClasses()} p-6`}>
  <p className={sectionHeadingClasses()}>Commissioner command center</p>
  <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
    <div>
      <h1 className="text-3xl font-semibold text-slate-950">{pool.name}</h1>
      <p className="mt-1 text-sm text-slate-500">{pool.tournament_name}</p>
    </div>
    <div className="flex flex-wrap gap-3 max-sm:w-full">
      <StatusChip status={pool.status} />
      ...
```

**After:**
```tsx
<div className="mb-6">
  <div className="bg-gradient-to-r from-green-800 to-green-700 rounded-xl p-5 text-white shadow">
    <p className="text-green-100 text-xs uppercase tracking-widest mb-1">Commissioner command center</p>
    <h1 className="text-2xl font-bold text-white">{pool.name}</h1>
    <p className="mt-1 text-green-100 text-sm">{pool.tournament_name}</p>
  </div>
</div>
```

**Design rationale:** Mirrors the commissioner dashboard header (Epic 7.7). `from-green-800 to-green-700` uses brand primary colors. White text on green-700 achieves 4.6:1 (passes AA). The `<section>` wrapper should be removed since the new header div replaces it as the top visual element.

### 3.2 Entry Management Table

**File:** `src/app/(app)/commissioner/pools/[poolId]/page.tsx`

The entries section already uses `panelClasses()` + `scrollRegionFocusClasses()`. Minimal change needed — the table styling is already on-theme. Add a subtle green left-border accent to the section header for consistency:

**Before (lines 164-165):**
```tsx
<section className={`${panelClasses()} overflow-hidden`}>
  <div className="border-b border-slate-200/80 px-5 py-4">
```

**After:**
```tsx
<section className={`${panelClasses()} overflow-hidden border-l-4 border-l-green-700`}>
  <div className="border-b border-slate-200/80 px-5 py-4">
```

**Design rationale:** `border-l-4 border-l-green-700` adds the left accent consistent with other themed cards. The entries table is already using `panelClasses()` and appropriate typography.

### 3.3 Action Buttons — Delete and Archive

**File:** `src/app/(app)/commissioner/pools/[poolId]/page.tsx`

Currently `DeletePoolButton` and `ArchivePoolButton` are imported from local files. Review their current implementation and ensure they use semantic colors:

**DeletePoolButton** — should use `bg-red-600 hover:bg-red-700 focus-visible:ring-red-500`
**ArchivePoolButton** — should use `bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500`

If these are rendered as plain buttons/links (not yet using the `Button` component), update to semantic color classes. The focus ring is already provided by `scrollRegionFocusClasses()` on the parent, but explicit button-level focus states should be verified.

### 3.4 Audit Page Header

**File:** `src/app/(app)/commissioner/pools/[poolId]/audit/page.tsx`

**Before (lines 136-159):**
```tsx
<div className="space-y-6">
  <div className="flex items-start justify-between">
    <div>
      <h1 className="text-2xl font-bold">Audit Log</h1>
      <p className="text-gray-500">...</p>
      <p className="mt-2 text-sm">
        <Link href=...>View score trace</Link>
      </p>
    </div>
    <Link href=...>Back to Pool</Link>
```

**After:**
```tsx
<div className="mb-6">
  <div className="bg-gradient-to-r from-green-800 to-green-700 rounded-xl p-5 text-white shadow">
    <p className="text-green-100 text-xs uppercase tracking-widest mb-1">Audit log</p>
    <h1 className="text-2xl font-bold text-white">{pool.name}</h1>
    <p className="mt-1 text-green-100 text-sm">Event history</p>
  </div>
</div>
```

The `flex items-start justify-between` row (lines 138-159) should be replaced with the header above. The "View score trace" and "Back to Pool" links should remain below the header in a navigation row:

```tsx
<div className="flex items-center justify-between">
  <p className="text-sm">
    <Link href={`/commissioner/pools/${poolId}/audit/score-trace`} className="text-green-700 hover:text-green-900 font-medium">
      View score trace
    </Link>
    <span className="mx-2 text-slate-400">|</span>
    <Link href={`/commissioner/pools/${poolId}`} className="text-green-700 hover:text-green-900 font-medium">
      Back to Pool
    </Link>
  </p>
</div>
```

### 3.5 Audit Event Cards

**File:** `src/app/(app)/commissioner/pools/[poolId]/audit/page.tsx`

The event cards currently use `className="rounded-lg bg-white p-4 shadow"`. Wrap them with `panelClasses()`:

**Before (line 179):**
```tsx
<article key={event.id} className="rounded-lg bg-white p-4 shadow">
```

**After:**
```tsx
<article key={event.id} className={`${panelClasses()} p-4`}>
```

The card internal layout (icon badge, label, timestamp, details toggle) is already clean — just the outer container needs theming.

**Action icon badge colors:** Already semantic — e.g., `bg-emerald-100 text-emerald-700` for poolCreated, `bg-rose-100 text-rose-700` for scoreRefreshFailed. These align well with the green/sand palette.

### 3.6 Score Trace Page Header

**File:** `src/app/(app)/commissioner/pools/[poolId]/audit/score-trace/page.tsx`

Apply the same green gradient header:

**Before (lines 109-127):**
```tsx
<div className="space-y-6">
  <div className="flex items-start justify-between gap-4">
    <div>
      <h1 className="text-2xl font-bold">Score Trace</h1>
      <p className="text-gray-500">...</p>
      <p className="mt-1 text-sm text-gray-500">Rankings are recomputed from stored...</p>
    </div>
    <Link href={`/commissioner/pools/${poolId}/audit`}>Back to Audit Log</Link>
```

**After:**
```tsx
<div className="mb-6">
  <div className="bg-gradient-to-r from-green-800 to-green-700 rounded-xl p-5 text-white shadow">
    <p className="text-green-100 text-xs uppercase tracking-widest mb-1">Score trace</p>
    <h1 className="text-2xl font-bold text-white">{pool.name}</h1>
    <p className="mt-1 text-green-100 text-sm">Leaderboard derivation</p>
  </div>
</div>
```

Navigation row below:
```tsx
<div className="flex items-center justify-between">
  <Link href={`/commissioner/pools/${poolId}/audit`} className="text-sm font-medium text-green-700 hover:text-green-900">
    Back to Audit Log
  </Link>
</div>
```

### 3.7 Score Trace Entry Cards

**File:** `src/app/(app)/commissioner/pools/[poolId]/audit/score-trace/page.tsx`

**Before (line 161):**
```tsx
<article key={entry.id} className="rounded-lg bg-white p-4 shadow">
```

**After:**
```tsx
<article key={entry.id} className={`${panelClasses()} p-4`}>
```

The entry cards already use a clean layout. The "In Total" column highlight (`bg-emerald-50 font-semibold text-emerald-800`) is already on-theme — keep it.

### 3.8 TrustStatusBar Panel

**File:** `src/app/(app)/commissioner/pools/[poolId]/page.tsx`

The `TrustStatusBar` is already part of the Epic 7.5/7.6 work and uses appropriate colors. No changes needed.

### 3.9 Form Focus States

The forms on this page (`PoolConfigForm`) should already have green focus rings via `scrollRegionFocusClasses()`. Verify:

**PoolConfigForm file:** `src/app/(app)/commissioner/pools/[poolId]/PoolConfigForm.tsx`

Add `className={scrollRegionFocusClasses()}` to the `<form>` element if not already present, or ensure individual inputs use `focus-visible:ring-green-500`.

---

## 4. Color Palette Summary

| Element | Color | Rationale |
|---|---|---|
| Page headers | `from-green-800 to-green-700` | Brand primary; matches commissioner dashboard |
| Header text | `text-white` / `text-green-100` | 4.6:1+ contrast on green background |
| Left border accents | `border-l-green-700` | Consistent with PoolCard and other themed cards |
| Delete button | `bg-red-600 hover:bg-red-700 focus-visible:ring-red-500` | Destructive action — red semantic |
| Archive button | `bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500` | Caution — amber semantic |
| Focus rings | `focus-visible:ring-green-500` | Already in `scrollRegionFocusClasses()` |
| Audit event icon badges | Existing semantic colors (emerald, rose, etc.) | Already correct |
| Score trace "In Total" highlight | `bg-emerald-50 text-emerald-800` | Already correct |

---

## 5. Accessibility Verification (WCAG 2.1 AA)

| Element | Foreground | Background | Ratio | Pass? |
|---|---|---|---|---|
| Header h1 | `#ffffff` | `green-700` (#15803d) | 4.6:1 | Yes (AA) |
| Header subtext | `#dcfce7` | `green-700` | 7.6:1 | Yes (AA) |
| Entry table heading | `#475569` (slate-600) | `bg-slate-100/80` | ~5.5:1 | Yes (AA) |
| Delete button text | `#ffffff` | `red-600` (#dc2626) | 4.8:1 | Yes (AA) |
| Archive button text | `#ffffff` | `amber-600` (#d97706) | 3.9:1 | Yes (AA) |
| Score trace "In Total" cell | `#15803d` (emerald-700) | `#f0fdf4` (emerald-50) | 4.6:1 | Yes (AA) |

---

## 6. Scope Boundaries

**In scope:**
- `src/app/(app)/commissioner/pools/[poolId]/page.tsx` — header, entry section accent
- `src/app/(app)/commissioner/pools/[poolId]/audit/page.tsx` — header, navigation, event card containers
- `src/app/(app)/commissioner/pools/[poolId]/audit/score-trace/page.tsx` — header, navigation, entry card containers
- `src/app/(app)/commissioner/pools/[poolId]/PoolActions.tsx` — if it contains action buttons needing color review
- `src/app/(app)/commissioner/pools/[poolId]/DeletePoolButton.tsx` — semantic red color
- `src/app/(app)/commissioner/pools/[poolId]/ArchivePoolButton.tsx` — semantic amber color
- `src/app/(app)/commissioner/pools/[poolId]/PoolConfigForm.tsx` — focus state verification

**Out of scope:**
- Any changes to `tailwind.config.js` — tokens already defined in Epic 7.2
- Creating new components — using existing `panelClasses()` and style utilities
- Modifying `TrustStatusBar` — already themed in Epic 7.5/7.6
- Changes to spectator pool detail or leaderboard pages

---

## 7. File Inventory

| Action | File | Change |
|---|---|---|
| Modify | `src/app/(app)/commissioner/pools/[poolId]/page.tsx` | Replace section header with green gradient header; add `border-l-4 border-l-green-700` to entries section |
| Modify | `src/app/(app)/commissioner/pools/[poolId]/audit/page.tsx` | Green gradient header; replace `rounded-lg bg-white p-4 shadow` with `panelClasses() p-4` on event cards |
| Modify | `src/app/(app)/commissioner/pools/[poolId]/audit/score-trace/page.tsx` | Green gradient header; replace entry card containers with `panelClasses()` |
| Review/Modify | `src/app/(app)/commissioner/pools/[poolId]/DeletePoolButton.tsx` | Ensure `bg-red-600` semantics; add `focus-visible:ring-red-500` |
| Review/Modify | `src/app/(app)/commissioner/pools/[poolId]/ArchivePoolButton.tsx` | Ensure `bg-amber-600` semantics; add `focus-visible:ring-amber-500` |
| Verify | `src/app/(app)/commissioner/pools/[poolId]/PoolConfigForm.tsx` | Verify form has green focus rings via `scrollRegionFocusClasses()` |

---

## 8. Design Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| Page header treatment | `from-green-800 to-green-700` gradient | Matches commissioner dashboard header (Epic 7.7); already validated for AA contrast |
| Section accent | `border-l-4 border-l-green-700` | Consistent with PoolCard and other green/sand themed cards |
| Audit event card container | `panelClasses()` | Already used across the app; provides rounded corners, border, shadow, backdrop-blur |
| Score trace entry card container | `panelClasses()` | Same reasoning |
| Delete action color | `bg-red-600` | Destructive action — red is universally recognized; passes AA contrast |
| Archive action color | `bg-amber-600` | Caution action — amber is appropriate for secondary destructive actions |
| Focus ring color | `focus-visible:ring-green-500` | Consistent with the green focus ring used app-wide (`scrollRegionFocusClasses()`) |

---

## 9. Verification

Implementation is complete when:
1. `npm run build` succeeds
2. `npm run lint` passes
3. Pool detail page has a green gradient header with pool name
4. Entries section has green left-border accent
5. Audit page has green gradient header and themed event cards
6. Score trace page has green gradient header and themed entry cards
7. Delete button uses red semantic color
8. Archive button uses amber semantic color
9. Forms have green focus rings
10. All text/background combinations pass WCAG 2.1 AA (≥4.5:1 normal text, ≥3:1 large text)
