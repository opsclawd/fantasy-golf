# Redesign Architecture Mapping — Design Spec

**Date:** 2026-04-16
**Author:** Architecture Lead
**Issue:** [OPS-16](/OPS/issues/OPS-16)
**Parent:** [OPS-14](/OPS/issues/OPS-14) — Drive the mobile redesign for fantasy-golf
**Status:** DESIGN_REVIEW

---

## 1. Problem Statement

Fantasy Golf needs a visual redesign toward a sharper, more premium motorsport-inspired look using dark green and sand. The current codebase has a partial design system (`uiStyles.ts` + config-driven components like `StatusChip`, `FreshnessChip`, `DataAlert`) but also has significant inconsistencies: ad-hoc button colors, mixed `gray`/`slate` usage, pages using `bg-gray-50` while others use `pageShellClasses()` gradient, and no shared button or input primitives.

This spec defines the technical bridge: how the approved visual direction maps to the current codebase's architecture, what tokens, primitives, and shell patterns we need, and exactly which files to touch.

---

## 2. Current State Assessment

### 2.1 What Works Well (Preserve These)

| Pattern | File | Usage |
|---|---|---|
| `panelClasses()` | `uiStyles.ts` | ~20+ consumers — frosted-glass card aesthetic with `rounded-3xl border border-white/60 bg-white/90 backdrop-blur` |
| `metricCardClasses()` | `uiStyles.ts` | 4-col metric grid — `panelClasses() + min-h-[8rem] p-5` |
| `pageShellClasses()` | `uiStyles.ts` | Spectator page gradient background |
| `sectionHeadingClasses()` | `uiStyles.ts` | Eyebrow label pattern — `text-[0.7rem] font-semibold uppercase tracking-[0.18em]` |
| `scrollRegionFocusClasses()` | `uiStyles.ts` | Accessible scrollable focus rings |
| Config-driven chip system | `StatusChip.tsx`, `FreshnessChip.tsx` | `STATUS_CONFIG`/`FRESHNESS_CONFIG` pattern — maps state to token classes |
| Tone-based alert system | `TrustStatusBar.tsx`, `DataAlert.tsx` | `toneClasses()`/`VARIANT_CONFIG` — semantic tone routing |
| Accessibility patterns | All status components | `role="status"`, `aria-live`, `sr-only`, 44px touch targets |

### 2.2 What Needs Fixing (Inconsistencies)

| Problem | Detail | Files Affected |
|---|---|---|
| **No shared button component** | Buttons range from `bg-blue-600` (auth), `bg-green-600` (start pool), `bg-red-600` (close/delete), `bg-slate-600` (archive), `bg-slate-950` (newer actions), `bg-emerald-600` (catalog sync) | 8+ action files |
| **No shared input component** | Inputs range from `rounded-2xl border border-slate-200 px-4 py-3` (picks) to `rounded-xl border border-slate-200 px-3 py-2.5` (search) to `p-2 border rounded` (auth) | 5+ form files |
| **Mixed color namespaces** | `gray` used in `GolferContribution`, `GolferScorecard`, `ScoreDisplay`, app layout (`bg-gray-50`) while rest of codebase uses `slate` | 6+ files |
| **App layout lacks pageShellClasses** | `(app)/layout.tsx` uses `bg-gray-50` (flat, cold) while spectator uses the warm gradient. Visual disconnect between authenticated and public pages. | `src/app/(app)/layout.tsx` |
| **Auth/Join pages use completely different styling** | `bg-white rounded-lg shadow` card pattern, `bg-blue-600` buttons — no design system tokens at all | `src/app/(auth)/`, `src/app/join/` |
| **PoolCard doesn't use panelClasses** | `PoolCard.tsx` uses `bg-white rounded-lg shadow` — inconsistent with every other card | `PoolCard.tsx` |
| **ScoreDisplay uses different color names** | `text-green-600`/`text-red-600`/`text-gray-600` instead of emerald/rose/slate | `score-display.tsx` |

### 2.3 Current Token Inventory

**Color tokens currently used (Tailwind utility classes):**

| Category | Colors | Pattern |
|---|---|---|
| Brand / Trust | `emerald-50` through `emerald-950` | Primary positive, trust, brand identity |
| Selection / Active | `sky-50` through `sky-950` | Active states, selections |
| Neutral / Surface | `slate-50` through `slate-950` | Text, backgrounds, borders |
| Warning / Stale | `amber-50` through `amber-950` | Pending, stale data |
| Error / Danger | `red-50` through `red-950`, `rose-50` through `rose-200` | Errors, destructive actions |
| Legacy / Inconsistent | `gray-50` through `gray-900`, `blue-600`, `green-600` | Ad-hoc, should migrate |

