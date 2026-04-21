# Design Spec: OPS-46 — Tournament Scores Per-Round Overwrite Bug Fix

## Issue Summary

**Issue:** OPS-46 — "Implement: Tournament scores per-round overwrite bug fix"
**Priority:** Critical
**Status:** DESIGNING

## Problem Statement

The `tournament_scores` table was originally designed as a single-row-per-golfer table. When the Slash Golf API refreshed, it would overwrite the previous round's data with the current round's data, losing historical round-by-round information.

## Solution That Was Implemented

Two-table split design, committed in `1bedc55` and `987b47b`:

### 1. `tournament_score_rounds` — Append-Only Archive

```sql
CREATE TABLE tournament_score_rounds (
  ...
  UNIQUE(golfer_id, tournament_id, round_id)
);
```

Upsert with `onConflict: 'golfer_id,tournament_id,round_id'` ensures each round is written once and never modified.

### 2. `tournament_scores` — Current State

Lean row for leaderboard queries. Updated on every refresh but does not store per-round historical data.

### 3. Dual-Write in `upsertTournamentScore()`

```typescript
// 1. Archive each round from the rounds array
for (const roundRecord of roundRecords) {
  await supabase
    .from('tournament_score_rounds')
    .upsert(roundRecord, { onConflict: 'golfer_id,tournament_id,round_id' })
}

// 2. Write current state
await supabase
  .from('tournament_scores')
  .upsert({ ... }, { onConflict: 'golfer_id,tournament_id' })
```

## Verification Tasks

### Task 1: Confirm Round Archiving

**Verification:** Given a `GolferScore` with `rounds = [R1, R2]`, verify:
- `tournament_score_rounds` gets two upserts: (golfer, tournament, 1) and (golfer, tournament, 2)
- `tournament_scores` gets one upsert with `round_id = 2` (current round)

**Evidence:** Unit test in `src/lib/__tests__/scoring-queries.test.ts` passes. Manual test via Supabase:
```sql
SELECT golfer_id, tournament_id, round_id, strokes, score_to_par
FROM tournament_score_rounds
WHERE golfer_id = 'X' AND tournament_id = 'Y'
ORDER BY round_id;
```

### Task 2: Confirm No Round Overwrite

**Verification:** When API refresh sends rounds [R1, R2, R3] for the same golfer:
- First refresh: `tournament_score_rounds` has R1, R2
- Second refresh: `tournament_score_rounds` must still have R1, R2 (not overwritten)
- Only the `tournament_scores` row gets updated to R3

**Mechanism:** The `UNIQUE(golfer_id, tournament_id, round_id)` constraint prevents R1/R2 from being modified by subsequent upserts.

### Task 3: Confirm Zero-Value Preservation

**Verification:** Commits `eafdec8` added `parseMongoNumber()` to handle MongoDB numeric wrappers like `{ '$numberInt': '0' }`. Verify:
- `strokes: 0`, `score_to_par: 0`, `thru: 0` are preserved and not treated as null

**Evidence:** Test in `src/lib/__tests__/slash-golf-client.test.ts` covers zero-value handling.

### Task 4: Confirm API Parsing Handles Full Rounds Array

**Verification:** The `slash-golf/client.ts` `normalizeTournamentScores()` function:
- Detects round-based shape via `'rounds' in scoreRecord`
- Maps `rounds[].roundId` → `GolferScoreRound.round_id` via `parseMongoNumber()`
- Maps `rounds[].strokes` → `strokes` via `parseScoreValue()`
- Maps `rounds[].scoreToPar` → `score_to_par` via `parseScoreValue()`
- Maps `rounds[].courseId` / `rounds[].courseName` correctly

## Acceptance Criteria

1. **Round data persists:** After multiple API refreshes, `tournament_score_rounds` contains all historical rounds for each golfer, not just the latest.
2. **No data loss on refresh:** Re-fetching scores does not overwrite previously stored round data in the archive table.
3. **Zero values preserved:** `strokes: 0` and `score_to_par: 0` are stored as integers, not discarded as null.
4. **Archive constraint active:** The `UNIQUE(golfer_id, tournament_id, round_id)` constraint prevents duplicate round entries.
5. **Current state accurate:** `tournament_scores.round_id` reflects the latest round from the API.

## Implementation Plan Structure

The implementation plan will consist of:
1. Schema verification (check RLS, constraint, indexes)
2. Integration test for round preservation across multiple refresh cycles
3. Zero-value edge case test
4. End-to-end verification of the full refresh pipeline

## Design Decisions

**Decision 1:** Do not modify the scoring-queries or scoring-refresh logic since it is already correctly implemented.

**Decision 2:** Add integration-level verification tests rather than modifying unit tests, since the unit tests already pass and correctly verify the dual-write behavior.

**Decision 3:** Keep the solution doc reference as the authoritative description rather than duplicating its content here.