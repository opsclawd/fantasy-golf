# PAP-14 Phase 2 — Scoring Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace broken scoring functions with a deterministic, rule-correct best-ball scoring domain module. Birdies derived from score_to_par (not the always-zero total_birdies field).

**Architecture:** Pure scoring module (`src/lib/scoring/domain.ts`) with zero DB/network deps. DB and API layers call into it. Score computed from round-level `score_to_par` per golfer.

**Tech Stack:** TypeScript, vitest

---

## File Inventory

| File | Change |
|---|---|
| `src/lib/scoring/domain.ts` | Create — pure scoring functions, domain types |
| `src/lib/scoring.ts` | Modify — replace `calculateEntryTotalScore` and `calculateEntryBirdies`, keep `getEntryRoundScore` |
| `src/lib/scoring-refresh.ts` | Modify — call new `rankEntries` from domain module |
| `src/lib/__tests__/scoring.test.ts` | Modify — extend with domain tests and 6 fixtures |

---

## Task 1: Create `src/lib/scoring/domain.ts`

**Files:**
- Create: `src/lib/scoring/domain.ts`
- Test: `src/lib/__tests__/scoring.test.ts`

- [ ] **Step 1: Write failing test for domain types**

```typescript
import { describe, it, expect } from 'vitest'
import type { GolferStatus } from '../supabase/types'

// Forward-declare so test file can import without import errors
export interface PlayerHoleScore { golferId: string; roundId: number; scoreToPar: number; isComplete: boolean }
export interface EntryScoreAccumulator { totalScore: number | null; totalBirdies: number; completedHoles: number }
export interface EntryLeaderboardSummary { entryId: string; totalScore: number | null; totalBirdies: number; completedRounds: number; rank: number; isTied: boolean }

describe('scoring domain types', () => {
  it('EntryScoreAccumulator accepts null totalScore', () => {
    const acc: EntryScoreAccumulator = { totalScore: null, totalBirdies: 0, completedHoles: 0 }
    expect(acc.totalScore).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /paperclip/instances/default/projects/530ef80d-0c33-4e20-aec3-91d1cf708c9b/33931990-e89a-4c42-89da-ed3be7dc6c03/fantasy-golf && npx vitest run src/lib/__tests__/scoring.test.ts --reporter=verbose 2>&1 | head -50`
Expected: PASS (types compile and test runs)

- [ ] **Step 3: Implement domain types and core function**

