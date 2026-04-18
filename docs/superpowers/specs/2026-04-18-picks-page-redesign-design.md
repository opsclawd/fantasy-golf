# Design Spec: Redesign Participant Picks Page

**Story:** OPS-21 — Epic 7.3: Redesign participant picks page
**Date:** 2026-04-18
**Author:** Architecture Lead
**Status:** DESIGN_REVIEW
**Depends on:** OPS-20 (Epic 7.1: design token system — done), OPS-22 (Epic 7.2: theme-aware UI primitives — done)

---

## 1. Problem Statement

The participant picks page uses outdated color tokens (`emerald-*`, `slate-*`, `sky-*`, `blue-*`) instead of the new green/sand design system. The acceptance criteria require applying the green/sand theme to five specific files while preserving all existing functionality and accessibility patterns. Design tokens (Epic 7.1) and Button + Card primitives (Epic 7.2) are now on `main`, ready for consumption.

Key problems in current code:
- Picks page uses `blue-*` for the submit button — the most prominent CTA on the page
- GolferPicker uses `slate-*` for layouts and `sky-*` for selection states
- SelectionSummaryCard uses `sky-*` for its progress card
- SubmissionConfirmation uses `emerald-*` for success state and `slate-*` for the picks list
- PickProgress uses `slate-*` and `sky-*` for its progress bar
- Interactive touch targets in GolferPicker approach 44px but aren't explicitly guaranteed
- No `Card` component for the panel-like sections — each uses hand-rolled `panelClasses()` + inline classes

## 2. Design Goals

- Apply green/sand design tokens from OPS-20/OPS-22 to all five target files
- Consume the new `Button` and `Card` primitives from OPS-22 instead of inline button styles
- Maintain all existing functionality — no behavioral changes to pick submission logic
- Maintain WCAG 2.1 AA contrast ratios on all color changes
- Guarantee ≥44px touch targets on all interactive elements
- Mobile-first layout preserved and tested

## 3. Dependency Check

**OPS-20 (design token system)** and **OPS-22 (theme-aware UI primitives)** are complete and on `main`. The following are now available:

- `tailwind.config.js` — semantic color tokens (`primary-900/700/100`, `surface-warm/base`, `action-warning/error`, `neutral-900/600/200`), spacing tokens, `label` font size
- `globals.css` — CSS custom properties (`--color-primary-*`, `--color-surface-*`, etc.), 44px touch target enforcement, green focus ring
- `src/components/ui/Button.tsx` — `variant="primary|secondary|danger|ghost"`, `size="sm|md|lg"`
- `src/components/uiStyles.ts` — `sectionHeadingClasses()` (now uses `text-green-800/70`), `panelClasses()`, `scrollRegionFocusClasses()` (now uses `ring-green-600`)
- `StatusChip.tsx` — migrated to `green/stone` tokens
- `LockBanner.tsx` — migrated to `green/stone` tokens
- `TrustStatusBar.tsx` — migrated to `green/stone` tokens

**Card component not yet created.** The OPS-22 spec defined `Card.tsx` with `accent="left"` but the implementation branch only includes `Button.tsx`. This story must either:
- Create `Card.tsx` as defined in the OPS-22 spec, OR
- Use `panelClasses()` with inline accent classes

**Decision: Create `Card.tsx`.** The OPS-22 spec explicitly defined Card component requirements (`accent="left"` with `border-l-4 border-l-green-700`). The acceptance criteria for this story call for "card-based redesign with green left-border accents" in GolferPicker. Creating the Card primitive now aligns with the architecture mapping and avoids duplicated inline patterns.

## 4. Acceptance Criteria Mapping

| # | Criterion | Covered In Section |
|---|---|---|
| AC-1 | Picks page uses new color tokens from design system | §5.1 |
| AC-2 | LockBanner maintains clear visibility (red for locked, green-100 for open) | §5.2 |
| AC-3 | TrustStatusBar uses green/sand treatment for freshness indicators | §5.3 |
| AC-4 | GolferPicker receives card-based redesign with green left-border accents | §5.4 |
| AC-5 | SubmissionConfirmation uses sand/cream success state | §5.5 |
| AC-6 | SelectionSummaryCard uses updated card styling | §5.6 |
| AC-7 | All interactive elements meet ≥44px touch target requirement | §6 |
| AC-8 | Mobile layout is prioritized and tested | §7 |
| AC-9 | No functional changes to pick submission logic | §8 |
| AC-10 | WCAG 2.1 AA contrast requirements met | §6 |