**Typography tokens:**

| Use | Classes | Notes |
|---|---|---|
| Eyebrow label | `text-[0.7rem] font-semibold uppercase tracking-[0.18em]` | `sectionHeadingClasses()` |
| Page title | `text-3xl font-semibold tracking-tight sm:text-4xl` | Inline, not tokenized |
| Card heading | `text-lg font-semibold`, `text-xl font-semibold` | Inline, 2 sizes |
| Body text | `text-sm text-slate-600`, `text-base font-semibold` | Inline |
| Table header | `text-xs font-semibold uppercase tracking-[0.16em] text-slate-500` | Inline, similar to eyebrow |
| Score value | `font-mono text-sm font-semibold` | Inline |
| Chip label | `text-xs font-semibold uppercase tracking-[0.16em]` | Inline |

**Spacing tokens:**

| Use | Classes | Notes |
|---|---|---|
| Section gap | `space-y-4`, `space-y-5`, `space-y-6` | Not tokenized |
| Panel inner | `p-4`, `p-5`, `p-6` | Inconsistent |
| Header padding | `px-4 py-4 sm:px-5` to `px-5 py-5 sm:px-7 sm:py-6` | 4 variants |
| Container | `max-w-3xl`, `max-w-5xl`, `max-w-7xl` | 3 widths, not in design sys |

---

## 3. Design Direction

### 3.1 Visual Direction Assumptions

Based on the parent issue (OPS-14) and existing codebase analysis, the redesign direction is:

- **Preserve the light base** with warm sand-to-green gradient, but deepen it for more premium feel
- **Strengthen emerald as the primary brand color** — the current `emerald` usage is correct but under-utilized in buttons and interactive elements
- **Introduce darker contrast elements** — darker navigation, buttons, and key UI anchors that create a motorsport premium feel
- **Unify `gray` → `slate`** across the entire codebase
- **Replace ad-hoc `blue-600`/`green-600` buttons** with a consistent button system using brand tokens
- **Keep frosted-glass panel aesthetic** — `panelClasses()` is the right pattern, it just needs deeper refinements

If Product Planner's design brief (OPS-15) diverges from these assumptions, this spec will need revision at the DESIGN_REVIEW gate.

### 3.2 Approach Selection

I considered three approaches:

#### Approach A: In-place Token Migration (Minimal Disruption)

Add CSS custom properties to `globals.css` and `tailwind.config.js`, then gradually migrate existing utility classes to reference these tokens. Keep `uiStyles.ts` function pattern.

**Pros:** Lowest risk, incremental, no component rewrites.
**Cons:** Still stuck with function-based token system, hard to theme later, doesn't solve the button/input component gap.

#### Approach B: Design Token Layer + Component Library (Recommended)

1. Define a Tailwind theme extension with semantic color tokens in `tailwind.config.js`
2. Add CSS custom properties in `globals.css` for values that need runtime access
3. Create shared UI primitives (`Button`, `Input`, `Card`) in `src/components/ui/`
4. Refactor `uiStyles.ts` to reference theme tokens instead of hardcoded classes
5. Migrate pages one-by-one to use new primitives

**Pros:** Solves the root problem (no buttons/inputs), establishes scalable pattern, allows incremental rollout, all future work uses primitives.
**Cons:** More upfront work than Approach A, touches more files.

#### Approach C: Full CSS-in-JS Migration

Replace Tailwind with a CSS-in-JS system (e.g., styled-components, vanilla-extract).

**Pros:** Maximum flexibility.
**Cons:** Massive rewrite, violates existing conventions, high risk, YAGNI.

**Selected: Approach B.** It addresses the core inconsistency problems (buttons, inputs, color namespace) while respecting the existing Tailwind + utility-class convention the team uses. It's incremental and testable.

---

## 4. Token Plan

### 4.1 Color Tokens

Add semantic color tokens to `tailwind.config.js` under `theme.extend.colors`:

