# OPS-50: Scoring Engine Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the scoring engine to use hole-by-hole best ball from `tournament_holes` data instead of aggregate golfer score shortcuts.

**Architecture:** The scoring engine is rebuilt around a new `tournament_holes` table that stores per-hole strokes. `buildGolferRoundScoresMap()` is rewritten to produce one `PlayerHoleScore` entry per stored hole (with `roundId` + `holeId`). `computeEntryScore()` is updated to index by `(roundId, holeId)` pairs, compute best-ball per hole, and sum only when all active golfers have completed the round.

**Tech Stack:** TypeScript, Vitest, Supabase (Postgres), Next.js API routes

---

## File Structure

```
src/lib/
  scoring/
    domain.ts          # PlayerHoleScore, computeEntryScore(), rankEntries()
  scoring.ts           # buildGolferRoundScoresMap(), rankEntries() entry point
  scoring-queries.ts   # getTournamentHolesForGolfers(), upsertTournamentHoles()
  supabase/
    types.ts           # TournamentHole type
supabase/migrations/
  YYYYMMDDHHMMSS_create_tournament_holes.sql
src/lib/__tests__/
  domain-scoring.test.ts    # existing — add holeId tests + hole-level tests
  scoring.test.ts           # existing — update for new data shape
  scoring-queries.test.ts   # new — test tournament_holes queries
```

---

## Task 1: Add `holeId` to `PlayerHoleScore` interface

**Files:**
- Modify: `src/lib/scoring/domain.ts:3-8`
- Test: `src/lib/__tests__/domain-scoring.test.ts`

- [ ] **Step 1: Update `PlayerHoleScore` interface**

```typescript
// src/lib/scoring/domain.ts:3-8 — BEFORE
export interface PlayerHoleScore {
  roundId: number
  scoreToPar: number | null
  status: GolferStatus
  isComplete: boolean
}

// src/lib/scoring/domain.ts — AFTER
export interface PlayerHoleScore {
  roundId: number
  holeId: number         // 1-18 — added for hole-level indexing
  scoreToPar: number | null
  status: GolferStatus
  isComplete: boolean
}
```

- [ ] **Step 2: Update `makePlayerHoleScore` helper in test file**

```typescript
// src/lib/__tests__/domain-scoring.test.ts:14-16 — BEFORE
function makePlayerHoleScore(roundId: number, scoreToPar: number, status: GolferStatus, isComplete: boolean): PlayerHoleScore {
  return { roundId, scoreToPar: scoreToPar as number, status, isComplete }
}

// src/lib/__tests__/domain-scoring.test.ts — AFTER
function makePlayerHoleScore(roundId: number, holeId: number, scoreToPar: number, status: GolferStatus, isComplete: boolean): PlayerHoleScore {
  return { roundId, holeId, scoreToPar: scoreToPar as number, status, isComplete }
}
```

- [ ] **Step 3: Update all existing test calls to pass `holeId`**

In `domain-scoring.test.ts`, every call to `makePlayerHoleScore` currently passes 4 args. Add `1` as the second argument (holeId = 1) to all existing calls, then add new tests with varying holeIds.

Example update for the first test case:
```typescript
// src/lib/__tests__/domain-scoring.test.ts:40-44 — update each call
['g1', [makePlayerHoleScore(1, 1, -2, 'active', true)]],   // was (1, -2, ...)
['g2', [makePlayerHoleScore(1, 1, -1, 'active', true)]],  // was (1, -1, ...)
['g3', [makePlayerHoleScore(1, 1, 0, 'active', true)]],    // was (1, 0, ...)
['g4', [makePlayerHoleScore(1, 1, 1, 'active', true)]],    // was (1, 1, ...)
```

Run: `cd /paperclip/instances/default/projects/db1bfeae-22d7-4a31-80a7-8ca5e5ae3bf6/c7451134-3dc7-4349-a014-2d43a4d0fff3/fantasy-golf && npm test -- --run src/lib/__tests__/domain-scoring.test.ts`
Expected: PASS (all existing tests still pass with updated helper)

