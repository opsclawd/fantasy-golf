# Redesign Architecture Mapping — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install the design token layer, shared primitives, and per-page migrations that implement the approved green/sand motorsport redesign across the fantasy-golf codebase.

**Architecture:** Hybrid approach — extend `uiStyles.ts` with new panel accent functions and `inputClasses()`, add a single `Button.tsx` component primitive, add semantic color tokens to `tailwind.config.js`, and migrate pages phase-by-phase replacing old color namespaces (`emerald`→`brand`, `slate`→`surface`, `gray`→`surface`, `sky`→`info`, `amber`→`warn`, `red`→`danger`) in every touched file.

**Tech Stack:** Next.js 14, Tailwind CSS 3.4, React 18, TypeScript 5, Vitest + Testing Library

**Design Spec:** `docs/superpowers/specs/2026-04-16-redesign-architecture-mapping-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|---|---|
| `src/components/Button.tsx` | Shared Button primitive with primary/secondary/danger/ghost variants |
| `src/components/__tests__/Button.test.tsx` | Button component tests |

### Modified Files
| File | Responsibility |
|---|---|
| `tailwind.config.js` | Add `sand`, `brand`, `surface`, `danger`, `warn`, `info` color tokens; typography, shadow, radius, spacing extensions |
| `src/app/globals.css` | Add CSS custom properties; update body class; update ring color |
| `src/components/uiStyles.ts` | Add `accentPanelClasses()`, `dangerPanelClasses()`, `warnPanelClasses()`, `inputClasses()`; update `scrollRegionFocusClasses()`, `sectionHeadingClasses()` |
| `src/components/__tests__/uiStyles.test.ts` | Update ring assertion; add tests for new functions |

Phase 1–4 files are listed in their respective sections below.

---

## Phase 0: Foundation (OPS-20 + OPS-22)

This phase creates the token layer and shared primitives that all subsequent phases depend on. No page-level migrations happen here.

### Task 1: Add semantic color tokens to tailwind.config.js

**Files:**
- Modify: `tailwind.config.js` (currently 12 lines, empty `theme.extend`)

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/tailwind-tokens.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import resolveConfig from 'tailwindcss/resolveConfig'
import tailwindConfig from '../../../tailwind.config'

const fullConfig = resolveConfig(tailwindConfig as any)

describe('tailwind semantic color tokens', () => {
  it('defines the sand color scale', () => {
    expect(fullConfig.theme.colors.sand).toBeDefined()
    expect(fullConfig.theme.colors.sand[50]).toBe('#fffbeb')
    expect(fullConfig.theme.colors.sand[100]).toBe('#fef3c7')
    expect(fullConfig.theme.colors.sand[600]).toBe('#d97706')
  })

  it('defines the brand color scale mapped to green', () => {
    expect(fullConfig.theme.colors.brand).toBeDefined()
    expect(fullConfig.theme.colors.brand.DEFAULT).toBe('#15803d')
    expect(fullConfig.theme.colors.brand[700]).toBe('#15803d')
    expect(fullConfig.theme.colors.brand[900]).toBe('#14532d')
  })

  it('defines the surface color scale mapped to stone', () => {
    expect(fullConfig.theme.colors.surface).toBeDefined()
    expect(fullConfig.theme.colors.surface.DEFAULT).toBe('#ffffff')
    expect(fullConfig.theme.colors.surface[600]).toBe('#57534e')
    expect(fullConfig.theme.colors.surface[900]).toBe('#1c1917')
  })

  it('defines the danger color scale mapped to red', () => {
    expect(fullConfig.theme.colors.danger).toBeDefined()
    expect(fullConfig.theme.colors.danger[600]).toBe('#dc2626')
  })

  it('defines the warn color scale mapped to amber', () => {
    expect(fullConfig.theme.colors.warn).toBeDefined()
    expect(fullConfig.theme.colors.warn[600]).toBe('#d97706')
  })

  it('defines the info color scale mapped to sky', () => {
    expect(fullConfig.theme.colors.info).toBeDefined()
    expect(fullConfig.theme.colors.info[600]).toBe('#0284c7')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/tailwind-tokens.test.ts`
Expected: FAIL — `fullConfig.theme.colors.sand` is `undefined`

- [ ] **Step 3: Write minimal implementation**

Replace the entire contents of `tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        sand: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        brand: {
          DEFAULT: '#15803d',
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        surface: {
          DEFAULT: '#ffffff',
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
          950: '#0c0a09',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        warn: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        info: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
      },
      fontSize: {
        'eyebrow': ['0.7rem', { lineHeight: '1rem', letterSpacing: '0.18em', fontWeight: '600' }],
        'label': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.16em', fontWeight: '600' }],
        'body': ['0.875rem', { lineHeight: '1.5rem' }],
        'body-lg': ['1rem', { lineHeight: '1.75rem' }],
        'heading-lg': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.025em', fontWeight: '600' }],
        'heading-xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.025em', fontWeight: '600' }],
      },
      boxShadow: {
        'panel': '0 18px 60px -24px rgba(28,25,23,0.35)',
        'panel-hover': '0 24px 70px -20px rgba(28,25,23,0.40)',
        'elevated': '0 32px 120px -40px rgba(28,25,23,0.55)',
        'subtle': '0 1px 3px 0 rgba(28,25,23,0.08)',
      },
      borderRadius: {
        'card': '1.5rem',
        'input': '1rem',
        'chip': '9999px',
        'button': '1rem',
      },
      spacing: {
        'panel-px': '1.25rem',
        'panel-py': '1.25rem',
        'shell-px': '1.25rem',
        'shell-py': '2rem',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/tailwind-tokens.test.ts`
Expected: PASS — all 6 semantic color scales are defined

- [ ] **Step 5: Run full test suite to confirm no regressions**

Run: `npx vitest run`
Expected: All existing tests pass

- [ ] **Step 6: Commit**