```js
// tailwind.config.js — theme.extend.colors
colors: {
  brand: {
    50:  '#ecfdf5',  // emerald-50
    100: '#d1fae5',  // emerald-100
    200: '#a7f3d0',  // emerald-200
    300: '#6ee7b7',  // emerald-300
    400: '#34d399',  // emerald-400
    500: '#10b981',  // emerald-500
    600: '#059669',  // emerald-600
    700: '#047857',  // emerald-700
    800: '#065f46',  // emerald-800
    900: '#064e3b',  // emerald-900
    950: '#022c22',  // emerald-950
  },
  sand: {
    50:  '#fdf8ef',  // custom warm off-white
    100: '#f6f1e7',  // from current gradient
    200: '#ede5d0',  // warm sand light
    300: '#ddd0b0',  // warm sand mid
    400: '#c4ad82',  // warm sand
    500: '#a8904e',  // warm sand accent
    600: '#8b7535',  // warm sand dark
    700: '#6e5a28',  // warm sand deep
    800: '#57471f',  // warm sand darkest
    900: '#3f320f',  // near-black sand
    950: '#2a1f08',  // black sand
  },
  surface: {
    DEFAULT: '#ffffff',
    50:  '#f8fafc',  // slate-50
    100: '#f1f5f9',  // slate-100
    200: '#e2e8f0',  // slate-200
    800: '#1e293b',  // slate-800
    900: '#0f172a',  // slate-900
    950: '#020617',  // slate-950
  },
  danger: {
    50:  '#fef2f2',  // red-50
    100: '#fee2e2',  // red-100
    200: '#fecaca',  // red-200
    600: '#dc2626',  // red-600
    700: '#b91c1c',  // red-700
    800: '#991b1b',  // red-800
    900: '#7f1d1d',  // red-900
    950: '#450a0a',  // red-950
  },
  warn: {
    50:  '#fffbeb',  // amber-50
    100: '#fef3c7',  // amber-100
    200: '#fde68a',  // amber-200
    600: '#d97706',  // amber-600
    700: '#b45309',  // amber-700
    800: '#92400e',  // amber-800
    900: '#78350f',  // amber-900
    950: '#451a03',  // amber-950
  },
  info: {
    50:  '#f0f9ff',  // sky-50
    100: '#e0f2fe',  // sky-100
    200: '#bae6fd',  // sky-200
    600: '#0284c7',  // sky-600 → keep but rename as semantic
    700: '#0369a1',  // sky-700
    800: '#075985',  // sky-800
    900: '#0c4a6e',  // sky-900
    950: '#082f49',  // sky-950
  },
}
```

**CSS Custom Properties** (in `globals.css` `:root`):

```css
:root {
  /* Brand */
  --color-brand: 5 150 105;       /* emerald-600 */
  --color-brand-hover: 4 120 87;   /* emerald-700 */
  --color-brand-contrast: 255 255 255;
  
  /* Sand / Surface */
  --color-sand: 246 241 231;       /* warm background */
  --color-sand-accent: 196 173 130; /* sand-400 accent */
  
  /* Semantic surfaces */
  --color-surface: 255 255 255;
  --color-surface-elevated: 248 250 252;
  --color-on-surface: 15 23 42;    /* slate-900 */
  --color-on-surface-variant: 71 85 105; /* slate-600 */
  
  /* Status */
  --color-danger: 220 38 38;
  --color-warn: 217 119 6;
  --color-info: 2 132 199;
  --color-success: 5 150 105;
  
  /* Shell gradient (existing, codified) */
  --gradient-shell: radial-gradient(circle at top, rgba(234,179,8,0.16), transparent 28%), linear-gradient(180deg, #f6f1e7 0%, #eef3ea 48%, #e7efe8 100%);
  
  /* Existing */
  --fg-shell: 15 23 42;
  --ring-brand: 14 116 144;
}
```

### 4.2 Typography Tokens

Add type scale to `tailwind.config.js`:

```js
// tailwind.config.js — theme.extend.fontSize
fontSize: {
  'eyebrow': ['0.7rem', { lineHeight: '1rem', letterSpacing: '0.18em', fontWeight: '600' }],
  'label': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.16em', fontWeight: '600' }],
  'body': ['0.875rem', { lineHeight: '1.5rem' }],       // text-sm
  'body-lg': ['1rem', { lineHeight: '1.75rem' }],        // text-base
  'heading-lg': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.025em', fontWeight: '600' }],
  'heading-xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.025em', fontWeight: '600' }],
},
```

This codifies the existing informal type scale without breaking current usage.

