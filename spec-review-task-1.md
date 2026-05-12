# Spec Review: Leaderboard API Migration

## Verdict: ✅ Spec compliant

## Step-by-step verification

| Step | Requirement | Status |
|------|-------------|--------|
| 1 | Imports: remove `rankEntries` from `@/lib/scoring/domain`, remove `getTournamentScoreRounds` from `@/lib/scoring-queries`; add `rankEntriesWithHoles` from `@/lib/scoring`, add `getTournamentHolesForGolfers` from `@/lib/scoring-queries` | ✅ Line 3, 7 |
| 2 | Remove `getTournamentScoreRounds` call and fake hole building | ✅ Not present |
| 3 | Add `getTournamentHolesForGolfers` after `allGolferIds` collection | ✅ Line 146 |
| 4 | `golferStatuses` as `Map<string, 'active' \| 'cut' \| 'withdrawn'>` | ✅ Line 126 |
| 5 | Replace `rankEntries` with `rankEntriesWithHoles` | ✅ Line 148 |
| 6 | Early-return path uses `rankEntriesWithHoles` with empty maps | ✅ Line 105 |
| 7 | Lint passes | ✅ |
| 7 | Build passes | ✅ |

## Notes

- `GolferRoundScoresMap` type import correctly removed — not present in file
- Active golfers are absent from `golferStatuses` map, relying on `golferStatuses.get(golferId) ?? 'active'` default as specified
- `golferStatuses` correctly passed as `Map` to `rankEntriesWithHoles` (not `Object.fromEntries`)