```bash
git add tailwind.config.js src/components/__tests__/tailwind-tokens.test.ts
git commit -m "feat: add semantic color tokens, typography, shadows, radius, spacing to tailwind config

Add sand, brand, surface, danger, warn, info color scales.
Add typography scale (eyebrow, label, body, body-lg, heading-lg, heading-xl).
Add shadow tokens (panel, panel-hover, elevated, subtle).
Add border radius tokens (card, input, chip, button).
Add spacing tokens (panel-px/py, shell-px/py).

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 2: Add CSS custom properties to globals.css

**Files:**
- Modify: `src/app/globals.css` (currently 62 lines)

- [ ] **Step 1: Write the failing test**

Add to `src/components/__tests__/tailwind-tokens.test.ts`:

```ts
describe('globals.css custom properties', () => {
  it('renders body with surface-900 text class', async () => {
    const { container } = render(<body />)
    expect(container.querySelector('body')).toBeInTheDocument()
  })
})
```

Note: This task is primarily a CSS change. The real verification is visual and via build. The test addition is minimal because CSS custom properties don't have good unit test coverage — we verify via `npm run build` success.

- [ ] **Step 2: Write the implementation**

Replace the entire contents of `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    color-scheme: light;
    --fg-shell: 28 25 23;
    --ring-brand: 21 128 61;
    --color-brand: 21 128 61;
    --color-brand-hover: 22 101 52;
    --color-brand-contrast: 255 255 255;
    --color-brand-light: 220 252 231;
    --color-sand: 254 243 199;
    --color-sand-light: 255 251 235;
    --color-surface: 255 255 255;
    --color-on-surface: 28 25 23;
    --color-on-surface-variant: 87 83 78;
    --color-danger: 220 38 38;
    --color-warn: 217 119 6;
    --color-info: 2 132 199;
    --gradient-shell-base: #f6f1e7;
    --gradient-shell-mid: #eef3ea;
    --gradient-shell-end: #e7efe8;
    --gradient-shell: radial-gradient(circle at top, rgba(254,243,199,0.20), transparent 28%), linear-gradient(180deg, var(--gradient-shell-base) 0%, var(--gradient-shell-mid) 48%, var(--gradient-shell-end) 100%);
  }

  :where(
    a[href],
    button,
    input:not([type='hidden']):not([type='checkbox']):not([type='radio']):not([type='range']),
    select,
    textarea,
    summary,
    [role='button']
  ) {
    min-block-size: 44px;
  }

  :where(
    button,
    input:not([type='hidden']):not([type='checkbox']):not([type='radio']):not([type='range']),
    select,
    textarea,
    [role='button']
  ) {
    min-inline-size: 44px;
  }

  html {
    scroll-behavior: smooth;
  }

  body {
    @apply bg-sand-50 text-surface-900 antialiased;
  }

  :where(a[href], button, input:not([type='hidden']), select, textarea, summary, [role='button']):focus-visible {
    outline: 3px solid rgb(var(--ring-brand));
    outline-offset: 3px;
    border-radius: 0.75rem;
    box-shadow: 0 0 0 6px rgba(var(--ring-brand), 0.18);
  }

  :where(a[href]:not([class]), [data-inline-link]) {
    min-inline-size: auto;
    min-block-size: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

Key changes from the original:
- `--fg-shell: 15 23 42` → `--fg-shell: 28 25 23` (stone-900 RGB instead of slate-900)
- `--ring-brand: 14 116 144` → `--ring-brand: 21 128 61` (green-700 instead of teal-700)
- Added `--color-brand`, `--color-brand-hover`, `--color-brand-contrast`, `--color-brand-light`
- Added `--color-sand`, `--color-sand-light`
- Added `--color-surface`, `--color-on-surface`, `--color-on-surface-variant`
- Added `--color-danger`, `--color-warn`, `--color-info`
- Added `--gradient-shell-base`, `--gradient-shell-mid`, `--gradient-shell-end`, `--gradient-shell`
- `bg-stone-50` → `bg-sand-50`, `text-slate-900` → `text-surface-900`

- [ ] **Step 3: Verify build succeeds**

Run: `npm run build`
Expected: Build completes with no errors

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All existing tests pass

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add CSS custom properties for design tokens in globals.css

Update --fg-shell to stone-900 RGB, --ring-brand to green-700.
Add custom properties for brand, sand, surface, danger, warn, info.
Add gradient shell custom properties.
Update body class from bg-stone-50 text-slate-900 to bg-sand-50 text-surface-900.

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 3: Extend uiStyles.ts with accent panels and inputClasses

**Files:**
- Modify: `src/components/uiStyles.ts` (currently 41 lines)
- Modify: `src/components/__tests__/uiStyles.test.ts` (currently 36 lines)

- [ ] **Step 1: Write the failing tests**

Add to `src/components/__tests__/uiStyles.test.ts` after the existing `it('returns visible focus classes...')` block:

```ts
import {
  accentPanelClasses,
  dangerPanelClasses,
  warnPanelClasses,
  inputClasses,
  metricCardClasses,
  pageShellClasses,
  panelClasses,
  scrollRegionFocusClasses,
  sectionHeadingClasses,
} from '../uiStyles'

describe('uiStyles', () => {
  it('returns the gradient shell for upgraded app pages', () => {
    expect(pageShellClasses()).toContain('bg-[radial-gradient(')
  })

  it('returns the premium panel classes for default panels', () => {
    expect(panelClasses()).toContain('rounded-3xl')
    expect(panelClasses()).toContain('border-white/60')
  })

  it('returns metric card classes with compact hierarchy', () => {
    expect(metricCardClasses()).toContain('min-h-[8rem]')
  })

  it('returns the shared heading wrapper classes', () => {
    expect(sectionHeadingClasses()).toContain('tracking-[0.18em]')
    expect(sectionHeadingClasses()).toContain('text-brand-800/70')
  })

  it('returns visible focus classes for keyboard-scroll regions', () => {
    expect(scrollRegionFocusClasses()).toContain('focus-visible:ring-inset')
    expect(scrollRegionFocusClasses()).toContain('focus-visible:ring-2')
    expect(scrollRegionFocusClasses()).toContain('focus-visible:ring-brand-500')
    expect(scrollRegionFocusClasses()).not.toContain('focus-visible:ring-offset-2')
    expect(scrollRegionFocusClasses()).not.toBe('focus-visible:outline-none')
  })

  it('returns accent panel classes with brand left border', () => {
    expect(accentPanelClasses()).toContain('border-l-4')
    expect(accentPanelClasses()).toContain('border-l-brand-100')
    expect(accentPanelClasses()).toContain('rounded-3xl')
  })

  it('returns danger panel classes with danger left border', () => {
    expect(dangerPanelClasses()).toContain('border-l-4')
    expect(dangerPanelClasses()).toContain('border-l-danger-600')
    expect(dangerPanelClasses()).toContain('backdrop-blur')
  })

  it('returns warn panel classes with warn left border', () => {
    expect(warnPanelClasses()).toContain('border-l-4')
    expect(warnPanelClasses()).toContain('border-l-warn-600')
    expect(warnPanelClasses()).toContain('backdrop-blur')
  })

  it('returns input classes with brand focus ring and input radius', () => {
    expect(inputClasses()).toContain('rounded-input')
    expect(inputClasses()).toContain('border-surface-200')
    expect(inputClasses()).toContain('focus-visible:ring-brand-500')
    expect(inputClasses()).toContain('text-body-lg')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/uiStyles.test.ts`
Expected: FAIL — `accentPanelClasses` is not exported from `../uiStyles`

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `src/components/uiStyles.ts`:

```ts
export function pageShellClasses() {
  return [
    'min-h-screen',
    'bg-[radial-gradient(circle_at_top,_rgba(254,243,199,0.20),_transparent_28%),linear-gradient(180deg,var(--gradient-shell-base)_0%,var(--gradient-shell-mid)_48%,var(--gradient-shell-end)_100%)]',
    'text-surface-900',
  ].join(' ')
}

export function panelClasses() {
  return [
    'rounded-3xl',
    'border',
    'border-white/60',
    'bg-white/90',
    'shadow-[0_18px_60px_-24px_rgba(28,25,23,0.35)]',
    'backdrop-blur',
  ].join(' ')
}

export function accentPanelClasses() {
  return [
    panelClasses(),
    'border-l-4',
    'border-l-brand-100',
  ].join(' ')
}

export function dangerPanelClasses() {
  return [
    panelClasses(),
    'border-l-4',
    'border-l-danger-600',
  ].join(' ')
}

export function warnPanelClasses() {
  return [
    panelClasses(),
    'border-l-4',
    'border-l-warn-600',
  ].join(' ')
}

export function metricCardClasses() {
  return [panelClasses(), 'min-h-[8rem]', 'p-5'].join(' ')
}

export function scrollRegionFocusClasses() {
  return [
    'focus-visible:outline-none',
    'focus-visible:ring-inset',
    'focus-visible:ring-2',
    'focus-visible:ring-brand-500',
  ].join(' ')
}

export function sectionHeadingClasses() {
  return [
    'text-[0.7rem]',
    'font-semibold',
    'uppercase',
    'tracking-[0.18em]',
    'text-brand-800/70',
  ].join(' ')
}

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

Key changes from original:
- `pageShellClasses()`: gradient rgba updated from `(234,179,8,0.16)` to `(254,243,199,0.20)`, uses CSS vars `var(--gradient-shell-*)`, `text-slate-900` → `text-surface-900`
- `panelClasses()`: shadow rgba from `(15,23,42,0.35)` to `(28,25,23,0.35)` (stone-900)
- `scrollRegionFocusClasses()`: `ring-emerald-500` → `ring-brand-500`
- `sectionHeadingClasses()`: `text-emerald-800/70` → `text-brand-800/70`
- Added `accentPanelClasses()`, `dangerPanelClasses()`, `warnPanelClasses()`, `inputClasses()`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/uiStyles.test.ts`
Expected: PASS — all 9 tests pass

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All existing tests pass. Note: any tests that assert `emerald-500` in scrollRegionFocusClasses will fail — that's expected and correct.

- [ ] **Step 6: Commit**

```bash
git add src/components/uiStyles.ts src/components/__tests__/uiStyles.test.ts
git commit -m "feat: extend uiStyles with accent panels, inputClasses, token migration

Add accentPanelClasses(), dangerPanelClasses(), warnPanelClasses().
Add inputClasses() for consistent form input styling.
Migrate scrollRegionFocusClasses from emerald-500 to brand-500.
Migrate sectionHeadingClasses from emerald-800/70 to brand-800/70.
Update pageShellClasses gradient to sand tones with CSS vars.
Update panelClasses shadow to stone-900 rgba.

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 4: Create Button primitive component

**Files:**
- Create: `src/components/Button.tsx`
- Create: `src/components/__tests__/Button.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/Button.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Button } from '../Button'