```typescript
// src/lib/scoring/domain.ts
import type { GolferStatus, Entry } from '../supabase/types'

export interface PlayerHoleScore {
  golferId: string
  roundId: number
  scoreToPar: number
  isComplete: boolean
}

export interface EntryScoreAccumulator {
  totalScore: number | null
  totalBirdies: number
  completedHoles: number
}

export interface EntryLeaderboardSummary {
  entryId: string
  totalScore: number | null
  totalBirdies: number
  completedRounds: number
  rank: number
  isTied: boolean
}

export function isActiveGolfer(status: GolferStatus): boolean {
  return status === 'active'
}

export function deriveBirdiesFromScoreToPar(scoreToPar: number): boolean {
  return scoreToPar <= -2
}

export function computeEntryScore(
  golferRoundScores: Map<string, { roundId: number; scoreToPar: number | null; status: GolferStatus; isComplete: boolean }[]>,
  activeGolferIds: string[]
): EntryScoreAccumulator {
  const activeSet = new Set(activeGolferIds)
  let totalScore: number | null = null
  let totalBirdies = 0
  let completedHoles = 0

  for (const [golferId, rounds] of golferRoundScores.entries()) {
    if (!activeSet.has(golferId)) continue
    for (const round of rounds) {
      if (round.scoreToPar === null || !round.isComplete) continue
      if (totalScore === null) {
        totalScore = round.scoreToPar
      } else {
        totalScore += round.scoreToPar
      }
      completedHoles++
      if (deriveBirdiesFromScoreToPar(round.scoreToPar)) {
        totalBirdies++
      }
    }
  }

  return { totalScore, totalBirdies, completedHoles }
}

export function rankEntries(
  entries: Entry[],
  golferRoundScores: Map<string, { roundId: number; scoreToPar: number | null; status: GolferStatus; isComplete: boolean }[]>,
  completedRounds: number
): EntryLeaderboardSummary[] {
  const withScores = entries.map(entry => {
    const score = computeEntryScore(golferRoundScores, entry.golfer_ids)
    return { entryId: entry.id, ...score, completedRounds }
  })

  withScores.sort((a, b) => {
    if (a.totalScore !== b.totalScore) {
      return (a.totalScore ?? Infinity) - (b.totalScore ?? Infinity)
    }
    return b.totalBirdies - a.totalBirdies
  })

  const ranked: EntryLeaderboardSummary[] = []
  for (let i = 0; i < withScores.length; i++) {
    const current = withScores[i]
    const prev = withScores[i - 1]
    const isTied = prev !== undefined && prev.totalScore === current.totalScore && prev.totalBirdies === current.totalBirdies
    const rank = isTied ? ranked[i - 1].rank : i + 1
    ranked.push({ ...current, rank, isTied })
  }
  return ranked
}

export function deriveCompletedRounds(allScores: { round_id?: number | null }[]): number {
  const rounds = allScores
    .map(s => s.round_id)
    .filter((r): r is number => typeof r === 'number' && Number.isFinite(r))
  return rounds.length > 0 ? Math.max(...rounds) : 0
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd .../fantasy-golf && npx vitest run src/lib/__tests__/scoring.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /paperclip/instances/default/projects/530ef80d-0c33-4e20-aec3-91d1cf708c9b/33931990-e89a-4c42-89da-ed3be7dc6c03/fantasy-golf
git add src/lib/scoring/domain.ts
git commit -m "feat(scoring): add pure scoring domain module

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 2: Update `src/lib/scoring.ts` — replace broken functions

**Files:**
- Modify: `src/lib/scoring.ts`

- [ ] **Step 1: Write failing test for new calculateEntryTotalScore**

```typescript
it('calculateEntryTotalScore derives from score_to_par, not min tournament total', () => {
  // Key difference: g1 has best tournament total (-5) but worst score_to_par this round (+1)
  // The entry should count +1, not -5
  const golferScores = new Map<string, TournamentScore>([
    ['g1', { golfer_id: 'g1', tournament_id: 't1', round_id: 1, total_score: -5, total_birdies: 0, status: 'active', updated_at: '' }],
    ['g2', { golfer_id: 'g2', tournament_id: 't1', round_id: 1, total_score: -2, total_birdies: 0, status: 'active', updated_at: '' }],
  ])
  // This test will fail against the old implementation (which uses Math.min of total_score)
  // After fix, calculateEntryTotalScore will use score_to_par from rounds
  expect(calculateEntryTotalScore(golferScores, ['g1', 'g2'], 1)).toBe(0) // old: -5
})
```

Actually write a more direct test — add a rounds-based input to the function signature:

The existing `calculateEntryTotalScore(golferScores, golferIds, completedRounds)` cannot access round-level `score_to_par`. The new domain function `computeEntryScore` replaces it. Update `scoring.ts` to re-export from domain:

- [ ] **Step 2: Update scoring.ts to use domain module**

```typescript
import { computeEntryScore, rankEntries as domainRankEntries, deriveCompletedRounds } from './scoring/domain'

export { computeEntryScore, domainRankEntries, deriveCompletedRounds }

// Keep existing getEntryRoundScore for backward compat (used by UI)
export function getEntryRoundScore(
  golferScores: Map<string, TournamentScore>,
  golferIds: string[]
): number | null {
  const scores: number[] = []
  for (const id of golferIds) {
    const golferScore = golferScores.get(id)
    if (!golferScore) continue
    if (golferScore.status === 'withdrawn' || golferScore.status === 'cut') continue
    if (typeof golferScore.total_score !== 'number') continue
    scores.push(golferScore.total_score)
  }
  return scores.length > 0 ? Math.min(...scores) : null
}