### 4.3 Spacing Tokens

Add spacing scale to `tailwind.config.js`:

```js
// tailwind.config.js — theme.extend.spacing (additions)
spacing: {
  'panel-px': '1.25rem',   // 20px — consistent panel horizontal padding (currently p-4 or p-5)
  'panel-py': '1.25rem',   // 20px — consistent panel vertical padding
  'shell-px': '1.25rem',   // 20px — shell horizontal (currently px-4 or px-5)
  'shell-py': '2rem',      // 32px — shell vertical (currently py-8)
},
```

### 4.4 Shadow Tokens

```js
// tailwind.config.js — theme.extend.boxShadow
boxShadow: {
  'panel': '0 18px 60px -24px rgba(15,23,42,0.35)',
  'panel-hover': '0 24px 70px -20px rgba(15,23,42,0.40)',
  'elevated': '0 32px 120px -40px rgba(15,23,42,0.55)',
  'subtle': '0 1px 3px 0 rgba(15,23,42,0.08)',
},
```

This replaces the current `shadow-[0_18px_60px_-24px_rgba(15,23,42,0.35)]` with `shadow-panel`.

### 4.5 Border Radius Tokens

```js
// tailwind.config.js — theme.extend.borderRadius (additions)
borderRadius: {
  'card': '1.5rem',      // 24px — matches current rounded-3xl for panels
  'input': '1rem',       // 16px — consistent input radius
  'chip': '9999px',      // Tailwind's rounded-full
  'button': '1rem',      // 16px — consistent button radius
},
```

---

## 5. Shared Primitives

### 5.1 New Component Directory

Create `src/components/ui/` for shared primitives. These are not a full component library — they are the minimum viable primitives needed to eliminate the worst inconsistencies.

### 5.2 Primitive: `Button`

**File:** `src/components/ui/Button.tsx`

```tsx
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}
```

**Variant tokens:**

| Variant | Classes (proposed) |
|---|---|
| `primary` | `rounded-button bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-500 shadow-subtle` |
| `secondary` | `rounded-button border border-surface-200 bg-white text-on-surface-variant hover:bg-surface-50 focus-visible:ring-brand-500` |
| `danger` | `rounded-button bg-danger-600 text-white hover:bg-danger-700 focus-visible:ring-danger-500` |
| `ghost` | `rounded-button text-on-surface-variant hover:bg-surface-50 focus-visible:ring-brand-500` |

**Size tokens:**

| Size | Padding | Font |
|---|---|---|
| `sm` | `px-3 py-1.5` | `text-body` |
| `md` (default) | `px-4 py-2.5` | `text-body-lg` |
| `lg` | `px-6 py-3` | `text-body-lg font-semibold` |

All buttons inherit 44px minimum touch target from globals.css.

**Migration mapping from current ad-hoc buttons:**

| Current | New |
|---|---|
| `bg-blue-600 text-white hover:bg-blue-700` (auth actions) | `variant="primary"` |
| `bg-green-600 hover:bg-green-700` (start pool) | `variant="primary"` |
| `bg-red-600 hover:bg-red-700` (close pool) | `variant="danger"` |
| `bg-slate-600 hover:bg-slate-700` (archive) | `variant="secondary"` |
| `bg-slate-950 text-white` (newer actions) | `variant="primary"` |
| `bg-emerald-600 text-white` (catalog sync) | `variant="primary"` |

### 5.3 Primitive: `Card`

**File:** `src/components/ui/Card.tsx`

This replaces `panelClasses()` usage with a React component:

```tsx
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg'
  elevated?: boolean
}
```

**Classes:**

| Prop | Classes |
|---|---|
| default | `rounded-card border border-white/60 bg-white/90 shadow-panel backdrop-blur` |
| `elevated` | Same + `shadow-elevated` |
| `padding="sm"` | `p-4` |
| `padding="md"` (default inner) | `p-5` |
| `padding="lg"` | `p-6` |
| `padding="none"` | No padding |

This preserves the frosted-glass panel aesthetic exactly.

### 5.4 Primitive: `Input`

**File:** `src/components/ui/Input.tsx`

```tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}
```

**Classes:** `w-full rounded-input border border-surface-200 bg-white px-4 py-3 text-body-lg text-on-surface placeholder:text-on-surface-variant/50 focus-visible:ring-brand-500 focus-visible:border-brand-300 transition-colors`

