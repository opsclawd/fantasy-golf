# Picks Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the green/sand theme to the participant picks page by migrating five target files from emerald/slate/sky/blue tokens to green/stone tokens, creating the Card primitive, and adopting the Button component.

**Architecture:** Create the Card primitive component first (OPS-22 spec defined it but it wasn't implemented), then migrate each picks page component from old tokens to new tokens in dependency order: PickProgress → GolferPicker → SelectionSummaryCard → SubmissionConfirmation → PicksForm → page.tsx. TDD for Card (new), token-regression tests for modified components, behavioral tests unchanged.

**Tech Stack:** React 18, TypeScript 5, Tailwind CSS v3.4, Vitest, @testing-library/react, renderToStaticMarkup (react-dom/server)

**Design Spec:** `docs/superpowers/specs/2026-04-18-picks-page-redesign-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/components/ui/Card.tsx` | Card primitive with accent prop |
| Create | `src/components/ui/__tests__/Card.test.tsx` | Card component tests |
| Modify | `src/components/PickProgress.tsx` | Migrate slate/sky → stone/green tokens |
| Modify | `src/components/golfer-picker.tsx` | Card-based redesign with green left-border, token migration |
| Modify | `src/components/SelectionSummaryCard.tsx` | Sky → green token migration |
| Modify | `src/components/SubmissionConfirmation.tsx` | Emerald → green/sand success state, token migration |
| Modify | `src/app/(app)/participant/picks/[poolId]/PicksForm.tsx` | Adopt Button component, migrate tokens |
| Modify | `src/app/(app)/participant/picks/[poolId]/page.tsx` | Migrate slate/gray → stone tokens |
| Add tests | `src/components/__tests__/PicksFlowPresentation.test.tsx` | Add token regression tests for SelectionSummaryCard |
| Add tests | `src/components/__tests__/GolferPickerTokenMigration.test.tsx` | Token regression tests for GolferPicker |
| Verify | `src/components/PickProgress.tsx` | Verify no emerald/sky/slate remaining after migration |
| Verify | `src/app/(app)/participant/picks/[poolId]/actions.ts` | Verify NOT touched (functional invariants) |

---

### Task 1: Create Card Component (TDD)

**Files:**
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/__tests__/Card.test.tsx`

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
git commit -m "feat: add Card UI primitive with accent left border prop

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 2: Migrate PickProgress Classes

**Files:**
- Modify: `src/components/PickProgress.tsx`

PickProgress uses `slate-*` for the track/container and `sky-600` for the progress bar. Migrate to `stone-*` and `green-600`.

- [ ] **Step 1: Update PickProgress token classes**

In `src/components/PickProgress.tsx`, make these class changes:

Outer container — change:
```tsx
className="... rounded-2xl border border-slate-200/80 bg-slate-50/80 ..."
```
to:
```tsx
className="... rounded-3xl border border-stone-200/80 bg-stone-50/80 ..."
```

Count text — change:
```tsx
className="... text-slate-900"
```
to:
```tsx
className="... text-stone-900"
```

Progress track — change:
```tsx
className="... bg-slate-200"
```
to:
```tsx
className="... bg-stone-200"
```

Incomplete progress bar — change:
```tsx
isComplete ? 'bg-green-600' : 'bg-sky-600'
```
to:
```tsx
isComplete ? 'bg-green-600' : 'bg-green-600'
```

Note: Both states now use `bg-green-600`. The complete state already used green-600; only the incomplete state changes from sky-600 to green-600.

- [ ] **Step 2: Run tests**

Run: `npm run test`
Expected: All tests pass (PickProgress tests verify structure, not specific CSS classes)

- [ ] **Step 3: Commit PickProgress migration**

```bash
git add src/components/PickProgress.tsx
git commit -m "refactor: migrate PickProgress from slate/sky to stone/green tokens

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 3: Migrate GolferPicker to Card-Based Redesign with Green Tokens

**Files:**
- Modify: `src/components/golfer-picker.tsx`

This is the most significant change. The GolferPicker moves from flat sky-colored indicators to a card-based layout with green left-border accents for selected golfers.

- [ ] **Step 1: Migrate search/filter bar and golfer list container**

In `src/components/golfer-picker.tsx`, update the search/filter bar outer div:

Current:
```tsx
<div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-3 sm:flex-row sm:items-end">
```
New:
```tsx
<div className="flex flex-col gap-3 rounded-3xl border border-stone-200/80 bg-white/90 p-3 sm:flex-row sm:items-end">
```

Search label:
```tsx
className="mb-1 block text-sm font-medium text-gray-700"
```
→
```tsx
className="mb-1 block text-sm font-medium text-stone-700"
```

Search input:
```tsx
className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
```
→
```tsx
className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5"
```

Country label:
```tsx
className="mb-1 block text-sm font-medium text-gray-700"
```
→
```tsx
className="mb-1 block text-sm font-medium text-stone-700"
```

Country select:
```tsx
className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
```
→
```tsx
className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5"
```

- [ ] **Step 2: Migrate the scrollable golfer list container**

Current:
```tsx
className="max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white/90"
```
New:
```tsx
className="max-h-80 overflow-y-auto rounded-3xl border border-stone-200/80 bg-white/90"
```

Empty state text:
```tsx
className="p-3 text-sm text-gray-500"
```
→
```tsx
className="p-3 text-sm text-stone-500"
```

- [ ] **Step 3: Migrate golfer row selected/unselected states and pill classes**

Current golfer button className (the one inside the `.map`):
```tsx
className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-inset ${
  isSelected ? 'bg-sky-50' : ''
} ${isDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
```
New:
```tsx
className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-inset ${
  isSelected ? 'bg-green-50 border-l-4 border-l-green-700' : ''
} ${isDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
```

Selected pill:
```tsx
className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
  isSelected ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-600'
}`}
```
→
```tsx
className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
  isSelected ? 'bg-green-100 text-green-800' : 'bg-stone-100 text-stone-600'
}`}
```

