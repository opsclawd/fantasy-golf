# Epic 3: Follow Live Standings with Trustworthy Scoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a tournament goes live, entries lock automatically at the deadline, scores refresh on a recurring cadence with failure resilience, a ranked leaderboard displays current standings with visible freshness indicators, and scoring handles ties (shared ranks) and golfer withdrawals so standings remain fair and transparent.

**Architecture:** Pure TypeScript domain logic for lock evaluation, scoring (including withdrawal and tie handling), and freshness classification — all framework-free and tested first. Supabase stores score snapshots with `refreshed_at` metadata and golfer `status` for withdrawal tracking. The existing scoring API route is extended with failure recording, last-known-good preservation, and an `entryLocked` audit trail. The `Leaderboard` client component gains freshness chips, empty/pending states, tie indicators, and withdrawal badges. A new `lockEntries` server action transitions pools from `open` to `live` when the deadline passes. Polling-based refresh is the source of truth; real-time broadcast is supplementary.

**Tech Stack:** Next.js 14.2 App Router, React 18, TypeScript strict, Supabase (`@supabase/ssr`, `@supabase/supabase-js`), Tailwind CSS 3.4, Vitest 4.1

---

## Existing Code Deficiencies (What This Plan Fixes)

These are gaps in the current codebase that Epic 3 must address:

1. **`rankEntries`** (`src/lib/scoring.ts:58-80`): Assigns sequential ranks (1, 2, 3...) — entries with identical score AND birdies get different rank numbers. Needs shared-rank logic (1, 1, 3 for ties).
2. **No withdrawal handling**: `getEntryHoleScore` returns `null` when a golfer's score is missing, and `calculateEntryTotalScore` breaks the loop. No concept of withdrawn golfer status — needs a `status` field on `tournament_scores` and scoring logic that skips withdrawn golfers' missing holes.
3. **No freshness metadata**: The leaderboard API returns `updatedAt: new Date().toISOString()` (computed at request time, not from stored data). No `refreshed_at` or `last_known_good_at` columns in the DB. The UI shows "Updated {time}" but has no stale/current classification.
4. **No failure resilience in scoring route** (`src/app/api/scoring/route.ts`): Catches errors with a console.error and returns 500. Does not preserve last-known-good state, does not record failures for commissioner review, does not write audit events.
5. **Leaderboard empty state** (`src/components/leaderboard.tsx:121-125`): Shows "No entries yet" for all empty cases. Does not distinguish "no scoring data yet" from "no entries" or explain why standings aren't available.
6. **No automatic entry locking**: The `startPool` action transitions `open` → `live` manually. No mechanism to auto-lock entries when the deadline passes — the lock check is read-time only via `isPoolLocked()`.
7. **Leaderboard has no polling**: Relies on initial fetch + real-time broadcast. No periodic polling to ensure freshness if broadcast is missed.

## File Structure

### Files to Create

| File | Responsibility |
|---|---|
| `src/lib/freshness.ts` | Pure domain logic: classify data freshness as `current` or `stale` based on `refreshedAt` and a threshold |
| `src/lib/__tests__/freshness.test.ts` | Tests for freshness classification |
| `src/lib/scoring-queries.ts` | Supabase query helpers for tournament scores and score refresh metadata |
| `src/components/FreshnessChip.tsx` | Visual chip showing current/stale status with label (not color alone) |
| `src/components/LeaderboardEmptyState.tsx` | Empty/pending state component with contextual messaging |

### Files to Modify

| File | What Changes |
|---|---|
| `src/lib/db/schema.sql` | Add `refreshed_at`, `last_refresh_error` columns to `pools`; add `status` column to `tournament_scores` |
| `src/lib/supabase/types.ts` | Add new fields to `Pool`, `TournamentScore` types; add `GolferStatus`, `FreshnessStatus` types |
| `src/lib/scoring.ts` | Add withdrawal-aware scoring, shared-rank tie handling |
| `src/lib/__tests__/scoring.test.ts` | Add tests for ties, withdrawals, withdrawal+best-ball interactions |
| `src/lib/picks.ts` | Add `lockEntries` pure logic for deadline evaluation |
| `src/lib/__tests__/picks.test.ts` | Add lock-entries tests |
| `src/lib/pool-queries.ts` | Add `lockPoolEntries`, `updatePoolRefreshMetadata` query helpers |
| `src/lib/scoring-queries.ts` | New file: score upsert, snapshot queries |
| `src/app/api/scoring/route.ts` | Add failure recording, last-known-good preservation, auto-lock check, audit events |
| `src/app/api/leaderboard/[poolId]/route.ts` | Return freshness metadata, golfer statuses, pool status info |
| `src/components/leaderboard.tsx` | Add freshness chip, empty states, tie indicators, withdrawal badges, polling |
| `src/components/LockBanner.tsx` | Enhance with auto-lock countdown/status |
| `src/app/(app)/commissioner/pools/[poolId]/page.tsx` | Show last refresh time, refresh errors, lock status |
| `src/app/spectator/pools/[poolId]/page.tsx` | Pass pool status for contextual empty states |

---

## Task 1: Schema Updates and Type Definitions

**Files:**
- Modify: `src/lib/db/schema.sql`
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: Add `refreshed_at` and `last_refresh_error` columns to `pools` table in schema.sql**

Add these columns after the `status` column in the `pools` CREATE TABLE statement:

```sql
-- At end of schema.sql, add migration comments
-- Epic 3: Add refresh metadata to pools
ALTER TABLE pools ADD COLUMN refreshed_at TIMESTAMPTZ;
ALTER TABLE pools ADD COLUMN last_refresh_error TEXT;

-- Epic 3: Add golfer status to tournament_scores
ALTER TABLE tournament_scores ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'cut'));
```

- [ ] **Step 2: Run the SQL to verify syntax**

Run: `No automated DB apply — verify the SQL is valid by visual inspection. The schema.sql is a reference document, not a migration runner.`

- [ ] **Step 3: Update TypeScript types to match schema changes**

In `src/lib/supabase/types.ts`, add the new type and update existing interfaces:

```typescript
// Add after PoolFormat type
export type GolferStatus = 'active' | 'withdrawn' | 'cut'

export type FreshnessStatus = 'current' | 'stale' | 'unknown'
```