Error state adds: `border-danger-400 focus-visible:ring-danger-500`

### 5.5 Primitive: `MetricCard`

**File:** `src/components/ui/MetricCard.tsx`

Extends `Card` with `min-h-[8rem]` + `p-5`. Replaces `metricCardClasses()`.

```tsx
interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: React.ReactNode
  variant?: 'default' | 'brand' | 'danger' | 'warn'
}
```

### 5.6 Primitive: `SectionHeading`

**File:** `src/components/ui/SectionHeading.tsx`

Replaces `sectionHeadingClasses()` function calls with a component:

```tsx
interface SectionHeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  color?: 'default' | 'inherit' | 'brand'
}
```

**Variant mapping:**

| Color | Classes |
|---|---|
| `default` | `text-eyebrow text-brand-800/70` |
| `inherit` (current `.replace()` pattern) | `text-eyebrow text-current` |
| `brand` | `text-eyebrow text-brand-700` |

### 5.7 Primitive: `Chip`

**File:** `src/components/ui/Chip.tsx`

Replaces inline chip classes in `StatusChip`, `FreshnessChip`, and the freshness indicator in `TrustStatusBar`:

```tsx
interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'brand' | 'info' | 'warn' | 'danger' | 'neutral'
  icon?: string
}
```

| Variant | Classes |
|---|---|
| `brand` | `border-brand-200 bg-brand-50 text-brand-900` |
| `info` | `border-info-200 bg-info-50 text-info-900` |
| `warn` | `border-warn-200 bg-warn-50 text-warn-900` |
| `danger` | `border-danger-200 bg-danger-50 text-danger-900` |
| `neutral` | `border-surface-200 bg-surface-100 text-on-surface-variant` |

All variants share: `inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-chip border px-3 py-1 text-label`

---

## 6. Page Shell Strategy

### 6.1 Shell Architecture

The app currently has **three** distinct shell patterns:

1. **Authenticated app shell** (`(app)/layout.tsx`) — `bg-gray-50`, white nav, `max-w-7xl`
2. **Spectator page** (`spectator/page.tsx`) — `pageShellClasses()` with warm gradient
3. **Auth/join pages** — standalone centered cards, no shared layout

**Proposed unified shell:**

```
┌─────────────────────────────────────────┐
│ Navigation Bar                          │  ← bg-surface-elevated/95, border-b border-sand-200/60
│ [Logo]              [My Pools] [Comm.]   │  ← brand-900 logo text, surface-variant links
├─────────────────────────────────────────┤
│                                         │
│  Shell Gradient Background              │  ← CSS var --gradient-shell (preserved)
│                                         │
│  ┌───────────────────────────────┐      │
│  │ Card (panelClasses)           │      │  ← rounded-card, frosted glass
│  │ Content                       │      │
│  └───────────────────────────────┘      │
│                                         │
└─────────────────────────────────────────┘
```

### 6.2 Shell Component

**File:** `src/components/ui/PageShell.tsx`

```tsx
interface PageShellProps {
  children: React.ReactNode
  maxWidth?: 'narrow' | 'default' | 'wide'
}
```

| `maxWidth` | Value | Use case |
|---|---|---|
| `narrow` | `max-w-3xl` | Picks page |
| `default` | `max-w-5xl` | Pool list, spectator |
| `wide` | `max-w-7xl` | Commissioner detail |

Classes: `min-h-screen text-on-surface` + background gradient via CSS custom property.

### 6.3 Layout Changes

**`src/app/(app)/layout.tsx`** changes:
- Replace `bg-gray-50` with `PageShell` gradient background
- Replace nav `bg-white shadow-sm` with `bg-surface/95 backdrop-blur border-b border-sand-200/60`
- Replace `text-gray-900` logo with `text-brand-950 font-bold`
- Replace `text-gray-600` links with `text-on-surface-variant hover:text-on-surface`
- Replace `text-gray-600 hover:text-gray-900` with semantic tokens
- Add `PageShell maxWidth="wide"` wrapper

**`src/app/spectator/page.tsx`** changes:
- Replace `pageShellClasses()` inline with `<PageShell maxWidth="default">`

**`src/app/(auth)/` and `src/app/join/`** changes:
- Wrap in `<PageShell maxWidth="narrow">` with `flex items-center justify-center`
- Replace `bg-white rounded-lg shadow` card with `<Card>` component

---

## 7. Migration Strategy