Country text inside golfer name span:
```tsx
className="ml-2 text-sm text-gray-500"
```
→
```tsx
className="ml-2 text-sm text-stone-500"
```

- [ ] **Step 4: Migrate the summary bar at the bottom**

Current:
```tsx
className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-sm text-slate-600"
```
New:
```tsx
className="rounded-3xl border border-stone-200/80 bg-stone-50/80 px-3 py-2 text-sm text-stone-600"
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/components/__tests__/GolferPickerTournamentRoster.test.tsx`
Expected: PASS — behavioral tests (render, filter, select) still work; only CSS classes changed

- [ ] **Step 6: Commit GolferPicker migration**

```bash
git add src/components/golfer-picker.tsx
git commit -m "refactor: migrate GolferPicker to card-based green/stone design with left-border accents

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 4: Migrate SelectionSummaryCard from Sky to Green Tokens

**Files:**
- Modify: `src/components/SelectionSummaryCard.tsx`
- Modify: `src/components/__tests__/PicksFlowPresentation.test.tsx`

- [ ] **Step 1: Update SelectionSummaryCard class tokens**

In `src/components/SelectionSummaryCard.tsx`, make these changes:

Section outer classes — change:
```tsx
className={[
  panelClasses(),
  'border border-sky-200/80 bg-sky-50/90 p-4',
  className,
]
```
to:
```tsx
className={[
  panelClasses(),
  'border border-green-200/80 bg-green-50/90 p-4',
  className,
]
```

Section heading — change:
```tsx
className={sectionHeadingClasses().replace('text-green-800/70', 'text-sky-700/80')}
```
to:
```tsx
className={sectionHeadingClasses().replace('text-green-800/70', 'text-green-700/80')}
```

Count text — change:
```tsx
className="mt-2 text-base font-semibold text-slate-950"
```
to:
```tsx
className="mt-2 text-base font-semibold text-stone-950"
```

Subtitle text — change:
```tsx
className="mt-1 text-sm text-slate-700"
```
to:
```tsx
className="mt-1 text-sm text-stone-700"
```

Status pill complete — change:
```tsx
isComplete ? 'bg-emerald-100 text-emerald-800' : 'bg-white/80 text-sky-800'
```
to:
```tsx
isComplete ? 'bg-green-100 text-green-800' : 'bg-white/80 text-green-800'
```

No selection text — change:
```tsx
className="text-sm text-slate-600"
```
to:
```tsx
className="text-sm text-stone-600"
```

Pick list name — change:
```tsx
className="flex items-center gap-3 text-sm text-slate-800"
```
to:
```tsx
className="flex items-center gap-3 text-sm text-stone-800"
```

Number circle — change:
```tsx
className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-800"
```
to:
```tsx
className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs font-semibold text-green-800"
```

- [ ] **Step 2: Add token regression test to PicksFlowPresentation.test.tsx**

Add a new `describe` block at the end of `src/components/__tests__/PicksFlowPresentation.test.tsx`:

```tsx
describe('SelectionSummaryCard token migration', () => {
  it('uses green tokens for border and background (not sky)', () => {
    const markup = renderToStaticMarkup(
      createElement(SelectionSummaryCard, {
        selectedCount: 3,
        requiredCount: 6,
        selectedGolferNames: ['Scottie Scheffler', 'Rory McIlroy', 'Nelly Korda'],
      }),
    )

    expect(markup).toContain('border-green-200')
    expect(markup).toContain('bg-green-50')
    expect(markup).not.toContain('sky-')
  })

  it('uses stone tokens for text (not slate)', () => {
    const markup = renderToStaticMarkup(
      createElement(SelectionSummaryCard, {
        selectedCount: 3,
        requiredCount: 6,
        selectedGolferNames: ['Scottie Scheffler'],
      }),
    )

    expect(markup).toContain('text-stone-950')
    expect(markup).toContain('text-stone-700')
    expect(markup).not.toContain('slate-')
  })

  it('uses green-100 for complete status pill', () => {
    const markup = renderToStaticMarkup(
      createElement(SelectionSummaryCard, {
        selectedCount: 4,
        requiredCount: 4,
        selectedGolferNames: ['A', 'B', 'C', 'D'],
      }),
    )

    expect(markup).toContain('bg-green-100')
    expect(markup).toContain('text-green-800')
    expect(markup).not.toContain('emerald-')
  })
})
```

Ensure `createElement` is imported (it already is from React) and `SelectionSummaryCard` is imported (it already is at the top of the file).

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/components/__tests__/PicksFlowPresentation.test.tsx`
Expected: All tests PASS including token regression tests

- [ ] **Step 4: Commit SelectionSummaryCard migration**

```bash
git add src/components/SelectionSummaryCard.tsx src/components/__tests__/PicksFlowPresentation.test.tsx
git commit -m "refactor: migrate SelectionSummaryCard from sky/slate to green/stone tokens

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 5: Migrate SubmissionConfirmation to Green/Sand Success State

**Files:**
- Modify: `src/components/SubmissionConfirmation.tsx`

- [ ] **Step 1: Update SubmissionConfirmation class tokens**

In `src/components/SubmissionConfirmation.tsx`, make these changes:

Success section outer — change:
```tsx
className={`${panelClasses()} border border-emerald-200/80 bg-emerald-50/95 p-4`}
```
to:
```tsx
className={`${panelClasses()} border border-green-200/80 bg-amber-100/95 p-4`}
```

Success heading — change:
```tsx
className={`${sectionHeadingClasses()} text-emerald-800`}
```
to:
```tsx
className={`${sectionHeadingClasses()} text-green-800`}
```

Pool name — change:
```tsx
className="mt-2 text-lg font-semibold text-emerald-950"
```
to:
```tsx
className="mt-2 text-lg font-semibold text-green-950"
```

Status text — change:
```tsx
className="mt-1 break-words text-sm text-emerald-900"
```
to:
```tsx
className="mt-1 break-words text-sm text-green-800"
```

Picks list number — change:
```tsx
className="text-xs font-semibold text-slate-400"
```
to:
```tsx
className="text-xs font-semibold text-stone-400"
```

Picks list name — change:
```tsx
className="font-medium text-slate-900"
```
to:
```tsx
className="font-medium text-stone-900"
```

Picks list item background — change:
```tsx
className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm"
```
to:
```tsx
className="flex items-center gap-3 rounded-2xl bg-stone-50 px-3 py-2 text-sm"
```

- [ ] **Step 2: Run SubmissionConfirmation tests**

The existing `StatusComponentsA11y.test.tsx` imports `SubmissionConfirmation` and verifies structural attributes. It should still pass since we only changed CSS classes.

Run: `npx vitest run src/components/__tests__/StatusComponentsA11y.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit SubmissionConfirmation migration**

```bash
git add src/components/SubmissionConfirmation.tsx
git commit -m "refactor: migrate SubmissionConfirmation from emerald to green/amber sand tokens

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 6: Migrate PicksForm to Use Button Component and Stone Tokens

**Files:**
- Modify: `src/app/(app)/participant/picks/[poolId]/PicksForm.tsx`

- [ ] **Step 1: Add Button import and migrate SubmitButton**

In `src/app/(app)/participant/picks/[poolId]/PicksForm.tsx`, add Button import at the top:

```tsx
import { Button } from '@/components/ui/Button'
```

Replace the `SubmitButton` component. Current:
```tsx
function SubmitButton({ hasEnoughPicks, isEdit }: { hasEnoughPicks: boolean; isEdit: boolean }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending || !hasEnoughPicks}
      className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? 'Saving...' : isEdit ? 'Update Picks' : 'Submit Picks'}
    </button>
  )
}
```
New:
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

- [ ] **Step 2: Migrate Edit button to Button component**

Current edit button:
```tsx
<button
  type="button"
  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
  onClick={() => window.location.reload()}