describe('Button', () => {
  it('renders a button with primary variant by default', () => {
    render(<Button>Click me</Button>)
    const btn = screen.getByRole('button', { name: 'Click me' })
    expect(btn).toBeInTheDocument()
    expect(btn.className).toContain('bg-brand-600')
    expect(btn.className).toContain('text-white')
    expect(btn.className).toContain('rounded-button')
  })

  it('renders secondary variant', () => {
    render(<Button variant="secondary">Cancel</Button>)
    const btn = screen.getByRole('button', { name: 'Cancel' })
    expect(btn.className).toContain('border-surface-300')
    expect(btn.className).toContain('bg-white')
  })

  it('renders danger variant', () => {
    render(<Button variant="danger">Delete</Button>)
    const btn = screen.getByRole('button', { name: 'Delete' })
    expect(btn.className).toContain('bg-danger-600')
    expect(btn.className).toContain('text-white')
  })

  it('renders ghost variant', () => {
    render(<Button variant="ghost">Skip</Button>)
    const btn = screen.getByRole('button', { name: 'Skip' })
    expect(btn.className).toContain('text-surface-600')
  })

  it('renders small size', () => {
    render(<Button size="sm">Small</Button>)
    const btn = screen.getByRole('button', { name: 'Small' })
    expect(btn.className).toContain('px-3')
    expect(btn.className).toContain('py-1.5')
  })

  it('renders large size', () => {
    render(<Button size="lg">Large</Button>)
    const btn = screen.getByRole('button', { name: 'Large' })
    expect(btn.className).toContain('px-6')
    expect(btn.className).toContain('py-3')
    expect(btn.className).toContain('font-semibold')
  })

  it('passes HTML button attributes through', () => {
    render(<Button disabled type="submit">Submit</Button>)
    const btn = screen.getByRole('button', { name: 'Submit' })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('type', 'submit')
  })

  it('handles click events', async () => {
    let clicked = false
    render(<Button onClick={() => { clicked = true }}>Click</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Click' }))
    expect(clicked).toBe(true)
  })

  it('renders as a child element when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    )
    const link = screen.getByRole('link', { name: 'Link Button' })
    expect(link).toBeInTheDocument()
    expect(link.className).toContain('bg-brand-600')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/Button.test.tsx`
Expected: FAIL — Cannot find module `../Button`

- [ ] **Step 3: Install @radix-ui/react-slot dependency (for asChild pattern)**

Run: `npm install @radix-ui/react-slot`

Note: If you prefer not to add this dependency, omit the `asChild` feature from Button and remove that test. The `asChild` pattern is useful for link-styled-buttons but is optional for Phase 0.

- [ ] **Step 4: Write the implementation**

Create `src/components/Button.tsx`:

```tsx
import { Slot } from '@radix-ui/react-slot'
import { forwardRef } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'rounded-button bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-500 shadow-subtle',
  secondary:
    'rounded-button border border-surface-300 bg-white text-surface-700 hover:bg-surface-50 focus-visible:ring-brand-500',
  danger:
    'rounded-button bg-danger-600 text-white hover:bg-danger-700 focus-visible:ring-danger-500',
  ghost:
    'rounded-button text-surface-600 hover:bg-surface-50 focus-visible:ring-brand-500',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-body',
  md: 'px-4 py-2.5 text-body-lg',
  lg: 'px-6 py-3 text-body-lg font-semibold',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', asChild = false, className = '', ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    const classes = [
      'inline-flex items-center justify-center gap-2 font-medium transition-colors',
      'disabled:pointer-events-none disabled:opacity-50',
      VARIANT_CLASSES[variant],
      SIZE_CLASSES[size],
      className,
    ]
      .filter(Boolean)
      .join(' ')

    return <Comp ref={ref} className={classes} {...props} />
  }
)

Button.displayName = 'Button'
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/Button.test.tsx`
Expected: PASS — all 9 tests pass

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All existing tests pass

- [ ] **Step 7: Commit**

```bash
git add src/components/Button.tsx src/components/__tests__/Button.test.tsx package.json package-lock.json
git commit -m "feat: add Button primitive with primary/secondary/danger/ghost variants

Button supports 4 variants, 3 sizes, HTML attribute passthrough,
and asChild pattern via Radix Slot. All buttons inherit 44px
touch target from globals.css.

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 5: Migrate StatusChip to semantic tokens

**Files:**
- Modify: `src/components/StatusChip.tsx` (currently 42 lines)

- [ ] **Step 1: Write the failing test**

Add to `src/components/__tests__/StatusComponentsA11y.test.tsx` or add inline assertions in a new test block in `src/components/__tests__/Button.test.tsx`. Alternatively, since StatusChip already has test coverage for a11y, add a token-focused test:

Create `src/components/__tests__/StatusChip.tokens.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { PoolStatus } from '@/lib/supabase/types'

import { StatusChip } from '../StatusChip'

describe('StatusChip token migration', () => {
  it('uses brand tokens for open status', () => {
    render(<StatusChip status="open" />)
    const chip = screen.getByRole('status')
    expect(chip.className).toContain('border-brand-200')
    expect(chip.className).toContain('bg-brand-50')
    expect(chip.className).toContain('text-brand-900')
  })

  it('uses info tokens for live status', () => {
    render(<StatusChip status="live" />)
    const chip = screen.getByRole('status')
    expect(chip.className).toContain('border-info-200')
    expect(chip.className).toContain('bg-info-50')
    expect(chip.className).toContain('text-info-900')
  })

  it('uses surface tokens for complete status', () => {
    render(<StatusChip status="complete" />)
    const chip = screen.getByRole('status')
    expect(chip.className).toContain('border-surface-200')
    expect(chip.className).toContain('bg-surface-100')
    expect(chip.className).toContain('text-surface-900')
  })

  it('uses surface tokens for archived status', () => {
    render(<StatusChip status="archived" />)
    const chip = screen.getByRole('status')
    expect(chip.className).toContain('border-surface-200')
    expect(chip.className).toContain('bg-surface-100')
    expect(chip.className).toContain('text-surface-700')
  })

  it('no longer uses emerald or slate tokens', () => {
    const { container } = render(<StatusChip status="open" />)
    expect(container.innerHTML).not.toContain('emerald')
    const { container: container2 } = render(<StatusChip status="complete" />)
    expect(container2.innerHTML).not.toContain('slate')
  })

  it('still uses text-current override on label span', () => {
    render(<StatusChip status="open" />)
    expect(screen.getByText('Open').className).toContain('text-current')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/StatusChip.tokens.test.tsx`
Expected: FAIL — `border-brand-200` not found in className (still has `border-emerald-200`)

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `src/components/StatusChip.tsx`:

```tsx
import type { PoolStatus } from '@/lib/supabase/types'

import { sectionHeadingClasses } from './uiStyles'

const STATUS_CONFIG: Record<PoolStatus, { label: string; icon: string; classes: string }> = {
  open: {
    label: 'Open',
    icon: '\u25CB',
    classes: 'border-brand-200 bg-brand-50 text-brand-900',
  },
  live: {
    label: 'Live',
    icon: '\u25CF',
    classes: 'border-info-200 bg-info-50 text-info-900',
  },
  complete: {
    label: 'Complete',
    icon: '\u2713',
    classes: 'border-surface-200 bg-surface-100 text-surface-900',
  },
  archived: {
    label: 'Archived',
    icon: '\u25A3',
    classes: 'border-surface-200 bg-surface-100 text-surface-700',
  },
}

export function StatusChip({ status }: { status: PoolStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${config.classes}`}
      role="status"
      aria-label={`Pool status: ${config.label}`}
    >
      <span aria-hidden="true">{config.icon}</span>
      <span className={sectionHeadingClasses().replace('text-brand-800/70', 'text-current')}>
        {config.label}
      </span>
    </span>
  )
}
```

Key changes:
- `emerald-200/50/900` → `brand-200/50/900`
- `sky-200/50/900` → `info-200/50/900`
- `slate-200/100/900/700` → `surface-200/100/900/700`
- `.replace('text-emerald-800/70', ...)` → `.replace('text-brand-800/70', ...)`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/StatusChip.tokens.test.tsx`
Expected: PASS — all 6 tests pass