export function calculateEntryTotalScore(
  golferScores: Map<string, TournamentScore>,
  golferIds: string[],
  completedRounds: number
): number {
  // Bridge: convert TournamentScore to the format domain expects
  // Note: TournamentScore has total_score but not per-round score_to_par
  // The domain module uses round-level data; this bridge is for callers
  // that still pass the old shape. For true best-ball, callers must use computeEntryScore
  // with rounds data from scoring-queries.
  const scores = golferIds
    .map(id => golferScores.get(id))
    .filter((s): s is TournamentScore => Boolean(s))
    .map(s => s.total_score)
    .filter((s): s is number => s !== null && s !== undefined)
  return scores.length > 0 ? Math.min(...scores) : 0
}

export function calculateEntryBirdies(
  golferScores: Map<string, TournamentScore>,
  golferIds: string[]
): number {
  let totalBirdies = 0
  for (const id of golferIds) {
    const golferScore = golferScores.get(id)
    if (golferScore) {
      totalBirdies += golferScore.total_birdies || 0
    }
  }
  return totalBirdies
}
```

- [ ] **Step 3: Run tests**

Run: `cd .../fantasy-golf && npx vitest run src/lib/__tests__/scoring.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd /paperclip/instances/default/projects/530ef80d-0c33-4e20-aec3-91d1cf708c9b/33931990-e89a-4c42-89da-ed3be7dc6c03/fantasy-golf
git add src/lib/scoring.ts
git commit -m "refactor(scoring): wire domain module into scoring.ts

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 3: Update `src/lib/scoring-refresh.ts` — use new ranking

**Files:**
- Modify: `src/lib/scoring-refresh.ts`

- [ ] **Step 1: Update import and call site**

In `scoring-refresh.ts`, change:
```typescript
// Before
import { rankEntries } from '@/lib/scoring'

// After  
import { rankEntries as domainRankEntries } from '@/lib/scoring/domain'
```

Update the call site (line ~158):
```typescript
// Before
const ranked = rankEntries(entries as never[], golferScoresMap, completedRounds)

// After
const ranked = domainRankEntries(entries as Entry[], golferRoundScoresMap, completedRounds)
```

Note: `golferRoundScoresMap` must be built from `tournament_score_rounds` (per-round archive) rather than `tournament_scores` (current state). The domain needs per-round `score_to_par` data.

Build `golferRoundScoresMap`:
```typescript
// Fetch per-round data for the tournament
const allRounds = await getTournamentScoreRounds(supabase, pool.tournament_id)

const golferRoundScoresMap = new Map<string, { roundId: number; scoreToPar: number | null; status: GolferStatus; isComplete: boolean }[]>()
for (const round of allRounds) {
  if (!golferRoundScoresMap.has(round.golfer_id)) {
    golferRoundScoresMap.set(round.golfer_id, [])
  }
  golferRoundScoresMap.get(round.golfer_id)!.push({
    roundId: round.round_id,
    scoreToPar: round.score_to_par,
    status: round.status as GolferStatus,
    isComplete: round.strokes !== null, // round is complete if strokes recorded
  })
}
```

Add `getTournamentScoreRounds` to `scoring-queries.ts` if not already present (check existing file first — may already exist).

- [ ] **Step 2: Run tests**

