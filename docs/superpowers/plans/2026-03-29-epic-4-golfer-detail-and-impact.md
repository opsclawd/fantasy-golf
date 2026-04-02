# Epic 4: Golfer Detail & Impact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build golfer detail views, per-golfer contribution displays, and commissioner golfer inspection so players understand how their picks affect standings and commissioners can troubleshoot scoring.

**Architecture:** A new pure-TypeScript domain module (`golfer-detail.ts`) computes per-golfer hole contributions and scorecard data from existing `TournamentScore` and `Entry` types. A new Supabase query module (`golfer-queries.ts`) fetches golfer + score data. New client components render a golfer detail sheet (modal/drawer), per-golfer contribution breakdown on the picks page, and a commissioner golfer inspection panel. All data flows through existing server components and the leaderboard API — no new API routes required.

**Tech Stack:** Next.js 14 App Router, TypeScript (strict), Supabase SSR, Tailwind CSS, Vitest

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/golfer-detail.ts` | Pure domain logic: golfer scorecard, per-golfer contribution to an entry's best-ball, golfer pool context |
| `src/lib/__tests__/golfer-detail.test.ts` | Tests for all golfer-detail domain functions |
| `src/lib/golfer-queries.ts` | Supabase queries: fetch golfer by ID, golfer with scores, golfers-for-pool, entries-containing-golfer |
| `src/components/GolferScorecard.tsx` | Client component: hole-by-hole scorecard for a single golfer |
| `src/components/GolferContribution.tsx` | Client component: shows how a golfer contributes to an entry's best-ball score per hole |
| `src/components/GolferDetailSheet.tsx` | Client component: modal/drawer wrapper for golfer detail (name, country, status, scorecard) |
| `src/components/EntryGolferBreakdown.tsx` | Client component: list of golfers in an entry with contribution summary |
| `src/components/CommissionerGolferPanel.tsx` | Client component: commissioner-scoped golfer inspection (who picked this golfer, their scores, entry impact) |

### Modified Files

| File | Change |
|------|--------|
| `src/app/api/leaderboard/[poolId]/route.ts` | Add golfer names to the response so the leaderboard can link to golfer detail |
| `src/components/leaderboard.tsx` | Add clickable golfer names/chips that open GolferDetailSheet |
| `src/app/(app)/participant/picks/[poolId]/page.tsx` | Add EntryGolferBreakdown below SubmissionConfirmation when pool is live/complete |
| `src/app/(app)/commissioner/pools/[poolId]/page.tsx` | Add CommissionerGolferPanel section for live/complete pools |

---

## Task 1: Golfer Scorecard Domain Logic

**Files:**
- Create: `src/lib/golfer-detail.ts`
- Test: `src/lib/__tests__/golfer-detail.test.ts`

- [ ] **Step 1: Write failing tests for `getGolferScorecard`**

This function takes a `TournamentScore` and returns a structured scorecard object.

Create `src/lib/__tests__/golfer-detail.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import type { TournamentScore, GolferStatus } from '../supabase/types'
import { getGolferScorecard } from '../golfer-detail'

function createScore(
  golferId: string,
  holes: number[],
  status: GolferStatus = 'active',
  birdies: number = 0
): TournamentScore {
  const score: Record<string, unknown> = {
    golfer_id: golferId,
    tournament_id: 't1',
    total_birdies: birdies,
    status,
  }
  for (let i = 1; i <= 18; i++) {
    score[`hole_${i}`] = i <= holes.length ? holes[i - 1] : null
  }
  return score as TournamentScore
}

