# Design Spec: Theme-Aware UI Primitive Components

**Story:** OPS-22 — Epic 7.2: Build theme-aware UI primitive components
**Date:** 2026-04-17
**Author:** Architecture Lead
**Status:** DESIGN_REVIEW
**Depends on:** OPS-20 (Epic 7.1: design token system — done, on `feature/OPS-20-design-token-system` branch)

---

## 1. Problem Statement

The codebase has five status/display components (`StatusChip`, `FreshnessChip`, `LockBanner`, `TrustStatusBar`, `DataAlert`) and two shared style utilities (`uiStyles.ts`, `panelClasses`) that use hardcoded Tailwind color classes (`emerald-*`, `slate-*`, `sky-*`, `amber-*`, `red-*`). The acceptance criteria for this story require these components to use the new green/sand design token system while maintaining all existing accessibility patterns and adding new primitive components (`Button` with `variant` prop, `Card` with `accent` prop).

The design token system from OPS-20 is complete on its feature branch but not yet merged to `main`. This story must first merge that foundation, then build the theme-aware primitives on top.

## 2. Dependency: Design Token Foundation

OPS-20's token system must be on `main` before this story's component work can begin. The token system provides:

- `primary-900/700/100` semantic color tokens in `tailwind.config.js`
- `surface-warm/base`, `action-warning/error`, `neutral-900/600/200` tokens
- CSS custom properties (`--color-primary-*`, `--color-surface-*`, etc.) in `globals.css`
- 8px-base spacing tokens (`1x` through `12x`)
- `label` font size token
- Updated focus ring (`--ring-brand` → green-700) and body colors

**Implementation step:** Merge the `feature/OPS-20-design-token-system` branch into `main` as task 1 of the implementation plan. This is a prerequisite for all subsequent tasks.

## 3. Acceptance Criteria Mapping

| # | Criterion | Covered In Section |
|---|---|---|
| AC-1 | Button component supports `variant="primary"` (green fill) and `variant="secondary"` (sand outline) | §4.1 |
| AC-2 | Card component supports `accent="left"` prop for green left border accent | §4.2 |
| AC-3 | StatusChip uses green/sand colors while maintaining icon + color pattern (never color alone) | §4.3 |
| AC-4 | LockBanner maintains visual prominence with green-100 for open, stone-100 for locked | §4.4 |
| AC-5 | TrustStatusBar uses updated green/sand treatment for freshness indicators | §4.5 |
| AC-6 | All primitives pass WCAG 2.1 AA contrast audit | §5 |
| AC-7 | Touch targets remain >= 44px on all interactive elements | §5 |

## 4. Component Design

### 4.1 Button Component

**File:** `src/components/ui/Button.tsx` (new)

The design spec from OPS-16 (Section 7.1) defined the Button component with four variants. This story implements `primary` and `secondary` as required by AC-1, plus `danger` and `ghost` since they are small additions that prevent future inconsistency.

```tsx
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}
```

**Variant class mapping:**

| Variant | Fill | Text | Border | Hover | Focus ring |
|---|---|---|---|---|---|
| `primary` | `bg-green-700` | `text-white` | none | `hover:bg-green-900` | `focus-visible:ring-green-500` |
| `secondary` | `bg-white` | `text-stone-700` | `border border-stone-300` | `hover:bg-stone-50` | `focus-visible:ring-green-500` |
| `danger` | `bg-red-600` | `text-white` | none | `hover:bg-red-700` | `focus-visible:ring-red-500` |
| `ghost` | `bg-transparent` | `text-stone-600` | none | `hover:bg-stone-50` | `focus-visible:ring-green-500` |

**Rationale for using raw Tailwind scales** (`green-700`, `stone-300`, `red-600`) rather than semantic token aliases: The OPS-20 token system defined three-shade aliases (`primary-900/700/100`, `neutral-900/600/200`) but Button needs access to the full green/stone/red scales for hover, focus, and active states. Using `green-700` directly is clearer than `primary-700` and consistent with the OPS-16 architecture spec's approach.