>
  Edit picks
</button>
```
New:
```tsx
<Button
  type="button"
  variant="secondary"
  className="w-full sm:w-auto"
  onClick={() => window.location.reload()}
>
  Edit picks
</Button>
```

- [ ] **Step 3: Migrate inline text classes**

Form heading — change:
```tsx
className="mb-2 text-lg font-semibold text-slate-950"
```
to:
```tsx
className="mb-2 text-lg font-semibold text-stone-950"
```

Form description — change:
```tsx
className="mb-4 text-sm text-slate-600"
```
to:
```tsx
className="mb-4 text-sm text-stone-600"
```

- [ ] **Step 4: Run full test suite**

Run: `npm run test`
Expected: All tests pass

- [ ] **Step 5: Commit PicksForm migration**

```bash
git add src/app/\(app\)/participant/picks/\[poolId\]/PicksForm.tsx
git commit -m "refactor: migrate PicksForm to use Button component and stone tokens

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 7: Migrate Page Component Slate/Gray to Stone Tokens

**Files:**
- Modify: `src/app/(app)/participant/picks/[poolId]/page.tsx`

- [ ] **Step 1: Update page heading and description tokens**

In `src/app/(app)/participant/picks/[poolId]/page.tsx`, change the page heading:

Current:
```tsx
<h1 className="mt-2 text-2xl font-bold text-slate-950">{pool.name}</h1>
```
New:
```tsx
<h1 className="mt-2 text-2xl font-bold text-stone-950">{pool.name}</h1>
```