- [ ] **Step 4: Add holeId to `EntryHoleResult` and `GolferRoundScoresMap` usages**

The `EntryHoleResult` interface also references hole-level data. Update it to include `holeId`:
```typescript
// src/lib/scoring/domain.ts:10-14 — BEFORE
export interface EntryHoleResult {
  roundId: number
  bestBallScore: number | null
  isComplete: boolean
}

// src/lib/scoring/domain.ts — AFTER
export interface EntryHoleResult {
  roundId: number
  holeId: number
  bestBallScore: number | null
  isComplete: boolean
}
```

- [ ] **Step 5: Commit**

```bash
cd /paperclip/instances/default/projects/db1bfeae-22d7-4a31-80a7-8ca5e5ae3bf6/c7451134-3dc7-4349-a014-2d43a4d0fff3/fantasy-golf
git add src/lib/scoring/domain.ts src/lib/__tests__/domain-scoring.test.ts
git commit -m "ops-50: add holeId to PlayerHoleScore and EntryHoleResult interfaces

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 2: Rewrite `computeEntryScore()` for hole-level best ball

**Files:**
- Modify: `src/lib/scoring/domain.ts:43-121`

- [ ] **Step 1: Write the failing test for hole-level scoring**

```typescript
// src/lib/__tests__/domain-scoring.test.ts — add new test
describe('computeEntryScore hole-level', () => {
  it('normal round — best ball per hole summed', () => {
    // 4 golfers, each has 18 holes with varying scores
    // g1 is best on 10 holes (-1 each), g2 best on 8 holes (-2 each)
    // Entry score = 10 * (-1) + 8 * (-2) = -10 - 16 = -26
    const scores = makeGolferRoundScoresMapentries([
      ['g1', Array.from({ length: 18 }, (_, i) => makePlayerHoleScore(1, i + 1, -1, 'active', true))],
      ['g2', Array.from({ length: 18 }, (_, i) => makePlayerHoleScore(1, i + 1, -2, 'active', true))],
      ['g3', Array.from({ length: 18 }, (_, i) => makePlayerHoleScore(1, i + 1, 0, 'active', true))],
      ['g4', Array.from({ length: 18 }, (_, i) => makePlayerHoleScore(1, i + 1, 1, 'active', true))],
    ])

    const result = computeEntryScore(scores, ['g1', 'g2', 'g3', 'g4'])

    // Best ball each hole: g2's -2 for first 8 holes, g1's -1 for next 10
    // Sum = 8 * (-2) + 10 * (-1) = -16 + -10 = -26
    expect(result.totalScore).toBe(-26)
    expect(result.totalBirdies).toBe(18)  // all holes are birdie or better (-1 or -2)
    expect(result.completedHoles).toBe(18)
  })

  it('round with missing golfer — skipped', () => {
    // g1 complete 18 holes, g2 only has 10 holes (incomplete round)
    // Entire round should be skipped
    const scores = makeGolferRoundScoresMapentries([
      ['g1', Array.from({ length: 18 }, (_, i) => makePlayerHoleScore(1, i + 1, -1, 'active', true))],
      ['g2', Array.from({ length: 10 }, (_, i) => makePlayerHoleScore(1, i + 1, -2, 'active', true))],
      ['g3', Array.from({ length: 18 }, (_, i) => makePlayerHoleScore(1, i + 1, 0, 'active', true))],
      ['g4', Array.from({ length: 18 }, (_, i) => makePlayerHoleScore(1, i + 1, 1, 'active', true))],
    ])

    const result = computeEntryScore(scores, ['g1', 'g2', 'g3', 'g4'])

    // Round incomplete — no holes count
    expect(result.totalScore).toBe(null)
    expect(result.completedHoles).toBe(0)
  })
})
```

Run: `npm test -- --run src/lib/__tests__/domain-scoring.test.ts`
Expected: FAIL on the new tests (function doesn't index by holeId yet)

- [ ] **Step 2: Rewrite `computeEntryScore()` to index by (roundId, holeId)**

```typescript
// src/lib/scoring/domain.ts:43-121 — REPLACE with:
export function computeEntryScore(
  golferRoundScores: GolferRoundScoresMap,
  activeGolferIds: string[]
): EntryScoreAccumulator {
  let totalScore: number | null = 0
  let totalBirdies = 0
  let completedHoles = 0

  const activeSet = new Set(activeGolferIds)

  // Build hole-level index: "roundId-holeId" -> entries from all golfers
  const holesIndex = new Map<string, Array<{ golferId: string; scoreToPar: number | null; isComplete: boolean; status: GolferStatus }>>()

  for (const [golferId, rounds] of golferRoundScores) {
    for (const round of rounds) {
      const holeKey = `${round.roundId}-${round.holeId}`
      if (!holesIndex.has(holeKey)) {
        holesIndex.set(holeKey, [])
      }
      holesIndex.get(holeKey)!.push({
        golferId,
        scoreToPar: round.scoreToPar,
        isComplete: round.isComplete,
        status: round.status,
      })
    }
  }

  // Determine which rounds are complete for all active golfers
  // A round is complete only when ALL active golfers have all 18 holes with isComplete=true
  const roundCompleteness = new Map<number, boolean>()
  for (const [holeKey, entries] of holesIndex) {
    const roundId = parseInt(holeKey.split('-')[0])
    const allComplete = entries.every(e => e.isComplete)
    const current = roundCompleteness.get(roundId)
    roundCompleteness.set(roundId, current === undefined ? allComplete : current && allComplete)
  }

  // Compute best ball per hole, sum only complete rounds
  for (const [holeKey, entries] of holesIndex) {
    const roundId = parseInt(holeKey.split('-')[0])

    // Skip incomplete rounds
    if (!roundCompleteness.get(roundId)) continue

    // Filter to active golfers only (status === 'active')
    const activeEntries = entries.filter(e => activeSet.has(e.golferId) && e.status === 'active')
    if (activeEntries.length === 0) continue

    const validScores = activeEntries
      .map(e => e.scoreToPar)
      .filter((s): s is number => s !== null)

    if (validScores.length === 0) continue

    const bestBall = Math.min(...validScores)
    totalScore = (totalScore !== null ? totalScore : 0) + bestBall
    completedHoles++

    if (isBirdie(bestBall)) totalBirdies++
  }

  return {
    totalScore: totalScore === 0 && completedHoles === 0 ? null : totalScore,
    totalBirdies,
    completedHoles,
    activeGolferIds,
  }
}
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npm test -- --run src/lib/__tests__/domain-scoring.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/scoring/domain.ts src/lib/__tests__/domain-scoring.test.ts
git commit -m "ops-50: rewrite computeEntryScore for hole-level best ball

