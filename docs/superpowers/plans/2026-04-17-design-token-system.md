# Green/Sand Design Token System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a centralized design token system in Tailwind config and CSS custom properties that defines the green/sand color palette, 8px spacing rhythm, and typography tokens.

**Architecture:** Extend `tailwind.config.js` with semantic color tokens (`primary`, `surface`, `action`, `neutral`) using static hex values (for Tailwind opacity modifier support). Add parallel CSS custom properties in `globals.css` for documentation and future runtime-theming hooks. Update `layout.tsx` theme-color meta tag. Create token documentation.

**Tech Stack:** Tailwind CSS v3.4, Next.js 14, CSS custom properties, Vitest for testing

**Design Spec:** `docs/superpowers/specs/2026-04-17-design-token-system-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `tailwind.config.js` | Color, spacing, typography token definitions |
| Modify | `src/app/globals.css` | CSS custom properties, body styles, focus ring |
| Modify | `src/app/layout.tsx:21` | Theme-color meta tag |
| Create | `src/lib/__tests__/design-tokens.test.ts` | Token config validation tests |
| Create | `docs/design-tokens.md` | Token reference and migration mapping |

---

### Task 1: Tailwind Config — Color Tokens

**Files:**
- Modify: `tailwind.config.js`
- Test: `src/lib/__tests__/design-tokens.test.ts`

- [ ] **Step 1: Write failing test for color tokens**

Create `src/lib/__tests__/design-tokens.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import tailwindConfig from '../../../../tailwind.config.js'

const colors = tailwindConfig.theme.extend.colors

