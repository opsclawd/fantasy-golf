---
name: OPS-50 Rebuild Scoring Engine for Hole-by-Hole Best Ball
description: Replace aggregate-score shortcuts with per-hole best ball computation using stored tournament_holes data
module: scoring
tags: [scoring, hole-by-hole, best-ball, domain]
git_refs: []
problem_type: bug-fix
date: 2026-04-25
---

# OPS-50: Rebuild Scoring Engine for Hole-by-Hole Best Ball

## Problem

The current scoring implementation (`src/lib/scoring.ts`) uses aggregate golfer scores from the leaderboard to compute entry scores. This is a shortcut that does not correctly implement best-ball scoring.

**Current behavior:**
```ts
// buildGolferRoundScoresMap in scoring.ts
result.set(golferId, [{
  roundId: score.round_id ?? 1,
  scoreToPar: score.total_score,  // <-- BUG: aggregate tournament score
  status: score.status,
  isComplete: true,
}])
```

This produces a map where each golfer has ONE entry with their entire tournament `total_score` as `scoreToPar`. Then `computeEntryScore` takes `Math.min(...)` of these aggregate values.

**What this computes:** "Give me the golfer with the lowest tournament total and use that as the entry score."

**What best-ball actually is:** "For each hole, give me the lowest score among active golfers in the entry. Sum those minima."

The difference is significant when golfers have different round profiles (e.g., one golfer goes -6 on round 1 but +4 on round 2, while another goes -2 on round 1 and -2 on round 2).

## Key Constraints

1. **`computeEntryScore()` in `domain.ts` is already correct.** The algorithm iterates over `golferRoundScores`, groups by `roundId`, takes the minimum `scoreToPar` per round, sums those minima, and counts completed rounds. The bug is that the input data (`buildGolferRoundScoresMap`) produces wrong-shaped data.

2. **`tournament_holes` table does not exist yet.** The hole-by-hole design from 2026-04-11 was specced but never implemented. OPS-50 must create this table and populate it correctly.

3. **The existing `tournament_score_rounds` table has round-level aggregates**, not hole-level data. `score_to_par` in that table is the golfer's total score-to-par for completed rounds, not per-hole scores.

4. **Birdie counting must also be hole-level.** A birdie is counted when the best-ball score for a hole is below par. The current implementation counts birdies at the round level (one birdie per round if `bestBall < 0`).

5. **Round-gating rule from rules-spec section 2.3:** "A round only counts toward the entry total if **all golfers** in the entry have `isComplete: true` for that round." This must be preserved.

## Solution Overview

### Data Flow

```
tournament_holes (per-hole strokes)
    ↓
buildGolferRoundScoresMap() → GolferRoundScoresMap
    ↓
computeEntryScore() → entry total score + birdies + completed holes
    ↓
rankEntries() → ranked leaderboard
```

### 1. Create `tournament_holes` table

```sql
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

ALTER TABLE tournament_holes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tournament_holes_service_role_all"
  ON tournament_holes FOR ALL TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON tournament_holes TO service_role;
```

### 2. Add hole data sync to `scoring-refresh.ts`

When refreshing scores, fetch `/scorecard` for each golfer with completed rounds and persist verified hole data to `tournament_holes`. This is the same work described in the 2026-04-11 hole-by-hole design spec.

### 3. Fix `buildGolferRoundScoresMap()` to use hole data

**Current (wrong):**
```ts
function buildGolferRoundScoresMap(tournamentScores: Map<string, TournamentScore>): GolferRoundScoresMap {
  const result: GolferRoundScoresMap = new Map()
  for (const [golferId, score] of tournamentScores) {
    result.set(golferId, [{
      roundId: score.round_id ?? 1,
      scoreToPar: score.total_score,  // aggregate!
      status: score.status,
      isComplete: true,
    }])
  }
  return result
}
```

**Correct (new):**
```ts
function buildGolferRoundScoresMap(
  holesByGolfer: Map<string, TournamentHole[]>,
  golferStatuses: Map<string, GolferStatus>
): GolferRoundScoresMap {
  const result: GolferRoundScoresMap = new Map()

  for (const [golferId, holes] of holesByGolfer) {
    const rounds: PlayerHoleScore[] = holes.map(hole => ({
      roundId: hole.round_id,
      scoreToPar: hole.score_to_par,
      status: golferStatuses.get(golferId) ?? 'active',
      isComplete: true,  // only completed holes are stored
    }))
    result.set(golferId, rounds)
  }

  return result
}
```

Each `TournamentHole` becomes one `PlayerHoleScore` entry in the map.

### 4. Update scoring entry points

The functions that currently build `GolferRoundScoresMap` from `TournamentScore` must be updated:

- `rankEntries()` in `scoring.ts`
- Any other caller of `domainRankEntries()`

These must now accept hole data and statuses separately.

### 5. Rewrite `computeEntryScore()` for hole-level best ball

The current algorithm groups by `roundId` and takes one best-ball per round. For true hole-level best ball, we need to group by `(roundId, holeId)` pairs.

