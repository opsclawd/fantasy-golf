# Design Spec: Green/Sand Design Token System

**Story:** OPS-20 — Epic 7.1: Implement green/sand design token system
**Date:** 2026-04-17
**Author:** Architecture Lead
**Status:** DESIGN_REVIEW

---

## 1. Problem Statement

The codebase has no centralized design token system. Color values are scattered across 30+ component files as raw Tailwind class names (`bg-blue-600`, `text-slate-500`, etc.) and inline hex/rgba values (e.g., `#1f5d3f` in layout.tsx, `rgba(15,23,42,0.35)` shadows). This creates three problems:

1. **Inconsistency:** Two parallel gray systems (`slate-*` in newer components, `gray-*` in older pages) and two primary color systems (`emerald-*` for brand, `blue-*` for legacy forms).
2. **Hard to theme:** Swapping to the green/sand palette requires touching dozens of files individually with no single source of truth.
3. **Hard to maintain:** No documentation of what color maps to what semantic purpose.

## 2. Design Goals

- Provide a single source of truth for the green/sand color palette
- Make the token system usable via Tailwind utility classes (no API changes to components)
- Preserve all existing Tailwind utility patterns (opacity modifiers, responsive prefixes)
- Consolidate the dual gray systems (`gray-*` and `slate-*`) into `stone-*` per the design brief
- Replace `blue-*` primary actions with `green-*` per the design brief
- Keep the change purely thematic — no functional or layout changes

## 3. Approach

**Recommended: Tailwind theme extension with CSS custom properties**

Extend `tailwind.config.js` to define semantic color tokens that map to the green/sand palette. Use CSS custom properties in `globals.css` for runtime-switchable values. Components consume tokens via standard Tailwind classes like `bg-primary`, `text-primary-dark`, etc.

This is the recommended approach because:
- **Zero component API changes.** A class like `bg-primary-700` works identically to `bg-emerald-700` — opacity modifiers, responsive variants, hover prefixes all work.
- **Single source of truth.** The Tailwind config holds the hex values; `globals.css` holds CSS custom properties for runtime theming.
- **Incremental migration.** We can define all tokens now and migrate components in subsequent stories. This story only creates the token system; it does not refactor existing components.

### Alternatives Considered

**A. Pure CSS custom properties only** — Define `--color-primary`, `--color-surface`, etc. and apply via `style` attributes or `[class]` bindings. Rejected: loses Tailwind's utility composition (can't do `hover:bg-primary-700` without the theme extension).

**B. Style dictionary / build-time token pipeline** — Use a tool like Style Dictionary to generate tokens from a JSON source. Rejected: overkill for this project size; Tailwind's theme extension covers the use case without additional build tooling.

## 4. Token Architecture

### 4.1 Color Tokens

Define semantic color groups in `tailwind.config.js` → `theme.extend.colors`:

```js
// tailwind.config.js — theme.extend.colors
{
  primary: {
    900: '#14532d',  // green-900 — key headers, primary actions
    700: '#15803d',  // green-700 — interactive elements, links
    100: '#dcfce7',  // green-100 — success states, open locks
  },
  surface: {
    warm: '#fef3c7',  // sand-100 — warm backgrounds, accents
    base: '#fffbeb',  // sand-50 — page backgrounds
  },
  action: {
    warning: '#f59e0b', // amber-500 — warning states
    error: '#dc2626',   // red-600 — error states, locked indicators
  },
  // stone palette replaces slate/gray for all neutrals
  neutral: {
    900: '#1c1917',  // stone-900 — primary text
    600: '#57534e',  // stone-600 — secondary text
    200: '#e7e5e4',  // stone-200 — borders, dividers
  },
}
```

Additionally, use Tailwind's built-in `stone` scale (`stone-50`, `stone-100`, `stone-200`, etc.) directly where neutral shades beyond the three semantic tokens are needed. The `stone` scale aligns with the design brief palette, so we do not alias every shade — only the three most semantically meaningful ones.

### 4.2 CSS Custom Properties (globals.css)

Add CSS custom properties that document the token values and enable future runtime theming. The Tailwind config uses **static hex values** (not `var()` references) because Tailwind opacity modifiers like `bg-primary-700/50` require static values or RGB-component format — hex values with opacity modifiers work out of the box, while `var('#hex')` does not.

The CSS variables serve as a parallel documentation layer and future runtime-theming hook:

```css
:root {
  color-scheme: light;
  /* Brand */
  --color-primary-900: #14532d;
  --color-primary-700: #15803d;
  --color-primary-100: #dcfce7;
  /* Surface */
  --color-surface-warm: #fef3c7;
  --color-surface-base: #fffbeb;
  /* Action */
  --color-action-warning: #f59e0b;
  --color-action-error: #dc2626;
  /* Neutral */
  --color-neutral-900: #1c1917;
  --color-neutral-600: #57534e;
  --color-neutral-200: #e7e5e4;
  /* Focus ring — update from teal to green */
  --ring-brand: 21 128 61; /* rgb for #15803d (green-700) */
  /* Shell text — update from slate to stone */
  --fg-shell: 28 25 23; /* rgb for #1c1917 (stone-900) */
}
```