Now indexes by (roundId, holeId) pairs and sums best-ball per hole.
Round is only counted when all active golfers have complete 18-hole data.
Active golfer filtering uses status === 'active'.

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 3: Add `TournamentHole` type and database migration

**Files:**
- Modify: `src/lib/supabase/types.ts`
- Create: `supabase/migrations/YMMddHHMMSS_create_tournament_holes.sql`

- [ ] **Step 1: Add `TournamentHole` type to supabase types**

```typescript
// src/lib/supabase/types.ts — ADD after TournamentScoreRound interface
export interface TournamentHole {
  id?: string
  golfer_id: string
  tournament_id: string
  round_id: number
  hole_id: number
  strokes: number
  par: number
  score_to_par: number
  updated_at?: string
}
```

- [ ] **Step 2: Write migration for `tournament_holes` table**

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_create_tournament_holes.sql

CREATE TABLE tournament_holes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  golfer_id TEXT NOT NULL,
  tournament_id TEXT NOT NULL,
  round_id INTEGER NOT NULL CHECK (round_id BETWEEN 1 AND 4),
  hole_id INTEGER NOT NULL CHECK (hole_id BETWEEN 1 AND 18),
  strokes INTEGER NOT NULL,
  par INTEGER NOT NULL,
  score_to_par INTEGER NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(golfer_id, tournament_id, round_id, hole_id)
);

