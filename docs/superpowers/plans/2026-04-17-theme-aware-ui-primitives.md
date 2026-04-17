# Theme-Aware UI Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build theme-aware Button and Card primitives, migrate StatusChip/LockBanner/TrustStatusBar from emerald/slate to green/stone tokens, and update uiStyles.ts — all on top of the merged OPS-20 design token foundation.

**Architecture:** Merge the OPS-20 feature branch first, then create two new UI primitive components (Button, Card) in a new `src/components/ui/` directory, then migrate color classes in three existing components (StatusChip, LockBanner, TrustStatusBar) and two utility functions (sectionHeadingClasses, scrollRegionFocusClasses) in uiStyles.ts. TDD-first approach for new components; class-migration verification for existing components.

**Tech Stack:** React 18, TypeScript 5, Tailwind CSS v3.4, Vitest, @testing-library/react, @testing-library/jest-dom, renderToStaticMarkup (react-dom/server)

**Design Spec:** `docs/superpowers/specs/2026-04-17-theme-aware-ui-primitives-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Merge | `feature/OPS-20-design-token-system` → `main` | Design token foundation (tailwind tokens, CSS vars, layout.tsx theme-color) |
| Create | `src/components/ui/Button.tsx` | Button primitive with variant/size props |
| Create | `src/components/ui/__tests__/Button.test.tsx` | Button unit tests |
| Create | `src/components/ui/Card.tsx` | Card primitive with accent prop |
| Create | `src/components/ui/__tests__/Card.test.tsx` | Card unit tests |
| Modify | `src/components/StatusChip.tsx` | Migrate STATUS_CONFIG classes from emerald/slate to green/stone |
| Modify | `src/components/LockBanner.tsx` | Migrate classes from emerald/slate to green/stone |
| Modify | `src/components/TrustStatusBar.tsx` | Migrate classes from emerald/slate to green/stone |
| Modify | `src/components/uiStyles.ts` | Update sectionHeadingClasses and scrollRegionFocusClasses |
| Modify | `src/components/__tests__/StatusComponentsA11y.test.tsx` | Verify StatusChip class assertions still pass |
| Verify | `src/components/__tests__/LockBanner.test.tsx` | Verify existing behavioral tests pass (content, not classes) |
| Verify | `src/components/__tests__/TrustStatusBar.test.tsx` | Verify existing behavioral tests pass (state logic, not classes) |

---

### Task 1: Merge OPS-20 Design Token System Branch

**Files:**
- Merge: `feature/OPS-20-design-token-system` into `main`

This task merges the completed OPS-20 design token system into main. The branch contains: semantic color tokens in `tailwind.config.js`, CSS custom properties in `globals.css`, updated `layout.tsx` theme-color, new test files for token validation, and `docs/design-tokens.md`.

- [ ] **Step 1: Merge the feature branch into main**

```bash
git checkout main
git pull origin main
git merge feature/OPS-20-design-token-system --no-edit
```

- [ ] **Step 2: Resolve any merge conflicts**

If conflicts arise, the OPS-20 branch changes should take precedence for `tailwind.config.js`, `globals.css`, and `layout.tsx` since those are the files it modifies. For any design spec docs that collided, keep both versions.

- [ ] **Step 3: Run full test suite to verify the merge**

Run: `npm run test`
Expected: All tests pass (including new `design-tokens.test.ts` and `globals-css.test.ts`)

- [ ] **Step 4: Run build to verify no TypeScript errors**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 5: Commit if merge created a commit**

```bash
git push origin main
```

---

### Task 2: Create Button Component (TDD)

**Files:**
- Create: `src/components/ui/__tests__/Button.test.tsx`
- Create: `src/components/ui/Button.tsx`

- [ ] **Step 1: Create the `ui` directory and write the failing test**

Create `src/components/ui/__tests__/Button.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'

import { Button } from '../Button'