Description:
```tsx
<p className="mt-1 text-sm text-slate-600">{pool.tournament_name}</p>
```
→
```tsx
<p className="mt-1 text-sm text-stone-600">{pool.tournament_name}</p>
```

- [ ] **Step 2: Update archived/locked message divs**

Archived member message (first occurrence):
```tsx
<div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 text-sm sm:p-5" role="status" aria-live="polite">
  <p className="text-gray-600">This pool is archived and read-only.</p>
</div>
```
→
```tsx
<div className="rounded-3xl border border-stone-200/80 bg-stone-100 p-4 text-sm sm:p-5" role="status" aria-live="polite">
  <p className="text-stone-600">This pool is archived and read-only.</p>
</div>
```

Archived/locked no-entry message (second occurrence):
```tsx
<div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 text-sm sm:p-5" role="status" aria-live="polite">
  <p className="text-gray-600">
```
→
```tsx
<div className="rounded-3xl border border-stone-200/80 bg-stone-100 p-4 text-sm sm:p-5" role="status" aria-live="polite">
  <p className="text-stone-600">
```

- [ ] **Step 3: Run full test suite**

Run: `npm run test`
Expected: All tests pass

- [ ] **Step 4: Commit page token migration**

```bash
git add src/app/\(app\)/participant/picks/\[poolId\]/page.tsx
git commit -m "refactor: migrate picks page from slate/gray to stone tokens

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 8: Add GolferPicker Token Regression Tests

**Files:**
- Create: `src/components/__tests__/GolferPickerTokenMigration.test.tsx`

- [ ] **Step 1: Write the test file**

Create `src/components/__tests__/GolferPickerTokenMigration.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { GolferPicker } from '@/components/golfer-picker'