CREATE INDEX idx_tournament_holes_lookup
  ON tournament_holes(tournament_id, golfer_id, round_id);

CREATE INDEX idx_tournament_holes_tournament
  ON tournament_holes(tournament_id, round_id, hole_id);

ALTER TABLE tournament_holes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tournament_holes_service_role_all"
  ON tournament_holes FOR ALL TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON tournament_holes TO service_role;
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/types.ts supabase/migrations/
git commit -m "ops-50: add TournamentHole type and tournament_holes migration

TournamentHole stores per-hole strokes with (golfer_id, tournament_id, round_id, hole_id)
as the unique key. score_to_par = strokes - par.

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 4: Add query functions for `tournament_holes`

**Files:**
- Modify: `src/lib/scoring-queries.ts`
- Create: `src/lib/__tests__/scoring-queries.test.ts`

- [ ] **Step 1: Write failing tests for new query functions**

```typescript
// src/lib/__tests__/scoring-queries.test.ts — ADD new describe block
describe('tournament_holes queries', () => {
  it('getTournamentHolesForGolfers returns holes grouped by golfer', async () => {
    // Mock supabase client
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    }
    
    // Setup mock data
    const mockHoles = [
      { golfer_id: 'g1', tournament_id: 't1', round_id: 1, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
      { golfer_id: 'g1', tournament_id: 't1', round_id: 1, hole_id: 2, strokes: 3, par: 4, score_to_par: -1 },
    ]
    
    mockSupabase.select.mockReturnThis()
    mockSupabase.eq.mockReturnThis()
    mockSupabase.in.mockReturnThis()
    mockSupabase.order.mockReturnValue({
      data: mockHoles,
      error: null,
    })
    
    const result = await getTournamentHolesForGolfers(mockSupabase as any, 't1', ['g1', 'g2'])
    
    expect(mockSupabase.from).toHaveBeenCalledWith('tournament_holes')
    expect(result.get('g1')?.length).toBe(2)
    expect(result.get('g1')?.[0].score_to_par).toBe(0)
  })

  it('upsertTournamentHoles writes multiple holes', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
    }
    
    mockSupabase.upsert.mockReturnValue({ error: null })
    
    const holes: TournamentHole[] = [
      { golfer_id: 'g1', tournament_id: 't1', round_id: 1, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
    ]
    
    const result = await upsertTournamentHoles(mockSupabase as any, holes)
    expect(result.error).toBe(null)
    expect(mockSupabase.upsert).toHaveBeenCalled()
  })
})
```

