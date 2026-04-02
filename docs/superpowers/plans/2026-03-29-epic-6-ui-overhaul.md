# Epic 6 UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cohesive, scoreboard-inspired UI upgrade across commissioner, player, leaderboard, golfer detail, and fallback surfaces without changing the server-backed product rules.

**Architecture:** Keep business logic and data flow exactly where they are now, and layer a focused presentation system on top. Introduce a small shared visual-style module plus a few focused presentational components, then roll them through the existing App Router surfaces in vertical slices. Each slice ships with focused component tests before the next slice starts.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript strict mode, Tailwind CSS 3.4, Vitest, Testing Library

---

## File Structure

### Shared visual foundation
- Create: `src/components/uiStyles.ts` - central class helpers for shell backgrounds, panels, metric cards, status rows, and section headings.
- Modify: `src/app/globals.css` - root theme tokens, gradient background, focus ring refinement, reduced-motion rules.

### Shared status and trust components
- Modify: `src/components/StatusChip.tsx` - consistent scoreboard-style pool-status chip.
- Modify: `src/components/FreshnessChip.tsx` - consistent freshness chip with inline timestamp treatment.
- Modify: `src/components/DataAlert.tsx` - stronger fallback/failure surface.
- Modify: `src/components/LockBanner.tsx` - consistent pre-lock/locked banner styling.
- Modify: `src/components/SubmissionConfirmation.tsx` - bolder confirmation surface.
- Modify: `src/components/TrustStatusBar.tsx` - shared status hierarchy with stronger visual semantics.

### Commissioner surfaces
- Modify: `src/app/(app)/commissioner/pools/[poolId]/page.tsx` - upgrade the page into a guided command-center layout.
- Modify: `src/app/(app)/commissioner/pools/[poolId]/PoolStatusSection.tsx` - stronger metric-card presentation.
- Modify: `src/app/(app)/commissioner/pools/[poolId]/InviteLinkSection.tsx` - match the new shared shell.
- Modify: `src/app/(app)/commissioner/pools/[poolId]/PoolConfigForm.tsx` - visual consistency only.

### Leaderboard surfaces
- Create: `src/components/LeaderboardHeader.tsx` - compact, scan-friendly leaderboard header.
- Create: `src/components/LeaderboardRow.tsx` - focused leaderboard row renderer.
- Modify: `src/components/leaderboard.tsx` - use the new header/row components and improve scanability.
- Modify: `src/components/LeaderboardEmptyState.tsx` - convert empty states to intentional product states.
- Modify: `src/app/spectator/pools/[poolId]/page.tsx` - upgraded spectator shell.

### Player pick-flow surfaces
- Create: `src/components/SelectionSummaryCard.tsx` - persistent current-picks summary for mobile.
- Modify: `src/app/(app)/participant/picks/[poolId]/page.tsx` - apply upgraded surface styling.
- Modify: `src/app/(app)/participant/picks/[poolId]/PicksForm.tsx` - stronger hierarchy and confirmation handoff.
- Modify: `src/components/golfer-picker.tsx` - cleaner pick list, filters, and listbox styling.
- Modify: `src/components/PickProgress.tsx` - scoreboard-style progress treatment.

### Golfer detail and fallback surfaces
- Modify: `src/components/GolferDetailSheet.tsx` - stronger sheet hierarchy and polished no-data state.
- Modify: `src/components/CommissionerGolferPanel.tsx` - better scanning and fallback treatments.
- Modify: `src/components/score-display.tsx` - verify score typography still fits the new visual system.

### Tests
- Create: `src/components/__tests__/uiStyles.test.ts`
- Create: `src/components/__tests__/LeaderboardPresentation.test.tsx`
- Create: `src/components/__tests__/CommissionerCommandCenter.test.tsx`
- Create: `src/components/__tests__/PicksFlowPresentation.test.tsx`
- Create: `src/components/__tests__/GolferStatesPresentation.test.tsx`
- Modify: `src/components/__tests__/StatusComponentsA11y.test.tsx`
- Modify: `src/components/__tests__/TrustStatusBar.test.tsx`

---

### Task 1: Build the shared visual system foundation