const mockGolfers = [
  { id: '1', name: 'Scottie Scheffler', country: 'USA', search_name: 'scottie scheffler', is_active: true },
  { id: '2', name: 'Rory McIlroy', country: 'NIR', search_name: 'rory mcilroy', is_active: true },
]

describe('GolferPicker token migration', () => {
  it('uses green tokens for selected state (not sky)', () => {
    render(
      <GolferPicker
        selectedIds={['1']}
        onSelectionChange={() => {}}
        maxSelections={4}
        golfers={mockGolfers}
      />,
    )

    const scottieButton = screen.getByRole('option', { name: /Remove Scottie Scheffler/i })
    expect(scottieButton.className).toContain('bg-green-50')
    expect(scottieButton.className).toContain('border-l-4')
    expect(scottieButton.className).toContain('border-l-green-700')
  })

  it('uses stone tokens for unselected state and filter bar (not slate/gray)', () => {
    render(
      <GolferPicker
        selectedIds={[]}
        onSelectionChange={() => {}}
        maxSelections={4}
        golfers={mockGolfers}
      />,
    )

    const searchInput = screen.getByLabelText('Search golfers')
    expect(searchInput.className).toContain('border-stone-200')

    const countrySelect = screen.getByLabelText('Country')
    expect(countrySelect.className).toContain('border-stone-200')
  })

  it('uses green focus ring (not sky)', () => {
    render(
      <GolferPicker
        selectedIds={[]}
        onSelectionChange={() => {}}
        maxSelections={4}
        golfers={mockGolfers}
      />,
    )

    const golferButton = screen.getByRole('option', { name: /Select Scottie Scheffler/i })
    expect(golferButton.className).toContain('focus:ring-green-500')
  })

  it('uses stone-600 for "Select" pill in unselected state', () => {
    render(
      <GolferPicker
        selectedIds={[]}
        onSelectionChange={() => {}}
        maxSelections={4}
        golfers={mockGolfers}
      />,
    )

    const selectPill = screen.getByText('Select')
    expect(selectPill.className).toContain('bg-stone-100')
    expect(selectPill.className).toContain('text-stone-600')
  })
})
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/components/__tests__/GolferPickerTokenMigration.test.tsx`
Expected: All 4 tests PASS

- [ ] **Step 3: Commit GolferPicker token regression tests**

```bash
git add src/components/__tests__/GolferPickerTokenMigration.test.tsx
git commit -m "test: add GolferPicker token regression tests for green/stone migration

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 9: Full Build Verification & Token Audit

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

- [ ] **Step 4: Audit for remaining old tokens in the five target files**

Run:
```bash
grep -rn 'emerald-' src/app/\(app\)/participant/picks/\[poolId\]/page.tsx src/app/\(app\)/participant/picks/\[poolId\]/PicksForm.tsx src/components/golfer-picker.tsx src/components/SubmissionConfirmation.tsx src/components/SelectionSummaryCard.tsx src/components/PickProgress.tsx
```
Expected: No matches found

Run:
```bash
grep -rn 'slate-' src/app/\(app\)/participant/picks/\[poolId\]/page.tsx src/app/\(app\)/participant/picks/\[poolId\]/PicksForm.tsx src/components/golfer-picker.tsx src/components/SubmissionConfirmation.tsx src/components/SelectionSummaryCard.tsx src/components/PickProgress.tsx
```
Expected: No matches found