Run: `npm test -- --run src/lib/__tests__/scoring-queries.test.ts`
Expected: FAIL (functions don't exist yet)

- [ ] **Step 2: Add query functions to scoring-queries.ts**

```typescript
// src/lib/scoring-queries.ts — ADD before getScoresForTournament

export async function getTournamentHolesForGolfers(
  supabase: SupabaseClient,
  tournamentId: string,
  golferIds: string[]
): Promise<Map<string, TournamentHole[]>> {
  const { data, error } = await supabase
    .from('tournament_holes')
    .select('*')
    .eq('tournament_id', tournamentId)
    .in('golfer_id', golferIds)
    .order('round_id', { ascending: true })
    .order('hole_id', { ascending: true })

  if (error) throw new Error(error.message)

  const result = new Map<string, TournamentHole[]>()
  for (const hole of (data as TournamentHole[]) || []) {
    if (!result.has(hole.golfer_id)) {
      result.set(hole.golfer_id, [])
    }
    result.get(hole.golfer_id)!.push(hole)
  }
  return result
}

export async function upsertTournamentHoles(
  supabase: SupabaseClient,
  holes: TournamentHole[]
): Promise<{ error: string | null }> {
  if (holes.length === 0) return { error: null }

  const { error } = await supabase
    .from('tournament_holes')
    .upsert(holes, { onConflict: 'golfer_id,tournament_id,round_id,hole_id' })

  if (error) return { error: error.message }
  return { error: null }
}
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npm test -- --run src/lib/__tests__/scoring-queries.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/scoring-queries.ts src/lib/__tests__/scoring-queries.test.ts
git commit -m "ops-50: add getTournamentHolesForGolfers and upsertTournamentHoles to scoring-queries

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 5: Rewrite `buildGolferRoundScoresMap()` to use hole data

**Files:**
- Modify: `src/lib/scoring.ts:62-73`
- Test: `src/lib/__tests__/scoring.test.ts`

- [ ] **Step 1: Write failing test for new `buildGolferRoundScoresMap` signature**

```typescript
// src/lib/__tests__/scoring.test.ts — ADD new describe block
describe('buildGolferRoundScoresMap with hole data', () => {
  it('maps tournament holes to PlayerHoleScore entries with holeId', () => {
    const holesByGolfer = new Map<string, TournamentHole[]>([
      ['g1', [
        { golfer_id: 'g1', tournament_id: 't1', round_id: 1, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
        { golfer_id: 'g1', tournament_id: 't1', round_id: 1, hole_id: 2, strokes: 3, par: 4, score_to_par: -1 },
      ]],
    ])
    const statuses = new Map<string, GolferStatus>([['g1', 'active']])

    const result = buildGolferRoundScoresMap(holesByGolfer, statuses)

    expect(result.get('g1')?.length).toBe(2)
    expect(result.get('g1')?.[0]).toMatchObject({ roundId: 1, holeId: 1, scoreToPar: 0, isComplete: true })
    expect(result.get('g1')?.[1]).toMatchObject({ roundId: 1, holeId: 2, scoreToPar: -1, isComplete: true })
  })
})
```

Run: `npm test -- --run src/lib/__tests__/scoring.test.ts`
Expected: FAIL (function signature doesn't match yet)

- [ ] **Step 2: Update `buildGolferRoundScoresMap` function signature and body**

```typescript
// src/lib/scoring.ts:62-73 — REPLACE with:
function buildGolferRoundScoresMap(
  holesByGolfer: Map<string, TournamentHole[]>,
  golferStatuses: Map<string, GolferStatus>
): GolferRoundScoresMap {
  const result: GolferRoundScoresMap = new Map()

  for (const [golferId, holes] of holesByGolfer) {
    const rounds: PlayerHoleScore[] = holes.map(hole => ({
      roundId: hole.round_id,
      holeId: hole.hole_id,
      scoreToPar: hole.score_to_par,
      status: golferStatuses.get(golferId) ?? 'active',
      isComplete: true,  // only completed holes are stored
    }))
    result.set(golferId, rounds)
  }

  return result
}
```

Also update the import to include `TournamentHole` and update the `rankEntries` function to use the new signature:

```typescript
// src/lib/scoring.ts — imports — ADD TournamentHole
import type { TournamentHole } from './supabase/types'

// src/lib/scoring.ts:75-82 — UPDATE rankEntries to use new map builder
export function rankEntries(
  entries: Entry[],
  golferScores: Map<string, TournamentScore>,
  completedRounds: number
): (Entry & { totalScore: number | null; totalBirdies: number; rank: number; isTied: boolean })[] {
  // First get hole data from tournament_holes for scoring
  // For now, fall back to building from TournamentScore for backwards compat
  const golferRoundScoresMap = buildGolferRoundScoresMapFromScores(golferScores)
  return domainRankEntries(entries, golferRoundScoresMap, completedRounds) as (Entry & { totalScore: number | null; totalBirdies: number; rank: number; isTied: boolean })[]
}

// Keep old function for backwards compat during transition
function buildGolferRoundScoresMapFromScores(tournamentScores: Map<string, TournamentScore>): GolferRoundScoresMap {
  const result: GolferRoundScoresMap = new Map()
  for (const [golferId, score] of tournamentScores) {
    result.set(golferId, [{
      roundId: score.round_id ?? 1,
      holeId: 1,  // default — old path uses round-level
      scoreToPar: score.total_score,
      status: score.status,
      isComplete: true,
    }])
  }
  return result
}
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npm test -- --run src/lib/__tests__/scoring.test.ts src/lib/__tests__/domain-scoring.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/scoring.ts src/lib/__tests__/scoring.test.ts
git commit -m "ops-50: rewrite buildGolferRoundScoresMap for hole-level data

New signature accepts holesByGolfer (Map of TournamentHole[]) and golferStatuses.
Each TournamentHole becomes one PlayerHoleScore entry with roundId + holeId.
Old buildGolferRoundScoresMapFromScores kept for backward compat during transition.

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 6: Add edge-case and tiebreaker tests to domain-scoring.test.ts

**Files:**
- Modify: `src/lib/__tests__/domain-scoring.test.ts`

- [ ] **Step 1: Write edge case tests**

```typescript
// src/lib/__tests__/domain-scoring.test.ts — ADD new describe block
describe('computeEntryScore edge cases', () => {
  it('all golfers cut — score is null', () => {
    const scores = makeGolferRoundScoresMapentries([
      ['g1', [
        makePlayerHoleScore(1, 1, -1, 'cut', true),
        makePlayerHoleScore(2, 1, -2, 'cut', true),
      ]],
      ['g2', [
        makePlayerHoleScore(1, 1, 0, 'cut', true),
        makePlayerHoleScore(2, 1, -1, 'cut', true),
      ]],
      ['g3', [
        makePlayerHoleScore(1, 1, 1, 'cut', true),
        makePlayerHoleScore(2, 1, 0, 'cut', true),
      ]],
      ['g4', [
        makePlayerHoleScore(1, 1, 0, 'cut', true),
        makePlayerHoleScore(2, 1, 1, 'cut', true),
      ]],
    ])

    const result = computeEntryScore(scores, ['g1', 'g2', 'g3', 'g4'])

    expect(result.totalScore).toBe(null)
    expect(result.completedHoles).toBe(0)
  })

  it('shared rank when score AND birdies are equal', () => {
    const scores = makeGolferRoundScoresMapentries([
      ['g1', [makePlayerHoleScore(1, 1, -1, 'active', true)]],
      ['g2', [makePlayerHoleScore(1, 1, -1, 'active', true)]],
      ['g3', [makePlayerHoleScore(1, 1, -1, 'active', true)]],
      ['g4', [makePlayerHoleScore(1, 1, -1, 'active', true)]],
      ['g5', [makePlayerHoleScore(1, 1, -1, 'active', true)]],
      ['g6', [makePlayerHoleScore(1, 1, -1, 'active', true)]],
      ['g7', [makePlayerHoleScore(1, 1, -1, 'active', true)]],
      ['g8', [makePlayerHoleScore(1, 1, -1, 'active', true)]],
    ])

    const entries: Entry[] = [
      { id: 'e1', pool_id: 'p1', user_id: 'u1', golfer_ids: ['g1', 'g2', 'g3', 'g4'], total_birdies: 0, created_at: '', updated_at: '' },
      { id: 'e2', pool_id: 'p1', user_id: 'u2', golfer_ids: ['g5', 'g6', 'g7', 'g8'], total_birdies: 0, created_at: '', updated_at: '' },
    ]

    const ranked = rankEntries(entries, scores, 1)

    expect(ranked[0].rank).toBe(1)
    expect(ranked[1].rank).toBe(1)
    expect(ranked[0].isTied).toBe(true)
    expect(ranked[1].isTied).toBe(true)
  })

  it('two rounds — only complete rounds count', () => {
    // R1: all complete, R2: not all complete — only R1 counts
    const scores = makeGolferRoundScoresMapentries([
      ['g1', [
        makePlayerHoleScore(1, 1, -1, 'active', true),
        makePlayerHoleScore(2, 1, -2, 'active', false), // incomplete
      ]],
      ['g2', [
        makePlayerHoleScore(1, 1, 0, 'active', true),
        makePlayerHoleScore(2, 1, -1, 'active', true),
      ]],
      ['g3', [
        makePlayerHoleScore(1, 1, 1, 'active', true),
        makePlayerHoleScore(2, 1, 0, 'active', true),
      ]],
      ['g4', [
        makePlayerHoleScore(1, 1, 0, 'active', true),
        makePlayerHoleScore(2, 1, 1, 'active', true),
      ]],
    ])

    const result = computeEntryScore(scores, ['g1', 'g2', 'g3', 'g4'])

    // Only R1 counts (all complete) = -1
    expect(result.totalScore).toBe(-1)
    expect(result.completedHoles).toBe(1)
  })
})
```

Run: `npm test -- --run src/lib/__tests__/domain-scoring.test.ts`
Expected: PASS

- [ ] **Step 2: Commit**

```bash
git add src/lib/__tests__/domain-scoring.test.ts
git commit -m "ops-50: add edge case and tiebreaker tests for hole-level scoring

Tests cover: all-cut score null, shared rank when score+birdies equal,
two-round partial (only complete rounds count).

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 7: Update `rankEntries` to use hole-level scoring in live path

**Files:**
- Modify: `src/lib/scoring.ts`
- Modify: `src/app/api/leaderboard/[poolId]/route.ts` (if it calls rankEntries)

- [ ] **Step 1: Check where rankEntries is called**

```bash
cd /paperclip/instances/default/projects/db1bfeae-22d7-4a31-80a7-8ca5e5ae3bf6/c7451134-3dc7-4349-a014-2d43a4d0fff3/fantasy-golf
grep -rn "rankEntries" src/ --include="*.ts" --include="*.tsx" | grep -v "__tests__" | grep -v "node_modules"
```

Run the grep and show output.

- [ ] **Step 2: Add new overload of rankEntries that accepts hole data directly**

```typescript
// src/lib/scoring.ts — ADD new export
export function rankEntriesWithHoles(
  entries: Entry[],
  holesByGolfer: Map<string, TournamentHole[]>,
  golferStatuses: Map<string, GolferStatus>,
  completedRounds: number
): (Entry & { totalScore: number | null; totalBirdies: number; rank: number; isTied: boolean })[] {
  const golferRoundScoresMap = buildGolferRoundScoresMap(holesByGolfer, golferStatuses)
  return domainRankEntries(entries, golferRoundScoresMap, completedRounds) as (Entry & { totalScore: number | null; totalBirdies: number; rank: number; isTied: boolean })[]
}
```

- [ ] **Step 3: Run all scoring tests**

Run: `npm test -- --run src/lib/__tests__/domain-scoring.test.ts src/lib/__tests__/scoring.test.ts src/lib/__tests__/scoring-queries.test.ts`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/scoring.ts
git commit -m "ops-50: add rankEntriesWithHoles for hole-aware scoring path

New function accepts holesByGolfer Map and golferStatuses Map directly,
building GolferRoundScoresMap internally and calling domain rankEntries.
This is the entry point for the live scoring path once tournament_holes is populated.

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Verification

Run the full test suite:
```bash
cd /paperclip/instances/default/projects/db1bfeae-22d7-4a31-80a7-8ca5e5ae3bf6/c7451134-3dc7-4349-a014-2d43a4d0fff3/fantasy-golf
npm test -- --run
```

Expected: ALL tests pass (including pre-existing tests in all scoring files).

---

## Summary

| Task | File | Status |
|------|------|--------|
| 1 | `domain.ts` — add holeId to PlayerHoleScore | TBD |
| 2 | `domain.ts` — rewrite computeEntryScore for hole-level | TBD |
| 3 | `supabase/types.ts` + migration | TBD |
| 4 | `scoring-queries.ts` — hole query functions | TBD |
| 5 | `scoring.ts` — rewrite buildGolferRoundScoresMap | TBD |
| 6 | `domain-scoring.test.ts` — edge case tests | TBD |
| 7 | `scoring.ts` — add rankEntriesWithHoles | TBD |