### 7.1 Rollout Order (Mobile-First)

The rollout order prioritizes mobile-facing pages first, then internal/commissioner pages:

| Phase | Scope | Pages/Components | Why First |
|---|---|---|---|
| **Phase 0** | Token layer + primitives | `tailwind.config.js`, `globals.css`, `src/components/ui/*` | Foundation — all other phases depend on this |
| **Phase 1** | Spectator leaderboard | `spectator/`, `Leaderboard*`, `TrustStatusBar`, `FreshnessChip`, `StatusChip` | Highest public visibility, already uses `pageShellClasses()` |
| **Phase 2** | Picks flow | `participant/picks/`, `LockBanner`, `GolferPicker`, `PickProgress`, `SelectionSummaryCard`, `SubmissionConfirmation` | Player-facing, trust-critical |
| **Phase 3** | Auth & join | `(auth)/`, `join/` | New user entry point, currently has no design system |
| **Phase 4** | Commissioner dashboard | `commissioner/`, `CommissionerGolferPanel`, `GolferCatalogPanel`, `PoolCard`, metric cards | Internal tool, lowest urgency |

### 7.2 Migration Rules

1. **Never break existing behavior.** Each phase must ship without visual regressions.
2. **Token-first migration.** Replace `emerald-X` with `brand-X`, `slate-X` with `surface-X`, `sky-X` with `info-X`, etc. only in the files touched by that phase.
3. **Component-primitive substitution.** When touching a file, replace `panelClasses()` with `<Card>`, inline button styles with `<Button>`, etc.
4. **No orphaned code.** After a phase is complete, any `uiStyles.ts` function that has zero remaining consumers can be removed.
5. **`gray` → `slate` (surface) is mandatory in every touched file.** No file leaves Phase N still using `gray`.

### 7.3 uiStyles.ts Transition Plan

| Phase | Action | Remaining Consumers |
|---|---|---|
| Phase 0 | Keep all functions; they reference new theme tokens | All |
| Phase 1 | Migrate spectator components to `Card`, `SectionHeading`, `Chip` | Decrease by ~8 |
| Phase 2 | Migrate picks components | Decrease by ~5 |
| Phase 3 | Migrate auth/join | Decrease by ~3 |
| Phase 4 | Migrate commissioner | Decrease to 0 |
| Cleanup | Remove `uiStyles.ts` | 0 |

---

## 8. Exact Files to Touch

### Phase 0: Foundation

| File | Change |
|---|---|
| `tailwind.config.js` | Add `brand`, `sand`, `surface`, `danger`, `warn`, `info` color tokens; add `fontSize`, `boxShadow`, `borderRadius` extensions; add `panel-px`, `panel-py`, `shell-px`, `shell-py` spacing |
| `src/app/globals.css` | Add CSS custom properties for `--color-brand`, `--color-sand`, `--color-surface`, `--color-danger`, `--color-warn`, `--color-info`, `--gradient-shell`; update body styles to use `bg-sand-50 text-on-surface` |
| `src/components/ui/Button.tsx` | New file — Button primitive |
| `src/components/ui/Card.tsx` | New file — Card primitive (replaces `panelClasses()`) |
| `src/components/ui/Input.tsx` | New file — Input primitive |
| `src/components/ui/MetricCard.tsx` | New file — MetricCard primitive (replaces `metricCardClasses()`) |
| `src/components/ui/SectionHeading.tsx` | New file — SectionHeading primitive (replaces `sectionHeadingClasses()`) |
| `src/components/ui/Chip.tsx` | New file — Chip primitive |
| `src/components/ui/PageShell.tsx` | New file — PageShell primitive (replaces `pageShellClasses()`) |
| `src/components/ui/index.ts` | New file — barrel export |

### Phase 1: Spectator