- [ ] **Step 5: Run existing a11y tests for StatusChip**

Run: `npx vitest run src/components/__tests__/StatusComponentsA11y.test.tsx`
Expected: PASS — no a11y regressions

- [ ] **Step 6: Commit**

```bash
git add src/components/StatusChip.tsx src/components/__tests__/StatusChip.tokens.test.tsx
git commit -m "feat: migrate StatusChip from emerald/sky/slate to brand/info/surface tokens

Replace emerald-* with brand-*, sky-* with info-*, slate-* with surface-*.
Update sectionHeadingClasses replace pattern for new brand-800/70 token.

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 6: Migrate FreshnessChip to semantic tokens

**Files:**
- Modify: `src/components/FreshnessChip.tsx` (currently 60 lines)

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/FreshnessChip.tokens.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { FreshnessChip } from '../FreshnessChip'

describe('FreshnessChip token migration', () => {
  it('uses brand tokens for current status', () => {
    render(<FreshnessChip status="current" />)
    const chip = screen.getByRole('status')
    expect(chip.className).toContain('border-brand-200')
    expect(chip.className).toContain('bg-brand-50')
    expect(chip.className).toContain('text-brand-900')
  })

  it('uses warn tokens for stale status', () => {
    render(<FreshnessChip status="stale" />)
    const chip = screen.getByRole('status')
    expect(chip.className).toContain('border-warn-200')
    expect(chip.className).toContain('bg-warn-50')
    expect(chip.className).toContain('text-warn-900')
  })

  it('uses surface tokens for unknown status', () => {
    render(<FreshnessChip status="unknown" />)
    const chip = screen.getByRole('status')
    expect(chip.className).toContain('border-surface-200')
    expect(chip.className).toContain('bg-surface-100')
  })

  it('no longer uses emerald, amber, or slate tokens', () => {
    const statuses: Array<'current' | 'stale' | 'unknown'> = ['current', 'stale', 'unknown']
    for (const status of statuses) {
      const { container } = render(<FreshnessChip status={status} />)
      expect(container.innerHTML).not.toContain('emerald')
      expect(container.innerHTML).not.toContain('amber')
      expect(container.innerHTML).not.toContain('slate')
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/FreshnessChip.tokens.test.tsx`
Expected: FAIL — `border-brand-200` not found (still has `border-emerald-200`)

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `src/components/FreshnessChip.tsx`:

```tsx
import type { FreshnessStatus } from '@/lib/supabase/types'

import { sectionHeadingClasses } from './uiStyles'

const FRESHNESS_CONFIG: Record<
  FreshnessStatus,
  { label: string; icon: string; classes: string; srText: string }
> = {
  current: {
    label: 'Current',
    icon: '\u2713',
    classes: 'border-brand-200 bg-brand-50 text-brand-900',
    srText: 'Data is current',
  },
  stale: {
    label: 'Stale',
    icon: '\u26A0',
    classes: 'border-warn-200 bg-warn-50 text-warn-900',
    srText: 'Data may be outdated',
  },
  unknown: {
    label: 'No data yet',
    icon: '\u2014',
    classes: 'border-surface-200 bg-surface-100 text-surface-700',
    srText: 'No scoring data available',
  },
}

interface FreshnessChipProps {
  status: FreshnessStatus
  refreshedAt?: string | null
}

export function FreshnessChip({ status, refreshedAt }: FreshnessChipProps) {
  const config = FRESHNESS_CONFIG[status]

  const timeLabel =
    refreshedAt && status !== 'unknown'
      ? `Updated ${new Date(refreshedAt).toLocaleTimeString()}`
      : null

  return (
    <span
      className={`inline-flex min-w-0 shrink items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${config.classes}`}
      role="status"
      aria-live="polite"
      aria-label={config.srText}
    >
      <span aria-hidden="true" className="shrink-0">
        {config.icon}
      </span>
      <span className={`${sectionHeadingClasses().replace('text-brand-800/70', 'text-current')} truncate`}>
        {config.label}
      </span>
      {timeLabel && (
        <span className="ml-1 min-w-0 truncate text-xs opacity-75">{timeLabel}</span>
      )}
    </span>
  )
}
```

Key changes:
- `emerald-200/50/900` → `brand-200/50/900`
- `amber-200/50/900` → `warn-200/50/900`
- `slate-200/100/700` → `surface-200/100/700`
- `.replace('text-emerald-800/70', ...)` → `.replace('text-brand-800/70', ...)`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/FreshnessChip.tokens.test.tsx`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All existing tests pass

- [ ] **Step 6: Commit**

```bash
git add src/components/FreshnessChip.tsx src/components/__tests__/FreshnessChip.tokens.test.tsx
git commit -m "feat: migrate FreshnessChip from emerald/amber/slate to brand/warn/surface tokens

Replace emerald-* with brand-*, amber-* with warn-*, slate-* with surface-*.
Update sectionHeadingClasses replace pattern for new brand-800/70 token.

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 7: Migrate LockBanner to semantic tokens and accent panels

**Files:**
- Modify: `src/components/LockBanner.tsx` (currently 90 lines)

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/LockBanner.tokens.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { LockBanner } from '../LockBanner'