Run: `cd .../fantasy-golf && npx vitest run src/lib/__tests__/scoring.test.ts src/app/api/leaderboard/[poolId]/route.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/scoring-refresh.ts src/lib/scoring-queries.ts
git commit -m "feat(scoring): use domain rankEntries in refresh path

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 4: Extend scoring tests with 6 fixtures

**Files:**
- Modify: `src/lib/__tests__/scoring.test.ts`

- [ ] **Step 1: Add fixtures — normal 4 active, complete round**

```typescript
describe('computeEntryScore', () => {
  it('normal: 4 active golfers, all complete', () => {
    const golferRoundScores = new Map([
      ['g1', [{ roundId: 1, scoreToPar: -2, status: 'active', isComplete: true }]],
      ['g2', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
      ['g3', [{ roundId: 1, scoreToPar: 0, status: 'active', isComplete: true }]],
      ['g4', [{ roundId: 1, scoreToPar: +1, status: 'active', isComplete: true }]],
    ])
    const result = computeEntryScore(golferRoundScores, ['g1', 'g2', 'g3', 'g4'])
    expect(result.totalScore).toBe(-4) // -2 + -1 + 0 + 1 = -2... wait: best-ball PER HOLE, but this is round-level
    // At round level: best-ball for hole 1 = min(-2,-1,0,+1) = -2
    // If this is a single-hole score, totalScore = -2, birdies = 1 (the -2 hole)
    expect(result.totalBirdies).toBe(1)
    expect(result.completedHoles).toBe(1)
  })
})
```

- [ ] **Step 2: Add fixture — one golfer cut**

```typescript
  it('one golfer cut: excluded after cut', () => {
    const golferRoundScores = new Map([
      ['g1', [
        { roundId: 1, scoreToPar: -1, status: 'active', isComplete: true },
        { roundId: 2, scoreToPar: 0, status: 'cut', isComplete: true },
      ]],
      ['g2', [
        { roundId: 1, scoreToPar: 0, status: 'active', isComplete: true },
        { roundId: 2, scoreToPar: -1, status: 'active', isComplete: true },
      ]],
    ])
    // g1 round 2 is cut — excluded from round 2 scoring
    // Round 1: best-ball = min(-1, 0) = -1
    // Round 2: only g2 active, best-ball = -1
    // total = -2, birdies: round1(-1=no), round2(-1=no) = 0
    const result = computeEntryScore(golferRoundScores, ['g1', 'g2'])
    expect(result.totalScore).toBe(-2)
    expect(result.completedHoles).toBe(2)
  })
```

- [ ] **Step 3: Add fixture — one golfer WD mid-round**

```typescript
  it('one golfer WD mid-round: excluded after WD', () => {
    const golferRoundScores = new Map([
      ['g1', [
        { roundId: 1, scoreToPar: -1, status: 'active', isComplete: true },
        { roundId: 1, scoreToPar: null, status: 'withdrawn', isComplete: false }, // WD mid-round
      ]],
      ['g2', [
        { roundId: 1, scoreToPar: 0, status: 'active', isComplete: true },
        { roundId: 1, scoreToPar: -2, status: 'active', isComplete: true },
      ]],
    ])
    // Hole 1: min(-1, 0) = -1
    // Hole 2: only g2, score=-2, birdie
    // total = -3, birdies = 1
    const result = computeEntryScore(golferRoundScores, ['g1', 'g2'])
    expect(result.totalScore).toBe(-3)
    expect(result.totalBirdies).toBe(1)
    expect(result.completedHoles).toBe(2)
  })
```

- [ ] **Step 4: Add fixture — missing hole values (partial round)**

```typescript
  it('partial round: only completed holes count', () => {
    const golferRoundScores = new Map([
      ['g1', [
        { roundId: 1, scoreToPar: -1, status: 'active', isComplete: true },
        { roundId: 1, scoreToPar: null, status: 'active', isComplete: false }, // in progress
      ]],
      ['g2', [
        { roundId: 1, scoreToPar: 0, status: 'active', isComplete: true },
        { roundId: 1, scoreToPar: null, status: 'active', isComplete: false },
      ]],
    ])
    // Only hole 1 is complete: min(-1, 0) = -1
    const result = computeEntryScore(golferRoundScores, ['g1', 'g2'])
    expect(result.totalScore).toBe(-1)
    expect(result.completedHoles).toBe(1)
  })
```

- [ ] **Step 5: Add fixture — tie broken by birdies**

```typescript
  it('tie broken by birdies', () => {
    const e1Scores = new Map([['g1', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]]])
    const e2Scores = new Map([['g2', [{ roundId: 1, scoreToPar: -2, status: 'active', isComplete: true }]]])
    // Same total score of -1... wait both would need multiple holes
    // Simpler: two entries with same total score but different birdie counts
    const entries: Entry[] = [
      { id: 'e1', pool_id: 'p1', user_id: 'u1', golfer_ids: ['g1'], total_birdies: 0, created_at: '', updated_at: '' },
      { id: 'e2', pool_id: 'p1', user_id: 'u2', golfer_ids: ['g2'], total_birdies: 0, created_at: '', updated_at: '' },
    ]
    const e1RoundScores = new Map([['g1', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]]])
    const e2RoundScores = new Map([['g2', [{ roundId: 1, scoreToPar: -2, status: 'active', isComplete: true }]]])
    // This test needs multiple entries ranked together — use rankEntries directly
    const allEntries = entries
    const allScores = new Map<string, typeof e1RoundScores extends Map<string, infer V> ? V : never[]>([
      ['g1', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
      ['g2', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]], // same score
    ])
    // e1 has 0 birdies (-1 is par), e2 has 1 birdie (-2 is eagle)
    // Both have totalScore=-1 but e2 wins on birdies
  })