Run:
```bash
grep -rn 'sky-' src/app/\(app\)/participant/picks/\[poolId\]/page.tsx src/app/\(app\)/participant/picks/\[poolId\]/PicksForm.tsx src/components/golfer-picker.tsx src/components/SubmissionConfirmation.tsx src/components/SelectionSummaryCard.tsx src/components/PickProgress.tsx
```
Expected: No matches found (sky tokens migrated to green)

Run:
```bash
grep -rn 'blue-' src/app/\(app\)/participant/picks/\[poolId\]/PicksForm.tsx
```
Expected: No matches found (submit button now uses Button component)

- [ ] **Step 5: Verify Button component usage in PicksForm**

Run: `grep -n "Button" src/app/\(app\)/participant/picks/\[poolId\]/PicksForm.tsx`
Expected: Shows import and both Button usages (SubmitButton and Edit button)

- [ ] **Step 6: Verify Card component renders accent correctly**

Run: `npx vitest run src/components/ui/__tests__/Card.test.tsx`
Expected: All 7 tests PASS

- [ ] **Step 7: Verify actions.ts was NOT modified**

Run: `git diff main -- src/app/\(app\)/participant/picks/\[poolId\]/actions.ts`
Expected: No changes (empty diff)

---

### Task 10: Acceptance Criteria Verification

**Files:**
- Verify: All acceptance criteria met

- [ ] **Step 1: Verify AC-1 — Picks page uses new color tokens**

Run: `grep -rn 'green-\|stone-\|amber-' src/app/\(app\)/participant/picks/ | wc -l`
Expected: Multiple matches showing green/stone/amber tokens are in use

- [ ] **Step 2: Verify AC-2 — LockBanner visibility (already migrated in OPS-22)**

Run: `grep -n 'green-100\|stone-100' src/components/LockBanner.tsx | head -5`
Expected: Shows `bg-green-100` for open state and `bg-stone-100` for locked state

- [ ] **Step 3: Verify AC-3 — TrustStatusBar green/sand treatment (already migrated in OPS-22)**

Run: `grep -n 'green-200\|stone-' src/components/TrustStatusBar.tsx | head -5`
Expected: Shows green/stone tokens for info tone

- [ ] **Step 4: Verify AC-4 — GolferPicker card-based redesign with green left-border accents**

Run: `grep -n 'border-l-4 border-l-green-700' src/components/golfer-picker.tsx`
Expected: Match found in the selected golfer className

- [ ] **Step 5: Verify AC-5 — SubmissionConfirmation sand/cream success state**

Run: `grep -n 'bg-amber-100' src/components/SubmissionConfirmation.tsx`
Expected: Match found showing sand/cream background

- [ ] **Step 6: Verify AC-6 — SelectionSummaryCard updated card styling**

Run: `grep -n 'border-green-200\|bg-green-50' src/components/SelectionSummaryCard.tsx`
Expected: Matches for the green-themed card styling

- [ ] **Step 7: Verify AC-7 — Touch targets ≥44px**

Run: `grep -n 'min-block-size.*44' src/app/globals.css`
Expected: Shows the 44px min-block-size rules remain intact

- [ ] **Step 8: Verify AC-8 — Mobile layout preserved**

The only layout class changes are `rounded-2xl` → `rounded-3xl` (matching `panelClasses()`) and token colors. No structural layout changes. Verify by checking that no responsive breakpoint classes were removed.

- [ ] **Step 9: Verify AC-9 — No functional changes to pick submission logic**

Run: `git diff main -- src/app/\(app\)/participant/picks/\[poolId\]/actions.ts`
Expected: No changes

- [ ] **Step 10: Verify AC-10 — WCAG 2.1 AA contrast**

All new color combinations per the design spec §6.1 pass AA:
- `text-green-800` on `bg-green-50` → 6.8:1 ✅
- `text-green-950` on `bg-amber-100` → ~13.5:1 ✅
- `text-stone-900` on `bg-white` → 18.4:1 ✅
- `text-stone-600` on `bg-white` → 5.6:1 ✅

No final commit needed unless audit fixes were required.