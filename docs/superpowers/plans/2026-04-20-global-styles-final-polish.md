# Global Styles and Final Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the four target files (globals.css, uiStyles.ts, DataAlert.tsx, FreshnessChip.tsx) to ensure design token consistency, accessibility completeness, and meaningful test coverage.

**Architecture:** This is a polish/audit story. The engineer audits each file for hardcoded colors that should use design tokens, verifies accessibility attributes, cleans up inconsistencies, and adds unit tests where snapshot tests exist.

**Tech Stack:** Next.js, Tailwind CSS, Vitest, React Testing Library

---

### Task 1: Audit DataAlert.tsx for hardcoded colors

**Files:**
- Modify: `src/components/DataAlert.tsx:13-40`
- Reference: `docs/design-tokens.md`

- [ ] **Step 1: Review color usage in DataAlert.tsx**

Open `src/components/DataAlert.tsx` and check each variant's `classes` and `iconClasses`:
- `error`: `border-red-200`, `bg-red-50/95`, `text-red-950` → should map to `action-error` token
- `warning`: `border-amber-200`, `bg-amber-50/95`, `text-amber-950` → should map to `action-warning` token
- `info`: `border-sky-200`, `bg-sky-50/95`, `text-sky-950` → `sky` is not in the design token system

Check `docs/design-tokens.md` migration table. Note: `red-*` and `amber-*` map to `action-error`/`action-warning`. `sky-*` is not in the migration table.

- [ ] **Step 2: Verify if sky-200/sky-50/sky-950 need migration**

Per the design token migration table, `sky` is not an existing token. The info variant uses `sky-200` for border, `sky-50/95` for background, and `sky-950` for text. These should be reviewed.

If `sky` is intentionally used for "info" (blue-ish), confirm it stays as-is since there's no `info` token in the system. If it should be migrated, propose a replacement.

**Decision to make:** The info variant uses `sky-*` colors which are not in the design token system. For semantic "info" meaning, blue-ish is appropriate. The engineer should either:
- A) Keep `sky-*` as-is since there's no blue/info token in the system
- B) Replace with `primary-*` colors which ARE in the token system

Recommend Option A for now (keep as-is, it's intentional semantic coloring outside the token system).

- [ ] **Step 3: Commit audit finding**

```bash
git add docs/superpowers/specs/2026-04-20-global-styles-final-polish-design.md
git commit -m "docs: note sky-* colors in DataAlert are intentional"
```

---

### Task 2: Audit FreshnessChip.tsx for hardcoded colors

**Files:**
- Modify: `src/components/FreshnessChip.tsx:5-27`
- Reference: `docs/design-tokens.md`

- [ ] **Step 1: Review color usage in FreshnessChip.tsx**

Open `src/components/FreshnessChip.tsx` and check each status's `classes`:
- `current`: `border-green-200`, `bg-green-50`, `text-green-900` — `green-*` maps to `primary-*` tokens
- `stale`: `border-amber-200`, `bg-amber-50`, `text-amber-800` — `amber-*` maps to `action-warning` token
- `unknown`: `border-stone-200`, `bg-stone-100`, `text-stone-700` — `stone-*` is in the neutral scale (acceptable for neutral semantic meaning)

Per the migration table:
- `green-200` → `border-primary-100`
- `green-50` → `bg-primary-100`
- `green-900` → `text-primary-900`
- `amber-200` → `border-action-warning` (but action-warning is for bg, not border — verify)
- `amber-800` → `text-action-warning`

Wait: the `action-warning` token is `#f59e0b` (amber-500 range), not amber-200. The migration table maps `amber-800` to `text-action-warning`, but `action-warning` is amber-500 (f59e0b). This is a mismatch — `text-action-warning` (amber-500) on `text-amber-800` (darker amber) are different shades.

**Decision to make:** The stale status uses amber colors. Per migration table:
- `text-amber-800` / `bg-amber-100` → `text-action-warning` / `bg-action-warning` (but these are amber-500/amber-400 range, not 800/100)
- The engineer should decide if `amber-800` should map to `text-neutral-900` (stone-900 range) or stay as `amber-800` for semantic "darker amber" meaning

Recommend: Keep `amber-800` as-is for stale status (darker amber is semantically correct for "stale/warning"). The `action-warning` token is amber-500 which is too bright for text on a stale indicator.

---

### Task 3: Fix uiStyles scrollRegionFocusClasses test

**Files:**
- Modify: `src/components/__tests__/uiStyles.test.ts:29-35`

- [ ] **Step 1: Review the problematic test**

```typescript
it('returns visible focus classes for keyboard-scroll regions', () => {
  expect(scrollRegionFocusClasses()).toContain('focus-visible:ring-inset')
  expect(scrollRegionFocusClasses()).toContain('focus-visible:ring-2')
  expect(scrollRegionFocusClasses()).toContain('focus-visible:ring-green-500')
  expect(scrollRegionFocusClasses()).not.toContain('focus-visible:ring-offset-2')
  expect(scrollRegionFocusClasses()).not.toBe('focus-visible:outline-none')
})
```

The last assertion uses `not.toBe()` which is a string identity check, not a subset check. `scrollRegionFocusClasses()` returns `'focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-green-500'`, so `not.toBe('focus-visible:outline-none')` will pass (because the full string is not identical to `'focus-visible:outline-none'`).

This test is vacuous. The assertion should be removed since the other assertions already verify the correct classes are present.

- [ ] **Step 2: Fix the test**

Remove the line:
```typescript
expect(scrollRegionFocusClasses()).not.toBe('focus-visible:outline-none')
```

- [ ] **Step 3: Run tests to verify**

```bash
npm test -- src/components/__tests__/uiStyles.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/__tests__/uiStyles.test.ts
git commit -m "test(uiStyles): remove vacuous toBe assertion in scrollRegionFocusClasses test"
```

---

### Task 4: Add unit tests for DataAlert component

**Files:**
- Create: `src/components/__tests__/DataAlert.test.tsx`
- Reference: `src/components/DataAlert.tsx`, `src/test/setup.ts`

- [ ] **Step 1: Write failing unit tests for DataAlert**

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DataAlert } from '../DataAlert'

