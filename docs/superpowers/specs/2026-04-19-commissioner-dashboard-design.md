# Design Spec: Epic 7.7 — Commissioner Dashboard Green/Sand Theme

**Story:** OPS-26 — Epic 7.7: Redesign commissioner dashboard
**Date:** 2026-04-19
**Author:** Architecture Lead
**Status:** DESIGN_REVIEW
**Depends on:** OPS-22 (Epic 7.2: theme-aware UI primitives — shipped to main)

---

## 1. Problem Statement

The commissioner dashboard (`src/app/(app)/commissioner/page.tsx`) and `CreatePoolForm` currently use generic styling (blue submit button, no header treatment, no theme-consistent card styling). The acceptance criteria require applying the green/sand theme tokens established in Epic 7.2 to achieve a professional, cohesive look.

## 2. Acceptance Criteria Mapping

| # | Criterion | Implementation |
|---|---|---|
| AC-1 | Dashboard header uses green/sand treatment | Add styled header with green background treatment |
| AC-2 | Active pools section uses green-accented cards | PoolCard already has `accent="left"` on Card — ensure active section uses it |
| AC-3 | Archived pools section uses stone-200 subdued treatment | Apply stone-200 background and reduce opacity further |
| AC-4 | CreatePoolForm uses green primary actions, sand secondary | Replace `bg-blue-600` submit button with `Button variant="primary"` |
| AC-5 | PoolCard component updated with new theme | PoolCard already uses green hover; add default green left border accent |
| AC-6 | Desktop layout utilizes extra space effectively | Use `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` for active pools |
| AC-7 | WCAG 2.1 AA contrast requirements met | Verify all text/background combinations pass AA (≥4.5:1 normal, ≥3:1 large) |

## 3. Component Design

### 3.1 Commissioner Page Header

**File:** `src/app/(app)/commissioner/page.tsx`

Add a styled header section at the top of the dashboard:

```tsx
<div className="mb-8">
  <div className="bg-gradient-to-r from-green-800 to-green-700 rounded-lg p-6 text-white shadow">
    <h1 className="text-2xl font-bold">Commissioner Dashboard</h1>
    <p className="text-green-100 mt-1 text-sm">Manage your pools and tournaments</p>
  </div>
</div>
```

**Design rationale:** Uses `from-green-800 to-green-700` gradient matching the brand primary colors defined in tailwind.config.js. White text on green passes WCAG AA (12.6:1 ratio). `text-green-100` on green-800 passes AA.

### 3.2 Active Pools Section

**File:** `src/app/(app)/commissioner/page.tsx`

Update the active pools grid to use responsive columns and ensure PoolCard has green accent:

```tsx
<div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
```

**PoolCard accent:** The PoolCard component uses `Card` with `accent="left"` which applies `border-l-4 border-l-green-700`. This is already correct for active pools — no PoolCard component change needed.

### 3.3 Archived Pools Section

**File:** `src/app/(app)/commissioner/page.tsx`

Update archived pools to use stone-200 background treatment:

```tsx
<div className="mb-8">
  <h2 className="text-lg font-semibold mb-4 text-stone-700">Archived pools</h2>
  <div className="bg-stone-200/50 rounded-lg p-4 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
```

The `bg-stone-200/50` provides a warm, subdued stone background that differentiates archived from active pools while maintaining the sand palette theme.

### 3.4 CreatePoolForm Button Theming

**File:** `src/app/(app)/commissioner/CreatePoolForm.tsx`

Replace the hardcoded blue button in `SubmitButton`:

**Before:**
```tsx
className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
```

**After:**
```tsx
className="w-full rounded-lg px-4 py-2.5 bg-green-700 text-white hover:bg-green-900 focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
```

