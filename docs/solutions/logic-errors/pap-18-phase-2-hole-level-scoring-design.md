# PAP-18 Phase 2 — Hole-Level Scoring Domain Design

**Issue:** [PAP-18](/PAP/issues/PAP-18)
**Date:** 2026-04-22
**Status:** Design spec — auto-approved, handing off to Builder

---

## Context

PAP-18 builds on the Phase 1 scoring domain (already in `src/lib/scoring/domain.ts`). The Phase 1 domain operates at round level — `PlayerHoleScore` uses `roundId` which in practice maps to one round per golfer per tournament, not per hole.

The Phase 2 spec requires hole-level scoring with per-hole best-ball logic. However, the scorecard endpoint ingestion is explicitly out of scope (per "Scope Boundaries" in the spec). This design addresses what CAN be fixed now given current data shapes, and clearly delimits the scorecard work as a future phase.

---

## Changes from Phase 1 Domain

### 1. `isBirdie` threshold (R5)

**Current:** `scoreToPar <= -1` (only eagles and better count as birdies)  
**R5 says:** `holeScore < par` → equivalently `scoreToPar < 0`  
**Fix:** Change to `scoreToPar < 0`

**Rationale:** A hole at -1 (one under par) IS a birdie. The Phase 1 implementation was conservatively strict (only eagles+). R5 is explicit: birdie = holeScore < par. Par is 0 in score-to-par terms, so any negative score qualifies.

### 2. `EntryLeaderboardSummary.completedHoles` (R3)

**Current:** `EntryLeaderboardSummary` has `completedRounds`  
**R3 requires:** `completedHoles` — hole-level count, not round count  
**Fix:** Rename/add field. Since hole-level tracking requires scorecard data (out of scope), this field will track at the round level for now but be named to reflect future hole-level semantics. The `completedRounds` field from Phase 1 is retained.

**Note:** `computeEntryScore` already returns `completedHoles` (from round-level counting). The domain type just needs to expose it on `EntryLeaderboardSummary`.

### 3. `isComplete` in scoring-refresh (R9)

**Current:** `isComplete` hardcoded to `true` in `scoring-refresh.ts:153`  
**R9 requires:** Only holes with `isComplete === true` count toward scoring  
**Fix:** Determine `isComplete` from actual score data. For now, a round is complete if `strokes !== null`. This will be replaced when scorecard ingestion lands.

### 4. Scorecard adapter (outstanding question from spec)

The spec flags as deferred to planning: "How does the adapter convert scorecard response `holes` object into `PlayerHoleScore[]` format?"

**Decision:** This is out of scope for this phase. We document the contract here so scorecard ingestion can plug in cleanly:

```typescript
/**
 * Adapter contract: scorecard holes → domain PlayerHoleScore[]
 * 
 * Input: Slash Golf scorecard `holes` object:
 *   { "1": { holeId: 1, holeScore: 4, par: 4 }, "2": { holeId: 2, holeScore: 3, par: 4 }, ... }
 * 
 * Output: PlayerHoleScore[]
 *   [
 *     { holeNumber: 1, roundId: 1, golferId: "...", scoreToPar: 0, isComplete: true },
 *     { holeNumber: 2, roundId: 1, golferId: "...", scoreToPar: -1, isComplete: true },
 *     ...
 *   ]
 * 
 * scoreToPar = holeScore - par
 * isComplete = strokes !== null (round is complete if strokes recorded)
 */
```

This adapter function goes in `src/lib/scoring/scorecard-adapter.ts` (future phase).

---

## Types

```typescript
// src/lib/scoring/domain.ts (changes only)

export interface PlayerHoleScore {
  roundId: number
  scoreToPar: number | null
  status: GolferStatus
  isComplete: boolean
}
// NOTE: holeNumber field not yet available — requires scorecard ingestion (future phase)
// Until then, roundId serves as the primary grouping dimension

export interface EntryHoleResult {
  roundId: number
  bestBallScore: number | null
  isComplete: boolean
}

export interface EntryLeaderboardSummary {
  entryId: string
  totalScore: number | null
  totalBirdies: number
  completedRounds: number   // legacy round-level count
  completedHoles: number    // R3: hole-level count (future: populated from scorecard)
  rank: number
  isTied: boolean
}
```

---

## Scoring Rules (unchanged from Phase 1, except birdie threshold)

- Best-ball per round: entry score = lowest score_to_par among active golfers with `isComplete === true`
- Birdie = `scoreToPar < 0` (any below-par score, not just eagles)
- Cut/WD exclusion: golfers with non-'active' status excluded from that round onward
- Only `isComplete === true` rounds count
- Tiebreaking: score → birdies → entry ID (stable sort)

---

## Files to Modify

| File | Change |
|---|---|
| `src/lib/scoring/domain.ts` | Fix `isBirdie` threshold, add `completedHoles` to `EntryLeaderboardSummary` |
| `src/lib/scoring-refresh.ts` | Derive `isComplete` from `strokes !== null` instead of hardcoded `true` |
| `src/lib/__tests__/domain-scoring.test.ts` | Fix expected birdies in test fixtures where `scoreToPar === -1` |
| `src/lib/__tests__/scoring.test.ts` | Update birdie expectations in `rankEntries` tests |

---

## Test Fixtures (unchanged — already cover the required cases)

The six fixtures in `domain-scoring.test.ts` already cover the required cases:
1. Normal 4-active complete round ✓
2. One golfer cut ✓
3. One golfer WD mid-round ✓
4. Partial round ✓
5. Tie broken by birdies ✓
6. Tie on score and birdies with shared rank ✓

**Fixture fix needed:** Some fixtures use `scoreToPar === -1` and expect birdies. With the threshold change to `< 0`, these will now correctly count as birdies. Update expected values in affected tests.

---

## Assumptions

1. Until scorecard ingestion lands, `PlayerHoleScore.roundId` serves as the primary scoring dimension (round level, not hole level)
2. `isComplete` is derived from `strokes !== null` for current data; scorecard ingestion will provide per-hole `isComplete`
3. Hole-level best-ball (per-hole summing) requires scorecard data — not implementable with current round-level data

---

## Exit Criteria

- `isBirdie` uses `scoreToPar < 0` (any negative score = birdie)
- `EntryLeaderboardSummary` has `completedHoles` field
- `isComplete` derived from actual data (`strokes !== null`)
- All existing tests pass with updated birdie expectations
- Zero DB/network deps in scoring domain (unchanged)