Update the `Pool` interface to add:

```typescript
  refreshed_at: string | null
  last_refresh_error: string | null
```

Update the `TournamentScore` interface to add:

```typescript
  status: GolferStatus
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/schema.sql src/lib/supabase/types.ts
git commit -m "feat: add schema columns for refresh metadata and golfer status (Epic 3)"
```

---

## Task 2: Freshness Domain Logic

**Files:**
- Create: `src/lib/freshness.ts`
- Create: `src/lib/__tests__/freshness.test.ts`

- [ ] **Step 1: Write failing tests for freshness classification**

```typescript
// src/lib/__tests__/freshness.test.ts
import { describe, it, expect } from 'vitest'
import { classifyFreshness, DEFAULT_STALE_THRESHOLD_MS } from '../freshness'

describe('classifyFreshness', () => {
  it('returns "unknown" when refreshedAt is null', () => {
    expect(classifyFreshness(null)).toBe('unknown')
  })

  it('returns "unknown" when refreshedAt is an invalid date string', () => {
    expect(classifyFreshness('not-a-date')).toBe('unknown')
  })

  it('returns "current" when refreshedAt is within the threshold', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    expect(classifyFreshness(fiveMinutesAgo)).toBe('current')
  })

  it('returns "stale" when refreshedAt is beyond the threshold', () => {
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString()
    expect(classifyFreshness(twentyMinutesAgo)).toBe('stale')
  })

  it('uses custom threshold when provided', () => {
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString()
    // Default threshold (10 min) → current; custom 2 min → stale
    expect(classifyFreshness(threeMinutesAgo)).toBe('current')
    expect(classifyFreshness(threeMinutesAgo, 2 * 60 * 1000)).toBe('stale')
  })

  it('returns "current" at exact threshold boundary', () => {
    const exactlyAtThreshold = new Date(Date.now() - DEFAULT_STALE_THRESHOLD_MS).toISOString()
    // At boundary (<=) is stale
    expect(classifyFreshness(exactlyAtThreshold)).toBe('stale')
  })

  it('accepts explicit now parameter for deterministic testing', () => {
    const now = new Date('2026-04-10T12:00:00Z')
    const fiveMinBefore = '2026-04-10T11:55:00Z'
    const twentyMinBefore = '2026-04-10T11:40:00Z'

    expect(classifyFreshness(fiveMinBefore, DEFAULT_STALE_THRESHOLD_MS, now)).toBe('current')
    expect(classifyFreshness(twentyMinBefore, DEFAULT_STALE_THRESHOLD_MS, now)).toBe('stale')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/freshness.test.ts`
Expected: FAIL — module `../freshness` does not exist

- [ ] **Step 3: Implement freshness classification**

```typescript
// src/lib/freshness.ts
import type { FreshnessStatus } from './supabase/types'

/** Default stale threshold: 10 minutes */
export const DEFAULT_STALE_THRESHOLD_MS = 10 * 60 * 1000

/**
 * Classifies data freshness based on when it was last refreshed.
 *
 * - `current`: refreshedAt is within the threshold
 * - `stale`: refreshedAt is beyond the threshold
 * - `unknown`: refreshedAt is null or invalid
 */
export function classifyFreshness(
  refreshedAt: string | null,
  thresholdMs: number = DEFAULT_STALE_THRESHOLD_MS,
  now: Date = new Date()
): FreshnessStatus {
  if (refreshedAt === null) return 'unknown'

  const refreshedTime = Date.parse(refreshedAt)
  if (Number.isNaN(refreshedTime)) return 'unknown'

  const elapsed = now.getTime() - refreshedTime
  if (elapsed >= thresholdMs) return 'stale'

  return 'current'
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/freshness.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/freshness.ts src/lib/__tests__/freshness.test.ts
git commit -m "feat: add freshness classification domain logic"
```

---

## Task 3: Shared-Rank Tie Handling in Scoring

**Files:**
- Modify: `src/lib/scoring.ts`
- Modify: `src/lib/__tests__/scoring.test.ts`

- [ ] **Step 1: Write failing tests for shared-rank tie handling**

Add these tests to the existing `describe('rankEntries', ...)` block in `src/lib/__tests__/scoring.test.ts`:

```typescript
    it('assigns shared rank when entries have identical score and birdies', () => {
      const entries: Entry[] = [
        createEntry('e1', ['g1']),
        createEntry('e2', ['g2']),
        createEntry('e3', ['g3']),
      ]

      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScoreWithBirdies('g1', [-2, -1, 0], 3)],
        ['g2', createScoreWithBirdies('g2', [-2, -1, 0], 3)],
        ['g3', createScoreWithBirdies('g3', [0, 0, 0], 0)],
      ])

      const ranked = rankEntries(entries, golferScores, 3)

      // e1 and e2 are tied: same score (-3) and same birdies (3)
      expect(ranked[0].rank).toBe(1)
      expect(ranked[0].totalScore).toBe(-3)
      expect(ranked[1].rank).toBe(1)
      expect(ranked[1].totalScore).toBe(-3)
      // e3 skips to rank 3 (not 2)
      expect(ranked[2].rank).toBe(3)
      expect(ranked[2].totalScore).toBe(0)
    })

    it('does not share rank when score matches but birdies differ', () => {
      const entries: Entry[] = [
        createEntry('e1', ['g1']),
        createEntry('e2', ['g2']),
      ]

      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScoreWithBirdies('g1', [-2, 0, 0], 2)],
        ['g2', createScoreWithBirdies('g2', [-2, 0, 0], 1)],
      ])

      const ranked = rankEntries(entries, golferScores, 3)

      // Same score but different birdies → different ranks
      expect(ranked[0].rank).toBe(1)
      expect(ranked[0].totalBirdies).toBe(2)
      expect(ranked[1].rank).toBe(2)
      expect(ranked[1].totalBirdies).toBe(1)
    })

    it('handles three-way tie correctly', () => {
      const entries: Entry[] = [
        createEntry('e1', ['g1']),
        createEntry('e2', ['g2']),
        createEntry('e3', ['g3']),
        createEntry('e4', ['g4']),
      ]

      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScoreWithBirdies('g1', [-1, 0, 0], 1)],
        ['g2', createScoreWithBirdies('g2', [-1, 0, 0], 1)],
        ['g3', createScoreWithBirdies('g3', [-1, 0, 0], 1)],
        ['g4', createScoreWithBirdies('g4', [0, 0, 0], 0)],
      ])

      const ranked = rankEntries(entries, golferScores, 3)

      expect(ranked[0].rank).toBe(1)
      expect(ranked[1].rank).toBe(1)
      expect(ranked[2].rank).toBe(1)
      expect(ranked[3].rank).toBe(4) // skips 2 and 3
    })
```

