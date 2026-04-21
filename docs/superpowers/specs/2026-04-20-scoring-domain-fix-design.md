# PAP-14 Phase 2 — Scoring Model Domain Design

**Issue:** [PAP-14 Phase 2 — fix the scoring model at the domain level](/PAP/issues/PAP-14)
**Date:** 2026-04-20
**Status:** Design spec — for Board approval

---

## Context

PAP-14 Phase 1 (codebase-audit.md) identified five defects in the scoring system. The critical defect: `total_birdies` is always 0 because the Slash Golf leaderboard endpoint never provides a birdie field. The ranking function uses birdies as a tiebreaker, making tie ordering effectively random.

The PAP-14 Phase 2 brief requires:
1. A clean internal domain model for scoring
2. Rewritten scoring functions that do not depend on "minimum total golfer score"
3. Birdies derived from hole-level score_to_par (since leaderboard has no birdie field)
4. Handling of partial/incomplete rounds
5. A pure scoring service boundary (no DB or network side effects)

---

## Existing Scoring Architecture

```
scoring-refresh.ts (cron/on-demand trigger)
    → getTournamentScores (Slash Golf leaderboard API)
    → upsertTournamentScore (scoring-queries.ts)
    → rankEntries / calculateEntryTotalScore (scoring.ts)
    → broadcast via Supabase Realtime
```

Current problems in `scoring.ts`:
- `calculateEntryTotalScore` uses `Math.min(...scores)` — this is the minimum tournament total, not best-ball-per-hole
- `calculateEntryBirdies` sums stored `total_birdies` which is always 0
- `rankEntries` uses birdies as tiebreaker, but birdies are always 0
- No concept of "scored holes" vs "incomplete holes" — all holes treated equally

---

## Proposed Domain Model

### PlayerHoleScore

```typescript
interface PlayerHoleScore {
  golferId: string
  roundId: number
  holeNumber: number      // 1-18 (for future hole-by-hole)
  scoreToPar: number      // relative to par: -3=eagle, -2=birdie, -1=par, 0=bogey, +1=double-bogey+
  isComplete: boolean     // hole has a valid score
}
```

### EntryHoleResult

```typescript
interface EntryHoleResult {
  roundId: number
  holeScores: PlayerHoleScore[]
  bestBallScore: number | null   // lowest score_to_par among active golfers for this hole
  isComplete: boolean             // at least one active golfer completed this hole
}
```

### EntryScoreAccumulator

```typescript
interface EntryScoreAccumulator {
  totalScore: number           // sum of best-ball scores across completed holes (null if no completed holes)
  totalBirdies: number         // count of holes where best-ball score <= -2
  completedHoles: number       // count of holes where isComplete === true
  activeGolferIds: string[]    // golfers still in the tournament (not cut/WD)
}
```

### EntryLeaderboardSummary

```typescript
interface EntryLeaderboardSummary {
  entryId: string
  totalScore: number | null
  totalBirdies: number
  completedRounds: number
  rank: number
  isTied: boolean
}
```

---

## Scoring Rules (Per the PRD)

**Best-ball scoring:**
- On each hole, the entry's score is the lowest score among its active golfers
- The entry's total is the sum of per-hole best-ball scores
- Only scored (complete) holes count toward the total
- Incomplete holes are ignored until officially available

**Golfer status:**
- `cut`: excluded from best-ball after the cut line
- `withdrawn`: excluded from best-ball after WD
- `active`: always included

**Birdie definition:**
- A hole where the best-ball score is -2 or better (birdie or better: eagle, albatross)
- Since `total_birdies` from the API is always 0, birdies are derived from `score_to_par` per hole

**Incomplete rounds (partial progress):**
- Only holes with `isComplete === true` count toward scoring
- The total is the sum of completed holes only
- Display should indicate "X of Y holes scored"

**Tiebreaking:**
1. Lower total score wins
2. Higher birdie count wins (derived from score_to_par)
3. If still tied, entries share the same rank and the next rank is skipped (standard competition ranking)

