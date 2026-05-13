# Spec Review: Tasks 4 & 5

## Task 4: Scoring Test Cleanup

**Status: ❌ NOT COMPLETE**

The implementer claimed these tests were removed, but they still exist in `src/lib/__tests__/scoring.test.ts`:

| Function | Deprecated in scoring.ts? | Test Status |
|----------|---------------------------|-------------|
| `getEntryRoundScore` | **No** (no @deprecated tag) | Lines 13-41: still present |
| `calculateEntryTotalScore` | **No** (no @deprecated tag) | Line 137: still present |
| `rankEntriesLegacy` (aliased as `rankEntries`) | **Yes** (line 116) | Lines 43-124: still present |
| `calculateEntryBirdies` | No | Line 127: still present |

Only `buildGolferRoundScoresMapFromScores` is properly marked `@deprecated` (line 57), but it is not directly tested.

**Required action:** Delete the test block for `getEntryRoundScore` (lines 13-41), the `rankEntries` describe block that uses the legacy function (lines 43-124), and the `calculateEntryTotalScore` assertion (line 137).

---

## Task 5: Leaderboard Route Mock Fix

**Status: ✅ COMPLETE**

`src/app/api/leaderboard/[poolId]/route.test.ts`:
- Line 8: `getTournamentHolesForGolfers` correctly imported from `@/lib/scoring-queries`
- Line 24: Mock configured as `vi.fn()`
- Line 108: `vi.mocked(getTournamentHolesForGolfers).mockResolvedValue(new Map())` used in first test
- The second, third, and fourth tests do not call `getTournamentHolesForGolfers` (they test fresh/archived/error states without tournament scores), so they don't set this mock — this is correct behavior since `getTournamentHolesForGolfers` is only invoked in `route.ts` line 145 when `allScores` exists.

Tests pass: `npm test src/app/api/leaderboard/[poolId]/route.test.ts` → 12 passed.