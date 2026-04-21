# PAP-14 Phase 2 — Scoring Model Domain Design

**Issue:** [PAP-14 Phase 2 — fix the scoring model at the domain level](/PAP/issues/PAP-14)
**Date:** 2026-04-20
**Status:** Design spec — for Board approval

---

## Context

PAP-14 Phase 1 (codebase-audit.md) identified five defects. The critical defect: `total_birdies` is always 0 because the Slash Golf leaderboard endpoint never provides a birdie field. The ranking function uses birdies as a tiebreaker, making tie ordering effectively random.

The Phase 2 brief requires:
1. A clean internal domain model for scoring
2. Rewritten scoring functions that do not depend on minimum total golfer score
3. Birdies derived from hole-level score_to_par (since leaderboard has no birdie field)
4. Handling of partial/incomplete rounds
5. A pure scoring service boundary (no DB or network side effects)

---

## Existing Scoring Problems

- `calculateEntryTotalScore` uses `Math.min(...scores)` — minimum tournament total, not best-ball-per-hole
- `calculateEntryBirdies` sums stored `total_birdies` which is always 0
- `rankEntries` uses birdies as tiebreaker but birdies are always 0
- No concept of scored vs incomplete holes

---

## Proposed Domain Model

### Types

```typescript
interface PlayerHoleScore {
  golferId: string
  roundId: number
  scoreToPar: number
  isComplete: boolean
}

interface EntryHoleResult {
  roundId: number
  bestBallScore: number | null
  isComplete: boolean
}

interface EntryScoreAccumulator {
  totalScore: number | null
  totalBirdies: number
  completedHoles: number
  activeGolferIds: string[]
}

interface EntryLeaderboardSummary {
  entryId: string
  totalScore: number | null
  totalBirdies: number
  completedRounds: number
  rank: number
  isTied: boolean
}
```

### Scoring Rules

- Best-ball: on each hole, entry score = lowest score_to_par among active golfers
- Only complete holes count toward total
- Birdie = hole where best-ball score_to_par <= -2 (eagle or birdie)
- Cut/WD golfers excluded from holes after their status change
- Ties broken by: (1) lower score, (2) more birdies, (3) shared rank with next rank skipped

### Birdie Derivation

| score_to_par | Label | Birdie? |
|---|---|---|
| -3 | Albatross+ | yes |
| -2 | Eagle | yes |
| -1 | Birdie | yes |
| 0 | Par | no |
| +1 | Bogey+ | no |

---

## Pure Scoring Module: `src/lib/scoring/domain.ts`

```typescript
export interface PlayerHoleScore { golferId: string; roundId: number; scoreToPar: number; isComplete: boolean }
export interface EntryHoleResult { roundId: number; bestBallScore: number | null; isComplete: boolean }
export interface EntryScoreAccumulator { totalScore: number | null; totalBirdies: number; completedHoles: number }

export function computeEntryScore(
  golferRoundScores: Map<string, { roundId: number; scoreToPar: number | null; status: GolferStatus; isComplete: boolean }[]>,
  activeGolferIds: string[]
): EntryScoreAccumulator
export function rankEntries(
  entries: Entry[],
  golferRoundScores: Map<string, { roundId: number; scoreToPar: number | null; status: GolferStatus; isComplete: boolean }[]>
): EntryLeaderboardSummary[]
export function deriveCompletedRounds(allScores: TournamentScore[]): number
export function isActiveGolfer(status: GolferStatus): boolean
```

Boundary: zero DB or network dependencies.

---

## Files to Create/Modify

| File | Change |
|---|---|
| `src/lib/scoring/domain.ts` | Create — pure scoring functions |
| `src/lib/scoring.ts` | Modify — replace broken functions |
| `src/lib/scoring-refresh.ts` | Modify — call new domain scoring |
| `src/lib/__tests__/scoring.test.ts` | Modify — add test fixtures |

---

## Test Fixtures

1. Normal: 4 active golfers, complete round
2. One golfer cut — 3 active after cut
3. One golfer WD mid-round
4. Missing hole values — partial round
5. Tie on score, broken by birdies
6. Tie on score and birdies — shared rank

---

## Exit Criteria

- Given a fixed set of round scores, results are exact and repeatable
- Birdies derived from score_to_par (not zero field)
- Cut/WD correctly excluded post-status-change
- Partial rounds only count completed holes
- Tiebreaking deterministic
- Pure scoring module has zero DB/network deps