---

## Birdie Derivation Table

| score_to_par | Label | Counts as birdie? |
|---|---|---|
| -3 | Albatross (or better) | yes |
| -2 | Eagle | yes |
| -1 | Birdie | yes |
| 0 | Par | no |
| +1 | Bogey | no |
| +2 | Double bogey+ | no |

---

## Scoring Function Signatures

### Pure scoring module: `src/lib/scoring/domain.ts`

```typescript
// Domain types (exported for testing)
export interface PlayerHoleScore { golferId: string; roundId: number; scoreToPar: number; isComplete: boolean }
export interface EntryHoleResult { roundId: number; bestBallScore: number | null; isComplete: boolean }
export interface EntryScoreAccumulator { totalScore: number | null; totalBirdies: number; completedHoles: number; }

// Core computation — works from per-round score_to_par data
export function computeEntryScore(
  golferRoundScores: Map<string, { roundId: number; scoreToPar: number | null; status: GolferStatus; isComplete: boolean }[]>,
  activeGolferIds: string[]
): EntryScoreAccumulator

// Ranking with tiebreaker logic
export function rankEntries(
  entries: Entry[],
  golferRoundScores: Map<string, { roundId: number; scoreToPar: number | null; status: GolferStatus; isComplete: boolean }[]>
): EntryLeaderboardSummary[]

// Helpers
export function deriveCompletedRounds(allScores: TournamentScore[]): number
export function isActiveGolfer(status: GolferStatus): boolean
```

### Changes to `src/lib/scoring.ts`

- Keep `getEntryRoundScore` if still used by UI (it filters cut/WD correctly)
- Replace `calculateEntryTotalScore` with the new domain-based approach
- Replace `calculateEntryBirdies` with derivation from score_to_par
- Deprecate `rankEntries` (replaced by new function in domain module) or update to use the new scoring

### Boundary: pure scoring has no DB or network calls

The `src/lib/scoring/domain.ts` module accepts plain data (Maps, arrays) and returns plain results. No Supabase, no fetch calls. DB and API layers call into it.

---

## Data Availability Note

The Slash Golf `/leaderboard` endpoint provides:
- `total_score` per golfer (tournament running total)
- `rounds[]` with per-round `score_to_par`

Hole-by-hole data requires the `/scorecard` endpoint (not currently called). The proposed scoring model uses round-level `score_to_par` as the finest available grain. If hole-by-hole data becomes available in the future, the model extends naturally.

---

## Test Fixtures Required

1. **Normal: 4 active golfers, complete round** — all 4 active, all scored, verify best-ball sum and birdie count
2. **One golfer cut** — 3 active after cut, only pre-cut holes count, best-ball from remaining 3
3. **One golfer WD mid-round** — 3 active after WD, only completed holes before WD count
4. **Missing hole values** — partial round, only completed holes in score_to_par contribute
5. **Tie on score, broken by birdies** — two entries same total but different birdie counts
6. **Tie on score and birdies** — two entries identical, share rank, next rank skips

---

## Files to Create/Modify

| File | Change |
|---|---|
| `src/lib/scoring/domain.ts` | **Create** — pure scoring functions with domain types |
| `src/lib/scoring.ts` | **Modify** — replace broken functions, keep `getEntryRoundScore` if UI still needs it |
| `src/lib/scoring-refresh.ts` | **Modify** — call new domain scoring from the refresh path |
| `src/lib/__tests__/scoring.test.ts` | **Modify** — add test fixtures per spec, new domain tests |

---

## Exit Criteria

- Given a fixed set of round scores, results are exact and repeatable
- Birdies are derived correctly from score_to_par (not from a zero field)
- Cut/WD golfers are excluded from holes after their status change
- Partial rounds only count completed holes
- Tiebreaking is deterministic (score → birdies → shared rank)
- Pure scoring module has zero DB or network dependencies