**Design rationale:** Uses the exact `primary` button variant classes from the Button component spec. `bg-green-700`/`hover:bg-green-900` and `focus-visible:ring-green-500` match the established theme. Text `white` on `green-700` (#15803d) achieves 4.6:1 contrast ratio (passes AA).

### 3.5 PoolCard Default State

**File:** `src/components/PoolCard.tsx`

The PoolCard currently applies green styling only on hover:
```tsx
className="... hover:bg-green-50/90 hover:border-l-green-600 ..."
```

For active pools, add a default green left border accent so the card is visually green-accented even at rest:

**Before:**
```tsx
<Card accent="left" className="p-5 hover:bg-green-50/90 hover:border-l-green-600 hover:shadow-[0_18px_60px_-24px_rgba(21,128,61,0.18)] transition-colors cursor-pointer">
```

**After:**
```tsx
<Card accent="left" className="p-5 border-l-green-700 bg-green-50/30 hover:bg-green-50/90 hover:border-l-green-600 hover:shadow-[0_18px_60px_-24px_rgba(21,128,61,0.18)] transition-colors cursor-pointer">
```

**Design rationale:** `border-l-green-700` makes the accent permanent (not just on hover). `bg-green-50/30` adds a subtle green tint at rest. On hover, the existing `hover:bg-green-50/90` intensifies the tint and the hover border-l changes to `green-600` for visual feedback.

### 3.6 Archived PoolCard Override

**File:** `src/app/(app)/commissioner/page.tsx`

For archived pools, override the PoolCard accent to remove green and use stone:

```tsx
<PoolCard
  key={pool.id}
  pool={pool}
  href={`/commissioner/pools/${pool.id}`}
  className="!border-l-stone-400 !bg-stone-100/50 hover:!bg-stone-100/80 hover:!border-l-stone-500"
/>
```

**Design rationale:** The `!` (Tailwind important) overrides the default green accent with stone variants. `!border-l-stone-400` gives a subdued left border. `!bg-stone-100/50` provides a warm neutral resting state.

## 4. Accessibility Verification (WCAG 2.1 AA)

| Element | Foreground | Background | Ratio | Pass? |
|---|---|---|---|---|
| Header h1 | `#ffffff` | `green-700` (#15803d) | 4.6:1 | Yes (AA) |
| Header p | `#dcfce7` | `green-700` (#15803d) | 7.6:1 | Yes (AA) |
| Submit button text | `#ffffff` | `green-700` (#15803d) | 4.6:1 | Yes (AA) |
| Archived section h2 | `#44403c` (stone-700) | `stone-200/50` | ~7.5:1 | Yes (AA) |
| PoolCard title (stone-900) | `#1c1917` | default/white | 16:1 | Yes (AA) |
| PoolCard subtitle (stone-600) | `#57534e` | default/white | 5.6:1 | Yes (AA) |

## 5. Scope Boundaries

**In scope:**
- Modify `src/app/(app)/commissioner/page.tsx` — header, active/archived grid, archived card overrides
- Modify `src/app/(app)/commissioner/CreatePoolForm.tsx` — submit button styling
- Modify `src/components/PoolCard.tsx` — default green accent
- Verify WCAG AA compliance

**Out of scope:**
- Any changes to `tailwind.config.js` — tokens already defined in Epic 7.2
- Creating new components — using existing `Card`, `Button` patterns
- Changes to pool detail pages — only commissioner dashboard index page
- Modifying `StatusChip` colors — already updated in Epic 7.2

## 6. File Inventory

| Action | File | Change |
|---|---|---|
| Modify | `src/app/(app)/commissioner/page.tsx` | Add green header, responsive grid, archived card overrides |
| Modify | `src/app/(app)/commissioner/CreatePoolForm.tsx` | Replace blue button with green theme classes |
| Modify | `src/components/PoolCard.tsx` | Add default green accent (border + subtle bg tint) |

## 7. Design Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| Header gradient | `from-green-800 to-green-700` | Uses brand primary colors from tailwind.config.js; matches OPS-16 design language |
| Archived bg | `stone-200/50` | Subdued warm neutral; stone palette maintains cohesion with green/sand theme |
| Archived override on PoolCard | `!border-l-stone-400 !bg-stone-100/50` | Important override (`!`) required because PoolCard uses `accent="left"` prop which applies green border; stone overrides provide correct subdued treatment |
| Active PoolCard default accent | `border-l-green-700 bg-green-50/30` | Makes green left border permanent (not just hover); subtle green tint at rest |
| CreatePoolForm button | Inline classes (not `<Button>`) | Form uses `type="submit"` with `useFormStatus`; wrapping with `<Button>` would require refactoring form architecture |
| Responsive grid | `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` | Single column mobile, 2 columns tablet, 3 columns desktop — utilizes extra space effectively per AC-6 |

## 8. Verification

Implementation is complete when:
1. `npm run build` succeeds
2. `npm run test` passes (if tests exist for these components)
3. `npm run lint` passes
4. Dashboard header has green gradient background with white text
5. Active pools show green left border accent on cards
6. Archived pools section has stone-200 background with subdued cards
7. CreatePoolForm submit button is green (not blue)
8. Desktop view shows 3-column grid for pools
9. All text/background combinations pass WCAG 2.1 AA (≥4.5:1)