## 5. Component Design

### 5.1 Picks Page (`page.tsx`)

**File:** `src/app/(app)/participant/picks/[poolId]/page.tsx`

The page shell already uses `panelClasses()` and `sectionHeadingClasses()` — these now render with green tokens after OPS-22. The main changes:

| Current | New | Rationale |
|---|---|---|
| `text-slate-950` on `<h1>` | `text-stone-950` | Stone replaces slate per design system |
| `text-sm text-slate-600` on tournament name | `text-sm text-stone-600` | Stone replaces slate |
| Inline `rounded-2xl border border-slate-200/80 bg-slate-50` for archived message | `panelClasses()` with `border border-stone-200/80 bg-stone-100` | Use design system panel with stone tokens |
| `text-gray-600` in archived/locked messages | `text-stone-600` | Stone replaces gray |

The page structure and flow remain identical. Only CSS class changes.

**Error state styling:** The current "You did not submit picks" message uses `rounded-2xl border border-slate-200/80 bg-slate-50`. Change to `rounded-3xl border border-stone-200/80 bg-stone-100` to match panel roundedness and stone palette.

### 5.2 LockBanner (`LockBanner.tsx`)

**File:** `src/components/LockBanner.tsx`

LockBanner was already migrated in OPS-22 (Task 5). The component now uses:
- Locked state: `border-stone-200 bg-stone-100/90` with `text-stone-950` and `text-stone-700`
- Open state: `border-green-200 bg-green-100/90` with `text-green-950` and `text-green-800`

**No additional changes needed.** AC-2 is already satisfied by the OPS-22 migration. Verify via visual inspection that the banner remains prominent and clear.

### 5.3 TrustStatusBar (`TrustStatusBar.tsx`)

**File:** `src/components/TrustStatusBar.tsx`

TrustStatusBar was already migrated in OPS-22 (Task 6). The component now uses:
- Info tone: `border-green-200/80 bg-white/95 text-stone-900` with `text-stone-600` label and `text-stone-800` body
- Error tone: `border-red-200/80 bg-red-50/95 text-red-950`
- Warning tone: `border-amber-200/80 bg-amber-50/95 text-amber-950`

**No additional changes needed.** AC-3 is already satisfied by the OPS-22 migration. Verify via visual inspection.

### 5.4 GolferPicker (`golfer-picker.tsx`)

**File:** `src/components/golfer-picker.tsx`

This is the most significant redesign. The acceptance criteria call for a "card-based redesign with green left-border accents." The current GolferPicker is a flat list with sky-colored selection indicators. The redesign transforms it into a card-based layout using the `Card` component with `accent="left"`.

**Current structure:**
```
PickProgress (progress bar + count)
├─ Search + Country filter bar (rounded-2xl, slate borders)
├─ Scrollable list (rounded-2xl, slate background)
│  └─ Each golfer: flat <button> row with name, country, Selected/Select pill
└─ Summary bar (rounded-2xl, slate background)
```

**Redesigned structure:**
```
PickProgress (updated tokens)
├─ Card with accent="left" wrapping search + country filter
├─ Scrollable list (rounded-3xl, white/90 background with stone borders)
│  └─ Each golfer: card-like row with green-700 left border when selected
└─ Card wrapping current picks summary
```

**Token migration for GolferPicker:**