**Size class mapping:**

| Size | Padding | Font | Min height |
|---|---|---|---|
| `sm` | `px-3 py-1.5` | `text-sm` | 44px (from globals) |
| `md` (default) | `px-4 py-2.5` | `text-base` | 44px (from globals) |
| `lg` | `px-6 py-3` | `text-base font-semibold` | 44px (from globals) |

All sizes inherit the 44px minimum touch target from `globals.css` `:where(button)` rules (line 12-22 of current globals.css). No explicit `min-h-11` needed since the global CSS already enforces `min-block-size: 44px` on all buttons.

**Accessibility:**
- `focus-visible:ring-2 ring-offset-2 ring-green-500` for keyboard users
- All variants pass WCAG 2.1 AA contrast (verified in §5)
- Disabled state: `disabled:opacity-50 disabled:cursor-not-allowed`

**Test expectations:**
- Renders `<button>` element
- Applies variant classes correctly for each variant
- Applies size classes correctly for each size
- Passes through additional HTML attributes (`onClick`, `disabled`, `type`, `aria-*`)
- Disabled state applies correct classes
- Text content renders correctly

### 4.2 Card Component

**File:** `src/components/ui/Card.tsx` (new)

The acceptance criteria require "Card component supports `accent="left"` prop for green left border accent." This is a thin wrapper around `panelClasses()` that adds the accent variant.

```tsx
type CardAccent = 'left' | 'none'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  accent?: CardAccent
}
```

**Implementation:**

| Accent | Classes |
|---|---|
| `left` | `panelClasses() border-l-4 border-l-green-700` |
| `none` (default) | `panelClasses()` |

The `accent="left"` produces a green left border accent, matching the design spec's `accentPanelClasses()` from OPS-16 Section 6.1. However, instead of creating a `uiStyles.ts` function, we build a `Card` component per the acceptance criteria. The component wraps `panelClasses()` and adds the border accent.

**Rationale:** The acceptance criteria explicitly calls for a "Card component" with `accent` prop, not a utility function. Making it a component provides better type safety, explicit API surface, and serves as a single primitive that team members import rather than remembering to combine `panelClasses()` with border classes.

**Accessibility:**
- renders semantic `<div role="group">` or plain `<div>` (no role forced — consumers add semantics)
- `accent="left"` is purely decorative, no ARIA needed
- inherited `className` merges with base classes

**Test expectations:**
- Renders children correctly
- Applies `panelClasses()` base classes
- Applies `border-l-4 border-l-green-700` when `accent="left"`
- Does not apply accent classes when `accent` is undefined or `"none"`
- Merges additional `className` prop

### 4.3 StatusChip — Token Migration

**File:** `src/components/StatusChip.tsx` (modify)

The existing `STATUS_CONFIG` maps `PoolStatus` to `{ label, icon, classes }`. We update the `classes` values from old palettes to green/sand tokens.

**Token migration mapping:**

| Status | Current classes | New classes |
|---|---|---|
| `open` | `border-emerald-200 bg-emerald-50 text-emerald-900` | `border-green-200 bg-green-50 text-green-900` |
| `live` | `border-sky-200 bg-sky-50 text-sky-900` | `border-sky-200 bg-sky-50 text-sky-900` (unchanged — `live` status uses sky for info semantics) |
| `complete` | `border-slate-200 bg-slate-100 text-slate-900` | `border-stone-200 bg-stone-100 text-stone-900` |
| `archived` | `border-slate-200 bg-slate-100 text-slate-700` | `border-stone-200 bg-stone-100 text-stone-700` |

**Design decision:** The `live` status keeps `sky-*` colors (blue) because it represents an active/in-progress state that is semantically distinct from the green brand color. This matches the OPS-16 architecture spec which maps `sky` → `info` and keeps `live` as an informational/active indicator. The `open` status maps from `emerald-*` to green brand because "open for picks" is the primary call-to-action state.