| File | Change |
|---|---|
| `src/app/spectator/pools/[poolId]/page.tsx` | Replace `pageShellClasses()` with `<PageShell>`, migrate colors |
| `src/components/leaderboard.tsx` | Replace `panelClasses()` with `<Card>`, migrate colors |
| `src/components/LeaderboardHeader.tsx` | Replace `sectionHeadingClasses()` with `<SectionHeading>`, migrate colors |
| `src/components/LeaderboardRow.tsx` | Migrate `gray` → `surface`, `emerald` → `brand`, `sky` → `info` |
| `src/components/LeaderboardEmptyState.tsx` | Replace `panelClasses()` with `<Card>`, migrate colors |
| `src/components/StatusChip.tsx` | Migrate to `<Chip>`, update `STATUS_CONFIG` to use `brand`/`info`/`neutral` variants |
| `src/components/FreshnessChip.tsx` | Migrate to `<Chip>`, update `FRESHNESS_CONFIG` to use `brand`/`warn`/`neutral` variants |
| `src/components/TrustStatusBar.tsx` | Replace `panelClasses()` with `<Card>`, migrate `toneClasses()` to use `danger`/`warn`/`brand` tokens |
| `src/components/DataAlert.tsx` | Replace `panelClasses()` with `<Card>`, migrate `VARIANT_CONFIG` to use `danger`/`warn`/`info` tokens |
| `src/components/EntryGolferBreakdown.tsx` | Migrate colors |
| `src/components/GolferContribution.tsx` | Migrate `gray` → `surface` |
| `src/components/GolferScorecard.tsx` | Migrate `gray` → `surface` |
| `src/components/score-display.tsx` | Migrate `green` → `brand`, `red` → `danger`, `gray` → `surface` |
| `src/components/GolferDetailSheet.tsx` | Migrate colors, replace gradient with tokens |
| `src/components/CopyLinkButton.tsx` | Migrate to `<Button>` |

### Phase 2: Picks Flow

| File | Change |
|---|---|
| `src/app/(app)/participant/picks/[poolId]/page.tsx` | Wrap in `<PageShell maxWidth="narrow">` |
| `src/app/(app)/participant/picks/[poolId]/PicksForm.tsx` | Migrate to `<Button>`, `<Input>`, `<Card>` |
| `src/components/LockBanner.tsx` | Replace `panelClasses()` with `<Card>`, migrate colors |
| `src/components/PickProgress.tsx` | Migrate colors |
| `src/components/SelectionSummaryCard.tsx` | Replace `panelClasses()` with `<Card>`, migrate `sky` → `info` |
| `src/components/SubmissionConfirmation.tsx` | Replace `panelClasses()` with `<Card>`, migrate colors |
| `src/components/golfer-picker.tsx` | Migrate to `<Input>`, `<Button>` |
| `src/components/PoolCard.tsx` | Replace `bg-white rounded-lg shadow` with `<Card>` |

### Phase 3: Auth & Join

| File | Change |
|---|---|
| `src/app/(app)/layout.tsx` | Replace `bg-gray-50` with `<PageShell>` gradient, update nav to use brand tokens |
| `src/app/(auth)/sign-in/page.tsx` | Wrap in `<PageShell>`, replace card with `<Card>`, buttons with `<Button>` |
| `src/app/(auth)/sign-up/page.tsx` | Wrap in `<PageShell>`, replace card with `<Card>`, buttons with `<Button>` |
| `src/app/join/[inviteCode]/page.tsx` | Wrap in `<PageShell>`, replace card with `<Card>`, buttons with `<Button>` |
| `src/app/(app)/participant/pools/page.tsx` | Migrate colors, use `<Card>` |

### Phase 4: Commissioner

| File | Change |
|---|---|
| `src/app/(app)/commissioner/page.tsx` | Migrate to `<Card>`, `<Button>`, `<SectionHeading>` |
| `src/app/(app)/commissioner/pools/[poolId]/page.tsx` | Migrate to `<Card>`, `<Button>`, `<SectionHeading>`, `<MetricCard>` |
| `src/app/(app)/commissioner/pools/[poolId]/PoolConfigForm.tsx` | Migrate to `<Card>`, `<Input>`, `<Button>` |
| `src/app/(app)/commissioner/pools/[poolId]/PoolStatusSection.tsx` | Migrate to `<MetricCard>`, `<SectionHeading>` |
| `src/app/(app)/commissioner/pools/[poolId]/InviteLinkSection.tsx` | Migrate to `<Card>`, `<Button>`, `<SectionHeading>` |
| `src/app/(app)/commissioner/pools/[poolId]/PoolActions.tsx` | Migrate to `<Button>` variants |
| `src/app/(app)/commissioner/pools/[poolId]/ArchivePoolButton.tsx` | Migrate to `<Button variant="secondary">` |
| `src/app/(app)/commissioner/pools/[poolId]/ReopenPoolButton.tsx` | Migrate to `<Button variant="secondary">` |
| `src/app/(app)/commissioner/pools/[poolId]/DeletePoolButton.tsx` | Migrate to `<Button variant="danger">` |
| `src/app/(app)/commissioner/pools/[poolId]/CreatePoolForm.tsx` | Migrate to `<Card>`, `<Input>`, `<Button>` |
| `src/components/CommissionerGolferPanel.tsx` | Migrate to `<Card>`, `<SectionHeading>` |
| `src/components/GolferCatalogPanel.tsx` | Migrate to `<Card>`, `<Button>` |