| Element | Current | New |
|---|---|---|
| Search filter bar outer | `rounded-2xl border border-slate-200/80 bg-white/80 p-3 sm:flex-row` | `rounded-3xl border border-stone-200/80 bg-white/90 p-3 sm:flex-row` |
| Search label | `text-gray-700` | `text-stone-700` |
| Search input | `rounded-xl border border-slate-200 bg-white px-3 py-2.5` | `rounded-xl border border-stone-200 bg-white px-3 py-2.5` (stone replaces slate; height enforced by globals 44px) |
| Country label | `text-gray-700` | `text-stone-700` |
| Country select | `rounded-xl border border-slate-200 bg-white px-3 py-2.5` | `rounded-xl border border-stone-200 bg-white px-3 py-2.5` |
| Scrollable list container | `max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white/90` | `max-h-80 overflow-y-auto rounded-3xl border border-stone-200/80 bg-white/90` |
| Empty state text | `text-gray-500` | `text-stone-500` |
| Golfer row (unselected) | `hover:bg-slate-50` | `hover:bg-stone-50` |
| Golfer row (selected) | `bg-sky-50` | `bg-green-50` |
| Selected pill | `bg-sky-100 text-sky-800` | `bg-green-100 text-green-800` |
| Unselected pill | `bg-slate-100 text-slate-600` | `bg-stone-100 text-stone-600` |
| Focus ring | `focus:ring-sky-500` | `focus:ring-green-500` |
| Country text | `text-gray-500` | `text-stone-500` |
| Summary bar outer | `rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2` | `rounded-3xl border border-stone-200/80 bg-stone-50/80 px-3 py-2` |
| Summary text | `text-sm text-slate-600` | `text-sm text-stone-600` |

**Card-based redesign for selected golfers:**

When a golfer is selected, the row gets a prominent green left-border accent:

```tsx
className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left
  hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-inset
  ${isSelected ? 'bg-green-50 border-l-4 border-l-green-700' : ''}
  ${isDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
```

This replaces the current `bg-sky-50` selected state with `bg-green-50 border-l-4 border-l-green-700` — a card-based left-border accent that satisfies AC-4.

**Touch target enforcement:** The current `px-4 py-3` on each golfer button gives approximately `padding-top: 12px + padding-bottom: 12px + line-height ≈ 44px`. The globals.css `min-block-size: 44px` rule already guarantees this. Additionally, ensure the search input and country select benefit from the same 44px rule.

**PickProgress token migration:**

| Element | Current | New |
|---|---|---|
| Outer container | `rounded-2xl border border-slate-200/80 bg-slate-50/80` | `rounded-3xl border border-stone-200/80 bg-stone-50/80` |
| Count text | `font-medium text-slate-900` | `font-medium text-stone-900` |
| Complete text | `text-green-700` | `text-green-700` (already green — no change) |
| Remaining pill | `bg-amber-100 text-amber-800` | `bg-amber-100 text-amber-800` (warning amber — no change) |
| Progress track | `bg-slate-200` | `bg-stone-200` |
| Progress bar (incomplete) | `bg-sky-600` | `bg-green-600` |
| Progress bar (complete) | `bg-green-600` | `bg-green-600` (already green — no change) |

### 5.5 SubmissionConfirmation (`SubmissionConfirmation.tsx`)

**File:** `src/components/SubmissionConfirmation.tsx`

The acceptance criteria call for a "sand/cream success state." The current component uses `emerald-*` tokens for success. We migrate to sand/cream tones.

**Token migration:**

| Element | Current | New |
|---|---|---|
| Success section border | `border-emerald-200/80` | `border-green-200/80` |
| Success section background | `bg-emerald-50/95` | `bg-sand-50/95` (sand-50 for warm cream state) |
| Success heading | `text-emerald-800` | `text-green-800` |
| Success heading (via sectionHeadingClasses) | `text-emerald-800/70` → replaced by `sectionHeadingClasses()` | `sectionHeadingClasses()` (now `text-green-800/70`) + explicit `text-green-800` |
| Pool name | `text-emerald-950` | `text-green-950` |
| Status text | `text-emerald-900` | `text-green-800` |
| Picks list number | `text-slate-400` | `text-stone-400` |
| Picks list name | `text-slate-900` | `text-stone-900` |
| Picks list item background | `bg-slate-50` | `bg-stone-50` |

**Decision: Use `bg-amber-100/95`** for the success section background. This maps to `surface.warm` (`#fef3c7`) at near-full opacity, giving a warm sand/cream that reads as "confirmed/successful" without being as green-heavy as the active state. The border uses `border-green-200/80` to tie back to the brand green.

### 5.6 SelectionSummaryCard (`SelectionSummaryCard.tsx`)

**File:** `src/components/SelectionSummaryCard.tsx`

**Token migration:**