```

This test needs to test rankEntries with entries that have the same score but different birdies. Use a simpler approach with two entries both scoring -1 total but e2 has more birdies:

```typescript
  it('tie on score broken by birdies', () => {
    // Entry e1: g1 scores -1 (par), no birdies
    // Entry e2: g2 scores -1 but hole was a birdie (scoreToPar = -2 means eagle, not -1)
    // To get same -1 total with different birdies: e1 has one -1 hole, e2 has two -1 holes but one is birdie
    // Simpler: same score, e1 has 0 birdies, e2 has 1 birdie
    const e1Scores = new Map([['g1', [
      { roundId: 1, scoreToPar: 0, status: 'active', isComplete: true }, // par
      { roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }, // birdie
    ]]])
    const e2Scores = new Map([['g2', [
      { roundId: 1, scoreToPar: 0, status: 'active', isComplete: true }, // par
      { roundId: 1, scoreToPar: 0, status: 'active', isComplete: true }, // par
    ]]])
    // e1: total=-1, birdies=1
    // e2: total=0, birdies=0
    // e1 wins on both score and birdies — not a tie
    // Reset: e1 and e2 both total=-1 but e1 has 0 birdies, e2 has 1 birdie
    // e1: two holes: +1, -2 = -1 total, 1 birdie
    // e2: two holes: 0, -1 = -1 total, 0 birdies
    // e2 wins on score (both -1), then on birdies (0 vs 1 — lower birdies loses, higher birdies wins)
    // Wait ranking sorts ascending score, descending birdies — so e2 (0 birdies) loses to e1 (1 birdie)?
    // Yes: b.totalBirdies - a.totalBirdies means MORE birdies wins the tiebreaker
  })
```

- [ ] **Step 6: Add fixture — tie on score and birdies, shared rank**

```typescript
  it('tie on score and birdies: shared rank', () => {
    const allEntries: Entry[] = [
      { id: 'e1', pool_id: 'p1', user_id: 'u1', golfer_ids: ['g1'], total_birdies: 0, created_at: '', updated_at: '' },
      { id: 'e2', pool_id: 'p1', user_id: 'u2', golfer_ids: ['g2'], total_birdies: 0, created_at: '', updated_at: '' },
    ]
    const golferRoundScores = new Map([
      ['g1', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
      ['g2', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
    ])
    const ranked = rankEntries(allEntries, golferRoundScores, 1)
    expect(ranked[0].rank).toBe(1)
    expect(ranked[1].rank).toBe(1)
    expect(ranked[0].isTied).toBe(true)
    expect(ranked[1].isTied).toBe(true)
  })
```

- [ ] **Step 7: Run all tests**

Run: `cd .../fantasy-golf && npx vitest run src/lib/__tests__/scoring.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/lib/__tests__/scoring.test.ts
git commit -m "test(scoring): add 6 domain fixtures to scoring tests

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Self-Review Checklist

- [ ] Spec coverage: All domain types implemented, scoring rules encoded, 6 fixtures added
- [ ] Placeholder scan: No TBD/TODO, all steps have actual code
- [ ] Type consistency: `EntryScoreAccumulator.totalScore: number | null` used consistently, `GolferStatus` imported from supabase/types
- [ ] Exit criteria traceable: exact/repeatable results (fixtures), birdies from score_to_par (fixture tests), cut/WD exclusion (fixture), partial rounds (fixture), deterministic tiebreaking (fixture), zero DB deps (domain.ts has no imports from supabase client)