describe('golfer-detail', () => {
  describe('getGolferScorecard', () => {
    it('returns hole-by-hole scores and total for an active golfer', () => {
      const score = createScore('g1', [-1, 0, 1, -2, 0, 0, 0, 0, 0], 'active', 2)
      const card = getGolferScorecard(score)

      expect(card.golferId).toBe('g1')
      expect(card.status).toBe('active')
      expect(card.totalBirdies).toBe(2)
      expect(card.holes).toHaveLength(18)
      expect(card.holes[0]).toEqual({ hole: 1, score: -1 })
      expect(card.holes[1]).toEqual({ hole: 2, score: 0 })
      expect(card.holes[2]).toEqual({ hole: 3, score: 1 })
      expect(card.holes[3]).toEqual({ hole: 4, score: -2 })
      expect(card.holes[8]).toEqual({ hole: 9, score: 0 })
      expect(card.holes[9]).toEqual({ hole: 10, score: null })
      expect(card.completedHoles).toBe(9)
      expect(card.totalScore).toBe(-2)
    })

    it('returns zero total for a golfer with no completed holes', () => {
      const score = createScore('g1', [], 'active')
      const card = getGolferScorecard(score)

      expect(card.completedHoles).toBe(0)
      expect(card.totalScore).toBe(0)
      expect(card.holes.every(h => h.score === null)).toBe(true)
    })

    it('includes status for withdrawn golfers', () => {
      const score = createScore('g1', [-1, 0], 'withdrawn', 1)
      const card = getGolferScorecard(score)

      expect(card.status).toBe('withdrawn')
      expect(card.completedHoles).toBe(2)
      expect(card.totalScore).toBe(-1)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/golfer-detail.test.ts`
Expected: FAIL with "Cannot find module '../golfer-detail'"

- [ ] **Step 3: Implement `getGolferScorecard`**

Create `src/lib/golfer-detail.ts`:

```typescript
import type { TournamentScore, GolferStatus } from './supabase/types'
import { getHoleScore } from './scoring'

export interface HoleResult {
  hole: number
  score: number | null
}

export interface GolferScorecard {
  golferId: string
  status: GolferStatus
  totalBirdies: number
  holes: HoleResult[]
  completedHoles: number
  totalScore: number
}

export function getGolferScorecard(score: TournamentScore): GolferScorecard {
  const holes: HoleResult[] = []
  let completedHoles = 0
  let totalScore = 0

  for (let i = 1; i <= 18; i++) {
    const holeScore = getHoleScore(score, i)
    holes.push({ hole: i, score: holeScore })
    if (holeScore !== null) {
      completedHoles = i
      totalScore += holeScore
    }
  }

  return {
    golferId: score.golfer_id,
    status: score.status,
    totalBirdies: score.total_birdies,
    holes,
    completedHoles,
    totalScore,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/golfer-detail.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/golfer-detail.ts src/lib/__tests__/golfer-detail.test.ts
git commit -m "feat: add getGolferScorecard domain function with tests"
```

---

## Task 2: Per-Golfer Contribution Domain Logic

**Files:**
- Modify: `src/lib/golfer-detail.ts`
- Test: `src/lib/__tests__/golfer-detail.test.ts`

- [ ] **Step 1: Write failing tests for `getGolferContribution`**

This function answers: "For each hole, did this golfer provide the best-ball score for this entry?" It compares the golfer's score to the entry's best-ball score on each hole.

Append to `src/lib/__tests__/golfer-detail.test.ts`:

```typescript
import { getGolferContribution } from '../golfer-detail'

// (inside the outer describe block, after the getGolferScorecard describe)

describe('getGolferContribution', () => {
  it('marks holes where the golfer provided the best-ball score', () => {
    const golferScores = new Map<string, TournamentScore>([
      ['g1', createScore('g1', [-1, 0, 1], 'active', 1)],
      ['g2', createScore('g2', [0, -1, 0], 'active', 1)],
    ])

    const contribution = getGolferContribution('g1', ['g1', 'g2'], golferScores)

    // Hole 1: g1=-1, g2=0 → g1 is best → contributing
    expect(contribution.holes[0]).toEqual({ hole: 1, golferScore: -1, bestBallScore: -1, isContributing: true })
    // Hole 2: g1=0, g2=-1 → g2 is best → not contributing
    expect(contribution.holes[1]).toEqual({ hole: 2, golferScore: 0, bestBallScore: -1, isContributing: false })
    // Hole 3: g1=1, g2=0 → g2 is best → not contributing
    expect(contribution.holes[2]).toEqual({ hole: 3, golferScore: 1, bestBallScore: 0, isContributing: false })
  })

  it('marks as contributing when golfer ties for best ball', () => {
    const golferScores = new Map<string, TournamentScore>([
      ['g1', createScore('g1', [-1, 0], 'active')],
      ['g2', createScore('g2', [-1, 0], 'active')],
    ])

    const contribution = getGolferContribution('g1', ['g1', 'g2'], golferScores)

    // Both tied at -1 → g1 is contributing (it matches best ball)
    expect(contribution.holes[0].isContributing).toBe(true)
  })

  it('returns null contribution when golfer is withdrawn', () => {
    const golferScores = new Map<string, TournamentScore>([
      ['g1', createScore('g1', [-1, 0], 'withdrawn', 1)],
      ['g2', createScore('g2', [0, -1], 'active', 1)],
    ])

    const contribution = getGolferContribution('g1', ['g1', 'g2'], golferScores)

    expect(contribution.isWithdrawn).toBe(true)
    // Withdrawn golfers don't contribute to best-ball
    expect(contribution.holes[0].isContributing).toBe(false)
    expect(contribution.holes[1].isContributing).toBe(false)
  })

  it('handles golfer not found in scores map', () => {
    const golferScores = new Map<string, TournamentScore>()
    const contribution = getGolferContribution('g1', ['g1'], golferScores)

    expect(contribution.isWithdrawn).toBe(false)
    expect(contribution.totalContributingHoles).toBe(0)
  })

  it('counts total contributing holes', () => {
    const golferScores = new Map<string, TournamentScore>([
      ['g1', createScore('g1', [-1, -2, 0, -1], 'active', 3)],
      ['g2', createScore('g2', [0, 0, -1, -1], 'active', 2)],
    ])

    const contribution = getGolferContribution('g1', ['g1', 'g2'], golferScores)

    // Hole 1: g1=-1 best, Hole 2: g1=-2 best, Hole 3: g2=-1 best, Hole 4: tied -1 → g1 contributing
    expect(contribution.totalContributingHoles).toBe(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/golfer-detail.test.ts`
Expected: FAIL with "'getGolferContribution' is not exported"

- [ ] **Step 3: Implement `getGolferContribution`**

Add to `src/lib/golfer-detail.ts`:

```typescript
import { getHoleScore, getEntryHoleScore } from './scoring'

export interface HoleContribution {
  hole: number
  golferScore: number | null
  bestBallScore: number | null
  isContributing: boolean
}

export interface GolferContribution {
  golferId: string
  isWithdrawn: boolean
  holes: HoleContribution[]
  totalContributingHoles: number
}

export function getGolferContribution(
  golferId: string,
  entryGolferIds: string[],
  golferScores: Map<string, TournamentScore>
): GolferContribution {
  const golferScore = golferScores.get(golferId)
  const isWithdrawn = golferScore?.status === 'withdrawn' || golferScore?.status === 'cut'

  const holes: HoleContribution[] = []
  let totalContributingHoles = 0

  for (let i = 1; i <= 18; i++) {
    const golferHoleScore = golferScore ? getHoleScore(golferScore, i) : null
    const bestBallScore = getEntryHoleScore(golferScores, entryGolferIds, i)

    // A golfer contributes if they are active, have a score, and that score equals the best-ball
    const isContributing =
      !isWithdrawn &&
      golferHoleScore !== null &&
      bestBallScore !== null &&
      golferHoleScore === bestBallScore

    if (isContributing) totalContributingHoles++

    holes.push({
      hole: i,
      golferScore: golferHoleScore,
      bestBallScore,
      isContributing,
    })
  }

  return {
    golferId,
    isWithdrawn,
    holes,
    totalContributingHoles,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/golfer-detail.test.ts`
Expected: PASS (all 8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/golfer-detail.ts src/lib/__tests__/golfer-detail.test.ts
git commit -m "feat: add getGolferContribution to compute per-golfer best-ball impact"
```

---

## Task 3: Entry Golfer Summary Domain Logic

**Files:**
- Modify: `src/lib/golfer-detail.ts`
- Test: `src/lib/__tests__/golfer-detail.test.ts`

- [ ] **Step 1: Write failing tests for `getEntryGolferSummaries`**

This function produces a summary for each golfer in an entry: their name, status, total score, and contribution count.

Append to `src/lib/__tests__/golfer-detail.test.ts`:

```typescript
import { getEntryGolferSummaries } from '../golfer-detail'
import type { Golfer } from '../supabase/types'

// (inside the outer describe block)

describe('getEntryGolferSummaries', () => {
  it('returns a summary for each golfer in the entry', () => {
    const golferScores = new Map<string, TournamentScore>([
      ['g1', createScore('g1', [-1, 0, -1], 'active', 2)],
      ['g2', createScore('g2', [0, -1, 0], 'active', 1)],
    ])

    const golfers: Golfer[] = [
      { id: 'g1', name: 'Tiger Woods', country: 'USA' },
      { id: 'g2', name: 'Rory McIlroy', country: 'NIR' },
    ]

    const summaries = getEntryGolferSummaries(
      ['g1', 'g2'],
      golferScores,
      golfers
    )

    expect(summaries).toHaveLength(2)
    expect(summaries[0].golferId).toBe('g1')
    expect(summaries[0].name).toBe('Tiger Woods')
    expect(summaries[0].totalScore).toBe(-2)
    expect(summaries[0].status).toBe('active')
    expect(summaries[0].contributingHoles).toBeGreaterThanOrEqual(0)

    expect(summaries[1].golferId).toBe('g2')
    expect(summaries[1].name).toBe('Rory McIlroy')
  })

  it('handles golfer with no score data', () => {
    const golferScores = new Map<string, TournamentScore>()
    const golfers: Golfer[] = [
      { id: 'g1', name: 'Tiger Woods', country: 'USA' },
    ]

    const summaries = getEntryGolferSummaries(['g1'], golferScores, golfers)

    expect(summaries).toHaveLength(1)
    expect(summaries[0].totalScore).toBe(0)
    expect(summaries[0].status).toBe('active')
    expect(summaries[0].contributingHoles).toBe(0)
  })

  it('handles golfer not in golfers list', () => {
    const golferScores = new Map<string, TournamentScore>([
      ['g1', createScore('g1', [-1], 'active', 1)],
    ])

    const summaries = getEntryGolferSummaries(['g1'], golferScores, [])

    expect(summaries[0].name).toBe('g1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/golfer-detail.test.ts`
Expected: FAIL with "'getEntryGolferSummaries' is not exported"

- [ ] **Step 3: Implement `getEntryGolferSummaries`**

Add to `src/lib/golfer-detail.ts`:

```typescript
import type { TournamentScore, GolferStatus, Golfer } from './supabase/types'

export interface GolferSummary {
  golferId: string
  name: string
  country: string
  status: GolferStatus
  totalScore: number
  totalBirdies: number
  completedHoles: number
  contributingHoles: number
}

export function getEntryGolferSummaries(
  entryGolferIds: string[],
  golferScores: Map<string, TournamentScore>,
  golfers: Golfer[]
): GolferSummary[] {
  const golferMap = new Map(golfers.map(g => [g.id, g]))

  return entryGolferIds.map(golferId => {
    const golfer = golferMap.get(golferId)
    const score = golferScores.get(golferId)

    const scorecard = score
      ? getGolferScorecard(score)
      : { completedHoles: 0, totalScore: 0, totalBirdies: 0, status: 'active' as GolferStatus }

    const contribution = getGolferContribution(golferId, entryGolferIds, golferScores)

    return {
      golferId,
      name: golfer?.name ?? golferId,
      country: golfer?.country ?? '',
      status: scorecard.status,
      totalScore: scorecard.totalScore,
      totalBirdies: score?.total_birdies ?? 0,
      completedHoles: scorecard.completedHoles,
      contributingHoles: contribution.totalContributingHoles,
    }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/golfer-detail.test.ts`
Expected: PASS (all 11 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/golfer-detail.ts src/lib/__tests__/golfer-detail.test.ts
git commit -m "feat: add getEntryGolferSummaries for per-golfer entry breakdown"
```

---

## Task 4: Commissioner Golfer Context Domain Logic

**Files:**
- Modify: `src/lib/golfer-detail.ts`
- Test: `src/lib/__tests__/golfer-detail.test.ts`

- [ ] **Step 1: Write failing tests for `getGolferPoolContext`**

This function answers: "Which entries in this pool include this golfer, and what is their rank and score?"

Append to `src/lib/__tests__/golfer-detail.test.ts`:

```typescript
import { getGolferPoolContext } from '../golfer-detail'
import type { Entry } from '../supabase/types'

function createEntry(id: string, golferIds: string[]): Entry {
  return {
    id,
    pool_id: 'p1',
    user_id: id,
    golfer_ids: golferIds,
    total_birdies: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

// (inside the outer describe block)

describe('getGolferPoolContext', () => {
  it('finds all entries containing a given golfer', () => {
    const entries: Entry[] = [
      createEntry('e1', ['g1', 'g2']),
      createEntry('e2', ['g3', 'g4']),
      createEntry('e3', ['g1', 'g4']),
    ]

    const context = getGolferPoolContext('g1', entries)

    expect(context.totalEntries).toBe(3)
    expect(context.entriesWithGolfer).toBe(2)
    expect(context.entryIds).toEqual(['e1', 'e3'])
    expect(context.pickRate).toBeCloseTo(2 / 3)
  })

  it('returns zero when no entries contain the golfer', () => {
    const entries: Entry[] = [
      createEntry('e1', ['g2', 'g3']),
    ]

    const context = getGolferPoolContext('g1', entries)

    expect(context.entriesWithGolfer).toBe(0)
    expect(context.entryIds).toEqual([])
    expect(context.pickRate).toBe(0)
  })

  it('handles empty entries list', () => {
    const context = getGolferPoolContext('g1', [])

    expect(context.totalEntries).toBe(0)
    expect(context.entriesWithGolfer).toBe(0)
    expect(context.pickRate).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/golfer-detail.test.ts`
Expected: FAIL with "'getGolferPoolContext' is not exported"

- [ ] **Step 3: Implement `getGolferPoolContext`**

Add to `src/lib/golfer-detail.ts`:

```typescript
import type { Entry } from './supabase/types'

export interface GolferPoolContext {
  totalEntries: number
  entriesWithGolfer: number
  entryIds: string[]
  pickRate: number
}

export function getGolferPoolContext(
  golferId: string,
  entries: Entry[]
): GolferPoolContext {
  const matchingEntries = entries.filter(e => e.golfer_ids.includes(golferId))

  return {
    totalEntries: entries.length,
    entriesWithGolfer: matchingEntries.length,
    entryIds: matchingEntries.map(e => e.id),
    pickRate: entries.length > 0 ? matchingEntries.length / entries.length : 0,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/golfer-detail.test.ts`
Expected: PASS (all 14 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/golfer-detail.ts src/lib/__tests__/golfer-detail.test.ts
git commit -m "feat: add getGolferPoolContext for commissioner golfer inspection"
```

---

## Task 5: Golfer Queries Module

**Files:**
- Create: `src/lib/golfer-queries.ts`

- [ ] **Step 1: Create `golfer-queries.ts`**

This module follows the same pattern as `scoring-queries.ts` and `pool-queries.ts`: takes a `SupabaseClient`, returns typed data.

Create `src/lib/golfer-queries.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Golfer, TournamentScore } from './supabase/types'

export async function getGolferById(
  supabase: SupabaseClient,
  golferId: string
): Promise<Golfer | null> {
  const { data } = await supabase
    .from('golfers')
    .select('*')
    .eq('id', golferId)
    .single()
  return data as Golfer | null
}

export async function getGolfersByIds(
  supabase: SupabaseClient,
  golferIds: string[]
): Promise<Golfer[]> {
  if (golferIds.length === 0) return []
  const { data } = await supabase
    .from('golfers')
    .select('*')
    .in('id', golferIds)
  return (data as Golfer[]) || []
}

export async function getGolferScoreForTournament(
  supabase: SupabaseClient,
  golferId: string,
  tournamentId: string
): Promise<TournamentScore | null> {
  const { data } = await supabase
    .from('tournament_scores')
    .select('*')
    .eq('golfer_id', golferId)
    .eq('tournament_id', tournamentId)
    .maybeSingle()
  return data as TournamentScore | null
}

export async function getAllGolfersForPool(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<{ golfers: Golfer[]; scores: TournamentScore[] }> {
  const [golferResult, scoreResult] = await Promise.all([
    supabase.from('golfers').select('*'),
    supabase
      .from('tournament_scores')
      .select('*')
      .eq('tournament_id', tournamentId),
  ])

  return {
    golfers: (golferResult.data as Golfer[]) || [],
    scores: (scoreResult.data as TournamentScore[]) || [],
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/golfer-queries.ts
git commit -m "feat: add golfer-queries module for golfer data access"
```

---

## Task 6: GolferScorecard Component

**Files:**
- Create: `src/components/GolferScorecard.tsx`

- [ ] **Step 1: Create the GolferScorecard component**

This is a client component that renders a hole-by-hole score table for a single golfer, reusing `ScoreDisplay` for formatting.

Create `src/components/GolferScorecard.tsx`:

```tsx
'use client'

import { ScoreDisplay } from './score-display'
import type { GolferScorecard as ScorecardType } from '@/lib/golfer-detail'

interface GolferScorecardProps {
  scorecard: ScorecardType
}

export function GolferScorecard({ scorecard }: GolferScorecardProps) {
  const frontNine = scorecard.holes.slice(0, 9)
  const backNine = scorecard.holes.slice(9, 18)

  const frontTotal = frontNine.reduce((sum, h) => sum + (h.score ?? 0), 0)
  const backTotal = backNine.reduce((sum, h) => sum + (h.score ?? 0), 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            Thru {scorecard.completedHoles} holes
          </span>
          {scorecard.status !== 'active' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
              {scorecard.status === 'withdrawn' ? 'WD' : 'CUT'}
            </span>
          )}
        </div>
        <div className="text-sm">
          Total: <span className="font-mono font-semibold"><ScoreDisplay score={scorecard.totalScore} /></span>
        </div>
      </div>

      {/* Front 9 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Front nine scores">
          <thead>
            <tr className="bg-gray-50">
              {frontNine.map(h => (
                <th key={h.hole} className="px-2 py-1 text-center text-xs text-gray-500 font-normal">
                  {h.hole}
                </th>
              ))}
              <th className="px-2 py-1 text-center text-xs text-gray-700 font-semibold border-l">OUT</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {frontNine.map(h => (
                <td key={h.hole} className="px-2 py-1 text-center font-mono">
                  {h.score !== null ? <ScoreDisplay score={h.score} /> : <span className="text-gray-300">-</span>}
                </td>
              ))}
              <td className="px-2 py-1 text-center font-mono font-semibold border-l">
                <ScoreDisplay score={frontTotal} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Back 9 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Back nine scores">
          <thead>
            <tr className="bg-gray-50">
              {backNine.map(h => (
                <th key={h.hole} className="px-2 py-1 text-center text-xs text-gray-500 font-normal">
                  {h.hole}
                </th>
              ))}
              <th className="px-2 py-1 text-center text-xs text-gray-700 font-semibold border-l">IN</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {backNine.map(h => (
                <td key={h.hole} className="px-2 py-1 text-center font-mono">
                  {h.score !== null ? <ScoreDisplay score={h.score} /> : <span className="text-gray-300">-</span>}
                </td>
              ))}
              <td className="px-2 py-1 text-center font-mono font-semibold border-l">
                <ScoreDisplay score={backTotal} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/GolferScorecard.tsx
git commit -m "feat: add GolferScorecard component for hole-by-hole display"
```

---

## Task 7: GolferDetailSheet Component

**Files:**
- Create: `src/components/GolferDetailSheet.tsx`

- [ ] **Step 1: Create the GolferDetailSheet component**

This is a modal/drawer that shows a golfer's name, country, status, and scorecard. It fetches data client-side from the leaderboard API (which already returns scores).

Create `src/components/GolferDetailSheet.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useRef } from 'react'
import { GolferScorecard } from './GolferScorecard'
import { getGolferScorecard } from '@/lib/golfer-detail'
import type { TournamentScore, Golfer } from '@/lib/supabase/types'

interface GolferDetailSheetProps {
  golfer: Golfer
  score: TournamentScore | null
  onClose: () => void
}

export function GolferDetailSheet({ golfer, score, onClose }: GolferDetailSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      dialog.showModal()
    }
  }, [])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) {
        onClose()
      }
    },
    [onClose]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose]
  )

  const scorecard = score ? getGolferScorecard(score) : null

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      onClose={onClose}
      className="w-full max-w-lg rounded-lg shadow-xl p-0 backdrop:bg-black/50"
      aria-label={`${golfer.name} details`}
    >
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-bold">{golfer.name}</h2>
            <p className="text-sm text-gray-500">{golfer.country}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Close golfer details"
          >
            <span aria-hidden="true" className="text-xl">&times;</span>
          </button>
        </div>

        {/* Scorecard */}
        {scorecard ? (
          <GolferScorecard scorecard={scorecard} />
        ) : (
          <div className="py-6 text-center text-gray-500 text-sm" role="status">
            No scoring data available for this golfer.
          </div>
        )}
      </div>
    </dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/GolferDetailSheet.tsx
git commit -m "feat: add GolferDetailSheet modal for golfer detail view"
```

---

## Task 8: Add Golfer Names to Leaderboard API

**Files:**
- Modify: `src/app/api/leaderboard/[poolId]/route.ts`

- [ ] **Step 1: Update the leaderboard API to include golfer name and score data**

The leaderboard API already returns `golferStatuses`. We need to also return a `golferNames` map and the full `golferScores` data so the client can open golfer detail sheets without extra fetches.

In `src/app/api/leaderboard/[poolId]/route.ts`, find the section where `golferStatuses` is built (around line 71-78) and add `golferNames`. Also add golfer names lookup and include them in the response.

After the line `const golferStatuses: Record<string, string> = {}` (line 71), add a golfer names fetch:

```typescript
    // Fetch golfer names for display
    const allGolferIds = new Set<string>()
    for (const entry of entries) {
      for (const id of (entry as { golfer_ids: string[] }).golfer_ids) {
        allGolferIds.add(id)
      }
    }

    const { data: golferRows } = await supabase
      .from('golfers')
      .select('id, name, country')
      .in('id', Array.from(allGolferIds))

    const golferNames: Record<string, string> = {}
    const golferCountries: Record<string, string> = {}
    for (const g of golferRows || []) {
      golferNames[g.id] = g.name
      golferCountries[g.id] = g.country ?? ''
    }
```

Then update both response bodies (the main success response around line 98) to include the new fields:

```typescript
    return NextResponse.json({
      data: {
        entries: ranked,
        completedHoles,
        refreshedAt: pool.refreshed_at,
        freshness,
        poolStatus: pool.status,
        lastRefreshError: pool.last_refresh_error,
        golferStatuses,
        golferNames,
        golferCountries,
        golferScores: Object.fromEntries(golferScoresMap),
      },
      error: null,
    })
```

Also update the empty-entries and empty-scores early returns to include `golferNames: {}, golferCountries: {}, golferScores: {}`.

- [ ] **Step 2: Run the existing tests to ensure nothing breaks**

Run: `npx vitest run`
Expected: All existing tests pass

- [ ] **Step 3: Commit**

```bash
git add src/app/api/leaderboard/[poolId]/route.ts
git commit -m "feat: include golfer names, countries, and scores in leaderboard API"
```

---

## Task 9: Wire Golfer Detail into Leaderboard Component

**Files:**
- Modify: `src/components/leaderboard.tsx`

- [ ] **Step 1: Update LeaderboardData interface and add golfer detail state**

In `src/components/leaderboard.tsx`, update the `LeaderboardData` interface (around line 19) to include the new fields:

```typescript
interface LeaderboardData {
  entries: RankedEntry[]
  completedHoles: number
  refreshedAt: string | null
  freshness: FreshnessStatus
  poolStatus: PoolStatus
  lastRefreshError: string | null
  golferStatuses: Record<string, string>
  golferNames: Record<string, string>
  golferCountries: Record<string, string>
  golferScores: Record<string, TournamentScore>
}
```

Add import at top of file:

```typescript
import { GolferDetailSheet } from './GolferDetailSheet'
import type { TournamentScore, Golfer } from '@/lib/supabase/types'
```

- [ ] **Step 2: Add golfer selection state and sheet rendering**

Inside the `Leaderboard` component function, after the existing state declarations (around line 44), add:

```typescript
  const [selectedGolferId, setSelectedGolferId] = useState<string | null>(null)
```

Before the final `return`, compute the selected golfer data:

```typescript
  const selectedGolfer: Golfer | null = selectedGolferId && data
    ? {
        id: selectedGolferId,
        name: data.golferNames[selectedGolferId] ?? selectedGolferId,
        country: data.golferCountries?.[selectedGolferId] ?? '',
      }
    : null

  const selectedGolferScore: TournamentScore | null =
    selectedGolferId && data?.golferScores?.[selectedGolferId]
      ? data.golferScores[selectedGolferId]
      : null
```

- [ ] **Step 3: Replace user_id display with golfer chips in each entry row**

In the table body (around line 206-215), replace the entry's golfer display cell. After the user_id cell, add a golfer names cell. Find the existing entry row that shows `{entry.user_id.slice(0, 8)}` and the WD indicator. Replace the `<td>` for the Entry column with:

```tsx
                    <td className="px-4 py-2">
                      <div className="text-sm text-gray-700 mb-1">
                        {entry.user_id.slice(0, 8)}
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {entry.golfer_ids.map(id => {
                          const isWd = withdrawnGolferIds.has(id)
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setSelectedGolferId(id)}
                              className={`px-1.5 py-0.5 rounded text-xs hover:ring-1 hover:ring-blue-400 ${
                                isWd
                                  ? 'bg-amber-50 text-amber-700 line-through'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                              aria-label={`View details for ${data?.golferNames?.[id] ?? id}`}
                            >
                              {data?.golferNames?.[id] ?? id.slice(0, 8)}
                            </button>
                          )
                        })}
                      </div>
                    </td>
```

- [ ] **Step 4: Render the GolferDetailSheet at the bottom of the component**

Just before the closing `</div>` of the main return, add:

```tsx
      {selectedGolfer && (
        <GolferDetailSheet
          golfer={selectedGolfer}
          score={selectedGolferScore}
          onClose={() => setSelectedGolferId(null)}
        />
      )}
```

- [ ] **Step 5: Run the app to verify the leaderboard still renders**

Run: `npx next build`
Expected: Build succeeds without type errors

- [ ] **Step 6: Commit**

```bash
git add src/components/leaderboard.tsx
git commit -m "feat: add clickable golfer names in leaderboard with detail sheet"
```

---

## Task 10: GolferContribution Component

**Files:**
- Create: `src/components/GolferContribution.tsx`

- [ ] **Step 1: Create the GolferContribution component**

This component shows a row for one golfer: their score, status, and a mini visual of which holes they contributed the best-ball score.

Create `src/components/GolferContribution.tsx`:

```tsx
'use client'

import { ScoreDisplay } from './score-display'
import type { GolferSummary } from '@/lib/golfer-detail'

interface GolferContributionProps {
  summary: GolferSummary
  onSelect?: (golferId: string) => void
}

export function GolferContribution({ summary, onSelect }: GolferContributionProps) {
  const isInactive = summary.status === 'withdrawn' || summary.status === 'cut'

  return (
    <button
      type="button"
      onClick={() => onSelect?.(summary.golferId)}
      className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors text-left"
      aria-label={`View ${summary.name} details`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${isInactive ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {summary.name}
          </span>
          {isInactive && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
              {summary.status === 'withdrawn' ? 'WD' : 'CUT'}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {summary.country}
          {summary.completedHoles > 0 && (
            <span className="ml-2">Thru {summary.completedHoles}</span>
          )}
          {summary.contributingHoles > 0 && (
            <span className="ml-2">
              Best ball on {summary.contributingHoles} hole{summary.contributingHoles !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      <div className="ml-3 flex items-center gap-3">
        <div className="text-right">
          <div className="font-mono text-sm font-semibold">
            <ScoreDisplay score={summary.totalScore} />
          </div>
          <div className="text-xs text-gray-400">
            {summary.totalBirdies} birdie{summary.totalBirdies !== 1 ? 's' : ''}
          </div>
        </div>
        <span className="text-gray-300 text-sm" aria-hidden="true">&rsaquo;</span>
      </div>
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/GolferContribution.tsx
git commit -m "feat: add GolferContribution component for per-golfer display"
```

---

## Task 11: EntryGolferBreakdown Component

**Files:**
- Create: `src/components/EntryGolferBreakdown.tsx`

- [ ] **Step 1: Create the EntryGolferBreakdown component**

This component lists all golfers in an entry with their contribution summaries and opens a detail sheet on click.

Note: This component accepts a serializable `Record<string, TournamentScore>` (not a `Map`) because it is a client component receiving props from a server component. Maps don't serialize across the server/client boundary.

Create `src/components/EntryGolferBreakdown.tsx`:

```tsx
'use client'

import { useState, useMemo } from 'react'
import { GolferContribution } from './GolferContribution'
import { GolferDetailSheet } from './GolferDetailSheet'
import { getEntryGolferSummaries } from '@/lib/golfer-detail'
import type { TournamentScore, Golfer } from '@/lib/supabase/types'

interface EntryGolferBreakdownProps {
  golferIds: string[]
  golfers: Golfer[]
  golferScoresRecord: Record<string, TournamentScore>
}

export function EntryGolferBreakdown({ golferIds, golfers, golferScoresRecord }: EntryGolferBreakdownProps) {
  const [selectedGolferId, setSelectedGolferId] = useState<string | null>(null)

  const golferScores = useMemo(
    () => new Map(Object.entries(golferScoresRecord)),
    [golferScoresRecord]
  )

  const summaries = useMemo(
    () => getEntryGolferSummaries(golferIds, golferScores, golfers),
    [golferIds, golferScores, golfers]
  )

  const selectedGolfer: Golfer | null = useMemo(() => {
    if (!selectedGolferId) return null
    return golfers.find(g => g.id === selectedGolferId) ?? {
      id: selectedGolferId,
      name: selectedGolferId,
      country: '',
    }
  }, [selectedGolferId, golfers])

  const selectedGolferScore = selectedGolferId
    ? golferScores.get(selectedGolferId) ?? null
    : null

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700">Your Golfers</h3>
      <div className="space-y-1.5">
        {summaries.map(summary => (
          <GolferContribution
            key={summary.golferId}
            summary={summary}
            onSelect={setSelectedGolferId}
          />
        ))}
      </div>

      {selectedGolfer && (
        <GolferDetailSheet
          golfer={selectedGolfer}
          score={selectedGolferScore}
          onClose={() => setSelectedGolferId(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/EntryGolferBreakdown.tsx
git commit -m "feat: add EntryGolferBreakdown component for entry picks view"
```

---

## Task 12: Wire EntryGolferBreakdown into Participant Picks Page (Story 4.2)

**Files:**
- Modify: `src/app/(app)/participant/picks/[poolId]/page.tsx`

- [ ] **Step 1: Fetch golfer scores and golfer data when pool is live/complete**

In `src/app/(app)/participant/picks/[poolId]/page.tsx`, add imports at the top:

```typescript
import { EntryGolferBreakdown } from '@/components/EntryGolferBreakdown'
import { getScoresForTournament } from '@/lib/scoring-queries'
import { getGolfersByIds } from '@/lib/golfer-queries'
import type { TournamentScore, Golfer } from '@/lib/supabase/types'
```

After the `existingGolferNames` block (around line 40), add data fetching for live/complete pools:

```typescript
  let golferScoresMap = new Map<string, TournamentScore>()
  let golfersList: Golfer[] = []

  const showBreakdown = hasEntry && (pool.status === 'live' || pool.status === 'complete')

  if (showBreakdown) {
    const [scores, golfers] = await Promise.all([
      getScoresForTournament(supabase, pool.tournament_id),
      getGolfersByIds(supabase, existingGolferIds),
    ])

    golferScoresMap = new Map(scores.map(s => [s.golfer_id, s]))
    golfersList = golfers
  }
```

- [ ] **Step 2: Render EntryGolferBreakdown after the SubmissionConfirmation**

Find the block that renders `<SubmissionConfirmation ... />` (around line 50-55). After the `SubmissionConfirmation` closing tag (but still inside the same branch), add:

```tsx
        {showBreakdown && (
          <div className="mt-6">
            <EntryGolferBreakdown
              golferIds={existingGolferIds}
              golfers={golfersList}
              golferScoresMap={golferScoresMap}
            />
          </div>
        )}
```

Wait — the `EntryGolferBreakdown` component expects `golferScores` (not `golferScoresMap`). However, the component is a client component and `Map` does not serialize. We need to pass it as a serializable format and reconstruct the Map inside the component.

Update `EntryGolferBreakdown` props to accept a serializable scores record instead:

In `src/components/EntryGolferBreakdown.tsx`, change the props interface:

```tsx
interface EntryGolferBreakdownProps {
  golferIds: string[]
  golfers: Golfer[]
  golferScoresRecord: Record<string, TournamentScore>
}
```

And add Map construction inside the component:

```tsx
export function EntryGolferBreakdown({ golferIds, golfers, golferScoresRecord }: EntryGolferBreakdownProps) {
  const golferScores = useMemo(
    () => new Map(Object.entries(golferScoresRecord)),
    [golferScoresRecord]
  )
  // ... rest unchanged
```

Then in the picks page, pass the serializable form:

```tsx
        {showBreakdown && (
          <div className="mt-6">
            <EntryGolferBreakdown
              golferIds={existingGolferIds}
              golfers={golfersList}
              golferScoresRecord={Object.fromEntries(golferScoresMap)}
            />
          </div>
        )}
```

- [ ] **Step 3: Build to verify no type errors**

Run: `npx next build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/participant/picks/\[poolId\]/page.tsx src/components/EntryGolferBreakdown.tsx
git commit -m "feat: show per-golfer contribution breakdown on picks page for live/complete pools"
```

---

## Task 13: CommissionerGolferPanel Component

**Files:**
- Create: `src/components/CommissionerGolferPanel.tsx`

- [ ] **Step 1: Create the CommissionerGolferPanel component**

This component shows each golfer in the pool's tournament with their pick rate and status. It allows the commissioner to click through to a detail sheet. It receives data as serializable props from the server component.

Create `src/components/CommissionerGolferPanel.tsx`:

```tsx
'use client'

import { useState, useMemo } from 'react'
import { ScoreDisplay } from './score-display'
import { GolferDetailSheet } from './GolferDetailSheet'
import { getGolferScorecard, getGolferPoolContext } from '@/lib/golfer-detail'
import type { TournamentScore, Golfer, Entry } from '@/lib/supabase/types'

interface CommissionerGolferPanelProps {
  golfers: Golfer[]
  golferScoresRecord: Record<string, TournamentScore>
  entries: Entry[]
}

export function CommissionerGolferPanel({
  golfers,
  golferScoresRecord,
  entries,
}: CommissionerGolferPanelProps) {
  const [selectedGolferId, setSelectedGolferId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const golferScores = useMemo(
    () => new Map(Object.entries(golferScoresRecord)),
    [golferScoresRecord]
  )

  // Only show golfers that appear in at least one entry
  const pickedGolferIds = useMemo(() => {
    const ids = new Set<string>()
    for (const entry of entries) {
      for (const id of entry.golfer_ids) {
        ids.add(id)
      }
    }
    return ids
  }, [entries])

  const golferMap = useMemo(
    () => new Map(golfers.map(g => [g.id, g])),
    [golfers]
  )

  const pickedGolfers = useMemo(() => {
    return Array.from(pickedGolferIds)
      .map(id => {
        const golfer = golferMap.get(id)
        const score = golferScores.get(id)
        const context = getGolferPoolContext(id, entries)
        const scorecard = score ? getGolferScorecard(score) : null

        return {
          id,
          name: golfer?.name ?? id,
          country: golfer?.country ?? '',
          status: scorecard?.status ?? 'active',
          totalScore: scorecard?.totalScore ?? 0,
          completedHoles: scorecard?.completedHoles ?? 0,
          pickRate: context.pickRate,
          entriesWithGolfer: context.entriesWithGolfer,
        }
      })
      .sort((a, b) => a.totalScore - b.totalScore)
  }, [pickedGolferIds, golferMap, golferScores, entries])

  const filteredGolfers = pickedGolfers.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase().trim())
  )

  const selectedGolfer: Golfer | null = selectedGolferId
    ? golferMap.get(selectedGolferId) ?? { id: selectedGolferId, name: selectedGolferId, country: '' }
    : null

  const selectedGolferScore = selectedGolferId
    ? golferScores.get(selectedGolferId) ?? null
    : null

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b">
        <h2 className="font-semibold">Golfer Overview ({pickedGolfers.length})</h2>
        <p className="text-xs text-gray-500 mt-1">Golfers picked by at least one entry</p>
      </div>

      <div className="p-3 border-b">
        <input
          type="text"
          placeholder="Search golfers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full p-2 border rounded text-sm"
          aria-label="Search golfers"
        />
      </div>

      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left">Golfer</th>
              <th className="px-4 py-2 text-right">Score</th>
              <th className="px-4 py-2 text-right">Picked By</th>
              <th className="px-4 py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredGolfers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                  No golfers match your search.
                </td>
              </tr>
            ) : (
              filteredGolfers.map(g => {
                const isInactive = g.status === 'withdrawn' || g.status === 'cut'
                return (
                  <tr
                    key={g.id}
                    className="border-t hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedGolferId(g.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedGolferId(g.id)
                      }
                    }}
                    aria-label={`View ${g.name} details`}
                  >
                    <td className="px-4 py-2">
                      <div className={`font-medium ${isInactive ? 'line-through text-gray-400' : ''}`}>
                        {g.name}
                      </div>
                      <div className="text-xs text-gray-400">{g.country}</div>
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      <ScoreDisplay score={g.totalScore} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      {g.entriesWithGolfer}/{entries.length}
                      <span className="text-xs text-gray-400 ml-1">
                        ({Math.round(g.pickRate * 100)}%)
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {isInactive ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                          {g.status === 'withdrawn' ? 'WD' : 'CUT'}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Active</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedGolfer && (
        <GolferDetailSheet
          golfer={selectedGolfer}
          score={selectedGolferScore}
          onClose={() => setSelectedGolferId(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CommissionerGolferPanel.tsx
git commit -m "feat: add CommissionerGolferPanel for golfer oversight and troubleshooting"
```

---

## Task 14: Wire CommissionerGolferPanel into Commissioner Pool Page (Story 4.3)

**Files:**
- Modify: `src/app/(app)/commissioner/pools/[poolId]/page.tsx`

- [ ] **Step 1: Add imports and fetch golfer score data**

At the top of `src/app/(app)/commissioner/pools/[poolId]/page.tsx`, add:

```typescript
import { CommissionerGolferPanel } from '@/components/CommissionerGolferPanel'
import { getScoresForTournament } from '@/lib/scoring-queries'
import type { TournamentScore, Golfer, Entry } from '@/lib/supabase/types'
```

After the `golferMap` construction (around line 64), add score fetching for live/complete pools:

```typescript
  const showGolferPanel = pool.status === 'live' || pool.status === 'complete'

  let golferScoresRecord: Record<string, TournamentScore> = {}
  let allGolfersList: Golfer[] = []
  let typedEntries: Entry[] = []

  if (showGolferPanel) {
    const scores = await getScoresForTournament(supabase, pool.tournament_id)
    golferScoresRecord = Object.fromEntries(scores.map(s => [s.golfer_id, s]))
    allGolfersList = (allGolfers as Golfer[]) || []
    typedEntries = normalizedEntries.map(e => ({
      id: e.id,
      pool_id: poolId,
      user_id: e.user_id,
      golfer_ids: e.golfer_ids,
      total_birdies: 0,
      created_at: e.created_at,
      updated_at: e.created_at,
    }))
  }
```

- [ ] **Step 2: Render CommissionerGolferPanel after the entries table**

After the `{/* Entries Table */}` section closing `</div>` (around line 174), and before the `{/* Pending Members */}` section, add:

```tsx
      {/* Golfer Overview (live/complete pools only) */}
      {showGolferPanel && (
        <CommissionerGolferPanel
          golfers={allGolfersList}
          golferScoresRecord={golferScoresRecord}
          entries={typedEntries}
        />
      )}
```

- [ ] **Step 3: Build to verify no type errors**

Run: `npx next build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/commissioner/pools/\[poolId\]/page.tsx
git commit -m "feat: add golfer overview panel to commissioner pool page for live/complete pools"
```

---

## Task 15: Run All Tests and Final Build

**Files:**
- None (verification only)

- [ ] **Step 1: Run all domain tests**

Run: `npx vitest run`
Expected: All tests pass (14 existing + 14 new golfer-detail tests = 28+ total)

- [ ] **Step 2: Run the full build**

Run: `npx next build`
Expected: Build succeeds with no type errors

- [ ] **Step 3: Commit any remaining fixes if needed**

If tests or build revealed issues, fix them and commit:

```bash
git add -A
git commit -m "fix: address test/build issues from Epic 4 implementation"
```

---

## Spec Coverage Verification

| Spec Requirement | Task(s) |
|---|---|
| **4.1** Golfer name, current score, pool-relevant status in detail view | Tasks 1, 6, 7 |
| **4.1** Loads quickly on mobile | Task 7 (dialog, no extra fetch) |
| **4.2** How golfers contribute to current standing | Tasks 2, 3, 10, 11 |
| **4.2** Contribution shown in clear, understandable way | Tasks 10, 11, 12 |
| **4.3** Golfer pool context, standing impact, entry details | Tasks 4, 13 |
| **4.3** Supports troubleshooting and oversight | Tasks 13, 14 (pick rate, search, status) |
| **FR25** View golfer detail information | Tasks 1, 5, 6, 7, 8, 9 |
| **FR26** See golfer contribution to standing | Tasks 2, 3, 10, 11, 12 |
| **FR27** Commissioner golfer-related pool details | Tasks 4, 13, 14 |
| **NFR4** Golfer detail loads quickly on mobile | Task 7 (reuses already-fetched data) |
| Deterministic domain-level tests | Tasks 1-4 |
| Mobile responsiveness | Tasks 6, 7, 10, 13 (responsive Tailwind) |
| Accessibility (not color alone) | Tasks 6, 7, 10, 13 (text labels, aria-labels, WD chips) |
| Trust cues (freshness, lock state, status) | Tasks 6, 7, 10, 13 (status chips, scorecard status) |