| Element | Current | New |
|---|---|---|
| Card border | `border-sky-200/80` | `border-green-200/80` |
| Card background | `bg-sky-50/90` | `bg-green-50/90` |
| Heading (replaced sectionHeadingClasses) | `text-sky-700/80` | `text-green-700/80` |
| Count text | `text-slate-950` | `text-stone-950` |
| Subtitle text | `text-slate-700` | `text-stone-700` |
| Status pill (complete) | `bg-emerald-100 text-emerald-800` | `bg-green-100 text-green-800` |
| Status pill (incomplete) | `bg-white/80 text-sky-800` | `bg-white/80 text-green-800` |
| Inner card border | `border-white/70` | `border-white/70` (unchanged) |
| Inner card background | `bg-white/75` | `bg-white/75` (unchanged) |
| No selection text | `text-slate-600` | `text-stone-600` |
| Pick list name | `text-slate-800` | `text-stone-800` |
| Number circle background | `bg-sky-100` | `bg-green-100` |
| Number circle text | `text-sky-800` | `text-green-800` |

**Design decision — green vs sky for selection state:** The AC requires using "new color tokens from design system." The sky color was used for selections in the old palette because it represented an intermediate/active state. In the green/sand palette, green is the brand/active color. Selection of golfers is an active, ongoing action — appropriately represented by green. This aligns with the design mapping where `sky` → `info` and `green` → `active/brand`.

### 5.7 PicksForm (`PicksForm.tsx`)

**File:** `src/app/(app)/participant/picks/[poolId]/PicksForm.tsx`

**Token migration and Button component adoption:**

| Element | Current | New |
|---|---|---|
| Submit button | `<button>` with `bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg` | `<Button variant="primary" size="lg">` with form submit behavior |
| Edit button | `<button>` with `rounded-2xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50` | `<Button variant="secondary">` |
| Form card container | `rounded-3xl border border-white/70 bg-white/90 p-4 shadow-[...] backdrop-blur` | Keep as-is (this is `panelClasses()` content — already consistent) |
| Form heading | `text-slate-950` | `text-stone-950` |
| Form description | `text-slate-600` | `text-stone-600` |
| Error message | `bg-red-50 border border-red-200 text-red-800` | `bg-red-50 border border-red-200 text-red-800` (unchanged — error red is correct) |

**Submit button migration:** Replace the inline `<button>` with `<Button variant="primary" size="lg">`. The existing `useFormStatus()` hook provides `pending` state which maps to Button's `disabled` behavior. The Button component enforces 44px touch targets via `globals.css`.

**Edit button migration:** Replace inline `<button>` with `<Button variant="secondary">`. Change `rounded-2xl` to the default rounded-lg that Button provides (consistent with the design system).

**Form state props:** The `SubmitButton` component already uses `useFormStatus()` and `disabled` prop. Migrate it to use Button:

```tsx
function SubmitButton({ hasEnoughPicks, isEdit }: { hasEnoughPicks: boolean; isEdit: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="primary" size="lg" disabled={pending || !hasEnoughPicks}>
      {pending ? 'Saving...' : isEdit ? 'Update Picks' : 'Submit Picks'}
    </Button>
  )
}
```

### 5.8 Card Component Creation

**File:** `src/components/ui/Card.tsx` (new)