- [ ] **Step 2: Run tests to verify the new tie tests fail**

Run: `npx vitest run src/lib/__tests__/scoring.test.ts`
Expected: The new shared-rank tests FAIL (current code assigns sequential ranks)

- [ ] **Step 3: Update `rankEntries` to use shared ranks**

Replace the ranking logic in `src/lib/scoring.ts`. Change the final `.map()` call:

```typescript
// Old code (lines 76-79):
  return withScores.map((entry, index) => ({
    ...entry,
    rank: index + 1
  }))

// New code:
  const ranked: (Entry & { totalScore: number; totalBirdies: number; rank: number })[] = []
  for (let i = 0; i < withScores.length; i++) {
    let rank: number
    if (
      i > 0 &&
      withScores[i].totalScore === withScores[i - 1].totalScore &&
      withScores[i].totalBirdies === withScores[i - 1].totalBirdies
    ) {
      rank = ranked[i - 1].rank
    } else {
      rank = i + 1
    }
    ranked.push({ ...withScores[i], rank })
  }
  return ranked
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx vitest run src/lib/__tests__/scoring.test.ts`
Expected: All PASS (including the existing test and new tie tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.ts src/lib/__tests__/scoring.test.ts
git commit -m "feat: add shared-rank tie handling to rankEntries"
```

---

## Task 4: Withdrawal-Aware Scoring

**Files:**
- Modify: `src/lib/scoring.ts`
- Modify: `src/lib/__tests__/scoring.test.ts`

- [ ] **Step 1: Write failing tests for withdrawal handling**

Add these tests to `src/lib/__tests__/scoring.test.ts`. Add `GolferStatus` to the import from `../supabase/types`. Update the `createScore` and `createScoreWithBirdies` helpers to include `status`:

First, update the helper functions at the bottom of the file:

```typescript
function createScore(golferId: string, holes: number[], status: GolferStatus = 'active'): TournamentScore {
  const score: any = {
    golfer_id: golferId,
    tournament_id: 't1',
    total_birdies: 0,
    status
  }
  for (let i = 1; i <= 18; i++) {
    score[`hole_${i}`] = i <= holes.length ? holes[i - 1] : 0
  }
  return score as TournamentScore
}

function createScoreWithBirdies(golferId: string, holes: number[], birdies: number, status: GolferStatus = 'active'): TournamentScore {
  return {
    ...createScore(golferId, holes, status),
    total_birdies: birdies
  }
}
```

Then add a new `describe` block:

```typescript
  describe('withdrawal handling', () => {
    it('skips withdrawn golfer when computing best-ball hole score', () => {
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', [-1, 0, 1])],
        ['g2', createScore('g2', [0, -1, 0], 'withdrawn')],
      ])

      // g2 is withdrawn — only g1's scores should be used
      expect(getEntryHoleScore(golferScores, ['g1', 'g2'], 1)).toBe(-1)
      expect(getEntryHoleScore(golferScores, ['g1', 'g2'], 2)).toBe(0)
    })

    it('returns null if all golfers in entry are withdrawn', () => {
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', [-1, 0], 'withdrawn')],
        ['g2', createScore('g2', [0, -1], 'withdrawn')],
      ])

      expect(getEntryHoleScore(golferScores, ['g1', 'g2'], 1)).toBe(null)
    })

    it('still includes withdrawn golfer birdies earned before withdrawal', () => {
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScoreWithBirdies('g1', [-1, 0, 0], 1)],
        ['g2', createScoreWithBirdies('g2', [-1, 0, 0], 1, 'withdrawn')],
      ])

      // Birdies include ALL golfers regardless of status — birdies were earned
      expect(calculateEntryBirdies(golferScores, ['g1', 'g2'])).toBe(2)
    })

    it('ranks entries with withdrawn golfers correctly', () => {
      const entries: Entry[] = [
        createEntry('e1', ['g1', 'g2']),
        createEntry('e2', ['g3', 'g4']),
      ]

      const golferScores = new Map<string, TournamentScore>([
        // e1: g1 active (-2 total), g2 withdrawn (scores ignored for holes)
        ['g1', createScoreWithBirdies('g1', [-1, -1, 0], 2)],
        ['g2', createScoreWithBirdies('g2', [-2, 0, 0], 1, 'withdrawn')],
        // e2: both active, best ball = -1 per hole = -3 total
        ['g3', createScoreWithBirdies('g3', [-1, 0, -1], 2)],
        ['g4', createScoreWithBirdies('g4', [0, -1, 0], 1)],
      ])

      const ranked = rankEntries(entries, golferScores, 3)

      // e2 best-ball: min(-1,0), min(0,-1), min(-1,0) = -1, -1, -1 = -3
      // e1 best-ball: only g1 active: -1, -1, 0 = -2
      expect(ranked[0].id).toBe('e2')
      expect(ranked[0].totalScore).toBe(-3)
      expect(ranked[1].id).toBe('e1')
      expect(ranked[1].totalScore).toBe(-2)
    })
  })
