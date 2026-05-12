# Quality Review — Task 3

## Summary

Diff range: `4b97fdc3ab8887c0ffd0a99407299ca98d3bdc12..f627545c80f0a680db5520aeddcf475eefd08a16`

## Step 1: rules-spec.md Section 2 Verification

**Result: CONSISTENT** — No changes needed.

`docs/rules-spec.md` lines 25–35 correctly describe hole-by-hole best-ball:

```
For each regulation hole in each counted round:
  1. Look at the selected golfers in the entry who are active.
  2. Use the lowest score-to-par among golfers with a valid score for that hole.
  3. Add that best hole score to the entry total.
  4. Count birdies/eagles as scoreToPar < 0 for the best-ball hole result.
```

This matches `design.md` Section 4.2's stated algorithm.

## Step 2: Existing Test Coverage

**Leaderboard test suite: PASS** (7 tests, 607ms)

```
npm test -- src/app/api/leaderboard/\[poolId\]/route.test.ts
# Test Files  1 passed (1)
#      Tests  7 passed (7)
```

## Step 3: getTournamentScoreRounds in Live API Path

**Result: CLEAN** — `getTournamentScoreRounds` appears only in test files.

```
rg "getTournamentScoreRounds" src/app/api/
# No files found
```

Only `route.test.ts` contains this symbol (for the negative regression test).

## Diff Analysis

### Files Changed

| File | Change |
|------|--------|
| `design.md` | Rewritten as implementation guide |
| `implement-task-1.log` | Build log artifact (should be .gitignored) |

### Code Changes in Diff

The diff shows the **outcome** of implementation work (not the implementation itself):

1. **`src/lib/scoring.ts`** — Removed `buildGolferRoundScoresMapFromScores` and `rankEntries` export. Correctly removes deprecated round-level path.

2. **`src/app/(app)/commissioner/pools/[poolId]/audit/score-trace/page.tsx`** — Updated import from `rankEntries` → `rankEntriesLegacy`. Correct migration for audit tooling.

3. **`src/lib/scoring-queries.ts`** — Removed `getTournamentScoreRounds` function. Correct cleanup.

4. **`src/app/api/leaderboard/[poolId]/route.test.ts`** — Added negative regression test asserting `domainRankEntries` is NOT called while `rankEntriesWithHoles` IS called. Correct.

5. **`src/lib/__tests__/scoring.test.ts`** — Added 3 new tests for round-gating and overlapping hole IDs. Correct.

## Strengths

- **Clean removal of deprecated code** — `buildGolferRoundScoresMapFromScores` and `rankEntries` removed from live path; `rankEntriesLegacy` preserved for audit tooling
- **Negative regression test** — Explicitly asserts the old `rankEntries` (round-level) is NOT called
- **Round-gating tests** — Added coverage for `computeEntryScore` round-completeness logic
- **No split-brain scoring risk** — Live API path exclusively uses `rankEntriesWithHoles` with `tournament_holes`
- **`getTournamentScoreRounds` fully excised** — No remaining references in live API code

## Issues

### Minor

1. **`implement-task-1.log` committed** — This is a build log artifact (2045 lines) that should not be committed. Should be removed and added to `.gitignore`.

### Pre-existing Test Failures (Unrelated to This Diff)

The following failures appear in the test run but are **not introduced by this diff** (they test components not touched: `LockBanner`, `SpectatorLeaderboard`, `scoring-edge-cases`, `scoring-refresh-edge-cases`):

- `LockBanner.test.tsx` — 2 failures (expects `border-amber` but gets `border-green`)
- `SpectatorLeaderboard.test.tsx` — 1 failure (gray-400 token check)
- `scoring-edge-cases.test.ts` — 2 failures
- `scoring-refresh-edge-cases.test.ts` — 6 failures
- `JoinPoolForm.test.tsx` — 3 failures

## Assessment

**APPROVED**

- `rules-spec.md` Section 2 already correctly describes hole-by-hole algorithm
- Leaderboard test suite passes (7/7)
- `getTournamentScoreRounds` has no live API path references
- Deprecated code correctly removed
- Negative regression test properly guards against round-level path reintroduction

**One cleanup item:** Remove `implement-task-1.log` and add to `.gitignore`.
