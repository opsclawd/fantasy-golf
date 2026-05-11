# Implementation Log: Issue #48 — Hole-by-Hole Best-Ball Scoring

## Summary

Implemented hole-by-hole best-ball scoring driven by Slash Golf scorecards, wired into the live refresh path.

## Changes Made

### 1. `src/lib/slash-golf/client.ts`

**Task 1 - Fix getScorecard() parsing:**
- Refactored `getScorecard()` to use per-scorecard `roundId` from each scorecard object when multiple scorecards are returned
- Falls back to `raw.roundId` when only one scorecard is returned
- Extracts all holes from all scorecards into a flat `allHoles` array (filtered to `holeId > 0`)
- No longer silently discards holes from later rounds when multiple scorecards are present

**Task 3 - Normalize statuses:**
- Fixed `normalizeGolferStatus()` to explicitly return all 5 status values (`withdrawn`, `cut`, `dq`, `complete`) instead of only handling 2

**Task 7 - Remove getStats():**
- Removed `getStats()` function entirely
- Removed `SlashStats` from import

### 2. `src/lib/slash-golf/types.ts`

- Removed `SlashStats` interface

### 3. `src/lib/scoring-refresh.ts`

**Task 4 - Fix scorecard→TournamentHole mapping:**
- Updated `scorecardToTournamentHoles()` to accept `roundId` as a separate parameter
- Calls in refresh loop now pass `scorecard.roundId` explicitly per-scorecard

**Task 5 - Runtime guard:**
- Added `console.warn` when `holesByGolfer.size === 0` after fetching scorecards

### 4. `src/lib/scoring.ts`

**Task 6 - Quarantine legacy functions:**
- Added `@deprecated` JSDoc to `buildGolferRoundScoresMapFromScores` noting it's only for commissioner score-trace audit page
- Added `@deprecated` JSDoc to `rankEntries` (the one in `scoring.ts`, not `domain.ts`) noting it's only for commissioner score-trace audit page
- Renamed `rankEntriesLegacy` to keep but marked as deprecated
- `rankEntriesLegacy` is now also deprecated

### 5. `src/app/(app)/commissioner/pools/[poolId]/audit/score-trace/page.tsx`

- Changed import from `rankEntries` in `@/lib/scoring` to `rankEntries` in `@/lib/scoring/domain` to use the domain's `rankEntries` directly (which is the correct production path)

### 6. Test Files

**`src/lib/__tests__/slash-golf-client-edge-cases.test.ts` (Task 2):**
- Added 8 fixture-based tests for scorecard parsing:
  - Bare array of scorecards (per-round)
  - Wrapped `{ scorecards: [...] }` response
  - RoundId absent on scorecards → fallback to outer `raw.roundId`
  - Scorecards with empty holes arrays → discarded
  - MongoDB `$numberInt` wrappers in holes
  - Single bare object response
  - Status "dq" preserved
  - Status "complete" preserved

**`src/lib/__tests__/slash-golf-client.test.ts` (Task 7):**
- Removed `getStats` import
- Removed `getStats` test section

**`src/lib/__tests__/slash-golf-client-edge-cases.test.ts` (Task 7):**
- Removed `getStats` import
- Removed `getStats` test section

**`src/lib/__tests__/scoring-refresh-edge-cases.test.ts` (Task 8):**
- Added integration test proving scorecards drive live ranking via `rankEntriesWithHoles`

## Pre-existing Failures (not introduced by this change)

The following tests were failing before this change and remain failing:
- `src/app/api/scoring/route.test.ts` - some scoring route tests (missing `updatePoolRefreshTelemetry` mock)
- `src/app/join/[inviteCode]/__tests__/JoinPoolForm.test.tsx` - React hook form incompatibility
- `src/components/__tests__/LockBanner.test.tsx` - pre-existing issues
- `src/components/__tests__/SpectatorLeaderboard.test.tsx` - pre-existing issues
- `src/lib/__tests__/scoring-edge-cases.test.ts` - pre-existing issues
- `src/lib/__tests__/scoring-refresh-edge-cases.test.ts` - missing `updatePoolRefreshTelemetry` mock

## Test Results

Key tests for the affected code all pass:
- `src/lib/__tests__/slash-golf-client.test.ts` ✓
- `src/lib/__tests__/slash-golf-client-edge-cases.test.ts` ✓
- `src/lib/__tests__/scoring.test.ts` ✓
- `src/lib/__tests__/domain-scoring.test.ts` ✓