```

- [ ] **Step 2: Run tests to verify withdrawal tests fail**

Run: `npx vitest run src/lib/__tests__/scoring.test.ts`
Expected: Withdrawal tests FAIL (current code doesn't check `status`)

- [ ] **Step 3: Update `getEntryHoleScore` to skip withdrawn golfers**

Replace the `getEntryHoleScore` function in `src/lib/scoring.ts`:

```typescript
export function getEntryHoleScore(
  golferScores: Map<string, TournamentScore>,
  golferIds: string[],
  hole: number
): number | null {
  const scores: number[] = []
  let hasActiveGolferWithoutScore = false

  for (const id of golferIds) {
    const golferScore = golferScores.get(id)

    // Golfer not in scores map at all — no data received yet
    if (!golferScore) {
      hasActiveGolferWithoutScore = true
      continue
    }

    // Skip withdrawn/cut golfers entirely — they don't contribute to best-ball
    if (golferScore.status === 'withdrawn' || golferScore.status === 'cut') continue

    const holeScore = getHoleScore(golferScore, hole)
    if (holeScore === null) {
      hasActiveGolferWithoutScore = true
      continue
    }
    scores.push(holeScore)
  }

  // If we collected at least one valid score, use it (best ball among available)
  if (scores.length > 0) return Math.min(...scores)

  // No scores at all — either all withdrawn or no data
  return null
}
```

Note: `calculateEntryTotalScore` keeps the same break-on-null behavior because holes are sequential. `calculateEntryBirdies` stays unchanged — birdies already earned by withdrawn golfers still count.

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx vitest run src/lib/__tests__/scoring.test.ts`
Expected: All PASS

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/scoring.ts src/lib/__tests__/scoring.test.ts
git commit -m "feat: add withdrawal-aware best-ball scoring"
```

---

## Task 5: Lock-Entries Domain Logic

**Files:**
- Modify: `src/lib/picks.ts`
- Modify: `src/lib/__tests__/picks.test.ts`

- [ ] **Step 1: Write failing tests for `shouldAutoLock`**

Add a new `describe` block to `src/lib/__tests__/picks.test.ts`:

```typescript
import {
  validatePickSubmission,
  isPoolLocked,
  calculateRemainingPicks,
  shouldAutoLock,
} from '../picks'

// ... existing tests ...