describe('DataAlert', () => {
  it('renders error variant with correct text', () => {
    render(<DataAlert variant="error" title="Error title" message="Error message" />)
    expect(screen.getByText('Error title')).toBeInTheDocument()
    expect(screen.getByText('Error message')).toBeInTheDocument()
  })

  it('renders warning variant with correct text', () => {
    render(<DataAlert variant="warning" title="Warning title" message="Warning message" />)
    expect(screen.getByText('Warning title')).toBeInTheDocument()
    expect(screen.getByText('Warning message')).toBeInTheDocument()
  })

  it('renders info variant with correct text', () => {
    render(<DataAlert variant="info" title="Info title" message="Info message" />)
    expect(screen.getByText('Info title')).toBeInTheDocument()
    expect(screen.getByText('Info message')).toBeInTheDocument()
  })

  it('error variant has role="alert"', () => {
    render(<DataAlert variant="error" title="Error" />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('warning variant has role="status"', () => {
    render(<DataAlert variant="warning" title="Warning" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('info variant has role="status"', () => {
    render(<DataAlert variant="info" title="Info" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('does not render message when not provided', () => {
    const { container } = render(<DataAlert variant="error" title="Error" />)
    expect(container.querySelector('span:last-child')).toHaveTextContent('Error')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/components/__tests__/DataAlert.test.tsx
```

Expected: FAIL (file doesn't exist yet)

- [ ] **Step 3: Create the test file**

Write the file `src/components/__tests__/DataAlert.test.tsx` with the test code above.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/components/__tests__/DataAlert.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/__tests__/DataAlert.test.tsx
git commit -m "test: add unit tests for DataAlert component"
```

---

### Task 5: Add unit tests for FreshnessChip component

**Files:**
- Create: `src/components/__tests__/FreshnessChip.test.tsx`
- Reference: `src/components/FreshnessChip.tsx`, `src/test/setup.ts`

- [ ] **Step 1: Write failing unit tests for FreshnessChip**

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FreshnessChip } from '../FreshnessChip'

describe('FreshnessChip', () => {
  it('renders current status with correct label', () => {
    render(<FreshnessChip status="current" />)
    expect(screen.getByText('Current')).toBeInTheDocument()
  })

  it('renders stale status with correct label', () => {
    render(<FreshnessChip status="stale" />)
    expect(screen.getByText('Stale')).toBeInTheDocument()
  })

  it('renders unknown status with correct label', () => {
    render(<FreshnessChip status="unknown" />)
    expect(screen.getByText('No data yet')).toBeInTheDocument()
  })

  it('has role="status"', () => {
    render(<FreshnessChip status="current" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('displays refreshed time when provided and status is not unknown', () => {
    render(<FreshnessChip status="current" refreshedAt="2026-04-20T10:00:00Z" />)
    expect(screen.getByText(/Updated/)).toBeInTheDocument()
  })

  it('does not display refreshed time when status is unknown', () => {
    render(<FreshnessChip status="unknown" refreshedAt="2026-04-20T10:00:00Z" />)
    expect(screen.queryByText(/Updated/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/components/__tests__/FreshnessChip.test.tsx
```

Expected: FAIL (file doesn't exist yet)

- [ ] **Step 3: Create the test file**

Write the file `src/components/__tests__/FreshnessChip.test.tsx` with the test code above.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/components/__tests__/FreshnessChip.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/__tests__/FreshnessChip.test.tsx
git commit -m "test: add unit tests for FreshnessChip component"
```

---

### Task 6: Verify globals.css and uiStyles are complete

**Files:**
- Read: `src/app/globals.css`
- Read: `src/components/uiStyles.ts`
- Read: `src/components/__tests__/uiStyles.test.ts`
- Read: `src/app/__tests__/globals-css.test.ts`

- [ ] **Step 1: Run globals-css tests**

```bash
npm test -- src/app/__tests__/globals-css.test.ts
```

Expected: PASS

- [ ] **Step 2: Run uiStyles tests**

```bash
npm test -- src/components/__tests__/uiStyles.test.ts
```

Expected: PASS

- [ ] **Step 3: Verify no TODO/FIXME in target files**

```bash
grep -n 'TODO\|FIXME\|XXX\|HACK' src/app/globals.css src/components/uiStyles.ts src/components/DataAlert.tsx src/components/FreshnessChip.tsx
```

Expected: No output (no placeholders found)

---

### Task 7: Run full test suite

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: ALL TESTS PASS

- [ ] **Step 2: Commit final polish**

```bash
git add -A && git commit -m "OPS-29: global styles and final polish — tests added, audits complete"
```

---

## Spec Coverage Check

- [x] Design token consistency audit for DataAlert.tsx (Task 1)
- [x] Design token consistency audit for FreshnessChip.tsx (Task 2)
- [x] Accessibility attribute verification (Tasks 4, 5)
- [x] uiStyles test cleanup (Task 3)
- [x] globals.css test coverage verified (Task 6)
- [x] Full test suite passes (Task 7)

## Type Consistency Check

- `DataAlertProps` interface fields match test assertions: `variant`, `title`, `message`, `className`
- `FreshnessChipProps` interface fields match test assertions: `status`, `refreshedAt`
- `FreshnessStatus` type imported from `@/lib/supabase/types` — matches test usage
- `DataAlertVariant` type is `'error' | 'warning' | 'info'` — matches test usage