**New algorithm structure:**

```ts
export function computeEntryScore(
  golferRoundScores: GolferRoundScoresMap,  // hole-level: each entry is one hole
  activeGolferIds: string[]
): EntryScoreAccumulator {
  // Index holes by (roundId, holeId) -> scores from all golfers
  const holesIndex = new Map<string, Array<{ golferId: string; scoreToPar: number | null; isComplete: boolean }>>()

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
      })
    }
  }

  // Determine which rounds are complete for all active golfers
  const roundCompletion = new Map<number, boolean>()
  for (const [holeKey, entries] of holesIndex) {
    const roundId = parseInt(holeKey.split('-')[0])
    const allComplete = entries.every(e => e.isComplete)
    const current = roundCompletion.get(roundId)
    roundCompletion.set(roundId, current === undefined ? allComplete : current && allComplete)
  }

  // Compute best ball per hole, sum only complete rounds
  let totalScore: number | null = 0
  let totalBirdies = 0
  let completedHoles = 0

  const activeSet = new Set(activeGolferIds)

  for (const [holeKey, entries] of holesIndex) {
    const [roundIdStr, holeIdStr] = holeKey.split('-')
    const roundId = parseInt(roundIdStr)

    if (!roundCompletion.get(roundId)) continue

    const activeEntries = entries.filter(e => activeSet.has(e.golferId) && e.isComplete)
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

  return { totalScore, totalBirdies, completedHoles, activeGolferIds }
}
```

Key changes:
- Index by `(roundId, holeId)` instead of just `roundId`
- Check round completion (all active golfers must have complete hole data)
- Sum best-ball per hole, not per round
- Count `completedHoles` as actual holes scored

### 6. Round completion and active golfer filtering

Rules spec section 2.2/2.3:
- Active golfers (status === 'active') count in best-ball calculation
- Cut/WD golfers are excluded from subsequent rounds but their completed rounds still count
- A round only counts if ALL active golfers in the entry have `isComplete: true`
With hole-level data:
- `isComplete: true` for a golfer's hole means we have verified hole data
- A round is complete for an entry when all active golfers have `isComplete: true` for all 18 holes
- A golfer who is cut/WD is filtered from `activeGolferIds` for subsequent rounds but their completed holes still exist in `golferRoundScores`

## Data Model Changes

### New type: `TournamentHole`

```ts
export interface TournamentHole {
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

### New query functions in `scoring-queries.ts`

```ts
export async function getTournamentHolesForGolfers(
  supabase: SupabaseClient,
  tournamentId: string,
  golferIds: string[]
): Promise<Map<string, TournamentHole[]>>

export async function upsertTournamentHoles(
  supabase: SupabaseClient,
  holes: TournamentHole[]
): Promise<{ error: string | null }>
```

## Display Considerations

The picks page shows:
- "Counted in N rounds" → should show "X of Y holes"
- Birdies shown per entry → should count hole-level birdies

These UI changes are out of scope for OPS-50 (the scoring engine rebuild), but the data changes enable them.

## Out of Scope

- UI changes to display hole-level metrics
- Scorecard API fetching (part of OPS-28)
- Cron/pipeline hardening (part of OPS-29)
- Regression test coverage (part of OPS-30)

## Dependencies

- `tournament_holes` table must exist before scoring can use it
- Hole data must be populated (via OPS-28 scorecard integration)
- Rules spec section 2.1/2.3 defines the scoring contract

## Test Scenarios

| Scenario | Input | Expected Output |
|----------|-------|----------------|
| Normal round | g1: -3, g2: +1, g3: E, g4: +2 | Entry score = -3 |
| All same score | g1: -2, g2: -2, g3: -2, g4: -2 | Entry score = -2 |
| Golfer WD | g1: -3, g2: WD, g3: E, g4: +2 | Entry score = -2 (best of g1,g3,g4) |
| Cut mid-tournament | g1: -3, cut after R1, g2: -2, g3: E, g4: +2 | R1: -3, R2+: best of g2,g3,g4 |
| Partial entry | g1: -3, g2: no data, g3: E, g4: +2 | Round with missing golfer is skipped |

## Alternative Approaches

### A) Minimal fix: Keep round-level counting, improve data granularity

Keep `computeEntryScore()` as-is (counting rounds), but fix `buildGolferRoundScoresMap()` to use stored round-level scores instead of tournament totals.

**Problem:** Does not satisfy "sums across scored holes" in acceptance criteria.

### B) Full hole-level rebuild (recommended above)

Rewrite `computeEntryScore()` to iterate over `(roundId, holeId)` pairs and count holes.

**Advantage:** Satisfies acceptance criteria exactly. Algorithm becomes the source of truth for hole-level best ball.

### C) Separate scoring paths

Keep round-level scoring for leaderboard (fast, uses aggregate data) and add hole-level scoring for picks display (uses `tournament_holes`).

**Problem:** Two different scoring algorithms for the same game format creates confusion and potential inconsistency.

**Recommended:** Option B - full hole-level rebuild.
