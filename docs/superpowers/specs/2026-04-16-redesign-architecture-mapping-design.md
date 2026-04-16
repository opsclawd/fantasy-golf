# Redesign Architecture Mapping — Design Spec

**Date:** 2026-04-16
**Author:** Architecture Lead
**Issue:** [OPS-16](/OPS/issues/OPS-16)
**Parent:** [OPS-14](/OPS/issues/OPS-14) — Drive the mobile redesign for fantasy-golf
**Status:** DESIGN_REVIEW

---

## 1. Problem Statement

Fantasy Golf needs a visual redesign toward a sharper, more premium motorsport-inspired look using deepened green and sand. The current codebase has a partial design system (`uiStyles.ts` + config-driven components like `StatusChip`, `FreshnessChip`, `DataAlert`) but also has significant inconsistencies: ad-hoc button colors, mixed `gray`/`slate` usage, pages using `bg-gray-50` while others use `pageShellClasses()` gradient, and no shared button or input primitives.

This spec defines the technical bridge: how the approved visual direction maps to the current codebase's architecture, what tokens, functions, and patterns we need, and exactly which files to touch — per page priority order confirmed by Product Planner.

---

## 2. Confirmed Decisions (from OPS-15)

The Product Planner has resolved all clarification questions:

| Question | Answer | Impact on Spec |
|---|---|---|
| Visual direction | **Option A: Refine Existing** — deepen emerald/sand palette, not dark mode. Specific tokens: `green-900` (#14532d), `green-700` (#15803d), `green-100` (#dcfce7), `sand-100` (#fef3c7), `sand-50` (#fffbeb), `stone-900` (#1c1917), `stone-600` (#57534e), `red-600` (#dc2626) | Token plan uses `green-*`, `sand-*`, `stone-*`, `red-600` directly |
| Page priority | Phase 1 (Critical): Participant Picks (OPS-21). Phase 2 (High): Spectator (OPS-23), Pools list (OPS-24), Join pool (OPS-25). Phase 3 (Medium): Commissioner (OPS-26), Pool detail (OPS-27), Global styles (OPS-29). Phase 4 (Low): Auth (OPS-28) | Rollout order starts with Picks, not Spectator |
| Component strategy | **Option C: Hybrid** — keep `uiStyles.ts` function pattern, back with new token values. Extend `panelClasses()` for green left-border accent. StatusChip: keep icon + color pattern. LockBanner: `green-100` for open, `red-600` for locked | No `src/components/ui/` component library. Extend `uiStyles.ts` instead |
| Breakpoints | Keep existing `sm:`, `md:`, `lg:` Tailwind defaults | No breakpoint changes |

---

## 3. Current State Assessment

### 3.1 What Works Well (Preserve These)

| Pattern | File | Usage |
|---|---|---|
| `panelClasses()` | `uiStyles.ts` | ~20+ consumers — frosted-glass card aesthetic |
| `metricCardClasses()` | `uiStyles.ts` | 4-col metric grid — `panelClasses() + min-h-[8rem] p-5` |
| `pageShellClasses()` | `uiStyles.ts` | Spectator page gradient background |
| `sectionHeadingClasses()` | `uiStyles.ts` | Eyebrow label pattern |
| `scrollRegionFocusClasses()` | `uiStyles.ts` | Accessible scrollable focus rings |
| Config-driven chip system | `StatusChip.tsx`, `FreshnessChip.tsx` | `STATUS_CONFIG`/`FRESHNESS_CONFIG` — maps state to token classes |
| Tone-based alert system | `TrustStatusBar.tsx`, `DataAlert.tsx` | `toneClasses()`/`VARIANT_CONFIG` — semantic tone routing |
| Accessibility patterns | All status components | `role="status"`, `aria-live`, `sr-only`, 44px touch targets |

### 3.2 What Needs Fixing (Inconsistencies)

| Problem | Detail | Files Affected |
|---|---|---|
| **No shared button pattern** | Buttons range from `bg-blue-600` (auth), `bg-green-600` (start pool), `bg-red-600` (close/delete), `bg-slate-600` (archive), `bg-slate-950` (newer actions), `bg-emerald-600` (catalog sync) | 8+ action files |
| **Mixed color namespaces** | `gray` used in `GolferContribution`, `GolferScorecard`, `ScoreDisplay`, app layout (`bg-gray-50`) while rest uses `slate`. Both need migration to `stone` per confirmed direction. | 6+ files |
| **App layout lacks `pageShellClasses`** | `(app)/layout.tsx` uses `bg-gray-50` (flat, cold) while spectator uses warm gradient. Visual disconnect. | `src/app/(app)/layout.tsx` |
| **Auth/Join pages use completely different styling** | `bg-white rounded-lg shadow` card pattern, `bg-blue-600` buttons — no design system tokens | `src/app/(auth)/`, `src/app/join/` |
| **PoolCard doesn't use `panelClasses`** | Uses `bg-white rounded-lg shadow` — inconsistent with every other card | `PoolCard.tsx` |
| **ScoreDisplay uses different color names** | `text-green-600`/`text-red-600`/`text-gray-600` instead of consistent palette | `score-display.tsx` |
| **No accent panel variant** | `panelClasses()` has no green left-border accent for open/pool-open states | `uiStyles.ts` |

### 3.3 Current Token Inventory

**Color tokens currently used (Tailwind utility classes):**

| Category | Colors | Pattern |
|---|---|---|
| Brand / Trust | `emerald-50` through `emerald-950` | Primary positive, trust, brand identity |
| Selection / Active | `sky-50` through `sky-950` | Active states, selections |
| Neutral / Surface | `slate-50` through `slate-950` | Text, backgrounds, borders |
| Warning / Stale | `amber-50` through `amber-950` | Pending, stale data |
| Error / Danger | `red-50` through `red-950`, `rose-50` through `rose-200` | Errors, destructive actions |
| Legacy / Inconsistent | `gray-50` through `gray-900`, `blue-600`, `green-600` | Ad-hoc, must migrate |

---

## 4. Design Direction

### 4.1 Visual Direction: Refine and Deepen (Option A)

Per Product Planner confirmation, we refine the existing light base with deepened green and sand tones — not a dark mode shift.

**Confirmed palette anchors:**

| Role | Token | Value | Usage |
|---|---|---|---|
| Active / Open | `green-900` | `#14532d` | Deep green for headings, accent elements |
| Active / Open (medium) | `green-700` | `#15803d` | Active buttons, links, interactive green |
| Active / Open (light) | `green-100` | `#dcfce7` | Open state backgrounds, accent panels (open LockBanner) |
| Success / Warm light | `sand-100` | `#fef3c7` | Success backgrounds, warm highlights |
| Success / Warm lightest | `sand-50` | `#fffbeb` | Page shell gradient warm component |
| Text primary | `stone-900` | `#1c1917` | Body text, headings |
| Text secondary | `stone-600` | `#57534e` | Muted text, labels |
| Locked / Error | `red-600` | `#dc2626` | Locked states, destructive actions, errors |

**Full palette extension in Tailwind config:**

We add `sand` as a custom color (not a standard Tailwind scale) and map existing `emerald`/`slate`/`sky`/`amber`/`red` to semantic aliases. The key principle: **use Tailwind's built-in green/stone/sky/amber/red scales directly** where they match the confirmed palette, and add `sand` as the only custom color scale.

### 4.2 Approach Selection

I considered three approaches:

#### Approach A: Token-Only Migration (Minimal Change)

Add CSS custom properties and Tailwind theme aliases, then gradually migrate utility classes. Keep `uiStyles.ts` as-is.

**Pros:** Lowest risk, no new files.
**Cons:** Doesn't solve the button inconsistency problem. No accent panel variant. Still stuck with ad-hoc `bg-blue-600`, `bg-slate-950`, `bg-green-600` buttons.

#### Approach B: Design Token Layer + Component Library (Previous Spec)

Create `src/components/ui/` with Button, Card, Input, Chip, etc. Eventually remove `uiStyles.ts`.

**Pros:** Clean component model.
**Cons:** Product Planner explicitly confirmed Option C (Hybrid: keep `uiStyles.ts` function pattern). This approach contradicts the confirmed direction.

#### Approach C: Hybrid — Extend uiStyles.ts + Add Button Primitive (Recommended, Confirmed)

1. Add `sand` color to `tailwind.config.js` theme extension
2. Add semantic color aliases to `tailwind.config.js` (`brand`, `surface`, `danger`, `warn`, `info`)
3. Extend `uiStyles.ts` with new functions: `accentPanelClasses()`, `buttonClasses()`, `inputClasses()` — backed by new token values
4. Add `Button` as the ONLY new component primitive (the button inconsistency is severe enough to warrant a component)
5. Keep `StatusChip`/`FreshnessChip` config-driven pattern, update token values
6. Keep `LockBanner` pattern, update to `green-100` for open / `red-600` for locked
7. Migrate `gray` → `stone`, `emerald` → `green` (where representing active/open meaning), `sky` → stays as `sky` or maps to `info` semantic alias
8. No `src/components/ui/` directory for Card/Input/Chip — these stay as `uiStyles.ts` function calls

**Pros:** Matches confirmed Product Planner direction. Solves the worst inconsistency (buttons). Extends existing proven pattern (`uiStyles.ts`). Incremental and testable.
**Cons:** Buttons get a component while panels/inputs get functions — slight inconsistency. Acceptable tradeoff.

**Selected: Approach C.** This is the confirmed direction from Product Planner.

---

## 5. Token Plan

### 5.1 Color Tokens

Add to `tailwind.config.js` theme extension:

```js
// tailwind.config.js — theme.extend.colors
colors: {
  sand: {
    50:  '#fffbeb',   // warm lightest
    100: '#fef3c7',   // warm light
    200: '#fde68a',   // warm medium
    300: '#fcd34d',   // warm accent
    400: '#fbbf24',   // warm bold
    500: '#f59e0b',   // warm strong
    600: '#d97706',   // warm dark
    700: '#b45309',   // warm deep
    800: '#92400e',   // warm darkest
    900: '#78350f',   // near-black warm
    950: '#451a03',   // black warm
  },
  brand: {
    DEFAULT: '#15803d',     // green-700 — primary interactive green
    50:  '#f0fdf4',         // green-50
    100: '#dcfce7',         // green-100 — open state bg (confirmed)
    200: '#bbf7d0',         // green-200
    300: '#86efac',         // green-300
    400: '#4ade80',         // green-400
    500: '#22c55e',         // green-500
    600: '#16a34a',         // green-600
    700: '#15803d',         // green-700 — confirmed accent
    800: '#166534',         // green-800
    900: '#14532d',         // green-900 — confirmed deep
    950: '#052e16',         // green-950
  },
  surface: {
    DEFAULT: '#ffffff',
    50:  '#fafaf9',          // stone-50
    100: '#f5f5f4',          // stone-100
    200: '#e7e5e4',          // stone-200
    300: '#d6d3d1',          // stone-300
    400: '#a8a29e',          // stone-400
    500: '#78716c',          // stone-500
    600: '#57534e',          // stone-600 — confirmed secondary text
    700: '#44403c',          // stone-700
    800: '#292524',          // stone-800
    900: '#1c1917',          // stone-900 — confirmed primary text
    950: '#0c0a09',          // stone-950
  },
  danger: {
    50:  '#fef2f2',          // red-50
    100: '#fee2e2',          // red-100
    200: '#fecaca',          // red-200
    300: '#fca5a5',          // red-300
    400: '#f87171',          // red-400
    500: '#ef4444',          // red-500
    600: '#dc2626',          // red-600 — confirmed locked/error
    700: '#b91c1c',          // red-700
    800: '#991b1b',          // red-800
    900: '#7f1d1d',          // red-900
    950: '#450a0a',          // red-950
  },
  warn: {
    50:  '#fffbeb',          // amber-50 — shared with sand-50
    100: '#fef3c7',          // amber-100 — shared with sand-100
    200: '#fde68a',          // amber-200
    300: '#fcd34d',          // amber-300
    400: '#fbbf24',          // amber-400
    500: '#f59e0b',          // amber-500
    600: '#d97706',          // amber-600
    700: '#b45309',          // amber-700
    800: '#92400e',          // amber-800
    900: '#78350f',          // amber-900
    950: '#451a03',          // amber-950
  },
  info: {
    50:  '#f0f9ff',          // sky-50
    100: '#e0f2fe',          // sky-100
    200: '#bae6fd',          // sky-200
    300: '#7dd3fc',          // sky-300
    400: '#38bdf8',          // sky-400
    500: '#0ea5e9',          // sky-500
    600: '#0284c7',          // sky-600
    700: '#0369a1',          // sky-700
    800: '#075985',          // sky-800
    900: '#0c4a6e',          // sky-900
    950: '#082f49',          // sky-950
  },
}
```

**CSS Custom Properties** (in `globals.css` `:root`):

```css
:root {
  /* Brand — maps to green scale */
  --color-brand: 21 128 61;          /* green-700 */
  --color-brand-hover: 22 101 52;    /* green-800 */
  --color-brand-contrast: 255 255 255;
  --color-brand-light: 220 252 231;   /* green-100 */

  /* Sand / Warm */
  --color-sand: 254 243 199;         /* sand-100 */
  --color-sand-light: 255 251 235;    /* sand-50 */

  /* Surface — maps to stone scale */
  --color-surface: 255 255 255;
  --color-on-surface: 28 25 23;       /* stone-900 */
  --color-on-surface-variant: 87 83 78; /* stone-600 */

  /* Status */
  --color-danger: 220 38 38;          /* red-600 */
  --color-warn: 217 119 6;           /* amber-600 */
  --color-info: 2 132 199;           /* sky-600 */

  /* Shell gradient (preserved from current) */
  --gradient-shell: radial-gradient(circle at top, rgba(234,179,8,0.16), transparent 28%), linear-gradient(180deg, #f6f1e7 0%, #eef3ea 48%, #e7efe8 100%);

  /* Existing brand ring (preserved) */
  --ring-brand: 21 128 61;           /* green-700, was teal-700 */
}
```

**Migration mapping (applied per-phase, not wholesale):**

| Current | Target | When |
|---|---|---|
| `emerald-*` (meaning active/open) | `brand-*` or `green-*` | Per-file during phase |
| `emerald-*` (meaning brand/identity) | `brand-*` | Per-file during phase |
| `slate-*` (meaning neutral/surface) | `surface-*` or `stone-*` | Per-file during phase |
| `gray-*` | `surface-*` or `stone-*` | Mandatory in every touched file |
| `sky-*` (meaning info/selection) | `info-*` | Per-file during phase |
| `amber-*` (meaning warn/stale) | `warn-*` | Per-file during phase |
| `red-*` (meaning error/locked) | `danger-*` | Per-file during phase |
| `blue-*` (button backgrounds) | `brand-*` via `<Button variant="primary">` | When migrating each file |

### 5.2 Typography Tokens

Add to `tailwind.config.js`:

```js
// tailwind.config.js — theme.extend.fontSize
fontSize: {
  'eyebrow': ['0.7rem', { lineHeight: '1rem', letterSpacing: '0.18em', fontWeight: '600' }],
  'label': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.16em', fontWeight: '600' }],
  'body': ['0.875rem', { lineHeight: '1.5rem' }],
  'body-lg': ['1rem', { lineHeight: '1.75rem' }],
  'heading-lg': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.025em', fontWeight: '600' }],
  'heading-xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.025em', fontWeight: '600' }],
},
```

This codifies existing informal scales without breaking current usage.

### 5.3 Spacing Tokens

```js
// tailwind.config.js — theme.extend.spacing (additions)
spacing: {
  'panel-px': '1.25rem',
  'panel-py': '1.25rem',
  'shell-px': '1.25rem',
  'shell-py': '2rem',
},
```

### 5.4 Shadow Tokens

```js
// tailwind.config.js — theme.extend.boxShadow
boxShadow: {
  'panel': '0 18px 60px -24px rgba(28,25,23,0.35)',
  'panel-hover': '0 24px 70px -20px rgba(28,25,23,0.40)',
  'elevated': '0 32px 120px -40px rgba(28,25,23,0.55)',
  'subtle': '0 1px 3px 0 rgba(28,25,23,0.08)',
},
```

Note: Shadow rgba uses `stone-900` value (28,25,23) instead of the old `slate-900` (15,23,42).

### 5.5 Border Radius Tokens

```js
// tailwind.config.js — theme.extend.borderRadius (additions)
borderRadius: {
  'card': '1.5rem',
  'input': '1rem',
  'chip': '9999px',
  'button': '1rem',
},
```

---

## 6. uiStyles.ts Extensions

### 6.1 New Function: `accentPanelClasses()`

Adds a green left-border accent variant for open/active pool states:

```ts
export function accentPanelClasses() {
  return [
    panelClasses(),
    'border-l-4',
    'border-l-brand-100',
  ].join(' ')
}
```

**Usage:** LockBanner (open state), TrustStatusBar (info tone), any panel that needs an "active/open" visual distinction.

### 6.2 New Function: `dangerPanelClasses()`

Adds a red left-border accent variant for locked/error states:

```ts
export function dangerPanelClasses() {
  return [
    panelClasses(),
    'border-l-4',
    'border-l-danger-600',
  ].join(' ')
}
```

**Usage:** LockBanner (locked state), DataAlert (error variant), TrustStatusBar (error tone).

### 6.3 New Function: `warnPanelClasses()`

Adds an amber left-border accent variant for stale/warning states:

```ts
export function warnPanelClasses() {
  return [
    panelClasses(),
    'border-l-4',
    'border-l-warn-600',
  ].join(' ')
}
```

**Usage:** TrustStatusBar (warning tone), DataAlert (warning variant).

### 6.4 Updated Function: `pageShellClasses()`

Update gradient background to use deeper sand/warm tones:

```ts
export function pageShellClasses() {
  return [
    'min-h-screen',
    'bg-[radial-gradient(circle_at_top,_rgba(254,243,199,0.20),_transparent_28%),linear-gradient(180deg,var(--gradient-shell-base)_0%,var(--gradient-shell-mid)_48%,var(--gradient-shell-end)_100%)]',
    'text-surface-900',
  ].join(' ')
}
```

With corresponding CSS custom properties in `globals.css`:

```css
:root {
  --gradient-shell-base: #f6f1e7;
  --gradient-shell-mid: #eef3ea;
  --gradient-shell-end: #e7efe8;
}
```

### 6.5 Updated Function: `sectionHeadingClasses()`

Update from `emerald-800/70` to brand tokens:

```ts
export function sectionHeadingClasses() {
  return [
    'text-[0.7rem]',
    'font-semibold',
    'uppercase',
    'tracking-[0.18em]',
    'text-brand-800/70',
  ].join(' ')
}
```

### 6.6 Updated Function: `scrollRegionFocusClasses()`

Update from `emerald-500` to brand tokens:

```ts
export function scrollRegionFocusClasses() {
  return [
    'focus-visible:outline-none',
    'focus-visible:ring-inset',
    'focus-visible:ring-2',
    'focus-visible:ring-brand-500',
  ].join(' ')
}
```

### 6.7 New Function: `inputClasses()`

Adds consistent input styling for form inputs:

```ts
export function inputClasses() {
  return [
    'w-full',
    'rounded-input',
    'border',
    'border-surface-200',
    'bg-white',
    'px-4',
    'py-3',
    'text-body-lg',
    'text-surface-900',
    'placeholder:text-surface-500',
    'focus-visible:ring-brand-500',
    'focus-visible:border-brand-300',
    'transition-colors',
  ].join(' ')
}
```

**Usage:** Auth form inputs, commissioner form inputs, search inputs across all phases.

### 6.8 Transition Plan for `uiStyles.ts`

`uiStyles.ts` is NOT being removed. It grows with new functions and updated token values. Consumers migrate from inline styles to these functions per-phase. After all phases, `uiStyles.ts` remains the canonical source for layout/panel utility classes.

---

## 7. Shared Primitives

### 7.1 New Component: `Button`

**File:** `src/components/Button.tsx`

This is the ONLY new component primitive. Button inconsistency is the worst problem in the codebase (6+ different button styles). All other patterns (panels, headings, chips) remain as `uiStyles.ts` functions or config-driven components.

```tsx
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}
```

**Variant classes:**

| Variant | Classes |
|---|---|
| `primary` | `rounded-button bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-500 shadow-subtle` |
| `secondary` | `rounded-button border border-surface-300 bg-white text-surface-700 hover:bg-surface-50 focus-visible:ring-brand-500` |
| `danger` | `rounded-button bg-danger-600 text-white hover:bg-danger-700 focus-visible:ring-danger-500` |
| `ghost` | `rounded-button text-surface-600 hover:bg-surface-50 focus-visible:ring-brand-500` |

**Size classes:**

| Size | Padding | Font |
|---|---|---|
| `sm` | `px-3 py-1.5` | `text-body` |
| `md` (default) | `px-4 py-2.5` | `text-body-lg` |
| `lg` | `px-6 py-3` | `text-body-lg font-semibold` |

All buttons inherit 44px minimum touch target from `globals.css`.

**Migration mapping:**

| Current | New |
|---|---|
| `bg-blue-600 text-white hover:bg-blue-700` | `<Button variant="primary">` |
| `bg-green-600 hover:bg-green-700` | `<Button variant="primary">` |
| `bg-emerald-600 text-white` | `<Button variant="primary">` |
| `bg-slate-950 text-white` | `<Button variant="primary">` |
| `bg-red-600 hover:bg-red-700` | `<Button variant="danger">` |
| `bg-slate-600 hover:bg-slate-700` | `<Button variant="secondary">` |

### 7.2 Kept Pattern: Config-Driven StatusChip/FreshnessChip

Per Product Planner confirmation: **keep the icon + color pattern**. Never use color alone. Update the token values in `STATUS_CONFIG` and `FRESHNESS_CONFIG`:

**StatusChip token migration:**

| Status | Current classes | New classes |
|---|---|---|
| `open` | `border-emerald-200 bg-emerald-50 text-emerald-900` | `border-brand-200 bg-brand-50 text-brand-900` |
| `live` | `border-sky-200 bg-sky-50 text-sky-900` | `border-info-200 bg-info-50 text-info-900` |
| `complete` | `border-slate-200 bg-slate-100 text-slate-900` | `border-surface-200 bg-surface-100 text-surface-900` |
| `archived` | `border-slate-200 bg-slate-100 text-slate-700` | `border-surface-200 bg-surface-100 text-surface-700` |

**FreshnessChip token migration:**

| Status | Current classes | New classes |
|---|---|---|
| `current` | `border-emerald-200 bg-emerald-50 text-emerald-900` | `border-brand-200 bg-brand-50 text-brand-900` |
| `stale` | `border-amber-200 bg-amber-50 text-amber-900` | `border-warn-200 bg-warn-50 bg-warn-900` |
| `unknown` | `border-slate-200 bg-slate-100 text-slate-700` | `border-surface-200 bg-surface-100 text-surface-700` |

### 7.3 Kept Pattern: LockBanner

Per Product Planner confirmation:
- **Open state:** `green-100` background → `brand-100` with accent left-border
- **Locked state:** preserve `red-600` meaning → `danger-600` with danger accent

Update `LockBanner.tsx` colors:

| State | Current | New |
|---|---|---|
| Locked | `border-slate-200 bg-slate-100/90` | `border-danger-200/80 bg-danger-50/95` |
| Open | `border-emerald-200 bg-emerald-50/90` | `border-brand-200 bg-brand-50/90` |

### 7.4 Kept Pattern: TrustStatusBar `toneClasses()`

Update `toneClasses()` to use semantic tokens:

```ts
function toneClasses(tone: TrustTone): string {
  switch (tone) {
    case 'error':
      return 'border-danger-200/80 bg-danger-50/95 text-danger-950'
    case 'warning':
      return 'border-warn-200/80 bg-warn-50/95 text-warn-950'
    default:
      return 'border-brand-200/80 bg-white/95 text-surface-900'
  }
}
```

### 7.5 Kept Pattern: DataAlert `VARIANT_CONFIG`

Update `VARIANT_CONFIG` to use semantic tokens:

| Variant | Current | New |
|---|---|---|
| `error` | `border-red-200 bg-red-50/95 text-red-950` | `border-danger-200 bg-danger-50/95 text-danger-950` |
| `warning` | `border-amber-200 bg-amber-50/95 text-amber-950` | `border-warn-200 bg-warn-50/95 text-warn-950` |
| `info` | `border-sky-200 bg-sky-50/95 text-sky-950` | `border-info-200 bg-info-50/95 text-info-950` |

---

## 8. Page Shell Strategy

### 8.1 Shell Architecture

The app currently has three shell patterns:

1. **Authenticated app shell** (`(app)/layout.tsx`) — `bg-gray-50`, white nav, `max-w-7xl`
2. **Spectator page** (`spectator/page.tsx`) — `pageShellClasses()` with warm gradient
3. **Auth/join pages** — standalone centered cards, no shared layout

**Proposed unified shell:**

The `(app)/layout.tsx` adopts the `pageShellClasses()` gradient background. Auth/join pages get wrapped in a simplified version.

**`(app)/layout.tsx` changes:**

- Replace `bg-gray-50` → `min-h-screen bg-[radial-gradient(...)]` via updated `pageShellClasses()` or inline gradient
- Replace nav `bg-white shadow-sm` → `bg-surface/95 backdrop-blur border-b border-sand-200/60`
- Replace `text-gray-900` logo → `text-brand-950 font-bold`
- Replace `text-gray-600` links → `text-surface-600 hover:text-surface-900`

### 8.2 Auth/Join Pages

- Wrap in gradient background using CSS custom property `--gradient-shell`
- Replace `bg-white rounded-lg shadow` card with `panelClasses()` panel
- Replace `bg-blue-600` buttons with `<Button variant="primary">`

---

## 9. Migration Strategy

### 9.1 Rollout Order (Per Product Planner Confirmation)

| Phase | Scope | Stories | Key Files | Why |
|---|---|---|---|---|
| **Phase 0** | Foundation | OPS-20 | `tailwind.config.js`, `globals.css`, `uiStyles.ts` extensions, `Button.tsx` | All other phases depend on this |
| **Phase 1** | Participant Picks | OPS-21 | Picks page, LockBanner, PickProgress, SelectionSummaryCard, SubmissionConfirmation, GolferPicker | Trust-critical player interaction (confirmed Critical priority) |
| **Phase 2** | Spectator + Pools + Join | OPS-23, OPS-24, OPS-25 | Leaderboard, TrustStatusBar, StatusChip, FreshnessChip, DataAlert, PoolCard, Pools page, Join page | High-priority public-facing pages |
| **Phase 3** | Commissioner + Detail + Global | OPS-26, OPS-27, OPS-29 | Commissioner dashboard, Pool detail, Global styles, App layout, MetricCard | Medium priority — internal tools + global polish |
| **Phase 4** | Auth | OPS-28 | Sign-in, Sign-up pages | Low priority — functional, not trust-critical |

### 9.2 Migration Rules

1. **Never break existing behavior.** Each phase must ship without visual regressions.
2. **Token-first migration.** Replace `emerald-X` with `brand-X`, `slate-X` with `surface-X`, `gray-X` with `surface-X` or `stone-X`, `sky-X` with `info-X`, `red-X` with `danger-X` only in files touched by that phase.
3. **Button substitution.** When touching a file, replace ad-hoc button styles with `<Button>`.
4. **uiStyles.ts function substitution.** When touching a file, replace inline panel styles with `panelClasses()`, `accentPanelClasses()`, etc.
5. **`gray` → `surface` or `stone` is mandatory in every touched file.** No file leaves Phase N still using `gray`.
6. **Keep icon + color pattern** in StatusChip and FreshnessChip — never color alone.
7. **LockBanner** uses `brand-100` (green-100) for open, `danger-600` (red-600) for locked.

---

## 10. Exact Files to Touch

### Phase 0: Foundation

| File | Change |
|---|---|
| `tailwind.config.js` | Add `sand`, `brand` (green), `surface` (stone), `danger` (red), `warn` (amber), `info` (sky) color tokens; add `fontSize` (eyebrow, label, body, body-lg, heading-lg, heading-xl), `boxShadow` (panel, panel-hover, elevated, subtle), `borderRadius` (card, input, chip, button), `spacing` (panel-px, panel-py, shell-px, shell-py) extensions |
| `src/app/globals.css` | Add CSS custom properties for `--color-brand`, `--color-sand`, `--color-surface`, `--color-danger`, `--color-warn`, `--color-info`, `--gradient-shell`; update body style to `bg-sand-50 text-surface-900`; update focus ring to use `--ring-brand` (green-700); update shadow overlays to use stone-900 RGB values |
| `src/components/uiStyles.ts` | Add `accentPanelClasses()`, `dangerPanelClasses()`, `warnPanelClasses()`; update `sectionHeadingClasses()` to use `brand-800/70`; update `scrollRegionFocusClasses()` to use `brand-500` |
| `src/components/Button.tsx` | New file — Button primitive with primary/secondary/danger/ghost variants and sm/md/lg sizes |

### Phase 1: Participant Picks (OPS-21)

| File | Change |
|---|---|
| `src/app/(app)/participant/picks/[poolId]/page.tsx` | Wrap in gradient background; migrate `slate` → `surface`, `emerald` → `brand` |
| `src/app/(app)/participant/picks/[poolId]/PicksForm.tsx` | Migrate buttons to `<Button>`, migrate colors |
| `src/components/LockBanner.tsx` | Replace locked section with `dangerPanelClasses()` / `danger-600` tokens; replace open section with `accentPanelClasses()` / `brand-100` tokens; update `sectionHeadingClasses()` reference |
| `src/components/PickProgress.tsx` | Migrate `emerald` → `brand`, `slate` → `surface` |
| `src/components/SelectionSummaryCard.tsx` | Replace `panelClasses()` call, migrate `sky` → `info` |
| `src/components/SubmissionConfirmation.tsx` | Replace panel styles, migrate colors |
| `src/components/GolferCatalogPanel.tsx` | Migrate buttons to `<Button>`, migrate colors |

### Phase 2: Spectator + Pools + Join (OPS-23, OPS-24, OPS-25)

| File | Change |
|---|---|
| `src/app/spectator/pools/[poolId]/page.tsx` | Replace `pageShellClasses()` with updated gradient tokens; migrate colors |
| `src/components/leaderboard.tsx` | Replace `panelClasses()` with updated tokens; migrate colors |
| `src/components/LeaderboardHeader.tsx` | Replace `sectionHeadingClasses()`, migrate to `brand` tokens |
| `src/components/LeaderboardRow.tsx` | Migrate `gray` → `surface`, `emerald` → `brand`, `sky` → `info` |
| `src/components/LeaderboardEmptyState.tsx` | Replace `panelClasses()`, migrate colors |
| `src/components/StatusChip.tsx` | Update `STATUS_CONFIG` classes to use `brand`/`info`/`surface` tokens; keep icon + color pattern |
| `src/components/FreshnessChip.tsx` | Update `FRESHNESS_CONFIG` classes to use `brand`/`warn`/`surface` tokens; keep icon + color pattern |
| `src/components/TrustStatusBar.tsx` | Update `toneClasses()` to use `danger`/`warn`/`brand` tokens; use `accentPanelClasses()` / `dangerPanelClasses()` / `warnPanelClasses()` |
| `src/components/DataAlert.tsx` | Update `VARIANT_CONFIG` to use `danger`/`warn`/`info` tokens |
| `src/components/EntryGolferBreakdown.tsx` | Migrate colors |
| `src/components/GolferContribution.tsx` | Migrate `gray` → `surface` |
| `src/components/GolferScorecard.tsx` | Migrate `gray` → `surface` |
| `src/components/score-display.tsx` | Migrate `green` → `brand`, `red` → `danger`, `gray` → `surface` |
| `src/components/GolferDetailSheet.tsx` | Migrate colors, replace gradient with tokens |
| `src/components/CopyLinkButton.tsx` | Migrate to `<Button>` |
| `src/components/PoolCard.tsx` | Replace `bg-white rounded-lg shadow` with `panelClasses()`; migrate `gray` → `surface` |
| `src/app/(app)/participant/pools/page.tsx` | Migrate colors, use `panelClasses()` |
| `src/app/join/[inviteCode]/page.tsx` | Wrap in gradient, replace card with `panelClasses()`, buttons with `<Button>` |
| `src/app/join/[inviteCode]/JoinPoolForm.tsx` | Migrate buttons and inputs |

### Phase 3: Commissioner + Detail + Global (OPS-26, OPS-27, OPS-29)

| File | Change |
|---|---|
| `src/app/(app)/layout.tsx` | Replace `bg-gray-50` with `pageShellClasses()` gradient; update nav to use `brand` and `surface` tokens; replace `gray` links |
| `src/app/(app)/commissioner/page.tsx` | Migrate to `panelClasses()`, `<Button>`, `sectionHeadingClasses()` |
| `src/app/(app)/commissioner/pools/[poolId]/page.tsx` | Migrate to `panelClasses()`, `<Button>`, `sectionHeadingClasses()`, `metricCardClasses()` |
| `src/app/(app)/commissioner/pools/[poolId]/PoolConfigForm.tsx` | Migrate to `panelClasses()`, inputs, `<Button>` |
| `src/app/(app)/commissioner/pools/[poolId]/PoolStatusSection.tsx` | Migrate to `metricCardClasses()`, `sectionHeadingClasses()` |
| `src/app/(app)/commissioner/pools/[poolId]/InviteLinkSection.tsx` | Migrate to `panelClasses()`, `<Button>`, `sectionHeadingClasses()` |
| `src/app/(app)/commissioner/pools/[poolId]/PoolActions.tsx` | Migrate buttons to `<Button>` variants |
| `src/app/(app)/commissioner/pools/[poolId]/ArchivePoolButton.tsx` | Migrate to `<Button variant="secondary">` |
| `src/app/(app)/commissioner/pools/[poolId]/ReopenPoolButton.tsx` | Migrate to `<Button variant="secondary">` |
| `src/app/(app)/commissioner/pools/[poolId]/DeletePoolButton.tsx` | Migrate to `<Button variant="danger">` |
| `src/app/(app)/commissioner/CreatePoolForm.tsx` | Migrate to `panelClasses()`, `<Button>` |
| `src/components/CommissionerGolferPanel.tsx` | Migrate to `panelClasses()`, `<Button>` |
| `src/components/GolferCatalogPanel.tsx` | Migrate to `panelClasses()`, `<Button>` — if not already done in Phase 1 |

### Phase 4: Auth (OPS-28)

| File | Change |
|---|---|
| `src/app/(auth)/sign-in/page.tsx` | Wrap in gradient, replace card with `panelClasses()`, buttons with `<Button>`, inputs with `inputClasses()` |
| `src/app/(auth)/sign-up/page.tsx` | Wrap in gradient, replace card with `panelClasses()`, buttons with `<Button>`, inputs with `inputClasses()` |
| `src/app/(auth)/sign-up/actions.ts` | No visual changes (server action) |
| `src/app/(auth)/sign-in/actions.ts` | No visual changes (server action) |

---

## 11. Accessibility Preservation

The redesign preserves all existing accessibility patterns:

- 44px minimum touch targets (enforced in `globals.css`)
- `role="status"` + `aria-live` on all status/freshness/trust indicators
- `sr-only` for visually hidden labels
- Focus-visible rings using `--ring-brand` CSS custom property (updated to green-700)
- `prefers-reduced-motion` suppression (preserved in `globals.css`)
- Skip-to-content link (preserved in layout)
- Keyboard navigation in `GolferPicker` (arrow keys, enter, escape)
- `<dialog>` element for `GolferDetailSheet`
- **Icon + color pattern** in StatusChip/FreshnessChip (confirmed — never color alone)

New `Button` component inherits 44px touch targets from globals.

---

## 12. Testing Strategy

### 12.1 Verification Approach

Each phase should:

1. Run `npm run build` — no TypeScript or build errors
2. Run `npm run lint` — no lint warnings
3. Manually verify each affected page on mobile (375px) and desktop (1280px)
4. Verify all a11y patterns (screen reader, keyboard nav, focus rings) still work
5. Verify lock state and freshness indicators remain prominent and obvious

### 12.2 Component Tests

- **Button** component: verify variant classes, size classes, HTML attributes pass-through, 44px touch target
- **uiStyles.ts functions**: verify `accentPanelClasses()`, `dangerPanelClasses()`, `warnPanelClasses()` return expected class strings
- Existing tests in `src/lib/__tests__/` and `src/components/__tests__/` must continue to pass

### 12.3 No-Break Guarantee

Each phase must ship without:
- TypeScript errors
- Build failures
- Lint warnings
- Breaking existing tests
- Visual regressions visible on mobile (375px) or desktop (1280px)
- Loss of accessibility patterns (lock state prominence, freshness indicators)

---

## 13. Constraints and Guardrails

| Constraint | Enforcement |
|---|---|
| Mobile first | All token values validated at 375px first |
| Trust visible | Lock state and freshness remain first-class UI elements |
| Lock state obvious | Lock/open remains a prominent banner, not a subtle indicator |
| Freshness obvious | Freshness chips and trust bar remain visually prominent |
| Next action obvious | Primary actions visually dominant via `<Button variant="primary">` |
| No fake status | Status chips show real state only |
| Keep `uiStyles.ts` function pattern | Hybrids: extend functions, add `Button` component only |
| Keep icon + color in chips | Never color alone for status |
| Favor Tailwind conventions | Use `tailwind.config.js` theme extensions, not a new CSS-in-JS system |
| Keep product semantics intact | No flow changes, no API changes, only visual layer |
| `gray` → `surface`/`stone` mandatory | Every touched file must eliminate `gray` |

---

## 14. Decisions Resolved by Product Planner (OPS-15)

| Decision | Choice | Rationale |
|---|---|---|
| Visual direction | Option A: Refine existing emerald/sand → deepen to green/sand | Preserve and deepen, not overhaul |
| Component strategy | Option C: Hybrid — keep `uiStyles.ts`, add Button, extend functions | Proven pattern with selective component for worst inconsistency |
| Page priority | Phase 1: Picks, Phase 2: Spectator/Pools/Join, Phase 3: Commissioner/Detail/Global, Phase 4: Auth | Trust-critical picks first |
| Breakpoints | Keep Tailwind defaults (`sm:`, `md:`, `lg:`) | No changes needed |
| Palette anchors | `green-900`, `green-700`, `green-100` = active/open; `sand-100`, `sand-50` = success; `stone-900`, `stone-600` = text; `red-600` = locked/error | Confirmed palette |
| LockBanner | `green-100` for open, preserve `red-600` for locked | Keep meaning, update tokens |
| StatusChip | Keep icon + color pattern, never color alone | Accessibility requirement |