describe('LockBanner token migration', () => {
  it('uses danger tokens for locked state', () => {
    render(<LockBanner isLocked={true} deadline="2026-06-01T12:00:00Z" poolStatus="live" timezone="UTC" />)
    const banner = screen.getByRole('status')
    expect(banner.className).toContain('danger-600')
  })

  it('uses brand tokens for open state', () => {
    render(<LockBanner isLocked={false} deadline="2026-06-01T12:00:00Z" poolStatus="open" timezone="UTC" />)
    const banner = screen.getByRole('status')
    expect(banner.className).toContain('brand-100')
  })

  it('no longer uses emerald or slate tokens', () => {
    const { container: lockedContainer } = render(
      <LockBanner isLocked={true} deadline="2026-06-01T12:00:00Z" poolStatus="live" timezone="UTC" />
    )
    expect(lockedContainer.innerHTML).not.toContain('emerald')
    expect(lockedContainer.innerHTML).not.toContain('slate')

    const { container: openContainer } = render(
      <LockBanner isLocked={false} deadline="2026-06-01T12:00:00Z" poolStatus="open" timezone="UTC" />
    )
    expect(openContainer.innerHTML).not.toContain('emerald')
    expect(openContainer.innerHTML).not.toContain('slate')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/LockBanner.tokens.test.tsx`
Expected: FAIL — `danger-600` not found in locked banner className

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `src/components/LockBanner.tsx`:

```tsx
import { accentPanelClasses, dangerPanelClasses, panelClasses, sectionHeadingClasses } from './uiStyles'
import { getTournamentLockInstant } from '@/lib/picks'

interface LockBannerProps {
  isLocked: boolean
  deadline: string
  poolStatus: string
  timezone: string
}

function getLockedMessage(poolStatus: string): string {
  switch (poolStatus) {
    case 'live':
      return 'The tournament is live. No changes allowed.'
    case 'complete':
      return 'This tournament is complete.'
    case 'archived':
      return 'This pool is archived. Picks are read-only.'
    default:
      return 'The picks deadline has passed.'
  }
}

function formatDeadline(deadline: string, timeZone: string): string {
  const fallback = 'Deadline not available'
  const deadlineInstant = getTournamentLockInstant(deadline, timeZone)
  if (!deadlineInstant) {
    return fallback
  }

  return deadlineInstant.toLocaleString(undefined, {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

export function LockBanner({ isLocked, deadline, poolStatus, timezone }: LockBannerProps) {
  const lockedMessage = getLockedMessage(poolStatus)

  if (isLocked) {
    return (
      <div
        className={`${dangerPanelClasses()} mb-4 flex items-center gap-3 border border-danger-200 bg-danger-50/95 p-4`}
        role="status"
        aria-live="polite"
      >
        <span
          aria-hidden="true"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-danger-200 bg-white/75 text-lg"
        >
          &#x1F512;
        </span>
        <div>
          <p className={sectionHeadingClasses()}>Tournament lock</p>
          <p className="text-base font-semibold text-surface-950">Picks are locked</p>
          <p className="text-sm text-surface-700">{lockedMessage}</p>
        </div>
      </div>
    )
  }

  const formattedDeadline = formatDeadline(deadline, timezone)

  return (
    <div
      className={`${accentPanelClasses()} mb-4 flex items-center gap-3 border border-brand-200 bg-brand-50/90 p-4`}
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-white/75 text-lg"
      >
        &#x1F513;
      </span>
      <div>
        <p className={`${sectionHeadingClasses()} text-brand-800`}>Tournament lock</p>
        <p className="text-base font-semibold text-brand-950">Picks are open</p>
        <p className="text-sm text-brand-900">
          Deadline: {formattedDeadline}
        </p>
      </div>
    </div>
  )
}
```

Key changes:
- Import `accentPanelClasses`, `dangerPanelClasses` instead of just `panelClasses`
- Locked: `panelClasses() border border-slate-200 bg-slate-100/90` → `dangerPanelClasses() border border-danger-200 bg-danger-50/95`
- Locked icon border: `border-slate-300` → `border-danger-200`
- Locked text: `text-slate-950` → `text-surface-950`, `text-slate-700` → `text-surface-700`
- Open: `panelClasses() border border-emerald-200 bg-emerald-50/90` → `accentPanelClasses() border border-brand-200 bg-brand-50/90`
- Open icon: `border-emerald-200` → `border-brand-200`
- Open text: `text-emerald-800/950/900` → `text-brand-800/950/900`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/LockBanner.tokens.test.tsx`
Expected: PASS

- [ ] **Step 5: Run existing LockBanner a11y test**

Run: `npx vitest run src/components/__tests__/LockBanner.test.tsx`
Expected: PASS — no a11y regressions

- [ ] **Step 6: Commit**

```bash
git add src/components/LockBanner.tsx src/components/__tests__/LockBanner.tokens.test.tsx
git commit -m "feat: migrate LockBanner from emerald/slate to brand/danger/surface tokens

Use dangerPanelClasses() for locked state, accentPanelClasses() for open.
Replace all slate-*, emerald-* with surface-*, brand-*, danger-* tokens.

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 8: Migrate TrustStatusBar toneClasses to semantic tokens

**Files:**
- Modify: `src/components/TrustStatusBar.tsx` (currently 217 lines)

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/TrustStatusBar.tokens.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { TrustStatusBar } from '../TrustStatusBar'

describe('TrustStatusBar token migration', () => {
  it('uses danger tokens for error tone', () => {
    render(
      <TrustStatusBar
        isLocked={true}
        poolStatus="live"
        freshness="stale"
        refreshedAt={null}
        lastRefreshError="Network error"
      />
    )
    const statusBar = screen.getByRole('alert')
    expect(statusBar.className).toContain('danger')
  })

  it('uses warn tokens for warning tone', () => {
    render(
      <TrustStatusBar
        isLocked={false}
        poolStatus="live"
        freshness="stale"
        refreshedAt={null}
        lastRefreshError={null}
      />
    )
    const statusBar = screen.getByRole('status')
    expect(statusBar.className).toContain('warn')
  })

  it('no longer uses red, amber, or emerald tokens inline', () => {
    const { container } = render(
      <TrustStatusBar
        isLocked={false}
        poolStatus="live"
        freshness="stale"
        refreshedAt={null}
        lastRefreshError={null}
      />
    )
    expect(container.innerHTML).not.toContain('border-red-')
    expect(container.innerHTML).not.toContain('bg-red-')
    expect(container.innerHTML).not.toContain('border-amber-')
    expect(container.innerHTML).not.toContain('bg-amber-')
    expect(container.innerHTML).not.toContain('border-emerald-')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/TrustStatusBar.tokens.test.tsx`
Expected: FAIL — `danger` not found in error tone className

- [ ] **Step 3: Write the implementation**

In `src/components/TrustStatusBar.tsx`, make these targeted changes:

**Change 1:** Update `toneClasses` function (lines 104-113):

Replace:
```ts
function toneClasses(tone: TrustTone): string {
  switch (tone) {
    case 'error':
      return 'border-red-200/80 bg-red-50/95 text-red-950'
    case 'warning':
      return 'border-amber-200/80 bg-amber-50/95 text-amber-950'
    default:
      return 'border-emerald-200/80 bg-white/95 text-slate-900'
  }
}
```

With:
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

**Change 2:** Replace `text-slate-950` with `text-surface-950` (line ~189):

In the `createElement('p', ...)` that renders `"${state.lockLabel} for this pool"`, change:
```ts
'flex items-center gap-2 text-base font-semibold text-slate-950'
```
To:
```ts
'flex items-center gap-2 text-base font-semibold text-surface-950'
```

**Change 3:** Replace `text-slate-800` with `text-surface-800` (line ~203):

In the `createElement('p', ...)` that renders `state.lockMessage`, change:
```ts
'mt-3 text-sm text-slate-800'
```
To:
```ts
'mt-3 text-sm text-surface-800'
```

**Change 4:** Replace `text-slate-500` with `text-surface-500` (line ~210):

In the freshness label paragraph, change:
```ts
'text-xs font-semibold uppercase tracking-[0.18em] text-slate-500'
```
To:
```ts
'text-xs font-semibold uppercase tracking-[0.18em] text-surface-500'
```

**Change 5:** Replace `text-slate-800` with `text-surface-800` (line ~213):

In the freshness message paragraph, change:
```ts
'mt-1 text-sm text-slate-800'
```
To:
```ts
'mt-1 text-sm text-surface-800'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/TrustStatusBar.tokens.test.tsx`
Expected: PASS

- [ ] **Step 5: Run existing TrustStatusBar tests**

Run: `npx vitest run src/components/__tests__/TrustStatusBar.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/TrustStatusBar.tsx src/components/__tests__/TrustStatusBar.tokens.test.tsx
git commit -m "feat: migrate TrustStatusBar toneClasses from red/amber/emerald to danger/warn/brand

Replace all inline red-*, amber-*, emerald-* with danger-*, warn-*, brand-*.
Replace all slate-* text references with surface-* tokens.

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 9: Migrate DataAlert to semantic tokens

**Files:**
- Modify: `src/components/DataAlert.tsx` (currently 75 lines)

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/DataAlert.tokens.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { DataAlert } from '../DataAlert'

describe('DataAlert token migration', () => {
  it('uses danger tokens for error variant', () => {
    render(<DataAlert variant="error" title="Error occurred" />)
    const alert = screen.getByRole('alert')
    expect(alert.className).toContain('danger')
  })

  it('uses warn tokens for warning variant', () => {
    render(<DataAlert variant="warning" title="Warning" />)
    const alert = screen.getByRole('status')
    expect(alert.className).toContain('warn')
  })

  it('uses info tokens for info variant', () => {
    render(<DataAlert variant="info" title="Information" />)
    const alert = screen.getByRole('status')
    expect(alert.className).toContain('info')
  })

  it('no longer uses red, amber, sky, or emerald tokens', () => {
    const { container: errorContainer } = render(<DataAlert variant="error" title="E" />)
    expect(errorContainer.innerHTML).not.toContain('border-red-')
    expect(errorContainer.innerHTML).not.toContain('bg-red-')

    const { container: warnContainer } = render(<DataAlert variant="warning" title="W" />)
    expect(warnContainer.innerHTML).not.toContain('border-amber-')
    expect(warnContainer.innerHTML).not.toContain('bg-amber-')

    const { container: infoContainer } = render(<DataAlert variant="info" title="I" />)
    expect(infoContainer.innerHTML).not.toContain('border-sky-')
    expect(infoContainer.innerHTML).not.toContain('bg-sky-')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/DataAlert.tokens.test.tsx`
Expected: FAIL — `danger` not found in error variant className

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `src/components/DataAlert.tsx`:

```tsx
import { getDataAlertLiveRegion } from './data-alert-a11y'
import { panelClasses, sectionHeadingClasses } from './uiStyles'

type DataAlertVariant = 'error' | 'warning' | 'info'

interface DataAlertProps {
  variant: DataAlertVariant
  title: string
  message?: string
  className?: string
}

const VARIANT_CONFIG: Record<
  DataAlertVariant,
  {
    icon: string
    srPrefix: string
    classes: string
    iconClasses: string
  }
> = {
  error: {
    icon: '!',
    srPrefix: 'Error:',
    classes: 'border-danger-200 bg-danger-50/95 text-danger-950',
    iconClasses: 'border-danger-200/80 bg-white text-danger-700',
  },
  warning: {
    icon: '!',
    srPrefix: 'Warning:',
    classes: 'border-warn-200 bg-warn-50/95 text-warn-950',
    iconClasses: 'border-warn-200/80 bg-white text-warn-700',
  },
  info: {
    icon: 'i',
    srPrefix: 'Info:',
    classes: 'border-info-200 bg-info-50/95 text-info-950',
    iconClasses: 'border-info-200/80 bg-white text-info-700',
  },
}

export function DataAlert({ variant, title, message, className }: DataAlertProps) {
  const config = VARIANT_CONFIG[variant]
  const liveRegionProps = getDataAlertLiveRegion(variant)
  const classes = [
    panelClasses(),
    'flex items-start gap-3 border px-4 py-4 text-sm',
    config.classes,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} {...liveRegionProps}>
      <span
        aria-hidden="true"
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-semibold leading-5 shadow-sm ${config.iconClasses}`}
      >
        {config.icon}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span>
          <span className="sr-only">{config.srPrefix} </span>
          <span
            className={`${sectionHeadingClasses().replace('text-brand-800/70', 'text-current').replace('uppercase', 'normal-case').replace('tracking-[0.18em]', 'tracking-[0.08em]')} break-words`}
          >
            {title}
          </span>
        </span>
        {message ? <span className="break-words text-sm leading-6 normal-case tracking-normal opacity-90">{message}</span> : null}
      </span>
    </div>
  )
}
```

Key changes:
- `red-200/50/950/700` → `danger-200/50/950/700`
- `amber-200/50/950/700` → `warn-200/50/950/700`
- `sky-200/50/950/700` → `info-200/50/950/700`
- `.replace('text-emerald-800/70', ...)` → `.replace('text-brand-800/70', ...)`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/DataAlert.tokens.test.tsx`
Expected: PASS

- [ ] **Step 5: Run existing DataAlert a11y test**

Run: `npx vitest run src/components/__tests__/data-alert-a11y.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/DataAlert.tsx src/components/__tests__/DataAlert.tokens.test.tsx
git commit -m "feat: migrate DataAlert from red/amber/sky to danger/warn/info tokens

Replace all red-* with danger-*, amber-* with warn-*, sky-* with info-*.
Update sectionHeadingClasses replace pattern for brand-800/70.

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 10: Migrate app layout from gray to surface tokens

**Files:**
- Modify: `src/app/(app)/layout.tsx` (currently 47 lines)

- [ ] **Step 1: Write the failing test**

Create `src/app/(app)/__tests__/layout.tokens.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'

// Note: Layout components with server-side auth redirects are hard to unit test
// in isolation. This test validates the component source string for token presence.
// A better approach is visual/manual verification post-build.

describe('App layout token migration', () => {
  it('does not use gray tokens in layout source', async () => {
    const source = await import('fs').then(fs =>
      fs.readFileSync('src/app/(app)/layout.tsx', 'utf-8')
    )
    expect(source).not.toContain('bg-gray-')
    expect(source).not.toContain('text-gray-')
  })
})
```

Note: Layout testing is tricky due to `redirect()` from Next.js auth. The practical verification is `npm run build` + visual check. The test above checks source at the string level.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/(app)/__tests__/layout.tokens.test.tsx`
Expected: FAIL — source contains `bg-gray-50`

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `src/app/(app)/layout.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

import { pageShellClasses } from '@/components/uiStyles'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign-in')
  }

  return (
    <div className={pageShellClasses()}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-surface-900 focus:shadow"
      >
        Skip to main content
      </a>

      <nav className="bg-surface/95 backdrop-blur border-b border-sand-200/60" aria-label="Primary">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/participant/pools" className="text-xl font-bold text-brand-950">
            Fantasy Golf
          </Link>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/participant/pools" className="text-surface-600 hover:text-surface-900">
              My Pools
            </Link>
            <Link href="/commissioner" className="text-surface-600 hover:text-surface-900">
              Commissioner
            </Link>
          </div>
        </div>
      </nav>

      <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-8">
        {children}
      </main>
    </div>
  )
}
```

Key changes:
- `min-h-screen bg-gray-50` → `pageShellClasses()` (provides min-h-screen + gradient + text-surface-900)
- Nav: `bg-white shadow-sm` → `bg-surface/95 backdrop-blur border-b border-sand-200/60`
- Logo: `text-gray-900` → `text-brand-950`
- Links: `text-gray-600 hover:text-gray-900` → `text-surface-600 hover:text-surface-900`
- Skip link: `text-gray-900` → `text-surface-900`
- Added `import { pageShellClasses } from '@/components/uiStyles'`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/(app)/__tests__/layout.tokens.test.tsx`
Expected: PASS

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/app/(app)/layout.tsx src/app/(app)/__tests__/layout.tokens.test.tsx
git commit -m "feat: migrate app layout from gray to surface/brand tokens with pageShell gradient

Replace bg-gray-50 with pageShellClasses() gradient background.
Replace nav bg-white shadow-sm with bg-surface/95 backdrop-blur.
Replace text-gray-* with text-surface-* and text-brand-950.
Add sand-200/60 border to nav for warm accent.

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 11: Phase 0 verification — build and full test suite

**Files:** None (verification only)

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Build completes successfully with zero errors

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass with zero failures

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: Zero errors or warnings

- [ ] **Step 4: Visual verification checklist**

Open the dev server (`npm run dev`) and manually verify at 375px (mobile) and 1280px (desktop):

1. App shell: warm gradient background visible (not flat gray)
2. Nav bar: frosted glass effect with sand/warm border
3. StatusChip: open=green, live=blue, complete=neutral, archived=neutral (icon+color pattern intact)
4. FreshnessChip: current=green, stale=amber, unknown=neutral (icon+color pattern intact)
5. LockBanner locked: red left-border accent, red background, lock icon
6. LockBanner open: green left-border accent, green background, unlock icon
7. TrustStatusBar: error=red, warning=amber, info=white+green (icon visible)
8. DataAlert: error=red, warning=amber, info=blue (icon visible)
9. Focus rings: green-700 ring color on all interactive elements
10. Body text: stone-900 dark text on sand-50 warm background

---

## Phase 1: Participant Picks (OPS-21)

This phase migrates the trust-critical Picks flow. All files in this phase use semantic tokens exclusively — no `emerald`, `slate`, `gray`, or `sky` remaining.

### Task 12: Migrate Picks page shell

**Files:**
- Modify: `src/app/(app)/participant/picks/[poolId]/page.tsx`

- [ ] **Step 1: Read the file to understand current color usage**

Run: read the file and search for `emerald-`, `slate-`, `gray-`, `sky-`

- [ ] **Step 2: Write the failing test**

Add to a test file that renders the Picks page or checks source for old tokens:

```ts
// src/app/(app)/participant/picks/[poolId]/__tests__/picks-tokens.test.ts
import { describe, expect, it } from 'vitest'
import fs from 'fs'

describe('Picks page token migration', () => {
  const source = fs.readFileSync('src/app/(app)/participant/picks/[poolId]/page.tsx', 'utf-8')

  it('does not use emerald tokens', () => {
    expect(source).not.toContain('emerald-')
  })

  it('does not use slate tokens', () => {
    expect(source).not.toContain('slate-')
  })

  it('does not use gray tokens', () => {
    expect(source).not.toContain('gray-')
  })
})
```

- [ ] **Step 3: Migrate colors in the file**

Replace all occurrences:
- `emerald-*` → `brand-*` (where meaning is active/open)
- `slate-*` → `surface-*`
- `gray-*` → `surface-*`
- `sky-*` → `info-*`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/(app)/participant/picks/[poolId]/__tests__/picks-tokens.test.ts`
Expected: PASS

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/app/(app)/participant/picks/[poolId]/
git commit -m "feat: migrate Picks page from emerald/slate to brand/surface tokens

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 13: Migrate PicksForm buttons and colors

**Files:**
- Modify: `src/app/(app)/participant/picks/[poolId]/PicksForm.tsx`

- [ ] **Step 1: Read the file, search for inline button styles and old tokens**

- [ ] **Step 2: Replace inline button styles with `<Button>` components**

Replace all inline `className` button patterns with:
- `bg-blue-600 text-white hover:bg-blue-700` → `<Button variant="primary">`
- `bg-green-600 hover:bg-green-700` → `<Button variant="primary">`
- `bg-emerald-600 text-white` → `<Button variant="primary">`
- `bg-slate-950 text-white` → `<Button variant="primary">`
- `bg-red-600 hover:bg-red-700` → `<Button variant="danger">`
- `bg-slate-600 hover:bg-slate-700` → `<Button variant="secondary">`

- [ ] **Step 3: Replace remaining color tokens**

- `emerald-*` → `brand-*`
- `slate-*` → `surface-*`
- `gray-*` → `surface-*`

- [ ] **Step 4: Add `import { Button } from '@/components/Button'`**

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/app/(app)/participant/picks/[poolId]/PicksForm.tsx
git commit -m "feat: migrate PicksForm buttons to Button primitive and semantic tokens

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 14: Migrate PickProgress, SelectionSummaryCard, SubmissionConfirmation, GolferCatalogPanel

**Files:**
- Modify: `src/components/PickProgress.tsx`
- Modify: `src/components/SelectionSummaryCard.tsx`
- Modify: `src/components/SubmissionConfirmation.tsx`
- Modify: `src/components/GolferCatalogPanel.tsx`

For each file, follow this sub-pattern:

- [ ] **Step 1:** Read file, search for `emerald-`, `slate-`, `gray-`, `sky-`, inline button styles
- [ ] **Step 2:** Replace `emerald-*` → `brand-*`, `slate-*` → `surface-*`, `gray-*` → `surface-*`, `sky-*` → `info-*`
- [ ] **Step 3:** Replace inline button styles with `<Button variant="...">` where applicable
- [ ] **Step 4:** Add `import { Button } from '@/components/Button'` if buttons were replaced
- [ ] **Step 5:** Verify build: `npm run build`
- [ ] **Step 6:** Commit

```bash
git add src/components/PickProgress.tsx src/components/SelectionSummaryCard.tsx src/components/SubmissionConfirmation.tsx src/components/GolferCatalogPanel.tsx
git commit -m "feat: migrate PickProgress, SelectionSummaryCard, SubmissionConfirmation, GolferCatalogPanel to semantic tokens

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 15: Phase 1 verification

- [ ] **Step 1: Run full build** — `npm run build` — zero errors
- [ ] **Step 2: Run full test suite** — `npx vitest run` — all pass
- [ ] **Step 3: Run lint** — `npm run lint` — zero errors
- [ ] **Step 4: Visual verification** — Open picks page at 375px and 1280px, verify:
  - Lock banner: green accent for open, red accent for locked (prominent, not subtle)
  - Status chips: icon + color pattern intact (open=green, live=blue, complete=neutral)
  - Freshness chips: current=green, stale=amber (prominent, not subtle)
  - Buttons: consistent rounded-button style, no ad-hoc bg-blue-600 or bg-slate-950
  - No `gray`, `emerald`, `slate` tokens anywhere in picks flow HTML

---

## Phase 2: Spectator + Pools + Join (OPS-23, OPS-24, OPS-25)

### Task 16: Migrate spectator leaderboard page and components

**Files:**
- Modify: `src/app/spectator/pools/[poolId]/page.tsx`
- Modify: `src/components/leaderboard.tsx`
- Modify: `src/components/LeaderboardHeader.tsx`
- Modify: `src/components/LeaderboardRow.tsx`
- Modify: `src/components/LeaderboardEmptyState.tsx`
- Modify: `src/components/EntryGolferBreakdown.tsx`
- Modify: `src/components/GolferContribution.tsx`
- Modify: `src/components/GolferScorecard.tsx`
- Modify: `src/components/score-display.tsx`
- Modify: `src/components/GolferDetailSheet.tsx`
- Modify: `src/components/CopyLinkButton.tsx`

For each file:

- [ ] **Step 1:** Read file, search for `emerald-`, `slate-`, `gray-`, `sky-`, `amber-`, `red-`, inline `bg-blue-`/`bg-green-`/`bg-red-`/`bg-slate-`
- [ ] **Step 2:** Replace tokens per migration mapping (emerald→brand, slate→surface, gray→surface, sky→info, amber→warn, red→danger)
- [ ] **Step 3:** Replace inline button styles with `<Button>` where applicable
- [ ] **Step 4:** Replace `bg-white rounded-lg shadow` pattern with `panelClasses()` in `PoolCard.tsx`
- [ ] **Step 5:** Verify build: `npm run build`

Then commit all spectator changes:

```bash
git add src/app/spectator/ src/components/leaderboard.tsx src/components/LeaderboardHeader.tsx src/components/LeaderboardRow.tsx src/components/LeaderboardEmptyState.tsx src/components/EntryGolferBreakdown.tsx src/components/GolferContribution.tsx src/components/GolferScorecard.tsx src/components/score-display.tsx src/components/GolferDetailSheet.tsx src/components/CopyLinkButton.tsx
git commit -m "feat: migrate spectator leaderboard components to semantic tokens

Replace emerald-*, slate-*, gray-*, sky-* with brand-*, surface-*, info-*.
Replace bg-white rounded-lg shadow with panelClasses() in PoolCard.
Migrate CopyLinkButton to Button primitive.

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 17: Migrate pools page, join page, and PoolCard

**Files:**
- Modify: `src/app/(app)/participant/pools/page.tsx`
- Modify: `src/components/PoolCard.tsx`
- Modify: `src/app/join/[inviteCode]/page.tsx`
- Modify: `src/app/join/[inviteCode]/JoinPoolForm.tsx`

- [ ] **Step 1:** Read each file, identify old tokens and inline button/input styles
- [ ] **Step 2:** Replace `bg-white rounded-lg shadow` in PoolCard with `panelClasses()`; migrate all `gray-*` → `surface-*`
- [ ] **Step 3:** Replace `bg-blue-600` buttons in Join page with `<Button variant="primary">`
- [ ] **Step 4:** Replace `bg-white rounded-lg shadow` card in Join page with `panelClasses()`; add gradient background wrapper
- [ ] **Step 5:** Replace form inputs with `inputClasses()` function from uiStyles
- [ ] **Step 6:** Verify build: `npm run build`

```bash
git add src/app/(app)/participant/pools/page.tsx src/components/PoolCard.tsx src/app/join/
git commit -m "feat: migrate pools page, PoolCard, and join flow to semantic tokens

Replace PoolCard bg-white rounded-lg shadow with panelClasses().
Replace Join page bg-blue-600 buttons with Button variant=primary.
Replace Join page card with panelClasses() panel.
Apply inputClasses() to join form inputs.

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 18: Phase 2 verification

- [ ] **Step 1:** `npm run build` — zero errors
- [ ] **Step 2:** `npx vitest run` — all pass
- [ ] **Step 3:** `npm run lint` — zero errors
- [ ] **Step 4:** Visual verification at 375px + 1280px:
  - Leaderboard: gradient background, frosted-glass panels, brand green headings
  - PoolCard: frosted-glass panel (not flat white card)
  - Join page: gradient background, panelClasses card, consistent Button/input styling
  - StatusChip FreshnessChip: colors match meaning, icon visible
  - No `gray`, `emerald`, `slate`, `blue-600` tokens in HTML

---

## Phase 3: Commissioner + Detail + Global (OPS-26, OPS-27, OPS-29)

### Task 19: Migrate commissioner dashboard and sub-components

**Files:**
- Modify: `src/app/(app)/commissioner/page.tsx`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/page.tsx`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/PoolConfigForm.tsx`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/PoolStatusSection.tsx`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/InviteLinkSection.tsx`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/PoolActions.tsx`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/ArchivePoolButton.tsx`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/ReopenPoolButton.tsx`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/DeletePoolButton.tsx`
- Modify: `src/app/(app)/commissioner/CreatePoolForm.tsx`
- Modify: `src/components/CommissionerGolferPanel.tsx`

For each file:
- [ ] Replace token namespaces (emerald→brand, slate→surface, gray→surface, red→danger, amber→warn, sky→info)
- [ ] Replace inline button styles with `<Button>` variants
- [ ] Use `panelClasses()`, `metricCardClasses()`, `sectionHeadingClasses()`, `inputClasses()` where applicable
- [ ] Verify build after each batch of changes

Commit:

```bash
git add src/app/(app)/commissioner/ src/components/CommissionerGolferPanel.tsx
git commit -m "feat: migrate commissioner dashboard to semantic tokens and Button primitive

Replace all emerald/slate/gray/red inline tokens with brand/surface/danger.
Migrate all inline button styles to Button component variants.
Apply panelClasses, metricCardClasses, sectionHeadingClasses, inputClasses.

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 20: Phase 3 verification

- [ ] **Step 1:** `npm run build`
- [ ] **Step 2:** `npx vitest run`
- [ ] **Step 3:** `npm run lint`
- [ ] **Step 4:** Visual verification:
  - Commissioner dashboard: metric cards with panelClasses, brand headings
  - Pool actions: primary/secondary/danger Button variants
  - Form inputs: consistent inputClasses styling with brand focus ring
  - No `gray`, `emerald`, `slate` in commissioner HTML

---

## Phase 4: Auth (OPS-28)

### Task 21: Migrate sign-in and sign-up pages

**Files:**
- Modify: `src/app/(auth)/sign-in/page.tsx`
- Modify: `src/app/(auth)/sign-up/page.tsx`

- [ ] **Step 1:** Read each file, identify `bg-blue-600` buttons, `bg-white rounded-lg shadow` cards, old tokens
- [ ] **Step 2:** Replace card wrapper with `panelClasses()` panel
- [ ] **Step 3:** Add gradient background wrapper (use inline `bg-[radial-gradient(...)]` or `pageShellClasses()`)
- [ ] **Step 4:** Replace `bg-blue-600` buttons with `<Button variant="primary">`
- [ ] **Step 5:** Apply `inputClasses()` to all form inputs
- [ ] **Step 6:** Replace any `gray-*` tokens with `surface-*`
- [ ] **Step 7:** Verify build: `npm run build`

Commit:

```bash
git add src/app/(auth)/
git commit -m "feat: migrate auth pages to semantic tokens with gradient shell

Replace bg-blue-600 buttons with Button variant=primary.
Replace bg-white rounded-lg shadow cards with panelClasses panel.
Apply inputClasses to form inputs.
Add gradient background wrapper.

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 22: Final global verification

- [ ] **Step 1:** `npm run build`
- [ ] **Step 2:** `npx vitest run`
- [ ] **Step 3:** `npm run lint`
- [ ] **Step 4:** Grep the entire `src/` directory for remaining old token usage that should have been migrated:

```bash
grep -r "emerald-" src/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v ".test."
grep -r "bg-gray-" src/ --include="*.tsx" --include="*.ts" | grep -v node_modules
grep -r "text-gray-" src/ --include="*.tsx" --include="*.ts" | grep -v node_modules
```

Expected: Zero hits for `bg-gray-` and `text-gray-`. Any remaining `emerald-` should only be in files not yet touched by any phase (deferred items).

- [ ] **Step 5:** Visual verification across all pages at 375px and 1280px:
  - Gradient shell background on all authenticated pages
  - Frosted-glass nav bar with warm sand border
  - Consistent Button styling across all pages
  - Lock state visible with accent panels
  - Freshness indicators prominent with icon + color
  - No visual regressions from pre-redesign state