describe('tailwind config color tokens', () => {
  it('defines primary color tokens', () => {
    expect(colors.primary[900]).toBe('#14532d')
    expect(colors.primary[700]).toBe('#15803d')
    expect(colors.primary[100]).toBe('#dcfce7')
  })

  it('defines surface color tokens', () => {
    expect(colors.surface.warm).toBe('#fef3c7')
    expect(colors.surface.base).toBe('#fffbeb')
  })

  it('defines action color tokens', () => {
    expect(colors.action.warning).toBe('#f59e0b')
    expect(colors.action.error).toBe('#dc2626')
  })

  it('defines neutral color tokens', () => {
    expect(colors.neutral[900]).toBe('#1c1917')
    expect(colors.neutral[600]).toBe('#57534e')
    expect(colors.neutral[200]).toBe('#e7e5e4')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/design-tokens.test.ts`
Expected: FAIL — `TypeError: Cannot read properties of undefined` (colors is `{}` currently)

- [ ] **Step 3: Implement color tokens in tailwind.config.js**

Replace `tailwind.config.js` lines 8–10 with:

```js
  theme: {
    extend: {
      colors: {
        primary: {
          900: '#14532d',
          700: '#15803d',
          100: '#dcfce7',
        },
        surface: {
          warm: '#fef3c7',
          base: '#fffbeb',
        },
        action: {
          warning: '#f59e0b',
          error: '#dc2626',
        },
        neutral: {
          900: '#1c1917',
          600: '#57534e',
          200: '#e7e5e4',
        },
      },
    },
  },
```

Keep all existing content (`content` array, `plugins` array) unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/design-tokens.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.js src/lib/__tests__/design-tokens.test.ts
git commit -m "feat: add semantic color tokens to tailwind config

OPS-20: Define primary, surface, action, and neutral color token
groups in tailwind.config.js with green/sand palette hex values."
```

---

### Task 2: Tailwind Config — Spacing Tokens

**Files:**
- Modify: `tailwind.config.js`
- Test: `src/lib/__tests__/design-tokens.test.ts`

- [ ] **Step 1: Write failing test for spacing tokens**

Add to `src/lib/__tests__/design-tokens.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import tailwindConfig from '../../../../tailwind.config.js'

const spacing = tailwindConfig.theme.extend.spacing

describe('tailwind config spacing tokens', () => {
  it('defines 8px-base rhythm spacing', () => {
    expect(spacing['1x']).toBe('0.5rem')
    expect(spacing['2x']).toBe('1rem')
    expect(spacing['3x']).toBe('1.5rem')
    expect(spacing['4x']).toBe('2rem')
    expect(spacing['6x']).toBe('3rem')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/design-tokens.test.ts`
Expected: FAIL — spacing tests fail (spacing not defined yet)

- [ ] **Step 3: Implement spacing tokens in tailwind.config.js**

Add `spacing` key inside `theme.extend` (after `colors`):

```js
      spacing: {
        '1x': '0.5rem',
        '1.5x': '0.75rem',
        '2x': '1rem',
        '2.5x': '1.25rem',
        '3x': '1.5rem',
        '4x': '2rem',
        '5x': '2.5rem',
        '6x': '3rem',
        '8x': '4rem',
        '10x': '5rem',
        '12x': '6rem',
      },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/design-tokens.test.ts`
Expected: All spacing + color tests PASS

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.js src/lib/__tests__/design-tokens.test.ts
git commit -m "feat: add 8px-base spacing tokens to tailwind config

OPS-20: Define named spacing tokens (1x=8px, 2x=16px, etc.) in
tailwind.config.js theme.extend.spacing."
```

---

### Task 3: Tailwind Config — Typography Tokens

**Files:**
- Modify: `tailwind.config.js`
- Test: `src/lib/__tests__/design-tokens.test.ts`

- [ ] **Step 1: Write failing test for typography tokens**

Add to `src/lib/__tests__/design-tokens.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import tailwindConfig from '../../../../tailwind.config.js'

describe('tailwind config typography tokens', () => {
  it('defines label font size', () => {
    const fontSize = tailwindConfig.theme.extend.fontSize
    expect(fontSize.label[0]).toBe('0.875rem')
  })

  it('defines sans font family with Inter first', () => {
    const fontFamily = tailwindConfig.theme.extend.fontFamily
    expect(fontFamily.sans[0]).toBe('Inter')
  })

  it('defines mono font family', () => {
    const fontFamily = tailwindConfig.theme.extend.fontFamily
    expect(fontFamily.mono).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/design-tokens.test.ts`
Expected: FAIL — typography tests fail

- [ ] **Step 3: Implement typography tokens in tailwind.config.js**

Add `fontSize` and `fontFamily` keys inside `theme.extend` (after `spacing`):

```js
      fontSize: {
        label: ['0.875rem', { lineHeight: '1.25rem', fontWeight: '500' }],
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/design-tokens.test.ts`
Expected: All tests PASS (color + spacing + typography)

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.js src/lib/__tests__/design-tokens.test.ts
git commit -m "feat: add typography tokens to tailwind config

OPS-20: Define label font-size and Inter/mono font families in
tailwind.config.js theme.extend."
```

---

### Task 4: CSS Custom Properties — globals.css

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/app/__tests__/globals-css.test.ts`

- [ ] **Step 1: Write a test that validates CSS custom properties exist**

Create `src/app/__tests__/globals-css.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const cssPath = resolve(__dirname, '../globals.css')
const css = readFileSync(cssPath, 'utf-8')

describe('globals.css custom properties', () => {
  const requiredVars = [
    '--color-primary-900',
    '--color-primary-700',
    '--color-primary-100',
    '--color-surface-warm',
    '--color-surface-base',
    '--color-action-warning',
    '--color-action-error',
    '--color-neutral-900',
    '--color-neutral-600',
    '--color-neutral-200',
    '--ring-brand',
    '--fg-shell',
  ]

  it.each(requiredVars)('defines %s', (varName) => {
    const pattern = new RegExp(`^\\s*${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`, 'm')
    expect(css).toMatch(pattern)
  })

  it('updates --ring-brand to green-700 RGB value', () => {
    expect(css).toContain('--ring-brand: 21 128 61')
  })

  it('updates --fg-shell to stone-900 RGB value', () => {
    expect(css).toContain('--fg-shell: 28 25 23')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/__tests__/globals-css.test.ts`
Expected: FAIL — most custom properties not defined yet

- [ ] **Step 3: Update globals.css :root block**

Replace the `:root` block in `src/app/globals.css` (lines 6–10) with:

```css
  :root {
    color-scheme: light;
    --fg-shell: 28 25 23;
    --ring-brand: 21 128 61;
    --color-primary-900: #14532d;
    --color-primary-700: #15803d;
    --color-primary-100: #dcfce7;
    --color-surface-warm: #fef3c7;
    --color-surface-base: #fffbeb;
    --color-action-warning: #f59e0b;
    --color-action-error: #dc2626;
    --color-neutral-900: #1c1917;
    --color-neutral-600: #57534e;
    --color-neutral-200: #e7e5e4;
  }
```

- [ ] **Step 4: Update body @apply to use new tokens**

Change line 39 from:

```css
    @apply bg-stone-50 text-slate-900 antialiased;
```

to:

```css
    @apply bg-surface-base text-neutral-900 antialiased;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/app/__tests__/globals-css.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Run build to verify CSS compiles**

Run: `npm run build`
Expected: Build completes with no errors. The new Tailwind classes (`bg-surface-base`, `text-neutral-900`) must be recognized.

- [ ] **Step 7: Commit**

```bash
git add src/app/globals.css src/app/__tests__/globals-css.test.ts
git commit -m "feat: add CSS custom properties and update body styles

OPS-20: Add all color CSS custom properties to :root, update
--ring-brand from teal to green-700, --fg-shell from slate to
stone-900, and body classes to use new token names."
```

---

### Task 5: Update layout.tsx theme-color meta tag

**Files:**
- Modify: `src/app/layout.tsx:21`

- [ ] **Step 1: Update themeColor value**

Change line 21 in `src/app/layout.tsx` from:

```ts
  themeColor: '#1f5d3f',
```

to:

```ts
  themeColor: '#15803d',
```

This aligns the browser chrome theme color with `primary-700` (`#15803d` / green-700) per the design spec.

- [ ] **Step 2: Run build to verify**

Run: `npm run build`
Expected: Build completes with no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: update theme-color meta to green-700

OPS-20: Change browser chrome theme color from #1f5d3f to #15803d
(primary-700) to align with the new design token system."
```

---

### Task 6: Create Token Documentation

**Files:**
- Create: `docs/design-tokens.md`

- [ ] **Step 1: Write the token documentation file**

Create `docs/design-tokens.md`:

```md
# Design Token Reference

## Color Tokens

### Primary (Green)

| Tailwind Class | Hex | CSS Variable | Usage |
|---|---|---|---|
| `bg-primary-900` | `#14532d` | `--color-primary-900` | Key headers, primary actions |
| `bg-primary-700` | `#15803d` | `--color-primary-700` | Interactive elements, links, focus rings |
| `bg-primary-100` | `#dcfce7` | `--color-primary-100` | Success states, open locks |

### Surface (Sand)

| Tailwind Class | Hex | CSS Variable | Usage |
|---|---|---|---|
| `bg-surface-warm` | `#fef3c7` | `--color-surface-warm` | Warm backgrounds, accents |
| `bg-surface-base` | `#fffbeb` | `--color-surface-base` | Page backgrounds |

### Action

| Tailwind Class | Hex | CSS Variable | Usage |
|---|---|---|---|
| `bg-action-warning` | `#f59e0b` | `--color-action-warning` | Warning states, stale indicators |
| `bg-action-error` | `#dc2626` | `--color-action-error` | Error states, locked indicators |

### Neutral (Stone)

| Tailwind Class | Hex | CSS Variable | Usage |
|---|---|---|---|
| `text-neutral-900` | `#1c1917` | `--color-neutral-900` | Primary text |
| `text-neutral-600` | `#57534e` | `--color-neutral-600` | Secondary text |
| `border-neutral-200` | `#e7e5e4` | `--color-neutral-200` | Borders, dividers |

For neutral shades beyond 900/600/200, use Tailwind's built-in `stone` scale directly (e.g., `stone-50`, `stone-100`, `stone-300`, `stone-400`, `stone-500`, `stone-700`, `stone-800`, `stone-950`).

### Focus Ring

| CSS Variable | Value | Usage |
|---|---|---|
| `--ring-brand` | `21 128 61` (RGB) | Focus outlines — consumed as `rgb(var(--ring-brand))` |
| `--fg-shell` | `28 25 23` (RGB) | Shell text — consumed as `rgb(var(--fg-shell))` |

## Spacing Tokens

8px base rhythm. Use these named tokens in preference to Tailwind's numeric scale.

| Token | rem | px | Example |
|---|---|---|---|
| `1x` | 0.5rem | 8px | `p-1x` |
| `1.5x` | 0.75rem | 12px | `p-1.5x` |
| `2x` | 1rem | 16px | `p-2x` |
| `2.5x` | 1.25rem | 20px | `p-2.5x` |
| `3x` | 1.5rem | 24px | `p-3x` |
| `4x` | 2rem | 32px | `p-4x` |
| `5x` | 2.5rem | 40px | `p-5x` |
| `6x` | 3rem | 48px | `p-6x` |
| `8x` | 4rem | 64px | `p-8x` |
| `10x` | 5rem | 80px | `p-10x` |
| `12x` | 6rem | 96px | `p-12x` |

## Typography Tokens

| Token | Value | Usage |
|---|---|---|
| `text-label` | 0.875rem / 1.25rem / 500 | UI labels, compact text |
| `font-sans` | Inter, system-ui, sans-serif | Body text (Inter degrades to system-ui) |
| `font-mono` | ui-monospace, SFMono-Regular, monospace | Scores, timing data |

## Migration Mapping (Old → New)

This table maps the deprecated class patterns to their token replacements. Component migration happens in subsequent stories.

### Primary Brand Colors

| Old Class | New Class | Notes |
|---|---|---|
| `bg-emerald-700` | `bg-primary-700` | Interactive elements |
| `text-emerald-700` | `text-primary-700` | Links, active text |
| `bg-emerald-50` | `bg-primary-100` | Light backgrounds (close match) |
| `text-emerald-800` | `text-primary-900` | Dark brand text |
| `border-emerald-200` | `border-primary-100` | Brand borders |
| `bg-blue-600` | `bg-primary-700` | Primary buttons |
| `hover:bg-blue-700` | `hover:bg-primary-900` | Button hover |
| `text-blue-600` | `text-primary-700` | Links |
| `focus:ring-blue-500` | `focus:ring-primary-700` | Focus rings |

### Neutral Colors

| Old Class | New Class | Notes |
|---|---|---|
| `text-slate-900` / `text-gray-900` | `text-neutral-900` | Primary text |
| `text-slate-600` / `text-gray-600` | `text-neutral-600` | Secondary text |
| `border-slate-200` / `border-gray-200` | `border-neutral-200` | Borders |
| `bg-white` | `bg-white` | Keep as-is (not tokenized) |
| `bg-stone-50` / `bg-gray-50` | `bg-surface-base` | Page backgrounds |
| `text-slate-500` / `text-gray-500` | `text-stone-500` | Tertiary text (use stone scale) |

### Status Colors

| Old Class | New Class | Notes |
|---|---|---|
| `text-red-600` / `bg-red-600` | `text-action-error` / `bg-action-error` | Error/locked states |
| `text-amber-800` / `bg-amber-100` | `text-action-warning` / related | Warning states |
| `bg-sky-50` | `bg-primary-100` | Selected states (reassign to brand) |

### Hardcoded Values

| File | Old Value | New Token |
|---|---|---|
| `src/app/layout.tsx` | `#1f5d3f` | `#15803d` (primary-700) |
| `src/components/uiStyles.ts` | `#f6f1e7`, `#eef3ea`, `#e7efe8` | `surface-*` tokens |
| `src/components/GolferDetailSheet.tsx` | `#f8f5ee` | `surface-*` tokens |
```

- [ ] **Step 2: Commit**

```bash
git add docs/design-tokens.md
git commit -m "docs: add design token reference and migration mapping

OPS-20: Document all color, spacing, typography tokens with
Tailwind class names, hex values, CSS variables, and usage.
Include old-to-new migration mapping for future component work."
```

---

### Task 7: Full Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass, including new design-token and globals-css tests

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build completes successfully with zero errors

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No new lint errors

- [ ] **Step 4: Commit any fixes (if needed)**

Only if verification revealed issues. If clean, skip this step.

---

### Task 8: Save plan as issue document and transition to PLANNED

**Files:** None (Paperclip API operations)

- [ ] **Step 1: Upload plan to issue document**

Use `PUT /api/issues/{issueId}/documents/plan` with the full plan content.

- [ ] **Step 2: Add comment and update status**

Post comment with plan location and update issue status to `in_review` for Product Planner handoff.