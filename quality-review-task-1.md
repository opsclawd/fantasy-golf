# Quality Review: Migrate leaderboard GET to `rankEntriesWithHoles`

## Assessment: NEEDS_WORK

---

## Strengths

- **All 7 task steps correctly implemented**: Imports updated, `getTournamentScoreRounds` removed, `getTournamentHolesForGolfers` added, `golferStatuses` converted to `Map`, both call sites updated to `rankEntriesWithHoles`, `GolferRoundScoresMap` type removed
- **Lint**: Clean, no warnings or errors
- **Build**: Compiles successfully, no type errors
- **Tests**: All 5 leaderboard route tests pass
- **Cleaner domain logic**: Removing manual hole-building in favor of `getTournamentHolesForGolfers` is more maintainable

---

## Issues

### Minor: `golferStatuses` Map not converted to plain object for JSON response

**Severity:** Minor

**Location:** `src/app/api/leaderboard/[poolId]/route.ts:159`

**Problem:** `golferStatuses` is a `Map<string, 'active' | 'cut' | 'withdrawn'>` but is passed directly to the JSON response. `JSON.stringify()` does not serialize Maps — it returns `{}`. Meanwhile, `golferScores` on line 162 uses `Object.fromEntries(golferScoresMap)` to convert before serialization.

```typescript
// Line 159 — golferStatuses is a Map, will serialize as {}
golferStatuses,

// Line 162 — golferScores uses Object.fromEntries to convert Map to plain object
golferScores: Object.fromEntries(golferScoresMap),
```

**Fix:** Either convert with `Object.fromEntries()` for consistency:
```typescript
golferStatuses: Object.fromEntries(golferStatuses),
```

Or change the type declaration to `Record<string, 'active' | 'cut' | 'withdrawn'>` and build it as a plain object from the start (the original intent before this migration).

**Note:** This may not cause a visible bug if the client either (a) doesn't read `golferStatuses` from the response, or (b) has its own fallback. But it is inconsistent with how `golferScores` is handled and could cause silent data loss.

---

## Verification

| Check | Result |
|-------|--------|
| `npm run lint` | PASS |
| `npm run build` | PASS |
| Leaderboard route tests | 5/5 PASS |
| Pre-existing test failures (JoinPoolForm, scoring route) | UNRELATED to this change |

---

## Summary

The migration is functionally complete and all specified verification passes. The one issue is minor and involves JSON serialization of a Map type — a pattern inconsistency rather than a hard error. Recommend fixing for consistency with how `golferScores` is handled.