`--ring-brand` and `--fg-shell` remain in RGB-component format (space-separated) because they are consumed via `rgb(var(--ring-brand))` and `rgb(var(--fg-shell))` in existing CSS.

### 4.3 Spacing Tokens

The acceptance criteria require an 8px base rhythm. Tailwind's default spacing scale is 4px-based (`1 = 0.25rem = 4px`). For an 8px rhythm, we define a `spacing-token` utility map:

```js
// tailwind.config.js — theme.extend.spacing
spacing: {
  '1x': '0.5rem',   // 8px
  '1.5x': '0.75rem', // 12px
  '2x': '1rem',     // 16px
  '2.5x': '1.25rem', // 20px
  '3x': '1.5rem',   // 24px
  '4x': '2rem',     // 32px
  '5x': '2.5rem',   // 40px
  '6x': '3rem',     // 48px
  '8x': '4rem',     // 64px
  '10x': '5rem',    // 80px
  '12x': '6rem',    // 96px
},
```

This provides named spacing tokens that align to an 8px grid. The existing Tailwind numeric scale (`p-4` = 16px, etc.) remains available but the new named tokens (`p-2x`, `p-3x`) enforce the rhythm. Future component work should prefer the named tokens.

### 4.4 Typography Tokens

The design brief specifies typography treatment but no custom token system beyond font weights. Since the project uses system-ui fonts (Inter not loaded), we add minimal typography tokens:

```js
// tailwind.config.js — theme.extend
fontSize: {
  'label': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '500' }],
},
fontFamily: {
  sans: ['Inter', 'system-ui', 'sans-serif'],
  mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
},
```

No new font files are loaded — `Inter` degrades to `system-ui`. The `mono` family is for score/timing data per the design brief.

## 5. Existing Code Mapping

### 5.1 Tailwind Config Changes

The current `tailwind.config.js` has an empty `theme.extend`. We populate it with all tokens from Section 4.

### 5.2 CSS Variable Updates (globals.css)

- Update `--fg-shell` from `15 23 42` (slate-900) to `28 25 23` (stone-900)
- Update `--ring-brand` from `14 116 144` (teal-700) to `21 128 61` (green-700)
- Update `body` `@apply` from `bg-stone-50 text-slate-900` to `bg-surface-base text-neutral-900`
- Add all new CSS custom properties from Section 4.2

### 5.3 Hardcoded Color Audit (for documentation — migration happens in later stories)

The following files contain hardcoded colors that will need migration in subsequent stories, but are **out of scope** for this story which only creates the token system:

| File | Hardcoded Values | Token Mapping |
|------|-----------------|---------------|
| `src/app/layout.tsx:21` | `#1f5d3f` theme color | `--color-primary-700` |
| `src/components/uiStyles.ts:4` | Gradient hexes + rgba | `surface-*` + `primary-*` tokens |
| `src/components/GolferDetailSheet.tsx:72` | `#f8f5ee`, rgba shadows | `surface-*` tokens |
| All component files | `slate-*`, `gray-*`, `emerald-*`, `sky-*`, `blue-*` classes | Mapped to `primary-*`, `neutral-*`, `stone-*`, `surface-*` |

This mapping will be documented in a token reference file for use by the Implementation Engineer during future stories.

## 6. Scope Boundaries

**In scope (this story):**
- Define color, spacing, and typography tokens in `tailwind.config.js`
- Add CSS custom properties in `globals.css`
- Update `--fg-shell` and `--ring-brand` to green/sand palette values
- Update body `@apply` to use new token classes
- Update `layout.tsx` theme-color meta tag to use `--color-primary-700` hex
- Create token documentation file

**Out of scope (future stories):**
- Migrating individual component files from old classes to new token classes
- Removing `uiStyles.ts` hardcoded gradients (requires component-level refactoring)
- Changing any component behavior or layout
- Adding dark mode

## 7. Token Documentation

A `docs/design-tokens.md` file will be created containing:
1. Full token reference table (token name → hex value → semantic purpose)
2. Migration mapping table (old class → new token class)
3. Usage guidelines (when to use semantic tokens vs. Tailwind's `stone` scale directly)

## 8. Verification

The token system is complete when:
- `tailwind.config.js` contains all color, spacing, and typography tokens
- `globals.css` contains all CSS custom properties
- `npx tailwindcss --help` runs without errors (valid config)
- `npm run build` completes successfully
- Token documentation exists at `docs/design-tokens.md`
- The body background and text color render using the new `surface-base` and `neutral-900` tokens
- Focus rings render using the updated `--ring-brand` (green instead of teal)