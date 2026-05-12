# spec-review-task-4

## Review: Confirm leaderboard endpoint uses hole-level scoring path

### Files Reviewed
- `src/app/api/leaderboard/[poolId]/route.ts` (179 lines)
- `src/app/api/leaderboard/[poolId]/route.test.ts` (494 lines)

---

## Step 1: Run leaderboard test suite

**Command:** `npm test -- src/app/api/leaderboard/[poolId]/route.test.ts`
**Result:** ✅ PASS — 7 passed (7)

The test at line 328 (`ranks entries from tournament_holes via rankEntriesWithHoles, not tournament_score_rounds`) validates the correct behavior. Additional tests cover:
- Stale data refresh triggering (line 133)
- Refresh error surfacing (line 210)
- No refresh for archived pools (line 287)
- Round disambiguation across holes (line 437)

---

## Step 2: Confirm no `getTournamentScoreRounds` in live API path

**Command:** `rg "getTournamentScoreRounds" src/app/api/`
**Result:** ✅ No matches in `src/app/api/`

The route uses:
- `getTournamentHolesForGolfers` (from `@/lib/scoring-queries`) — hole-level data
- `rankEntriesWithHoles` (from `@/lib/scoring`) — hole-level ranking function

`getTournamentScoreRounds` is not imported or called anywhere in the live API path.

---

## Step 3: Commit confirmation

**Command:** `git log -1 --stat`
**Result:** ✅ Commit `df83cb9` exists with message "test: confirm leaderboard endpoint uses hole-level path"

---

## Verdict

✅ **Spec compliant**

- No use of round-level `getTournamentScoreRounds` in the leaderboard API path
- Uses hole-level `getTournamentHolesForGolfers` + `rankEntriesWithHoles` as required
- Tests pass and cover the correct ranking path
- Commit confirmed