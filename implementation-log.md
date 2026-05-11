# Implementation Log: Issue #48 — Hole-by-Hole Best-Ball Scoring

## Summary

Implemented hole-by-hole best-ball scoring driven by Slash Golf scorecards, wired into the live refresh path and leaderboard API.

## Changes Made

### 1. `src/lib/slash-golf/client.ts`

**Task 1 - Fix getScorecard() parsing:**
- Added `getScorecards()` function that returns array of `SlashScorecard` with per-scorecard `roundId`
- `getScorecard()` now delegates to `getScorecards()` and returns first scorecard
- RoundId assignment: each scorecard uses its own `roundId`, falling back to `raw.roundId ?? 1` only for idx 0

**Task 3 - Normalize statuses:**
- `normalizeGolferStatus()` was already correct (preserves all 5 statuses)

### 2. `src/lib/scoring-refresh.ts`

**Task 4 - Fix scorecard→TournamentHole mapping:**
- Changed import from `getScorecard` to `getScorecards`
- Loop now calls `getScorecards()` and iterates over all scorecards, passing each one's `roundId` to `scorecardToTournamentHoles()`

**Task 5a - Runtime guard:**
- Added `console.warn` when `holesByGolfer.size === 0` after fetching scorecards
- Added `console.warn` when no hole data was persisted (`holesPersisted === false`)

### 3. `src/lib/scoring.ts`

**Task 6 - Quarantine legacy functions:**
- Kept `rankEntries` (takes `Map<string, TournamentScore>`) for score-trace page compatibility
- Kept `buildGolferRoundScoresMapFromScores` (private, used by `rankEntries`)
- Kept `rankEntriesLegacy` but marked deprecated
- `rankEntriesWithHoles` is the production path

### 4. `src/app/api/leaderboard/[poolId]/route.ts`

**Leaderboard now uses hole-level ranking:**
- Removed `getTournamentScoreRounds` and `rankEntries` from domain
- Added `getTournamentHolesForGolfers` from scoring-queries
- Added `rankEntriesWithHoles` from scoring
- Added `getTournamentRosterGolfers` for golfer names
- Fetches `holesByGolfer` and calls `rankEntriesWithHoles()` directly instead of building round-level aggregates

### 5. Test File Updates

**`src/lib/__tests__/scoring.test.ts`:**
- Removed `rankEntriesLegacy as rankEntries` import
- Removed tests for deprecated `rankEntries` and `rankEntriesLegacy`

**`src/lib/__tests__/scoring-refresh.test.ts`:**
- Added `getScorecards` to mock
- Changed `getScorecard` mock to `getScorecards`

**`src/lib/__tests__/scoring-refresh-edge-cases.test.ts`:**
- Added `getScorecards` mock
- Added `getTournamentHolesForGolfers` mock
- Added `upsertTournamentHoles` mock
- Changed `rankEntries` mock from domain to `rankEntriesWithHoles`
- Updated test cases to mock the new functions

**`src/app/api/scoring/route.test.ts`:**
- Added `getScorecards`, `getTournamentHolesForGolfers`, `upsertTournamentHoles`, `rankEntriesWithHoles` to mocks
- Changed `rankEntries` mock to `rankEntriesWithHoles`

**`src/app/api/leaderboard/[poolId]/route.test.ts`:**
- Changed mocks from `rankEntries` (domain) + `getTournamentScoreRounds` to `rankEntriesWithHoles` (scoring) + `getTournamentHolesForGolfers` + `getTournamentRosterGolfers`
- Updated test assertions for new `rankEntriesWithHoles` signature

### 6. Pre-existing Failures (unrelated to this change)

- `JoinPoolForm.test.tsx` - React `useFormState` incompatibility with test environment
- `LockBanner.test.tsx` - Token migration tests for amber/timezone
- `SpectatorLeaderboard.test.tsx` - Token migration test for gray-400

## Verification

- `npm run build` ✓ (compiles successfully)
- `npm run lint` ✓ (no errors)
- 453 tests passing (11 failing from pre-existing issues)