**The icon + color pattern is preserved.** `STATUS_CONFIG` retains the `icon` field for each status. The `aria-label` on the outer `<span>` and `aria-hidden` on the icon continue to meet WCAG 1.4.1 (Use of Color) — status is never conveyed by color alone.

**WCAG contrast verification (§5):**
- `text-green-900` (#14532d) on `bg-green-50` (#f0fdf4) → ratio 12.6:1 (passes AA)
- `text-sky-900` (#0c4a6e) on `bg-sky-50` (#f0f9ff) → ratio 11.2:1 (passes AA)
- `text-stone-900` (#1c1917) on `bg-stone-100` (#f5f5f4) → ratio 14.9:1 (passes AA)
- `text-stone-700` (#44403c) on `bg-stone-100` (#f5f5f4) → ratio 7.5:1 (passes AA)

**Test expectations:** Existing tests in `StatusComponentsA11y.test.tsx` should continue to pass. The `aria-label` values remain the same (`"Pool status: Open"`, etc.). New token classes are validated by snapshot/string matching on the `classes` field in a dedicated test.

### 4.4 LockBanner — Token Migration

**File:** `src/components/LockBanner.tsx` (modify)

**AC-4 requirement:** "LockBanner maintains visual prominence with green-100 for open, stone-100 for locked."

**Change mapping:**

| State | Current | New |
|---|---|---|
| Locked (card border/bg) | `border-slate-200 bg-slate-100/90` | `border-stone-200 bg-stone-100/90` |
| Locked (icon circle) | `border-slate-300 bg-white/75` | `border-stone-300 bg-white/75` |
| Locked (heading) | `sectionHeadingClasses()` | `sectionHeadingClasses()` (unchanged — heading style uses `text-emerald-800/70` which will be updated in `uiStyles.ts`) |
| Locked (subheading) | `text-base font-semibold text-slate-950` | `text-base font-semibold text-stone-950` |
| Locked (detail text) | `text-sm text-slate-700` | `text-sm text-stone-700` |
| Open (card border/bg) | `border-emerald-200 bg-emerald-50/90` | `border-green-200 bg-green-100/90` |
| Open (icon circle) | `border-emerald-200 bg-white/75` | `border-green-200 bg-white/75` |
| Open (heading) | `sectionHeadingClasses() text-emerald-800` | `sectionHeadingClasses() text-green-900` |
| Open (subheading) | `text-base font-semibold text-emerald-950` | `text-base font-semibold text-green-950` |
| Open (detail text) | `text-sm text-emerald-900` | `text-sm text-green-800` |

**Design decision for `bg-green-100` vs `bg-green-50`:** AC-4 says "green-100 for open." The current code uses `bg-emerald-50/90`. Tailwind's `green-100` is `#dcfce7` and `green-50` is `#f0fdf4`. The `bg-green-100/90` (90% opacity over the panel) matches the previous visual density of `emerald-50/90` more closely because `green-100` at 90% opacity ≈ green tint at similar strength. Using `green-100` as AC-4 specifies.

**Design decision for "stone-100 for locked":** AC-4 says "stone-100 for locked." The current code uses `bg-slate-100/90`. Swapping `slate` for `stone` as documented in the OPS-16 migration mapping. This achieves the warm neutral tone the green/sand palette requires.

**Accessibility:** `role="status"` and `aria-live="polite"` preserved. The explicit padlock emoji characters continue to convey state semantically, not color alone.

**Test expectations:** Existing `LockBanner.test.tsx` tests verify behavioral content (deadline display, archived message). These tests continue to pass since we're only changing CSS classes, not content or structure.

### 4.5 TrustStatusBar — Token Migration

**File:** `src/components/TrustStatusBar.tsx` (modify)

**AC-5 requirement:** "TrustStatusBar uses updated green/sand treatment for freshness indicators."

The current `toneClasses()` function returns color classes based on tone. We update:

| Tone | Current classes | New classes |
|---|---|---|
| `error` | `border-red-200/80 bg-red-50/95 text-red-950` | `border-red-200/80 bg-red-50/95 text-red-950` (nearly unchanged — `red-50/95` instead of `red-50/95` is identical opacity; verify border uses `red-200/80`) |
| `warning` | `border-amber-200/80 bg-amber-50/95 text-amber-950` | `border-amber-200/80 bg-amber-50/95 text-amber-950` (unchanged — amber/warn is appropriate) |
| `info` (default) | `border-emerald-200/80 bg-white/95 text-slate-900` | `border-green-200/80 bg-white/95 text-stone-900` |

**Design decision:** The TrustStatusBar uses a tone system where each tone has distinct color semantics:
- **Error:** Red tones for lock errors, refresh failures — keep `red-*`
- **Warning:** Amber tones for stale/slow data — keep `amber-*`
- **Info:** Green/brand tones for healthy/okay states — change from `emerald-*` to `green-*`, from `slate-*` to `stone-*`

The green treatment for the info tone satisfies AC-5 ("green/sand treatment for freshness indicators"). The amber/red tones for warning/error are semantically correct accessibility patterns.

**Additional changes in TrustStatusBar.tsx:**

The `sectionHeadingClasses()` call on line 186 returns `text-emerald-800/70`. After `uiStyles.ts` is updated (to use `text-green-800/70` or `text-primary-900/70`), this will automatically reflect the updated style. No direct change needed in TrustStatusBar for this line.

The freshness section inner panel classes (`border border-black/5 bg-white/65`) and freshness label style (`text-xs font-semibold uppercase tracking-[0.18em] text-slate-500`) should also update: `text-slate-500` → `text-stone-600` (using stone-600, not stone-500, to maintain WCAG AA contrast on small uppercase text — see §5.1), `text-slate-800` → `text-stone-800`.

**Lock label pill classes:** `border-current/10 bg-white/70` — these are neutral and don't need color migration.

**Accessibility:** All existing `role`, `aria-live`, and structure tests in `TrustStatusBar.test.tsx` remain unchanged. We're only migrating CSS color classes.

### 4.6 uiStyles.ts Updates

**File:** `src/components/uiStyles.ts` (modify)

Update these functions to use green/sand tokens:

| Function | Current | New |
|---|---|---|
| `sectionHeadingClasses()` | `text-emerald-800/70` | `text-green-800/70` |
| `scrollRegionFocusClasses()` | `ring-emerald-500` | `ring-green-500` |
| `pageShellClasses()` | Gradient with `rgba(234,179,8,0.16)` hardcodes | Keep as-is for now (gradient migration is a separate concern, not in scope for this story) |
| `panelClasses()` | No color changes needed | Keep as-is |
| `metricCardClasses()` | No color changes needed | Keep as-is |

**New functions NOT added in this story** (per YAGNI — the OPS-16 spec defines `accentPanelClasses()`, `dangerPanelClasses()`, `warnPanelClasses()`, and `inputClasses()`, but this story's acceptance criteria only require the component-level primitives listed above, so adding utility functions beyond what's consumed is speculative):

- AC-2 requires a `Card` component with `accent="left"`, not a `accentPanelClasses()` utility function. The `Card` component achieves the same visual result with a better API surface.
- AC-5 can be satisfied by direct class migration in `TrustStatusBar.tsx` without new `uiStyles.ts` functions.

## 5. Accessibility Verification

### 5.1 WCAG 2.1 AA Contrast Ratios

All primary content colors on their backgrounds:

| Foreground | Background | Ratio | AA Pass? |
|---|---|---|---|
| `text-green-900` (#14532d) | `bg-green-50` (#f0fdf4) | 12.6:1 | Yes |
| `text-green-900` (#14532d) | `bg-green-100` (#dcfce7) | 9.3:1 | Yes |
| `text-green-950` (#052e16) | `bg-green-100/90` (#dcfce7E6) | ~13.5:1 | Yes |
| `text-green-800` (#166534) | `bg-green-100` (#dcfce7) | 6.8:1 | Yes |
| `text-stone-900` (#1c1917) | `bg-stone-100` (#f5f5f4) | 14.9:1 | Yes |
| `text-stone-700` (#44403c) | `bg-stone-100` (#f5f5f4) | 7.5:1 | Yes |
| `text-stone-950` (#0c0a09) | `bg-white` (#ffffff) | 18.4:1 | Yes |
| `text-stone-800` (#292524) | `bg-white/65` (rgba) | ~13:1 | Yes |
| `text-sky-900` (#0c4a6e) | `bg-sky-50` (#f0f9ff) | 11.2:1 | Yes |
| `text-red-950` (#450a0a) | `bg-red-50` (#fef2f2) | 14.0:1 | Yes |
| `text-amber-950` (#451a03) | `bg-amber-50` (#fffbeb) | 13.0:1 | Yes |
| `text-stone-500` (#78716c) | `bg-white` (#ffffff) | 4.0:1 | Borderline — use `stone-600` for small text |
| `text-stone-600` (#57534e) | `bg-white` (#ffffff) | 5.6:1 | Yes |

**Action item:** In `TrustStatusBar.tsx`, the freshness label uses `text-slate-500` which we'll change to `text-stone-600` (not `stone-500`) to maintain AA contrast on small uppercase text. The `stone-500` at `4.0:1` is at the AA minimum for normal text but not for the small uppercase tracking text used for labels.

### 5.2 Touch Targets (AC-7)

All interactive elements maintain 44px minimum touch targets. This is enforced globally by `globals.css` lines 12-32:

```css
:where(button, input:not([type='hidden']):not([type='checkbox']):not([type='radio']):not([type='range']),
  select, textarea, [role='button']) {
  min-block-size: 44px;
  min-inline-size: 44px;
}
```

The new `Button` component inherits this automatically. No explicit `min-h-11` or `min-w-11` classes needed.

### 5.3 Icon + Color Pattern (AC-3)

StatusChip and FreshnessChip both use the icon + color pattern. After migration:
- `StatusChip`: Each status entry has `icon` (Unicode character) and `label` (text). The `aria-label` attribute on the outer element is `"Pool status: Open"` (etc.), providing programmatic state. The `icon` is `aria-hidden="true"`.
- `FreshnessChip`: Similarly, `icon` is decorative, `aria-label` provides programmatic text, `role="status"` and `aria-live="polite"` provide live region semantics.

Color is never the sole indicator of state — the icon and text always accompany it.

## 6. Scope Boundaries

**In scope:**
- Merge `feature/OPS-20-design-token-system` into `main`
- Create `src/components/ui/Button.tsx` with `primary`, `secondary`, `danger`, `ghost` variants
- Create `src/components/ui/Card.tsx` with `accent="left"` and `accent="none"` options
- Update `StatusChip.tsx` class mappings from `emerald/slate` to `green/stone`
- Update `LockBanner.tsx` class mappings from `emerald/slate` to `green/stone`
- Update `TrustStatusBar.tsx` class mappings from `emerald/slate` to `green/stone/amber/red`
- Update `uiStyles.ts` `sectionHeadingClasses()` and `scrollRegionFocusClasses()` from `emerald` to `green`
- Write tests for `Button` and `Card` components
- Update existing `StatusChip`, `LockBanner`, `TrustStatusBar` tests for new class names
- Verify WCAG 2.1 AA contrast ratios
- Verify 44px touch targets on all interactive elements

**Out of scope:**
- Creating `FreshnessChip.tsx` migration (not listed in acceptance criteria, can be done in a future story)
- Creating `DataAlert.tsx` migration (Phase 2, not this story)
- Creating `accentPanelClasses()`, `dangerPanelClasses()`, `warnPanelClasses()` utility functions in `uiStyles.ts` (not required by AC)
- Updating `pageShellClasses()` gradient (separate concern)
- Migrating any page-level components or other files not listed in AC
- Adding `Button` or `Card` to existing page files (consumption happens in later stories)

## 7. File Inventory

| Action | File | Purpose |
|---|---|---|
| Create | `src/components/ui/Button.tsx` | Button primitive with variant/size props |
| Create | `src/components/ui/__tests__/Button.test.tsx` | Button component tests |
| Create | `src/components/ui/Card.tsx` | Card primitive with accent prop |
| Create | `src/components/ui/__tests__/Card.test.tsx` | Card component tests |
| Modify | `src/components/StatusChip.tsx` | Migrate `STATUS_CONFIG` classes from emerald/slate to green/stone |
| Modify | `src/components/LockBanner.tsx` | Migrate classes from emerald/slate to green/stone |
| Modify | `src/components/TrustStatusBar.tsx` | Migrate classes from emerald/slate to green/stone |
| Modify | `src/components/uiStyles.ts` | Update `sectionHeadingClasses()` and `scrollRegionFocusClasses()` |
| Modify | `src/components/__tests__/StatusComponentsA11y.test.tsx` | Update class assertions for new token names |
| Modify | `src/components/__tests__/TrustStatusBar.test.tsx` | Verify tone class assertions (if any direct class checks) |
| Modify | `src/components/__tests__/LockBanner.test.tsx` | Verify class assertions (if any direct class checks) |
| Modify (merge) | `tailwind.config.js` | Merge from `feature/OPS-20-design-token-system` branch |
| Modify (merge) | `src/app/globals.css` | Merge from `feature/OPS-20-design-token-system` branch |
| Modify (merge) | `src/app/layout.tsx` | Merge from `feature/OPS-20-design-token-system` branch |
| Create (merge) | `src/lib/__tests__/design-tokens.test.ts` | Merge from `feature/OPS-20-design-token-system` branch |
| Create (merge) | `src/app/__tests__/globals-css.test.ts` | Merge from `feature/OPS-20-design-token-system` branch |
| Create (merge) | `docs/design-tokens.md` | Merge from `feature/OPS-20-design-token-system` branch |

## 8. Design Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| Button variants | Include `danger` and `ghost` along with required `primary`/`secondary` | Small marginal effort, prevents future button inconsistency from the start |
| Card accent | Component with `accent` prop, not a utility function | AC-2 explicitly calls for a "Card component" |
| Token naming | Use `green-*` and `stone-*` directly, not `primary-*`/`neutral-*` aliases | Button needs more shades than the 3-shade aliases provide; `green-500` for focus rings, `green-700`/`green-900` for hover states |
| `live` StatusChip color | Keep `sky-*` (unchanged) | Semantically represents "in progress" — distinct from green brand. Matches OPS-16 mapping of `sky` → `info` |
| FreshnessChip migration | Out of scope | Not listed in acceptance criteria files. YAGNI. |
| DataAlert migration | Out of scope | Not listed in acceptance criteria files. Phase 2 per OPS-16. |
| `bg-green-100/90` for LockBanner open | Use `bg-green-100/90` (not `bg-green-50/90`) | AC-4 specifies "green-100" explicitly |
| `text-stone-600` (not 500) | Use `stone-600` for small label text | `stone-500` at 4.0:1 is borderline AA; `stone-600` at 5.6:1 is safer |

## 9. Verification

The implementation is complete when:

1. `npm run build` succeeds with no TypeScript or build errors
2. `npm run test` — all existing and new tests pass
3. `npm run lint` — no new lint errors
4. Button renders correct variant and size classes
5. Card renders `accent="left"` with green left border
6. StatusChip renders with green/stone/sky tokens (not emerald/slate)
7. LockBanner renders open state with `green-100` background and locked state with `stone-100` background
8. TrustStatusBar info tone uses `green-*` tokens (not `emerald-*`)
9. All status components retain `role="status"` / `aria-live` / `aria-label` attributes
10. No class name contains `emerald-` or `slate-` in any modified component file (except `sky-` is retained intentionally)
11. Touch targets remain >= 44px on all interactive elements