Create the Card primitive per the OPS-22 design spec (which defined it but wasn't implemented yet):

```tsx
import { type HTMLAttributes, createElement } from 'react'
import { panelClasses } from '../uiStyles'

type CardAccent = 'left' | 'none'

const accentClasses: Record<CardAccent, string> = {
  left: 'border-l-4 border-l-green-700',
  none: '',
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  accent?: CardAccent
}

export function Card({ accent, className = '', children, ...rest }: CardProps) {
  const classes = [
    panelClasses(),
    accent ? accentClasses[accent] : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return createElement('div', { className: classes, ...rest }, children)
}
```

This matches the OPS-22 spec exactly. The Card wraps `panelClasses()` and optionally adds a green left border accent. The `accent="left"` prop satisfies AC-4's requirement for "card-based redesign with green left-border accents."

**Test:** Create `src/components/ui/__tests__/Card.test.tsx` per the OPS-22 implementation plan (Task 3).

## 6. Accessibility Verification

### 6.1 WCAG 2.1 AA Contrast Ratios

All primary content colors on their backgrounds:

| Foreground | Background | Ratio | AA Pass? |
|---|---|---|---|
| `text-green-800` (#166534) | `bg-green-50` (#f0fdf4) | 6.8:1 | Yes |
| `text-green-800` (#166534) | `bg-green-100` (#dcfce7) | 5.8:1 | Yes |
| `text-green-950` (#052e16) | `bg-green-100/90` | ~13.5:1 | Yes |
| `text-green-700` (#15803d) | `bg-white/90` | 4.6:1 | Yes (AA normal text) |
| `text-green-800/70` (#166534b3) | `bg-white/90` | ~4.7:1 | Yes |
| `text-stone-900` (#1c1917) | `bg-stone-100` (#f5f5f4) | 14.9:1 | Yes |
| `text-stone-950` (#0c0a09) | `bg-white` (#ffffff) | 18.4:1 | Yes |
| `text-stone-700` (#44403c) | `bg-stone-50/80` (#f5f5f4cc) | ~7.5:1 | Yes |
| `text-stone-600` (#57534e) | `bg-white` (#ffffff) | 5.6:1 | Yes |
| `text-stone-600` (#57534e) | `bg-stone-50` (#fafaf9) | 5.3:1 | Yes |
| `text-green-800` (#166534) | `bg-amber-100/95` (#fef3c7f2) | 6.5:1 | Yes |
| `text-stone-900` (#1c1917) | `bg-amber-100/95` (#fef3c7f2) | ~14.0:1 | Yes |
| `text-stone-400` (#a8a29e) | `bg-stone-50` (#fafaf9) | 3.0:1 | No — but used as decorative numbering; heading text uses `text-stone-900` |
| `text-stone-500` (#78716c) | `bg-white/90` (#ffffffe6) | 4.2:1 | Yes for normal text; borderline for small uppercase — use `text-stone-600` instead |

**Action item:** In GolferPicker, use `text-stone-500` for country labels (already AA for normal text at 4.2:1+) and `text-stone-600` for any small uppercase tracking text.

### 6.2 Touch Targets (AC-7)

All interactive elements maintain ≥44px touch targets:

- **GolferPicker golfer buttons:** `px-4 py-3` + content height gives ~44px+ height. `globals.css` `min-block-size: 44px` guarantees minimum.
- **Search input:** `globals.css` enforces `min-block-size: 44px` on `input[type='text']`.
- **Country select:** `globals.css` enforces `min-block-size: 44px` on `select`.
- **Submit button:** Uses `<Button variant="primary" size="lg">` which inherits 44px from globals.
- **Edit button:** Uses `<Button variant="secondary">` which inherits 44px from globals.

### 6.3 Icon + Color Pattern

No new status indicators are introduced. Existing patterns preserved:
- LockBanner: uses explicit text labels + emoji icons, never color alone
- TrustStatusBar: uses tone-based backgrounds + explicit text, never color alone
- SubmissionConfirmation: heading text provides state, not color alone

## 7. Mobile Layout

The current mobile layout is already well-structured with `sm:` breakpoints. The redesign preserves all responsive patterns:

- **GolferPicker search/filter bar:** `flex-col gap-3` on mobile → `sm:flex-row sm:items-end`. No change.
- **Country select width:** `sm:w-56`. No change.
- **Golfer list:** `max-h-80 overflow-y-auto`. No change.
- **Page max width:** `max-w-3xl`. No change.
- **Panel padding:** `p-5 sm:p-6`. No change.

The mobile-first layout is preserved. All rounded corners now use `rounded-3xl` for panels (consistent with `panelClasses()`) and `rounded-xl` for inputs (consistent with the design system).

## 8. Functional Invariants

The following functional behaviors MUST NOT change:

- Pick submission flow (client state → server action → redirect/error)
- Form validation (must select exactly `picksPerEntry` golfers)
- Lock state logic (pool deadline enforcement)
- Golfer filtering and search
- Keyboard navigation (ArrowUp/ArrowDown in golfer list)
- ARIA attributes (`role="listbox"`, `aria-multiselectable`, `aria-selected`, `aria-disabled`, `aria-label`)
- `role="status"` and `aria-live="polite"` on status elements
- The server action in `actions.ts` is NOT modified

## 9. Scope Boundaries

**In scope:**
- Create `Card` component (`src/components/ui/Card.tsx`) and its test
- Migrate `page.tsx` from slate/gray to stone tokens
- Migrate `PicksForm.tsx` to use `Button` component and stone tokens
- Migrate `golfer-picker.tsx` to stone/green tokens with card-based left-border selected state
- Migrate `SubmissionConfirmation.tsx` to green/sand (amber) success state
- Migrate `SelectionSummaryCard.tsx` from sky to green tokens
- Migrate `PickProgress.tsx` from slate/sky to stone/green tokens
- Write/update tests verifying token migration in all modified components
- Verify WCAG 2.1 AA contrast ratios
- Verify 44px touch targets on all interactive elements

**Out of scope:**
- Changes to `LockBanner.tsx` (already migrated in OPS-22)
- Changes to `TrustStatusBar.tsx` (already migrated in OPS-22)
- Changes to `actions.ts` (server action — no visual layer)
- Changes to `EntryGolferBreakdown.tsx` (not listed in AC files)
- Changes to other pages not listed in the acceptance criteria
- Adding `Card` usages to pages other than GolferPicker
- Dark mode
- Any functional logic changes

## 10. Design Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| Selected golfer indicator | `bg-green-50 border-l-4 border-l-green-700` left border accent | AC-4 calls for "card-based redesign with green left-border accents" |
| Success state background | `bg-amber-100/95` (surface.warm) | AC-5 calls for "sand/cream success state"; amber-100 is warm sand without being green |
| Selection progress color | `bg-green-600` (was `bg-sky-600`) | Selection is brand interaction → green. Sky reserved for informational per design system |
| SelectionSummaryCard accent | `border-green-200/80 bg-green-50/90` (was `border-sky-200/80 bg-sky-50/90`) | Progress card is an active state → brand green |
| Create Card component | Yes, per OPS-22 spec | AC-4 requires card-based redesign; avoids duplicating panelClasses + accent logic |
| PickProgress in GolferPicker | Migrate to stone/green tokens but keep as separate component | PickProgress is already extracted; consuming it inside GolferPicker is correct |
| Search/filter bar styling | Keep inline classes, migrate tokens | Not worth extracting into Card — it's a filter bar, not a card with accent |
| `PickProgress.tsx` changes | Migrate tokens as listed | Component is imported by GolferPicker; changes propagate automatically |

## 11. File Inventory

| Action | File | Purpose |
|---|---|---|
| Create | `src/components/ui/Card.tsx` | Card primitive with accent prop |
| Create | `src/components/ui/__tests__/Card.test.tsx` | Card component tests |
| Modify | `src/app/(app)/participant/picks/[poolId]/page.tsx` | Migrate slate/gray → stone tokens |
| Modify | `src/app/(app)/participant/picks/[poolId]/PicksForm.tsx` | Adopt Button component, migrate tokens |
| Modify | `src/components/golfer-picker.tsx` | Card-based redesign with green left-border, token migration |
| Modify | `src/components/SubmissionConfirmation.tsx` | Green/sand success state, token migration |
| Modify | `src/components/SelectionSummaryCard.tsx` | Sky → green token migration |
| Modify | `src/components/PickProgress.tsx` | Slate/sky → stone/green token migration |
| Modify | `src/components/__tests__/PicksFlowPresentation.test.tsx` | Verify test assertions match new tokens |
| Verify | `src/app/(app)/participant/picks/[poolId]/actions.ts` | No changes — verify not touched |
| Verify | `src/components/LockBanner.tsx` | No changes — already migrated in OPS-22 |
| Verify | `src/components/TrustStatusBar.tsx` | No changes — already migrated in OPS-22 |

## 12. Verification

The implementation is complete when:

1. `npm run build` succeeds with no TypeScript or build errors
2. `npm run test` — all existing and new tests pass
3. `npm run lint` — no new lint errors
4. No `emerald-`, `slate-`, `sky-`, or `blue-` color classes remain in the five target files (page.tsx, PicksForm.tsx, golfer-picker.tsx, SubmissionConfirmation.tsx, SelectionSummaryCard.tsx)
5. `PickProgress.tsx` has no `slate-` or `sky-` classes
6. Card component renders `border-l-4 border-l-green-700` when `accent="left"`
7. GolferPicker selected state applies `bg-green-50 border-l-4 border-l-green-700`
8. SubmissionConfirmation success section uses `bg-amber-100/95` (sand/cream)
9. SelectionSummaryCard uses `border-green-200/80 bg-green-50/90`
10. All interactive elements meet ≥44px touch target (enforced by globals.css)
11. WCAG 2.1 AA contrast ratios verified per §6.1
12. No functional changes to pick submission logic (actions.ts untouched)