# spec-review-task-2.md

## Summary

✅ Spec compliant. All required changes implemented correctly.

## Verification

**Step 1 (Update existing mocks):** ✅
- Line 6: Import uses `rankEntriesWithHoles` from `@/lib/scoring`
- Line 7: Import uses `getTournamentHolesForGolfers` from `@/lib/scoring-queries`
- Lines 18-21: `@/lib/scoring` mock includes `rankEntriesWithHoles`
- Lines 23-25: `@/lib/scoring-queries` mock includes `getTournamentHolesForGolfers`

**Step 2 (New test added):** ✅
- Lines 322-389: New test `ranks entries from tournament_holes via rankEntriesWithHoles, not tournament_score_rounds` present
- Test uses `getTournamentHolesForGolfers` mock and `rankEntriesWithHoles` mock correctly
- Assertions verify correct call signatures (line 386-388)

**Step 3 (Existing tests updated):** ✅
- All 4 existing tests use `getTournamentHolesForGolfers` (lines 112, 181, 258, 309)
- All 4 existing tests use `rankEntriesWithHoles` (lines 113, 182, 259, 310)
- No tests reference old `getTournamentScoreRounds` or `rankEntries`

**Step 4 (Tests pass):** ✅
- 5/5 tests passing

**Note:** Extra mock for `@/lib/tournament-roster/queries` (lines 27-29) was not in the spec but is necessary — the route itself calls `getTournamentRosterGolfers` (route.ts:137). This is correct, not extra work.