describe('Button', () => {
  it('renders a button element', () => {
    const markup = renderToStaticMarkup(createElement(Button, null, 'Click me'))
    expect(markup).toContain('Click me')
    expect(markup).toMatch(/^<button/)
  })

  it('applies primary variant classes by default', () => {
    const markup = renderToStaticMarkup(createElement(Button, null, 'Go'))
    expect(markup).toContain('bg-green-700')
    expect(markup).toContain('text-white')
    expect(markup).toContain('focus-visible:ring-green-500')
  })

  it('applies secondary variant classes', () => {
    const markup = renderToStaticMarkup(createElement(Button, { variant: 'secondary' }, 'Cancel'))
    expect(markup).toContain('bg-white')
    expect(markup).toContain('text-stone-700')
    expect(markup).toContain('border-stone-300')
    expect(markup).toContain('focus-visible:ring-green-500')
  })

  it('applies danger variant classes', () => {
    const markup = renderToStaticMarkup(createElement(Button, { variant: 'danger' }, 'Delete'))
    expect(markup).toContain('bg-red-600')
    expect(markup).toContain('text-white')
    expect(markup).toContain('focus-visible:ring-red-500')
  })

  it('applies ghost variant classes', () => {
    const markup = renderToStaticMarkup(createElement(Button, { variant: 'ghost' }, 'Skip'))
    expect(markup).toContain('bg-transparent')
    expect(markup).toContain('text-stone-600')
    expect(markup).toContain('focus-visible:ring-green-500')
  })

  it('applies md size classes by default', () => {
    const markup = renderToStaticMarkup(createElement(Button, null, 'Medium'))
    expect(markup).toContain('px-4')
    expect(markup).toContain('py-2.5')
  })

  it('applies sm size classes', () => {
    const markup = renderToStaticMarkup(createElement(Button, { size: 'sm' }, 'Small'))
    expect(markup).toContain('px-3')
    expect(markup).toContain('py-1.5')
  })

  it('applies lg size classes', () => {
    const markup = renderToStaticMarkup(createElement(Button, { size: 'lg' }, 'Large'))
    expect(markup).toContain('px-6')
    expect(markup).toContain('py-3')
  })

  it('passes through HTML button attributes', () => {
    const markup = renderToStaticMarkup(
      createElement(Button, { type: 'submit', disabled: true, 'aria-label': 'Submit form' }, 'Submit'),
    )
    expect(markup).toContain('type="submit"')
    expect(markup).toContain('disabled')
    expect(markup).toContain('aria-label="Submit form"')
    expect(markup).toContain('disabled:opacity-50')
  })

  it('applies focus-visible ring classes', () => {
    const markup = renderToStaticMarkup(createElement(Button, null, 'Focus'))
    expect(markup).toContain('focus-visible:ring-2')
    expect(markup).toContain('focus-visible:ring-offset-2')
  })

  it('applies hover state classes for primary variant', () => {
    const markup = renderToStaticMarkup(createElement(Button, { variant: 'primary' }, 'Hover'))
    expect(markup).toContain('hover:bg-green-900')
  })

  it('applies hover state classes for secondary variant', () => {
    const markup = renderToStaticMarkup(createElement(Button, { variant: 'secondary' }, 'Hover'))
    expect(markup).toContain('hover:bg-stone-50')
  })

  it('applies rounded class for consistent shape', () => {
    const markup = renderToStaticMarkup(createElement(Button, null, 'Rounded'))
    expect(markup).toContain('rounded-lg')
  })

  it('merges additional className prop', () => {
    const markup = renderToStaticMarkup(
      createElement(Button, { className: 'mt-4' }, 'Extra'),
    )
    expect(markup).toContain('mt-4')
    expect(markup).toContain('bg-green-700')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/__tests__/Button.test.tsx`
Expected: FAIL — `Cannot find module '../Button'`

- [ ] **Step 3: Write the Button component implementation**

Create `src/components/ui/Button.tsx`:

```tsx
import { type ButtonHTMLAttributes, createElement } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-green-700 text-white hover:bg-green-900 focus-visible:ring-green-500',
  secondary: 'bg-white text-stone-700 border border-stone-300 hover:bg-stone-50 focus-visible:ring-green-500',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
  ghost: 'bg-transparent text-stone-600 hover:bg-stone-50 focus-visible:ring-green-500',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-base',
  lg: 'px-6 py-3 text-base font-semibold',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    'inline-flex items-center justify-center rounded-lg',
    variantClasses[variant],
    sizeClasses[size],
    'focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return createElement('button', { className: classes, ...rest }, children)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/__tests__/Button.test.tsx`
Expected: All 14 tests PASS

- [ ] **Step 5: Commit Button component and tests**

```bash
git add src/components/ui/Button.tsx src/components/ui/__tests__/Button.test.tsx
git commit -m "feat: add Button UI primitive with primary/secondary/danger/ghost variants"
```

---

### Task 3: Create Card Component (TDD)

**Files:**
- Create: `src/components/ui/__tests__/Card.test.tsx`
- Create: `src/components/ui/Card.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/__tests__/Card.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'

import { Card } from '../Card'

describe('Card', () => {
  it('renders children inside a div', () => {
    const markup = renderToStaticMarkup(createElement(Card, null, 'Hello world'))
    expect(markup).toContain('Hello world')
    expect(markup).toMatch(/^<div/)
  })

  it('applies panelClasses base styles by default', () => {
    const markup = renderToStaticMarkup(createElement(Card, null, 'Content'))
    expect(markup).toContain('rounded-3xl')
    expect(markup).toContain('border-white/60')
    expect(markup).toContain('bg-white/90')
    expect(markup).toContain('backdrop-blur')
  })

  it('applies accent left border when accent="left"', () => {
    const markup = renderToStaticMarkup(createElement(Card, { accent: 'left' }, 'Card content'))
    expect(markup).toContain('border-l-4')
    expect(markup).toContain('border-l-green-700')
  })

  it('does not apply accent classes when accent is undefined', () => {
    const markup = renderToStaticMarkup(createElement(Card, null, 'No accent'))
    expect(markup).not.toContain('border-l-4')
    expect(markup).not.toContain('border-l-green-700')
  })

  it('does not apply accent classes when accent="none"', () => {
    const markup = renderToStaticMarkup(createElement(Card, { accent: 'none' }, 'No accent'))
    expect(markup).not.toContain('border-l-4')
    expect(markup).not.toContain('border-l-green-700')
  })

  it('merges additional className prop', () => {
    const markup = renderToStaticMarkup(
      createElement(Card, { className: 'mt-4 p-6' }, 'Extra classes'),
    )
    expect(markup).toContain('mt-4')
    expect(markup).toContain('p-6')
    expect(markup).toContain('rounded-3xl')
  })

  it('passes through HTML div attributes', () => {
    const markup = renderToStaticMarkup(
      createElement(Card, { id: 'test-card', 'aria-label': 'Test card' }, 'Attrs'),
    )
    expect(markup).toContain('id="test-card"')
    expect(markup).toContain('aria-label="Test card"')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/__tests__/Card.test.tsx`
Expected: FAIL — `Cannot find module '../Card'`

- [ ] **Step 3: Write the Card component implementation**

Create `src/components/ui/Card.tsx`:

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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/__tests__/Card.test.tsx`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit Card component and tests**

```bash
git add src/components/ui/Card.tsx src/components/ui/__tests__/Card.test.tsx
git commit -m "feat: add Card UI primitive with accent left border prop"
```

---

### Task 4: Migrate StatusChip Classes

**Files:**
- Modify: `src/components/StatusChip.tsx`
- Verify: `src/components/__tests__/StatusComponentsA11y.test.tsx`

The current `StatusChip.tsx` uses emerald/slate classes. We change to green/stone. The `live` status keeps sky classes unchanged.

- [ ] **Step 1: Update STATUS_CONFIG in StatusChip.tsx**

In `src/components/StatusChip.tsx`, replace the `STATUS_CONFIG` object. Change these three entries:

Current `open` entry:
```ts
    classes: 'border-emerald-200 bg-emerald-50 text-emerald-900',
```
New `open` entry:
```ts
    classes: 'border-green-200 bg-green-50 text-green-900',
```

Current `complete` entry:
```ts
    classes: 'border-slate-200 bg-slate-100 text-slate-900',
```
New `complete` entry:
```ts
    classes: 'border-stone-200 bg-stone-100 text-stone-900',
```

Current `archived` entry:
```ts
    classes: 'border-slate-200 bg-slate-100 text-slate-700',
```
New `archived` entry:
```ts
    classes: 'border-stone-200 bg-stone-100 text-stone-700',
```

The `live` entry stays unchanged: `'border-sky-200 bg-sky-50 text-sky-900'`.

Also update the `sectionHeadingClasses()` call on the label span. Current:
```tsx
className={sectionHeadingClasses().replace('text-emerald-800/70', 'text-current')}
```
New (since we'll update sectionHeadingClasses in Task 7 to use `text-green-800/70`):
```tsx
className={sectionHeadingClasses().replace('text-green-800/70', 'text-current')}
```

- [ ] **Step 2: Run StatusChip accessibility tests**

Run: `npx vitest run src/components/__tests__/StatusComponentsA11y.test.tsx`
Expected: All tests PASS. The a11y tests check structural attributes (`role`, `aria-label`, `aria-live`) — not color classes — so they should continue passing.

- [ ] **Step 3: Commit StatusChip migration**

```bash
git add src/components/StatusChip.tsx
git commit -m "refactor: migrate StatusChip from emerald/slate to green/stone tokens"
```

---

### Task 5: Migrate LockBanner Classes

**Files:**
- Modify: `src/components/LockBanner.tsx`
- Verify: `src/components/__tests__/LockBanner.test.tsx`

The LockBanner has two visual states: locked (slate-based) and open (emerald-based). We migrate both to stone/green.

- [ ] **Step 1: Update the locked-state className**

In `src/components/LockBanner.tsx`, find the locked-state JSX block (the first return, inside the `if (isLocked)` block).

Current outer div className:
```tsx
className={`${panelClasses()} mb-4 flex items-center gap-3 border border-slate-200 bg-slate-100/90 p-4`}
```
New:
```tsx
className={`${panelClasses()} mb-4 flex items-center gap-3 border border-stone-200 bg-stone-100/90 p-4`}
```

Current icon circle className:
```tsx
className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white/75 text-lg"
```
New:
```tsx
className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-300 bg-white/75 text-lg"
```

Current subheading text:
```tsx
className="text-base font-semibold text-slate-950"
```
New:
```tsx
className="text-base font-semibold text-stone-950"
```

Current detail text:
```tsx
className="text-sm text-slate-700"
```
New:
```tsx
className="text-sm text-stone-700"
```

The `sectionHeadingClasses()` call stays as-is — it will be updated in Task 7 to use green tokens internally.

- [ ] **Step 2: Update the open-state className**

Current outer div className:
```tsx
className={`${panelClasses()} mb-4 flex items-center gap-3 border border-emerald-200 bg-emerald-50/90 p-4`}
```
New:
```tsx
className={`${panelClasses()} mb-4 flex items-center gap-3 border border-green-200 bg-green-100/90 p-4`}
```

Current icon circle className:
```tsx
className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-white/75 text-lg"
```
New:
```tsx
className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-green-200 bg-white/75 text-lg"
```

Current heading text (which appends to `sectionHeadingClasses()`):
```tsx
className={`${sectionHeadingClasses()} text-emerald-800`}
```
New:
```tsx
className={`${sectionHeadingClasses()} text-green-900`}
```

Current subheading text:
```tsx
className="text-base font-semibold text-emerald-950"
```
New:
```tsx
className="text-base font-semibold text-green-950"
```

Current detail text:
```tsx
className="text-sm text-emerald-900"
```
New:
```tsx
className="text-sm text-green-800"
```

- [ ] **Step 3: Run LockBanner tests**

Run: `npx vitest run src/components/__tests__/LockBanner.test.tsx`
Expected: All tests PASS. The behavioral tests verify text content ("Deadline:", "Apr 9", "EDT", archived message) — not CSS classes.

- [ ] **Step 4: Commit LockBanner migration**

```bash
git add src/components/LockBanner.tsx
git commit -m "refactor: migrate LockBanner from emerald/slate to green/stone tokens"
```

---

### Task 6: Migrate TrustStatusBar Classes

**Files:**
- Modify: `src/components/TrustStatusBar.tsx`
- Verify: `src/components/__tests__/TrustStatusBar.test.tsx`

The TrustStatusBar's `toneClasses()` function and inline JSX classes need emerald→green and slate→stone migration.

- [ ] **Step 1: Update toneClasses function**

In `src/components/TrustStatusBar.tsx`, find the `toneClasses` function. Change the `default` (info) case:

Current:
```ts
      return 'border-emerald-200/80 bg-white/95 text-slate-900'
```
New:
```ts
      return 'border-green-200/80 bg-white/95 text-stone-900'
```

The `error` and `warning` cases remain unchanged (they use `red-*` and `amber-*` respectively).

- [ ] **Step 2: Update inline slate classes in JSX**

Find the lock label text in the `createElement` call for the lock label paragraph. Current:
```tsx
          { className: 'flex items-center gap-2 text-base font-semibold text-slate-950' },
```
New:
```tsx
          { className: 'flex items-center gap-2 text-base font-semibold text-stone-950' },
```

Find the lock message paragraph. Current:
```tsx
    createElement('p', { className: 'mt-3 text-sm text-slate-800' }, state.lockMessage),
```
New:
```tsx
    createElement('p', { className: 'mt-3 text-sm text-stone-800' }, state.lockMessage),
```

Find the freshness label paragraph inside the freshness section. Current:
```tsx
            { className: 'text-xs font-semibold uppercase tracking-[0.18em] text-slate-500' },
```
New:
```tsx
            { className: 'text-xs font-semibold uppercase tracking-[0.18em] text-stone-600' },
```

Find the freshness message paragraph. Current:
```tsx
          createElement('p', { className: 'mt-1 text-sm text-slate-800' }, state.freshnessMessage),
```
New:
```tsx
          createElement('p', { className: 'mt-1 text-sm text-stone-800' }, state.freshnessMessage),
```

- [ ] **Step 3: Run TrustStatusBar tests**

Run: `npx vitest run src/components/__tests__/TrustStatusBar.test.tsx`
Expected: All tests PASS. The tests verify state logic and rendering structure, not CSS classes.

- [ ] **Step 4: Commit TrustStatusBar migration**

```bash
git add src/components/TrustStatusBar.tsx
git commit -m "refactor: migrate TrustStatusBar from emerald/slate to green/stone tokens"
```

---

### Task 7: Update uiStyles.ts Utility Functions

**Files:**
- Modify: `src/components/uiStyles.ts`

- [ ] **Step 1: Update sectionHeadingClasses**

In `src/components/uiStyles.ts`, find the `sectionHeadingClasses` function. Current:

```ts
export function sectionHeadingClasses() {
  return [
    'text-[0.7rem]',
    'font-semibold',
    'uppercase',
    'tracking-[0.18em]',
    'text-emerald-800/70',
  ].join(' ')
}
```

New:
```ts
export function sectionHeadingClasses() {
  return [
    'text-[0.7rem]',
    'font-semibold',
    'uppercase',
    'tracking-[0.18em]',
    'text-green-800/70',
  ].join(' ')
}
```

- [ ] **Step 2: Update scrollRegionFocusClasses**

In `src/components/uiStyles.ts`, find the `scrollRegionFocusClasses` function. Current:

```ts
export function scrollRegionFocusClasses() {
  return [
    'focus-visible:outline-none',
    'focus-visible:ring-inset',
    'focus-visible:ring-2',
    'focus-visible:ring-emerald-500',
  ].join(' ')
}
```

New:
```ts
export function scrollRegionFocusClasses() {
  return [
    'focus-visible:outline-none',
    'focus-visible:ring-inset',
    'focus-visible:ring-2',
    'focus-visible:ring-green-500',
  ].join(' ')
}
```

- [ ] **Step 3: Run full test suite**

Run: `npm run test`
Expected: All tests PASS.

- [ ] **Step 4: Commit uiStyles migration**

```bash
git add src/components/uiStyles.ts
git commit -m "refactor: migrate uiStyles sectionHeadingClasses and scrollRegionFocusClasses from emerald to green"
```

---

### Task 8: Full Build Verification & No-emerald/slate Audit

**Files:**
- Verify: All modified files
- Verify: `npm run build`, `npm run test`, `npm run lint`

- [ ] **Step 1: Run full test suite**

Run: `npm run test`
Expected: All tests pass

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No new lint errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 4: Audit for remaining emerald/slate in modified files**

Run: `grep -rn 'emerald-' src/components/StatusChip.tsx src/components/LockBanner.tsx src/components/TrustStatusBar.tsx src/components/uiStyles.ts src/components/ui/Button.tsx src/components/ui/Card.tsx`

Expected: No matches found (all emerald references have been migrated)

Run: `grep -rn 'slate-' src/components/StatusChip.tsx src/components/LockBanner.tsx src/components/TrustStatusBar.tsx src/components/uiStyles.ts src/components/ui/Button.tsx src/components/ui/Card.tsx`

Expected: No matches found (all slate references have been migrated)

Note: `sky-` references are intentionally retained per design spec (live status uses sky for info semantics).

- [ ] **Step 5: Verify touch target enforcement in globals.css**

Run: `grep -n 'min-block-size.*44' src/app/globals.css`
Expected: Shows the 44px min-block-size rules remain intact

- [ ] **Step 6: Final commit if any audit fixes were needed**

If the grep audit in Step 4 found any remaining emerald/slate references, fix them now and commit. If clean, no commit needed.

---

### Task 9: Update StatusChip Test for Token Verification

**Files:**
- Modify: `src/components/__tests__/StatusComponentsA11y.test.tsx`

The existing a11y tests verify structural attributes, not CSS class tokens. Add a dedicated test that verifies the StatusChip uses green/stone tokens (not emerald/slate) to catch regressions.

- [ ] **Step 1: Add token regression test to StatusComponentsA11y.test.tsx**

Add a new `describe` block after the existing one in `src/components/__tests__/StatusComponentsA11y.test.tsx`:

```tsx
describe('StatusChip token migration', () => {
  it('uses green tokens for open status (not emerald)', () => {
    const markup = renderToStaticMarkup(
      createElement(StatusChip, { status: 'open' }),
    )
    expect(markup).toContain('border-green-200')
    expect(markup).toContain('bg-green-50')
    expect(markup).toContain('text-green-900')
    expect(markup).not.toContain('emerald-')
  })

  it('uses stone tokens for complete and archived status (not slate)', () => {
    const markup = renderToStaticMarkup(
      createElement(StatusChip, { status: 'complete' }),
    )
    expect(markup).toContain('border-stone-200')
    expect(markup).toContain('bg-stone-100')
    expect(markup).not.toContain('slate-')

    const archivedMarkup = renderToStaticMarkup(
      createElement(StatusChip, { status: 'archived' }),
    )
    expect(archivedMarkup).toContain('border-stone-200')
    expect(archivedMarkup).not.toContain('slate-')
  })

  it('retains sky tokens for live status', () => {
    const markup = renderToStaticMarkup(
      createElement(StatusChip, { status: 'live' }),
    )
    expect(markup).toContain('border-sky-200')
    expect(markup).toContain('bg-sky-50')
    expect(markup).toContain('text-sky-900')
  })
})
```

Ensure `createElement` and `renderToStaticMarkup` imports are present at the top of the file (they already are in the existing imports).

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/components/__tests__/StatusComponentsA11y.test.tsx`
Expected: All tests PASS, including new token regression tests

- [ ] **Step 3: Commit token regression tests**

```bash
git add src/components/__tests__/StatusComponentsA11y.test.tsx
git commit -m "test: add StatusChip token regression tests for green/stone migration"
```

---

### Task 10: LockBanner and TrustStatusBar Token Regression Tests

**Files:**
- Modify: `src/components/__tests__/LockBanner.test.tsx`
- Modify: `src/components/__tests__/TrustStatusBar.test.tsx`

- [ ] **Step 1: Add LockBanner token regression test**

Add a new `describe` block at the end of `src/components/__tests__/LockBanner.test.tsx`:

```tsx
describe('LockBanner token migration', () => {
  it('uses stone tokens for locked state (not slate)', () => {
    const props: any = {
      isLocked: true,
      deadline: '2026-04-09T00:00:00+00:00',
      poolStatus: 'complete',
      timezone: 'America/New_York',
    }
    const markup = renderToStaticMarkup(<LockBanner {...props} />)

    expect(markup).toContain('border-stone-200')
    expect(markup).toContain('bg-stone-100')
    expect(markup).not.toContain('slate-')
    expect(markup).not.toContain('emerald-')
  })

  it('uses green tokens for open state (not emerald)', () => {
    const props: any = {
      isLocked: false,
      deadline: '2026-04-09T00:00:00+00:00',
      poolStatus: 'open',
      timezone: 'America/New_York',
    }
    const markup = renderToStaticMarkup(<LockBanner {...props} />)

    expect(markup).toContain('border-green-200')
    expect(markup).toContain('bg-green-100')
    expect(markup).toContain('text-green-950')
    expect(markup).not.toContain('emerald-')
    expect(markup).not.toContain('slate-')
  })
})
```

- [ ] **Step 2: Add TrustStatusBar token regression test**

Add a new `describe` block at the end of `src/components/__tests__/TrustStatusBar.test.tsx`:

```tsx
describe('TrustStatusBar token migration', () => {
  it('uses green/stone tokens for info tone (not emerald/slate)', () => {
    const markup = renderToStaticMarkup(
      createElement(TrustStatusBar, {
        isLocked: false,
        poolStatus: 'open',
        freshness: 'current',
        refreshedAt: '2026-03-29T12:00:00.000Z',
        lastRefreshError: null,
      }),
    )

    expect(markup).toContain('border-green-200')
    expect(markup).toContain('text-stone-900')
    expect(markup).not.toContain('emerald-')
    expect(markup).not.toContain('slate-')
  })

  it('uses stone-600 for freshness labels (not slate-500)', () => {
    const markup = renderToStaticMarkup(
      createElement(TrustStatusBar, {
        isLocked: true,
        poolStatus: 'live',
        freshness: 'current',
        refreshedAt: '2026-03-29T12:00:00.000Z',
        lastRefreshError: null,
      }),
    )

    expect(markup).toContain('text-stone-600')
    expect(markup).not.toContain('text-slate-500')
  })
})
```

Ensure `createElement` import is present (it is, from existing imports).

- [ ] **Step 3: Run all modified tests**

Run: `npx vitest run src/components/__tests__/LockBanner.test.tsx src/components/__tests__/TrustStatusBar.test.tsx src/components/__tests__/StatusComponentsA11y.test.tsx`
Expected: All tests PASS

- [ ] **Step 4: Commit regression tests**

```bash
git add src/components/__tests__/LockBanner.test.tsx src/components/__tests__/TrustStatusBar.test.tsx
git commit -m "test: add LockBanner and TrustStatusBar token regression tests"
```

---

### Task 11: Final Full Verification

**Files:**
- Verify: Entire project

- [ ] **Step 1: Run complete test suite**

Run: `npm run test`
Expected: All tests pass, including new Button/Card tests and all token regression tests

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with no TypeScript or build errors

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No new lint errors

- [ ] **Step 4: Verify Button component accessibility**

Run: `npx vitest run src/components/ui/__tests__/Button.test.tsx`
Confirm:
- All variant classes render correctly
- Focus-visible ring classes present
- Disabled state applies `disabled:opacity-50 disabled:cursor-not-allowed`
- 44px minimum touch target enforced via globals.css (no explicit min-h needed)

- [ ] **Step 5: Verify Card component renders accent correctly**

Run: `npx vitest run src/components/ui/__tests__/Card.test.tsx`
Confirm:
- Default Card renders with `panelClasses()` styles
- `accent="left"` renders `border-l-4 border-l-green-700`
- `accent="none"` and undefined accent do not render aceent classes

- [ ] **Step 6: Final emerald/slate audit across ALL component files**

Run: `grep -rn 'emerald-' src/components/ || echo "No emerald references found"`

Expected in StatusChip.tsx: No matches (migrated to green)
Expected in LockBanner.tsx: No matches (migrated to green/stone)
Expected in TrustStatusBar.tsx: No matches (migrated to green/stone)
Expected in uiStyles.ts: No matches (migrated to green)

Note: Other files in `src/components/` may still use `emerald-` or `slate-` — that's expected and out of scope for this story. The audit only covers the files modified in this story.

- [ ] **Step 7: Confirm all acceptance criteria are met**

| AC | Verification |
|----|-------------|
| AC-1: Button variant="primary"/"secondary" | Button.test.tsx verifies primary/secondary classes render |
| AC-2: Card accent="left" | Card.test.tsx verifies border-l-4 border-l-green-700 |
| AC-3: StatusChip green/sand with icon+color pattern | Token regression tests verify green/stone classes, a11y tests verify aria attributes |
| AC-4: LockBanner green-100 for open, stone-100 for locked | LockBanner test verifies bg-green-100/bg-stone-100 |
| AC-5: TrustStatusBar green/sand treatment | TrustStatusBar test verifies green tone classes for info state |
| AC-6: WCAG 2.1 AA contrast | Spec §5.1 documents all ratios pass AA |
| AC-7: Touch targets >=44px | globals.css enforces 44px; Button inherits this; existing tests cover |

---

## Pre-task Checklist

Before starting implementation, verify:

- [ ] `feature/OPS-20-design-token-system` branch is available locally and remotely
- [ ] `npm run test` passes on current `main`
- [ ] `npm run build` passes on current `main`
- [ ] `npm run lint` passes on current `main`
- [ ] `src/components/ui/` directory does not yet exist (will be created in Task 2)