describe('shouldAutoLock', () => {
  it('returns true when pool is open and deadline has passed', () => {
    expect(
      shouldAutoLock('open', '2026-04-10T08:00:00Z', new Date('2026-04-10T09:00:00Z'))
    ).toBe(true)
  })

  it('returns false when pool is open and deadline is in the future', () => {
    expect(
      shouldAutoLock('open', '2026-04-10T08:00:00Z', new Date('2026-04-10T07:00:00Z'))
    ).toBe(false)
  })

  it('returns false when pool is already live', () => {
    expect(
      shouldAutoLock('live', '2026-04-10T08:00:00Z', new Date('2026-04-10T09:00:00Z'))
    ).toBe(false)
  })

  it('returns false when pool is complete', () => {
    expect(
      shouldAutoLock('complete', '2026-04-10T08:00:00Z', new Date('2026-04-10T09:00:00Z'))
    ).toBe(false)
  })

  it('returns false when deadline is invalid', () => {
    expect(
      shouldAutoLock('open', 'not-a-date', new Date('2026-04-10T09:00:00Z'))
    ).toBe(false)
  })

  it('returns true at exact deadline moment', () => {
    expect(
      shouldAutoLock('open', '2026-04-10T08:00:00Z', new Date('2026-04-10T08:00:00Z'))
    ).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/picks.test.ts`
Expected: FAIL — `shouldAutoLock` is not exported from `../picks`

- [ ] **Step 3: Implement `shouldAutoLock`**

Add to the bottom of `src/lib/picks.ts`:

```typescript
/**
 * Determines if a pool should be automatically locked (transitioned to 'live').
 * Only returns true for 'open' pools whose deadline has passed.
 */
export function shouldAutoLock(
  status: PoolStatus,
  deadline: string,
  now: Date = new Date()
): boolean {
  if (status !== 'open') return false

  const deadlineTime = Date.parse(deadline)
  if (Number.isNaN(deadlineTime)) return false

  return now.getTime() >= deadlineTime
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/picks.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/picks.ts src/lib/__tests__/picks.test.ts
git commit -m "feat: add shouldAutoLock domain logic for deadline-based entry locking"
```

---

## Task 6: Scoring Query Helpers

**Files:**
- Create: `src/lib/scoring-queries.ts`
- Modify: `src/lib/pool-queries.ts`

- [ ] **Step 1: Create the scoring query helper module**

```typescript
// src/lib/scoring-queries.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { TournamentScore } from './supabase/types'

export async function upsertTournamentScore(
  supabase: SupabaseClient,
  score: Omit<TournamentScore, 'status'> & { status?: string }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('tournament_scores')
    .upsert(score, { onConflict: 'golfer_id,tournament_id' })
  if (error) return { error: error.message }
  return { error: null }
}

export async function getScoresForTournament(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<TournamentScore[]> {
  const { data } = await supabase
    .from('tournament_scores')
    .select('*')
    .eq('tournament_id', tournamentId)
  return (data as TournamentScore[]) || []
}

export async function updateGolferStatus(
  supabase: SupabaseClient,
  golferId: string,
  tournamentId: string,
  status: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('tournament_scores')
    .update({ status })
    .eq('golfer_id', golferId)
    .eq('tournament_id', tournamentId)
  if (error) return { error: error.message }
  return { error: null }
}
```

- [ ] **Step 2: Add pool refresh metadata query helpers to `pool-queries.ts`**

Add these functions to the end of `src/lib/pool-queries.ts`:

```typescript
export async function updatePoolRefreshMetadata(
  supabase: SupabaseClient,
  poolId: string,
  metadata: { refreshed_at?: string; last_refresh_error?: string | null }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('pools')
    .update(metadata)
    .eq('id', poolId)
  if (error) return { error: error.message }
  return { error: null }
}

export async function getActivePool(
  supabase: SupabaseClient
): Promise<Pool | null> {
  const { data } = await supabase
    .from('pools')
    .select('*')
    .eq('status', 'live')
    .limit(1)
    .maybeSingle()
  return data as Pool | null
}

export async function getOpenPoolsPastDeadline(
  supabase: SupabaseClient,
  now: Date = new Date()
): Promise<Pool[]> {
  const { data } = await supabase
    .from('pools')
    .select('*')
    .eq('status', 'open')
    .lte('deadline', now.toISOString())
  return (data as Pool[]) || []
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/scoring-queries.ts src/lib/pool-queries.ts
git commit -m "feat: add scoring and pool refresh query helpers"
```

---

## Task 7: Resilient Scoring API Route

**Files:**
- Modify: `src/app/api/scoring/route.ts`

This is the core of Story 3.2: the scoring route must handle failures gracefully, preserve last-known-good state, record audit events, and auto-lock pools that pass their deadline.

- [ ] **Step 1: Rewrite the scoring API route**

Replace the entire contents of `src/app/api/scoring/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTournamentScores } from '@/lib/slash-golf/client'
import { rankEntries } from '@/lib/scoring'
import { shouldAutoLock } from '@/lib/picks'
import {
  getActivePool,
  getOpenPoolsPastDeadline,
  updatePoolStatus,
  updatePoolRefreshMetadata,
  insertAuditEvent,
} from '@/lib/pool-queries'
import {
  upsertTournamentScore,
  getScoresForTournament,
} from '@/lib/scoring-queries'
import type { TournamentScore } from '@/lib/supabase/types'

let isUpdating = false

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (isUpdating) {
    return NextResponse.json({ message: 'Update in progress' }, { status: 409 })
  }
  isUpdating = true

  try {
    const supabase = await createClient()

    // Step 1: Auto-lock any open pools past their deadline
    const poolsToLock = await getOpenPoolsPastDeadline(supabase)
    for (const pool of poolsToLock) {
      const { error } = await updatePoolStatus(supabase, pool.id, 'live', 'open')
      if (!error) {
        await insertAuditEvent(supabase, {
          pool_id: pool.id,
          user_id: null,
          action: 'entryLocked',
          details: { reason: 'deadline_passed', deadline: pool.deadline },
        })
      }
    }

    // Step 2: Find the active (live) pool to refresh scores for
    const pool = await getActivePool(supabase)
    if (!pool) {
      return NextResponse.json({ data: { message: 'No live pool' }, error: null })
    }

    // Step 3: Fetch scores from external API
    let slashScores
    try {
      slashScores = await getTournamentScores(pool.tournament_id)
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error'

      // Record the failure but preserve last-known-good state
      await updatePoolRefreshMetadata(supabase, pool.id, {
        last_refresh_error: errorMessage,
      })

      await insertAuditEvent(supabase, {
        pool_id: pool.id,
        user_id: null,
        action: 'scoreRefreshFailed',
        details: { error: errorMessage },
      })

      return NextResponse.json(
        { data: null, error: { code: 'FETCH_FAILED', message: errorMessage } },
        { status: 502 }
      )
    }

    // Step 4: Upsert scores into DB
    for (const score of slashScores) {
      const holeScores: Record<string, number | null> = {}
      for (let i = 1; i <= 18; i++) {
        holeScores[`hole_${i}`] = score.hole_scores[i - 1] ?? null
      }

      await upsertTournamentScore(supabase, {
        golfer_id: score.golfer_id,
        tournament_id: pool.tournament_id,
        ...holeScores,
        total_birdies: countBirdies(score.hole_scores),
      } as any)
    }

    // Step 5: Update refresh metadata (success)
    const refreshedAt = new Date().toISOString()
    await updatePoolRefreshMetadata(supabase, pool.id, {
      refreshed_at: refreshedAt,
      last_refresh_error: null,
    })

    // Step 6: Compute and broadcast ranked leaderboard
    const allScores = await getScoresForTournament(supabase, pool.tournament_id)

    const { data: entries } = await supabase
      .from('entries')
      .select('*')
      .eq('pool_id', pool.id)

    const golferScoresMap = new Map<string, TournamentScore>()
    for (const score of allScores) {
      golferScoresMap.set(score.golfer_id, score)
    }

    const completedHoles = slashScores.length > 0
      ? Math.min(...slashScores.map(s => s.thru))
      : 0

    const ranked = rankEntries(entries || [], golferScoresMap, completedHoles)

    // Broadcast via Supabase real-time
    await supabase.channel('pool_updates').send({
      type: 'broadcast',
      event: 'scores',
      payload: { ranked, completedHoles, updatedAt: refreshedAt },
    })

    await insertAuditEvent(supabase, {
      pool_id: pool.id,
      user_id: null,
      action: 'scoreRefreshCompleted',
      details: { completedHoles, entryCount: (entries || []).length },
    })

    return NextResponse.json({
      data: { completedHoles, refreshedAt },
      error: null,
    })
  } catch (error) {
    console.error('Scoring update failed:', error)
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Update failed',
        },
      },
      { status: 500 }
    )
  } finally {
    isUpdating = false
  }
}

function countBirdies(holeScores: (number | null)[]): number {
  return holeScores.filter(s => s !== null && s < 0).length
}
```

- [ ] **Step 2: Run the full test suite to check for regressions**

Run: `npx vitest run`
Expected: All tests pass (the cron route test may need adjustment if it checks response shape)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/scoring/route.ts
git commit -m "feat: add failure resilience, auto-lock, and audit events to scoring route"
```

---

## Task 8: Enhanced Leaderboard API Route

**Files:**
- Modify: `src/app/api/leaderboard/[poolId]/route.ts`

The leaderboard API must return freshness metadata, pool status, and golfer statuses so the UI can render trust cues.

- [ ] **Step 1: Rewrite the leaderboard API route**

Replace the entire contents of `src/app/api/leaderboard/[poolId]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rankEntries } from '@/lib/scoring'
import { classifyFreshness } from '@/lib/freshness'
import type { TournamentScore } from '@/lib/supabase/types'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ poolId: string }> }
) {
  const { poolId } = await params
  const supabase = await createClient()

  try {
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('*')
      .eq('id', poolId)
      .single()

    if (poolError || !pool) {
      return NextResponse.json(
        { data: null, error: { code: 'NOT_FOUND', message: 'Pool not found' } },
        { status: 404 }
      )
    }

    const freshness = classifyFreshness(pool.refreshed_at)

    const { data: entries } = await supabase
      .from('entries')
      .select('*')
      .eq('pool_id', poolId)

    if (!entries || entries.length === 0) {
      return NextResponse.json({
        data: {
          entries: [],
          completedHoles: 0,
          refreshedAt: pool.refreshed_at,
          freshness,
          poolStatus: pool.status,
          lastRefreshError: pool.last_refresh_error,
          golferStatuses: {},
        },
        error: null,
      })
    }

    const { data: allScores } = await supabase
      .from('tournament_scores')
      .select('*')
      .eq('tournament_id', pool.tournament_id)

    if (!allScores || allScores.length === 0) {
      return NextResponse.json({
        data: {
          entries: [],
          completedHoles: 0,
          refreshedAt: pool.refreshed_at,
          freshness,
          poolStatus: pool.status,
          lastRefreshError: pool.last_refresh_error,
          golferStatuses: {},
        },
        error: null,
      })
    }

    const golferScoresMap = new Map<string, TournamentScore>()
    const golferStatuses: Record<string, string> = {}
    for (const score of allScores) {
      const ts = score as TournamentScore
      golferScoresMap.set(ts.golfer_id, ts)
      if (ts.status !== 'active') {
        golferStatuses[ts.golfer_id] = ts.status
      }
    }

    // Calculate completed holes from DB scores
    const completedScores = allScores.filter(s => s.hole_1 !== null)
    const completedHoles =
      completedScores.length > 0
        ? Math.min(
            ...completedScores.map(s => {
              let thru = 0
              for (let i = 1; i <= 18; i++) {
                if ((s as any)[`hole_${i}`] !== null) thru = i
                else break
              }
              return thru
            })
          )
        : 0

    const ranked = rankEntries(entries, golferScoresMap, completedHoles)

    return NextResponse.json({
      data: {
        entries: ranked,
        completedHoles,
        refreshedAt: pool.refreshed_at,
        freshness,
        poolStatus: pool.status,
        lastRefreshError: pool.last_refresh_error,
        golferStatuses,
      },
      error: null,
    })
  } catch (error) {
    console.error('Leaderboard fetch failed:', error)
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch leaderboard',
        },
      },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/leaderboard/[poolId]/route.ts
git commit -m "feat: return freshness metadata and golfer statuses from leaderboard API"
```

---

## Task 9: FreshnessChip Component

**Files:**
- Create: `src/components/FreshnessChip.tsx`

- [ ] **Step 1: Create the FreshnessChip component**

```typescript
// src/components/FreshnessChip.tsx
import type { FreshnessStatus } from '@/lib/supabase/types'

const FRESHNESS_CONFIG: Record<
  FreshnessStatus,
  { label: string; icon: string; classes: string; srText: string }
> = {
  current: {
    label: 'Current',
    icon: '\u2713', // checkmark
    classes: 'bg-green-100 text-green-800',
    srText: 'Data is current',
  },
  stale: {
    label: 'Stale',
    icon: '\u26A0', // warning
    classes: 'bg-amber-100 text-amber-800',
    srText: 'Data may be outdated',
  },
  unknown: {
    label: 'No data yet',
    icon: '\u2014', // em dash
    classes: 'bg-gray-100 text-gray-600',
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
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.classes}`}
      role="status"
      aria-label={config.srText}
    >
      <span aria-hidden="true">{config.icon}</span>
      <span>{config.label}</span>
      {timeLabel && (
        <span className="text-xs opacity-75 ml-1">{timeLabel}</span>
      )}
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/FreshnessChip.tsx
git commit -m "feat: add FreshnessChip component for current/stale/unknown indicators"
```

---

## Task 10: LeaderboardEmptyState Component

**Files:**
- Create: `src/components/LeaderboardEmptyState.tsx`

- [ ] **Step 1: Create the empty state component**

```typescript
// src/components/LeaderboardEmptyState.tsx
import type { PoolStatus } from '@/lib/supabase/types'

interface LeaderboardEmptyStateProps {
  poolStatus: PoolStatus
  hasEntries: boolean
  hasScores: boolean
  lastRefreshError: string | null
}

export function LeaderboardEmptyState({
  poolStatus,
  hasEntries,
  hasScores,
  lastRefreshError,
}: LeaderboardEmptyStateProps) {
  let title: string
  let description: string

  if (poolStatus === 'open') {
    title = 'Waiting for tournament to start'
    description = hasEntries
      ? 'Entries have been submitted. Standings will appear once the tournament goes live and scoring begins.'
      : 'No entries submitted yet. Share the invite link so players can join and make their picks.'
  } else if (!hasEntries) {
    title = 'No entries in this pool'
    description = 'This pool has no entries. Standings cannot be calculated without participants.'
  } else if (!hasScores) {
    title = 'Waiting for scores'
    description = 'The tournament is live but no scoring data has been received yet. Standings will appear once the first scores come in.'
  } else {
    title = 'Standings unavailable'
    description = 'We were unable to compute standings. This is likely a temporary issue.'
  }

  return (
    <div className="p-8 text-center" role="status">
      <p className="text-lg font-medium text-gray-700">{title}</p>
      <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">{description}</p>
      {lastRefreshError && poolStatus === 'live' && (
        <div
          className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800"
          role="alert"
        >
          <span aria-hidden="true">{'\u26A0'}</span>
          <span>Last refresh failed: {lastRefreshError}</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/LeaderboardEmptyState.tsx
git commit -m "feat: add contextual LeaderboardEmptyState component"
```

---

## Task 11: Enhanced Leaderboard Client Component

**Files:**
- Modify: `src/components/leaderboard.tsx`

This is the primary UI for Stories 3.3, 3.4, and 3.5. It must show ranked standings with tie indicators, withdrawal badges, freshness chips, polling-based refresh, and empty states.

- [ ] **Step 1: Rewrite the Leaderboard component**

Replace the entire contents of `src/components/leaderboard.tsx`:

```typescript
'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ScoreDisplay } from './score-display'
import { FreshnessChip } from './FreshnessChip'
import { LeaderboardEmptyState } from './LeaderboardEmptyState'
import type { FreshnessStatus, PoolStatus } from '@/lib/supabase/types'

interface RankedEntry {
  id: string
  golfer_ids: string[]
  totalScore: number
  totalBirdies: number
  rank: number
  user_id: string
}

interface LeaderboardData {
  entries: RankedEntry[]
  completedHoles: number
  refreshedAt: string | null
  freshness: FreshnessStatus
  poolStatus: PoolStatus
  lastRefreshError: string | null
  golferStatuses: Record<string, string>
}

interface LeaderboardProps {
  poolId: string
  /** Polling interval in milliseconds. Default: 30 seconds */
  pollInterval?: number
}

const DEFAULT_POLL_INTERVAL = 30_000

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function Leaderboard({ poolId, pollInterval = DEFAULT_POLL_INTERVAL }: LeaderboardProps) {
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/leaderboard/${poolId}`)
      const json = await res.json()

      if (json.data) {
        setData(json.data)
        setFetchError(null)
      } else if (json.error) {
        setFetchError(json.error.message || 'Failed to load leaderboard')
      } else {
        // Legacy response format (backwards compat during rollout)
        if (json.entries) {
          setData({
            entries: json.entries,
            completedHoles: json.completedHoles ?? 0,
            refreshedAt: json.updatedAt ?? null,
            freshness: 'unknown',
            poolStatus: 'live',
            lastRefreshError: null,
            golferStatuses: {},
          })
        }
      }
    } catch {
      setFetchError('Network error loading leaderboard')
    } finally {
      setLoading(false)
    }
  }, [poolId])

  useEffect(() => {
    fetchLeaderboard()

    // Polling: refetch on interval
    const intervalId = setInterval(fetchLeaderboard, pollInterval)

    // Real-time: supplementary live updates
    const channel = supabase
      .channel('pool_updates')
      .on('broadcast', { event: 'scores' }, (payload: unknown) => {
        if (!isObject(payload) || !isObject(payload.payload)) return

        const p = payload.payload as Record<string, unknown>
        if (!Array.isArray(p.ranked)) return

        // On broadcast, trigger a fresh fetch to get full metadata
        fetchLeaderboard()
      })
      .subscribe()

    return () => {
      clearInterval(intervalId)
      supabase.removeChannel(channel)
    }
  }, [poolId, pollInterval, fetchLeaderboard, supabase])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500" role="status">
        Loading leaderboard...
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center" role="alert">
        <p className="text-red-600 font-medium">Unable to load leaderboard</p>
        <p className="text-sm text-gray-500 mt-1">{fetchError}</p>
      </div>
    )
  }

  if (!data) return null

  const { entries, completedHoles, refreshedAt, freshness, poolStatus, lastRefreshError, golferStatuses } = data
  const hasEntries = entries.length > 0
  const hasScores = completedHoles > 0

  // Detect which golfer IDs in entries are withdrawn
  const withdrawnGolferIds = new Set(
    Object.entries(golferStatuses)
      .filter(([, status]) => status === 'withdrawn' || status === 'cut')
      .map(([id]) => id)
  )

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <h2 className="text-lg font-semibold">Leaderboard</h2>
          <div className="flex items-center gap-3 flex-wrap">
            <FreshnessChip status={freshness} refreshedAt={refreshedAt} />
            {completedHoles > 0 && (
              <span className="text-sm text-gray-500">
                Thru {completedHoles} holes
              </span>
            )}
          </div>
        </div>
        {lastRefreshError && poolStatus === 'live' && (
          <div
            className="mt-2 flex items-center gap-1.5 text-sm text-amber-700"
            role="alert"
          >
            <span aria-hidden="true">{'\u26A0'}</span>
            <span>Scores may be delayed: {lastRefreshError}</span>
          </div>
        )}
      </div>

      {/* Content */}
      {!hasEntries || !hasScores ? (
        <LeaderboardEmptyState
          poolStatus={poolStatus}
          hasEntries={hasEntries}
          hasScores={hasScores}
          lastRefreshError={lastRefreshError}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm">Rank</th>
                <th className="px-4 py-2 text-left text-sm">Entry</th>
                <th className="px-4 py-2 text-right text-sm">Score</th>
                <th className="px-4 py-2 text-right text-sm">Birdies</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => {
                const isTied =
                  (index > 0 && entries[index - 1].rank === entry.rank) ||
                  (index < entries.length - 1 && entries[index + 1]?.rank === entry.rank)

                const entryHasWithdrawnGolfer = entry.golfer_ids.some(id =>
                  withdrawnGolferIds.has(id)
                )

                return (
                  <tr key={entry.id} className="border-t">
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1 text-center rounded text-sm ${
                          entry.rank === 1
                            ? 'bg-yellow-100 text-yellow-800'
                            : entry.rank === 2
                              ? 'bg-gray-100 text-gray-800'
                              : entry.rank === 3
                                ? 'bg-orange-100 text-orange-800'
                                : ''
                        }`}
                      >
                        {isTied ? `T${entry.rank}` : entry.rank}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-sm text-gray-700">
                        {entry.user_id.slice(0, 8)}
                      </div>
                      {entryHasWithdrawnGolfer && (
                        <span className="inline-flex items-center gap-1 mt-0.5 text-xs text-amber-700">
                          <span aria-hidden="true">{'\u26A0'}</span>
                          WD
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      <ScoreDisplay score={entry.totalScore} />
                    </td>
                    <td className="px-4 py-2 text-right">{entry.totalBirdies}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/components/leaderboard.tsx
git commit -m "feat: add freshness chip, ties, withdrawals, polling, and empty states to Leaderboard"
```

---

## Task 12: Update Spectator Page with Pool Status Context

**Files:**
- Modify: `src/app/spectator/pools/[poolId]/page.tsx`

- [ ] **Step 1: Update the spectator page to pass pool context**

Replace the contents of `src/app/spectator/pools/[poolId]/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { Leaderboard } from '@/components/leaderboard'
import { StatusChip } from '@/components/StatusChip'
import { notFound } from 'next/navigation'

export default async function SpectatorPage({
  params,
}: {
  params: Promise<{ poolId: string }>
}) {
  const { poolId } = await params
  const supabase = await createClient()

  const { data: pool } = await supabase
    .from('pools')
    .select('*')
    .eq('id', poolId)
    .single()

  if (!pool) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{pool.name}</h1>
              <p className="text-gray-500">{pool.tournament_name}</p>
            </div>
            <StatusChip status={pool.status} />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Leaderboard poolId={poolId} />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/spectator/pools/[poolId]/page.tsx
git commit -m "feat: add pool status chip to spectator leaderboard page"
```

---

## Task 13: Commissioner Pool Detail — Refresh Status and Lock Display

**Files:**
- Modify: `src/app/(app)/commissioner/pools/[poolId]/page.tsx`

The commissioner needs to see: last refresh time, refresh errors, and lock state on their pool detail page.

- [ ] **Step 1: Add refresh status section to commissioner pool detail**

In `src/app/(app)/commissioner/pools/[poolId]/page.tsx`, add the `FreshnessChip` import and a new section after the `PoolStatusSection`. Add this import at the top:

```typescript
import { FreshnessChip } from '@/components/FreshnessChip'
import { classifyFreshness } from '@/lib/freshness'
```

Then add this section after the `{/* Pool Status Summary */}` section (after the `<PoolStatusSection ... />` component):

```typescript
      {/* Scoring Refresh Status (only for live/complete pools) */}
      {pool.status !== 'open' && (
        <div className="bg-white rounded-lg shadow p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-gray-700">Scoring Status</h3>
            <FreshnessChip
              status={classifyFreshness(pool.refreshed_at)}
              refreshedAt={pool.refreshed_at}
            />
          </div>
          {pool.last_refresh_error && (
            <div
              className="flex items-center gap-1.5 text-sm text-amber-700 bg-amber-50 rounded-lg p-3"
              role="alert"
            >
              <span aria-hidden="true">{'\u26A0'}</span>
              <span>Last refresh error: {pool.last_refresh_error}</span>
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(app)/commissioner/pools/[poolId]/page.tsx
git commit -m "feat: show scoring refresh status and errors on commissioner pool detail"
```

---

## Task 14: Integration Tests for Lock and Freshness Logic

**Files:**
- Modify: `src/lib/__tests__/scoring.test.ts`
- Modify: `src/lib/__tests__/freshness.test.ts`

Add additional edge-case tests to increase coverage of the domain logic.

- [ ] **Step 1: Add edge-case tests for scoring with empty entries**

Add to `src/lib/__tests__/scoring.test.ts`:

```typescript
    it('returns empty array when no entries are provided', () => {
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', [-1, 0, 1])],
      ])

      const ranked = rankEntries([], golferScores, 3)
      expect(ranked).toEqual([])
    })

    it('ranks a single entry as rank 1', () => {
      const entries: Entry[] = [createEntry('e1', ['g1'])]

      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScoreWithBirdies('g1', [-1, 0, 1], 1)],
      ])

      const ranked = rankEntries(entries, golferScores, 3)
      expect(ranked).toHaveLength(1)
      expect(ranked[0].rank).toBe(1)
      expect(ranked[0].totalScore).toBe(0)
    })

    it('handles entry where all golfers are withdrawn', () => {
      const entries: Entry[] = [
        createEntry('e1', ['g1', 'g2']),
        createEntry('e2', ['g3']),
      ]

      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScoreWithBirdies('g1', [-1, 0, 0], 1, 'withdrawn')],
        ['g2', createScoreWithBirdies('g2', [-1, 0, 0], 1, 'withdrawn')],
        ['g3', createScoreWithBirdies('g3', [-1, -1, 0], 2)],
      ])

      const ranked = rankEntries(entries, golferScores, 3)
      // e1 has totalScore = 0 (no active golfers → all null holes → break immediately)
      // e2 has totalScore = -2
      expect(ranked[0].id).toBe('e2')
      expect(ranked[0].totalScore).toBe(-2)
      expect(ranked[1].id).toBe('e1')
      expect(ranked[1].totalScore).toBe(0)
    })
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/scoring.test.ts
git commit -m "test: add edge-case tests for empty entries, single entry, and all-withdrawn scoring"
```

---

## Task 15: Cron Route Test Update

**Files:**
- Modify: `src/app/api/cron/scoring/route.test.ts`

The cron route test may need updating if it checks the response shape from the scoring route.

- [ ] **Step 1: Read the existing cron route test**

Read `src/app/api/cron/scoring/route.test.ts` to determine if it checks response shape.

- [ ] **Step 2: Update the test if needed**

If the test checks the scoring route response body, update expectations to match the new `{ data, error }` format. If it only checks status codes, it should still pass.

- [ ] **Step 3: Run cron route test**

Run: `npx vitest run src/app/api/cron/scoring/route.test.ts`
Expected: PASS

- [ ] **Step 4: Commit (if changes were needed)**

```bash
git add src/app/api/cron/scoring/route.test.ts
git commit -m "test: update cron route test for new scoring response format"
```

---

## Task 16: Full Test Suite Verification and Schema Update

- [ ] **Step 1: Run the complete test suite**

Run: `npx vitest run --coverage`
Expected: All tests pass with coverage report

- [ ] **Step 2: Run TypeScript type checking**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Run ESLint**

Run: `npx next lint`
Expected: No errors

- [ ] **Step 4: Update the schema.sql reference file**

Ensure `src/lib/db/schema.sql` includes the new columns inline in the CREATE TABLE statements (not just ALTER TABLE). Update the `pools` table to include `refreshed_at` and `last_refresh_error`. Update `tournament_scores` to include `status`.

In `src/lib/db/schema.sql`, update the `pools` CREATE TABLE to add before `created_at`:

```sql
  refreshed_at TIMESTAMPTZ,
  last_refresh_error TEXT,
```

Update the `tournament_scores` CREATE TABLE to add before the UNIQUE constraint:

```sql
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'cut')),
```

Remove the ALTER TABLE statements added in Task 1 (they were for migration; the schema.sql should be the canonical full schema).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schema.sql
git commit -m "chore: update canonical schema.sql with Epic 3 columns"
```

---

## Summary of Story Coverage

| Story | What's Implemented | Tasks |
|---|---|---|
| **3.1: Lock entries at tee time** | `shouldAutoLock` domain logic; auto-lock in scoring route; `entryLocked` audit event; `isPoolLocked` already exists for read-time enforcement | Tasks 5, 7 |
| **3.2: Refresh scores on a recurring cadence** | Resilient scoring route with failure recording, last-known-good preservation, audit events; `updatePoolRefreshMetadata` query | Tasks 6, 7 |
| **3.3: Display the live leaderboard** | Enhanced Leaderboard component with ranked table, tie indicators (`T1`), empty states, polling refresh | Tasks 10, 11, 12 |
| **3.4: Show current vs stale data** | `classifyFreshness` domain logic; `FreshnessChip` component; freshness in API response; commissioner refresh status panel | Tasks 2, 8, 9, 11, 13 |
| **3.5: Surface score changes, ties, and withdrawals** | Shared-rank tie handling; withdrawal-aware `getEntryHoleScore`; `golferStatuses` in API; WD badges in UI | Tasks 3, 4, 8, 11 |