### Phase 4 Cleanup

| File | Change |
|---|---|
| `src/components/uiStyles.ts` | Delete (all consumers migrated) |
| `tailwind.config.js` | Verify no unused theme extensions |

---

## 9. Accessibility Preservation

The redesign must preserve all existing accessibility patterns:

- 44px minimum touch targets (enforced in `globals.css`)
- `role="status"` + `aria-live` on all status/freshness/trust indicators
- `sr-only` for visually hidden labels
- Focus-visible rings using `/ring-brand` CSS custom property
- `prefers-reduced-motion` suppression (enforced in `globals.css`)
- Skip-to-content link
- Keyboard navigation in `GolferPicker` (arrow keys, enter, escape)
- `<dialog>` element for `GolferDetailSheet`

All new primitives (`Button`, `Card`, `Input`, `Chip`) must maintain these patterns. The `Button` component auto-inherits 44px touch targets from globals.

---

## 10. Testing Strategy

### 10.1 Visual Regression Approach

Since there is no visual regression testing framework currently, each phase should:

1. Run `npm run build` to verify no TypeScript or build errors
2. Run `npm run lint` to verify no lint warnings
3. Manually verify each affected page on mobile (375px) and desktop (1280px) viewports
4. Verify all a11y patterns (screen reader, keyboard nav, focus rings) still work

### 10.2 Component Tests

New primitives (`Button`, `Card`, `Input`, `Chip`, etc.) should have unit tests verifying:
- Correct variant classes are applied
- HTML attributes pass through correctly
- Accessibility attributes (`role`, `aria-*`) are present where expected
- 44px touch targets are respected

Existing tests in `src/components/__tests__/` and `src/lib/__tests__/` must continue to pass. Since components are visually-driven and tests use React Testing Library (which queries by role/text), most tests should not break if component behavior stays the same.

### 10.3 No-Break Guarantee

Each phase must ship without:
- TypeScript errors
- Build failures
- Lint warnings
- Breaking existing tests
- Visual regressions visible on mobile (375px) or desktop (1280px)

---

## 11. Constraints and Guardrails

| Constraint | Enforcement |
|---|---|
| Mobile first | All token values and responsive breakpoints must be validated at 375px first |
| Trust visible | Lock state and freshness must remain first-class UI elements — no redesign removes or obscures them |
| Lock state obvious | Lock/open remains a prominent banner, not a subtle indicator |
| Freshness obvious | Freshness chips and trust bar remain visually prominent |
| Next action obvious | Primary actions remain visually dominant via `Button variant="primary"` |
| No fake status | Status chips show real state only — no mock or placeholder states |
| Reusable primitives over one-off styling | Every new visual pattern becomes a primitive first |
| Favor existing Tailwind conventions | Use `tailwind.config.js` theme extensions, not a new CSS-in-JS system |
| Keep product semantics intact | No flow changes, no API changes, only visual layer changes |
| Backward compatibility | `uiStyles.ts` functions remain functional until Phase 4 cleanup removes all consumers |

---

## 12. Assumptions Awaiting Product Planner Confirmation

| Assumption | Default | Risk if Wrong |
|---|---|---|
| Visual direction: refine existing emerald/sand palette (not dark mode) | Refine and deepen | If dark mode needed, Phase 0 tokens need inversion layer |
| Page rollout priority: Spectator → Picks → Auth → Commissioner | As listed | Lower priority pages can be deferred |
| Button style: rounded (1rem radius) with solid fill | `rounded-button bg-brand-600` | If different button shape needed, only Button.tsx changes |
| Card style: preserve frosted-glass panels | Keep `backdrop-blur` + `bg-white/90` | If opaque cards needed, only Card.tsx changes |
| Input style: rounded with brand focus ring | `rounded-input focus-visible:ring-brand-500` | Low risk — standard pattern |

These assumptions are documented explicitly so Product Planner can override them at the DESIGN_REVIEW gate.