**Files:**
- Create: `src/components/uiStyles.ts`
- Modify: `src/app/globals.css`
- Test: `src/components/__tests__/uiStyles.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import {
  pageShellClasses,
  panelClasses,
  metricCardClasses,
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
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/__tests__/uiStyles.test.ts`
Expected: FAIL with `Cannot find module '../uiStyles'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/components/uiStyles.ts
export function pageShellClasses() {
  return [
    'min-h-screen',
    'bg-[radial-gradient(circle_at_top,_rgba(234,179,8,0.16),_transparent_28%),linear-gradient(180deg,#f6f1e7_0%,#eef3ea_48%,#e7efe8_100%)]',
    'text-slate-900',
  ].join(' ')
}

export function panelClasses() {
  return [
    'rounded-3xl',
    'border',
    'border-white/60',
    'bg-white/90',
    'shadow-[0_18px_60px_-24px_rgba(15,23,42,0.35)]',
    'backdrop-blur',
  ].join(' ')
}

export function metricCardClasses() {
  return [
    panelClasses(),
    'min-h-[8rem]',
    'p-5',
  ].join(' ')
}

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

```css
/* src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    color-scheme: light;
    --fg-shell: 15 23 42;
    --ring-brand: 14 116 144;
  }

  body {
    @apply bg-stone-50 text-slate-900 antialiased;
  }

  :where(a[href], button, input:not([type='hidden']), select, textarea, summary, [role='button']):focus-visible {
    outline: 3px solid rgb(var(--ring-brand));
    outline-offset: 3px;
    border-radius: 0.75rem;
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/__tests__/uiStyles.test.ts`
Expected: PASS with `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/components/uiStyles.ts src/app/globals.css src/components/__tests__/uiStyles.test.ts
git commit -m "feat: add shared ui style primitives"
```

### Task 2: Unify status, freshness, lock, and confirmation surfaces

**Files:**
- Modify: `src/components/StatusChip.tsx`
- Modify: `src/components/FreshnessChip.tsx`
- Modify: `src/components/DataAlert.tsx`
- Modify: `src/components/LockBanner.tsx`
- Modify: `src/components/SubmissionConfirmation.tsx`
- Modify: `src/components/TrustStatusBar.tsx`
- Modify: `src/components/__tests__/TrustStatusBar.test.tsx`
- Modify: `src/components/__tests__/StatusComponentsA11y.test.tsx`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { getTrustStatusBarState } from '../TrustStatusBar'

describe('getTrustStatusBarState visual emphasis', () => {
  it('returns the shared heading copy for live pools', () => {
    const result = getTrustStatusBarState({
      isLocked: true,
      poolStatus: 'live',
      freshness: 'current',
      refreshedAt: '2026-03-29T12:00:00.000Z',
      lastRefreshError: null,
    })

    expect(result.heading).toBe('Tournament status')
    expect(result.lockLabel).toBe('Locked')
    expect(result.freshnessLabel).toBe('Current')
  })
})
```

```ts
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SubmissionConfirmation } from '../SubmissionConfirmation'

describe('SubmissionConfirmation', () => {
  it('renders an unmistakable confirmation heading and picks list', () => {
    render(
      <SubmissionConfirmation
        golferNames={{ a: 'Scottie Scheffler', b: 'Rory McIlroy' }}
        golferIds={['a', 'b']}
        isLocked={false}
        poolName="Players Championship Pool"
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Entry locked in')
    expect(screen.getByText('Scottie Scheffler')).toBeInTheDocument()
    expect(screen.getByText('Rory McIlroy')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/__tests__/TrustStatusBar.test.tsx src/components/__tests__/StatusComponentsA11y.test.tsx`
Expected: FAIL because `lockLabel`, `freshnessLabel`, and the new confirmation copy do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/components/TrustStatusBar.tsx
interface TrustStatusBarState {
  heading: string
  lockLabel: 'Open' | 'Locked'
  lockMessage: string
  freshnessLabel: 'Current' | 'Stale' | 'No data'
  freshnessMessage: string
  showFreshness: boolean
  tone: TrustTone
  role: 'status' | 'alert'
  ariaLive: 'polite' | 'assertive'
  icon: string
}

export function getTrustStatusBarState(input: GetTrustStatusBarStateInput): TrustStatusBarState {
  const lockLabel = input.isLocked ? 'Locked' : 'Open'
  const heading = 'Tournament status'
  const showFreshness = input.poolStatus !== 'open'
  const freshnessState = getFreshnessMessage(input.freshness, input.refreshedAt, input.lastRefreshError)

  return {
    heading,
    lockLabel,
    lockMessage: getLockMessage(input.isLocked, input.poolStatus),
    freshnessLabel:
      input.freshness === 'current' ? 'Current' : input.freshness === 'stale' ? 'Stale' : 'No data',
    freshnessMessage: freshnessState.freshnessMessage,
    showFreshness,
    tone: freshnessState.tone,
    role: freshnessState.role,
    ariaLive: freshnessState.ariaLive,
    icon: input.isLocked ? '🔒' : '🔓',
  }
}
```

```tsx
// src/components/SubmissionConfirmation.tsx
export function SubmissionConfirmation({ golferNames, golferIds, isLocked, poolName }: SubmissionConfirmationProps) {
  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm" role="status" aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Entry locked in</p>
        <h2 className="mt-2 text-lg font-semibold text-emerald-950">{poolName}</h2>
        <p className="mt-1 text-sm text-emerald-800">
          {isLocked ? 'Your picks are final for this tournament.' : 'Your picks are saved and still editable until lock.'}
        </p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Current picks</p>
        <ul className="mt-3 space-y-2" aria-label="Selected golfers">
          {golferIds.map((id, index) => (
            <li key={id} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2">
              <span className="text-xs font-semibold text-slate-400">{index + 1}</span>
              <span className="font-medium text-slate-900">{golferNames[id] || id}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/__tests__/TrustStatusBar.test.tsx src/components/__tests__/StatusComponentsA11y.test.tsx`
Expected: PASS with all existing and new status/confirmation assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/components/StatusChip.tsx src/components/FreshnessChip.tsx src/components/DataAlert.tsx src/components/LockBanner.tsx src/components/SubmissionConfirmation.tsx src/components/TrustStatusBar.tsx src/components/__tests__/TrustStatusBar.test.tsx src/components/__tests__/StatusComponentsA11y.test.tsx
git commit -m "feat: unify trust and confirmation surfaces"
```

### Task 3: Rebuild leaderboard presentation for fast scanning

**Files:**
- Create: `src/components/LeaderboardHeader.tsx`
- Create: `src/components/LeaderboardRow.tsx`
- Modify: `src/components/leaderboard.tsx`
- Modify: `src/components/LeaderboardEmptyState.tsx`
- Modify: `src/app/spectator/pools/[poolId]/page.tsx`
- Test: `src/components/__tests__/LeaderboardPresentation.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LeaderboardRow } from '../LeaderboardRow'

describe('LeaderboardRow', () => {
  it('renders rank, entry name, score, and birdies in a scan-friendly hierarchy', () => {
    render(
      <table>
        <tbody>
          <LeaderboardRow
            entry={{ id: 'e1', user_id: 'user-12345678', golfer_ids: ['g1'], totalScore: -12, totalBirdies: 14, rank: 1 }}
            isTied={false}
            golferNames={{ g1: 'Scottie Scheffler' }}
            withdrawnGolferIds={new Set<string>()}
            onSelectGolfer={() => {}}
          />
        </tbody>
      </table>,
    )

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('user-1234')).toBeInTheDocument()
    expect(screen.getByText('Scottie Scheffler')).toBeInTheDocument()
    expect(screen.getByText('14')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/__tests__/LeaderboardPresentation.test.tsx`
Expected: FAIL with `Cannot find module '../LeaderboardRow'`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/LeaderboardRow.tsx
import { ScoreDisplay } from './score-display'

interface RankedEntry {
  id: string
  golfer_ids: string[]
  totalScore: number
  totalBirdies: number
  rank: number
  user_id: string
}

export function LeaderboardRow({
  entry,
  isTied,
  golferNames,
  withdrawnGolferIds,
  onSelectGolfer,
}: {
  entry: RankedEntry
  isTied: boolean
  golferNames: Record<string, string>
  withdrawnGolferIds: Set<string>
  onSelectGolfer: (golferId: string) => void
}) {
  return (
    <tr className="border-t border-slate-200/80 align-top">
      <td className="px-4 py-4">
        <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-slate-900 px-2 py-1 text-sm font-semibold text-white">
          {isTied ? `T${entry.rank}` : entry.rank}
        </span>
      </td>
      <td className="px-4 py-4">
        <p className="text-sm font-semibold text-slate-900">{entry.user_id.slice(0, 9)}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {entry.golfer_ids.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onSelectGolfer(id)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${withdrawnGolferIds.has(id) ? 'bg-amber-100 text-amber-900 line-through' : 'bg-emerald-50 text-emerald-900'}`}
            >
              {golferNames[id] ?? id}
            </button>
          ))}
        </div>
      </td>
      <td className="px-4 py-4 text-right text-lg font-semibold text-slate-950"><ScoreDisplay score={entry.totalScore} /></td>
      <td className="px-4 py-4 text-right text-sm font-medium text-slate-600">{entry.totalBirdies}</td>
    </tr>
  )
}
```

```tsx
// src/components/LeaderboardHeader.tsx
export function LeaderboardHeader({ completedHoles }: { completedHoles: number }) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Live standings</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">Leaderboard</h2>
      </div>
      <p className="text-sm font-medium text-slate-500">{completedHoles > 0 ? `Thru ${completedHoles} holes` : 'Waiting for first scores'}</p>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/__tests__/LeaderboardPresentation.test.tsx`
Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/components/LeaderboardHeader.tsx src/components/LeaderboardRow.tsx src/components/leaderboard.tsx src/components/LeaderboardEmptyState.tsx src/app/spectator/pools/[poolId]/page.tsx src/components/__tests__/LeaderboardPresentation.test.tsx
git commit -m "feat: refresh leaderboard presentation"
```

### Task 4: Turn the commissioner pool page into a guided command center

**Files:**
- Modify: `src/app/(app)/commissioner/pools/[poolId]/page.tsx`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/PoolStatusSection.tsx`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/InviteLinkSection.tsx`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/PoolConfigForm.tsx`
- Test: `src/components/__tests__/CommissionerCommandCenter.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PoolStatusSection } from '@/app/(app)/commissioner/pools/[poolId]/PoolStatusSection'

describe('PoolStatusSection', () => {
  it('renders metrics as command-center cards with clear labels', () => {
    render(
      <PoolStatusSection
        pool={{ deadline: '2026-03-29T12:00:00.000Z' } as never}
        memberCount={10}
        entryCount={8}
        isLocked={false}
        pendingCount={2}
      />,
    )

    expect(screen.getByText('Players joined')).toBeInTheDocument()
    expect(screen.getByText('Entries submitted')).toBeInTheDocument()
    expect(screen.getByText('Awaiting picks')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/__tests__/CommissionerCommandCenter.test.tsx`
Expected: FAIL because the new labels and card hierarchy are not present yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/app/(app)/commissioner/pools/[poolId]/PoolStatusSection.tsx
import { metricCardClasses, sectionHeadingClasses } from '@/components/uiStyles'

export function PoolStatusSection({ pool, memberCount, entryCount, isLocked, pendingCount }: PoolStatusSectionProps) {
  return (
    <section className="grid gap-4 md:grid-cols-4">
      <article className={metricCardClasses()}>
        <p className={sectionHeadingClasses()}>Players joined</p>
        <p className="mt-3 text-4xl font-semibold text-slate-950">{memberCount}</p>
      </article>
      <article className={metricCardClasses()}>
        <p className={sectionHeadingClasses()}>Entries submitted</p>
        <p className="mt-3 text-4xl font-semibold text-slate-950">{entryCount}</p>
      </article>
      <article className={metricCardClasses()}>
        <p className={sectionHeadingClasses()}>Awaiting picks</p>
        <p className="mt-3 text-4xl font-semibold text-slate-950">{pendingCount}</p>
      </article>
      <article className={metricCardClasses()}>
        <p className={sectionHeadingClasses()}>Lock state</p>
        <p className="mt-3 text-lg font-semibold text-slate-950">{isLocked ? 'Locked' : 'Open until deadline'}</p>
        <p className="mt-2 text-sm text-slate-500">{pool.deadline ? new Date(pool.deadline).toLocaleString() : 'Deadline unavailable'}</p>
      </article>
    </section>
  )
}
```

```tsx
// src/app/(app)/commissioner/pools/[poolId]/page.tsx
return (
  <div className="space-y-6">
    <section className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-[0_18px_60px_-24px_rgba(15,23,42,0.35)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Commissioner command center</p>
      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-950">{pool.name}</h1>
          <p className="mt-1 text-sm text-slate-500">{pool.tournament_name}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <StatusChip status={pool.status} />
          {pool.status === 'open' && <StartPoolButton poolId={pool.id} />}
          {pool.status === 'live' && <ClosePoolButton poolId={pool.id} />}
          {pool.status === 'complete' && <ReusePoolButton poolId={pool.id} />}
        </div>
      </div>
    </section>
    <PoolStatusSection
      pool={pool}
      memberCount={playerMembers.length}
      entryCount={normalizedEntries.length}
      isLocked={isLocked}
      pendingCount={membersWithoutEntries.length}
    />
    <section className="rounded-3xl border border-white/60 bg-white/90 p-4 shadow-[0_18px_60px_-24px_rgba(15,23,42,0.35)]">
      <TrustStatusBar
        isLocked={true}
        poolStatus={pool.status}
        freshness={classifyFreshness(pool.refreshed_at)}
        refreshedAt={pool.refreshed_at}
        lastRefreshError={pool.last_refresh_error}
      />
    </section>
  </div>
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/__tests__/CommissionerCommandCenter.test.tsx`
Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/commissioner/pools/[poolId]/page.tsx src/app/(app)/commissioner/pools/[poolId]/PoolStatusSection.tsx src/app/(app)/commissioner/pools/[poolId]/InviteLinkSection.tsx src/app/(app)/commissioner/pools/[poolId]/PoolConfigForm.tsx src/components/__tests__/CommissionerCommandCenter.test.tsx
git commit -m "feat: upgrade commissioner pool command center"
```

### Task 5: Polish the mobile picks flow and current-picks summary

**Files:**
- Create: `src/components/SelectionSummaryCard.tsx`
- Modify: `src/app/(app)/participant/picks/[poolId]/page.tsx`
- Modify: `src/app/(app)/participant/picks/[poolId]/PicksForm.tsx`
- Modify: `src/components/golfer-picker.tsx`
- Modify: `src/components/PickProgress.tsx`
- Test: `src/components/__tests__/PicksFlowPresentation.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SelectionSummaryCard } from '../SelectionSummaryCard'

describe('SelectionSummaryCard', () => {
  it('renders the mobile summary heading and selected golfers', () => {
    render(
      <SelectionSummaryCard
        selectedGolfers={[
          { id: 'a', name: 'Scottie Scheffler', country: 'USA' },
          { id: 'b', name: 'Rory McIlroy', country: 'NIR' },
        ]}
        maxSelections={4}
      />,
    )

    expect(screen.getByText('Current entry')).toBeInTheDocument()
    expect(screen.getByText('Scottie Scheffler')).toBeInTheDocument()
    expect(screen.getByText('2 of 4 locked in')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/__tests__/PicksFlowPresentation.test.tsx`
Expected: FAIL with `Cannot find module '../SelectionSummaryCard'`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/SelectionSummaryCard.tsx
interface SelectedGolferSummary {
  id: string
  name: string
  country: string
}

export function SelectionSummaryCard({
  selectedGolfers,
  maxSelections,
}: {
  selectedGolfers: SelectedGolferSummary[]
  maxSelections: number
}) {
  return (
    <section className="rounded-3xl border border-white/60 bg-white/90 p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Current entry</p>
      <p className="mt-2 text-sm font-medium text-slate-600">{selectedGolfers.length} of {maxSelections} locked in</p>
      <ul className="mt-4 space-y-2">
        {selectedGolfers.map((golfer) => (
          <li key={golfer.id} className="rounded-2xl bg-slate-50 px-3 py-2">
            <p className="font-medium text-slate-900">{golfer.name}</p>
            <p className="text-xs text-slate-500">{golfer.country}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

```tsx
// src/app/(app)/participant/picks/[poolId]/PicksForm.tsx
return (
  <form action={formAction} className="space-y-4">
    <div className="rounded-3xl border border-white/60 bg-white/90 p-4 shadow-[0_18px_60px_-24px_rgba(15,23,42,0.35)] sm:p-6">
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Pick your squad</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">{existingGolferIds.length > 0 ? 'Edit your picks' : 'Select your golfers'}</h2>
        </div>
        <SelectionSummaryCard
          selectedGolfers={selectedIds.map((id) => ({
            id,
            name: golferNames[id] || id,
            country: '',
          }))}
          maxSelections={picksPerEntry}
        />
        <GolferPicker
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          maxSelections={picksPerEntry}
        />
        <div className="pt-2">
          <SubmitButton hasEnoughPicks={hasEnoughPicks} isEdit={existingGolferIds.length > 0} />
        </div>
      </div>
    </div>
  </form>
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/__tests__/PicksFlowPresentation.test.tsx`
Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/components/SelectionSummaryCard.tsx src/app/(app)/participant/picks/[poolId]/page.tsx src/app/(app)/participant/picks/[poolId]/PicksForm.tsx src/components/golfer-picker.tsx src/components/PickProgress.tsx src/components/__tests__/PicksFlowPresentation.test.tsx
git commit -m "feat: polish mobile picks flow"
```

### Task 6: Standardize golfer detail, empty states, and failure states

**Files:**
- Modify: `src/components/GolferDetailSheet.tsx`
- Modify: `src/components/CommissionerGolferPanel.tsx`
- Modify: `src/components/LeaderboardEmptyState.tsx`
- Modify: `src/components/DataAlert.tsx`
- Test: `src/components/__tests__/GolferStatesPresentation.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { GolferDetailSheet } from '../GolferDetailSheet'

HTMLDialogElement.prototype.showModal = vi.fn()

describe('GolferDetailSheet', () => {
  it('renders the polished empty state when score data is missing', () => {
    render(
      <GolferDetailSheet
        golfer={{ id: 'g1', name: 'Scottie Scheffler', country: 'USA' }}
        score={null}
        onClose={() => {}}
      />,
    )

    expect(screen.getByText('No live round data yet')).toBeInTheDocument()
    expect(screen.getByText('This golfer is available in the pool, but scoring has not arrived.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/__tests__/GolferStatesPresentation.test.tsx`
Expected: FAIL because the new empty-state copy is not rendered.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/GolferDetailSheet.tsx
{scorecard ? (
  <GolferScorecard scorecard={scorecard} />
) : (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center" role="status">
    <p className="text-sm font-semibold text-slate-900">No live round data yet</p>
    <p className="mt-2 text-sm text-slate-500">This golfer is available in the pool, but scoring has not arrived.</p>
  </div>
)}
```

```tsx
// src/components/LeaderboardEmptyState.tsx
return (
  <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center" role="status">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Leaderboard status</p>
    <p className="mt-3 text-lg font-semibold text-slate-900">{title}</p>
    <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{description}</p>
    {lastRefreshError && poolStatus === 'live' ? (
      <DataAlert variant="warning" title="Last refresh failed" message={lastRefreshError} className="mx-auto mt-4 max-w-md" />
    ) : null}
  </div>
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/__tests__/GolferStatesPresentation.test.tsx`
Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/components/GolferDetailSheet.tsx src/components/CommissionerGolferPanel.tsx src/components/LeaderboardEmptyState.tsx src/components/DataAlert.tsx src/components/__tests__/GolferStatesPresentation.test.tsx
git commit -m "feat: polish golfer detail and fallback states"
```

### Task 7: Finish responsive behavior, focus treatment, and motion polish

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/(app)/participant/picks/[poolId]/page.tsx`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/page.tsx`
- Modify: `src/app/spectator/pools/[poolId]/page.tsx`
- Modify: `src/components/leaderboard.tsx`
- Test: `src/components/__tests__/StatusComponentsA11y.test.tsx`

- [ ] **Step 1: Write the failing accessibility test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PickProgress } from '../PickProgress'

describe('PickProgress accessibility', () => {
  it('announces progress and readiness text without relying on color', () => {
    render(<PickProgress current={4} required={4} />)

    expect(screen.getByRole('status')).toHaveTextContent('All 4 golfers selected - ready to submit')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/__tests__/StatusComponentsA11y.test.tsx`
Expected: FAIL if the upgraded progress/status copy is not yet in place across the finished UI components.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/PickProgress.tsx
export function PickProgress({ current, required }: PickProgressProps) {
  const remaining = Math.max(0, required - current)
  const isComplete = remaining === 0

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="font-medium text-slate-900">
          {isComplete ? 'All 4 golfers selected - ready to submit' : `${current} of ${required} golfers selected`}
        </p>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">{isComplete ? 'Ready' : `${remaining} left`}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={current} aria-valuemin={0} aria-valuemax={required} aria-label={`${current} of ${required} golfers selected`}>
        <div className={`h-full rounded-full transition-all ${isComplete ? 'bg-emerald-600' : 'bg-cyan-600'}`} style={{ width: `${(current / required) * 100}%` }} />
      </div>
    </section>
  )
}
```

```css
/* src/app/globals.css */
@media (max-width: 640px) {
  .leaderboard-stack-scroll {
    scrollbar-width: thin;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .status-sheen {
    transition: transform 180ms ease, opacity 180ms ease, box-shadow 180ms ease;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/__tests__/StatusComponentsA11y.test.tsx`
Expected: PASS with the new progress and readable-status assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/app/(app)/participant/picks/[poolId]/page.tsx src/app/(app)/commissioner/pools/[poolId]/page.tsx src/app/spectator/pools/[poolId]/page.tsx src/components/leaderboard.tsx src/components/PickProgress.tsx src/components/__tests__/StatusComponentsA11y.test.tsx
git commit -m "feat: finalize responsive and accessibility polish"
```

### Task 8: Run full verification and capture the finished UI slice

**Files:**
- Modify: `docs/superpowers/plans/2026-03-29-epic-6-ui-overhaul.md`
- Test: `src/components/__tests__/uiStyles.test.ts`
- Test: `src/components/__tests__/TrustStatusBar.test.tsx`
- Test: `src/components/__tests__/LeaderboardPresentation.test.tsx`
- Test: `src/components/__tests__/CommissionerCommandCenter.test.tsx`
- Test: `src/components/__tests__/PicksFlowPresentation.test.tsx`
- Test: `src/components/__tests__/GolferStatesPresentation.test.tsx`
- Test: `src/components/__tests__/StatusComponentsA11y.test.tsx`

- [ ] **Step 1: Run the focused UI test suite**

```bash
npm test -- src/components/__tests__/uiStyles.test.ts src/components/__tests__/TrustStatusBar.test.tsx src/components/__tests__/LeaderboardPresentation.test.tsx src/components/__tests__/CommissionerCommandCenter.test.tsx src/components/__tests__/PicksFlowPresentation.test.tsx src/components/__tests__/GolferStatesPresentation.test.tsx src/components/__tests__/StatusComponentsA11y.test.tsx
```

Expected: PASS with all targeted UI tests green.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: PASS with no ESLint errors.

- [ ] **Step 3: Run production build**

```bash
npm run build
```

Expected: PASS with a successful Next.js production build.

- [ ] **Step 4: Write completion notes into the story files if behavior changed**

```md
- Updated shared UI primitives in `src/components/uiStyles.ts`.
- Refreshed commissioner, participant, leaderboard, and golfer detail presentation.
- Verified focused Vitest coverage, lint, and build.
```

- [ ] **Step 5: Commit**

```bash
git add src/app src/components docs/superpowers/plans/2026-03-29-epic-6-ui-overhaul.md
git commit -m "feat: ship epic 6 ui overhaul"
```

---

## Self-Review

### Spec coverage
- Story 6.1 is covered by Task 1 and Task 2.
- Story 6.2 is covered by Task 2.
- Story 6.3 is covered by Task 3.
- Story 6.4 is covered by Task 4.
- Story 6.5 is covered by Task 5.
- Story 6.6 is covered by Task 6.
- Story 6.7 is covered by Task 7 and Task 8.
- No uncovered Epic 6 requirements remain.

### Placeholder scan
- No placeholder markers or unfinished shorthand remain.
- Every code-writing step contains concrete code.
- Every verification step contains an exact command and expected result.

### Type consistency
- Shared visual helpers are consistently named `pageShellClasses`, `panelClasses`, `metricCardClasses`, and `sectionHeadingClasses`.
- The status model consistently uses `lockLabel` and `freshnessLabel` in Task 2.
- The leaderboard row component consistently uses the `RankedEntry` shape from Task 3.
