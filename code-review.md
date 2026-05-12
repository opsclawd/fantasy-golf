# Code Review: `ai/issue-51` → `main`

## Summary

The branch correctly migrates the leaderboard GET endpoint from round-based pseudo-hole scoring to true hole-by-hole best-ball scoring. However, one **critical bug** was identified by the included quality review but not fixed before this review cycle.

---

## Critical

### `route.ts:159` — `golferStatuses` Map will serialize as `{}` in JSON response

**Severity:** critical

**File:** `src/app/api/leaderboard/[poolId]/route.ts`

**Evidence:**
```typescript
// Line 126: golferStatuses is a Map
const golferStatuses: Map<string, 'active' | 'cut' | 'withdrawn'> = new Map()

// Line 159: passed directly to NextResponse.json()
return NextResponse.json({
  data: {
    // ...
    golferStatuses,   // ← Map serializes as {} via JSON.stringify
    // ...
  },
})
```

`JSON.stringify(new Map([['g1','cut']]))` returns `'{}'` — all golfer status data is **silently dropped** from the API response.

**Failure mode:** All clients consuming `golferStatuses` from the leaderboard GET receive an empty object regardless of how many golfers are cut or withdrawn. UI that relies on this to display status badges will show nothing.

**Required fix:**
```typescript
golferStatuses: Object.fromEntries(golferStatuses),
```
Line 159 should use `Object.fromEntries()` the same way line 162 uses it for `golferScoresMap`:
```typescript
golferScores: Object.fromEntries(golferScoresMap),
```

---

## High

None.

---

## Medium

### `route.ts` — `getTournamentRosterGolfers` result not validated in new test

**Severity:** medium

**File:** `src/app/api/leaderboard/[poolId]/route.test.ts:333`

**Evidence:** The new test at line 333 mocks `getTournamentRosterGolfers.mockResolvedValue([])` but the test does not assert that `golferNames` or `golferCountries` are correctly populated from this call. The route builds `golferNames` and `golferCountries` from this function's result (lines 138–142 of route.ts), but the test never checks the shape or content of those fields in the response body.

**Failure mode:** If `getTournamentRosterGolfers` returns unexpected data shape, `golferNames`/`golferCountries` will be silently wrong in the response with no test catching it.

**Required fix:** Add assertion on `body.data.golferNames` and `body.data.golferCountries` in the new test, or verify the function is called with the expected tournament ID.

---

## Low

### `route.test.ts` — `deriveCompletedRounds` mock in new test returns hardcoded `2`

**Severity:** low

**File:** `src/app/api/leaderboard/[poolId]/route.test.ts:335`

**Evidence:**
```typescript
vi.mocked(deriveCompletedRounds).mockReturnValue(2)
```

The new test hardcodes `completedRounds = 2` rather than deriving it from the mocked `tournament_scores` data in the mock setup. The assertion at line 344 (`expect(rankEntriesWithHoles).toHaveBeenCalledWith(entries, holesByGolfer, expect.any(Map), 2)`) verifies the value is passed through, but this coupling means the test could pass with an incorrect derivation logic.

**Failure mode:** Low — the hardcoded value is intentional in the test design, and the assertion validates the integration. Not a regression risk.

**Suggestion:** No action required; this is acceptable test design.

---

## Positive Findings

1. **`route.ts` — Correct migration**: The scoring path is correctly migrated from `getTournamentScoreRounds` + `rankEntries` (round-level pseudo-hole) to `getTournamentHolesForGolfers` + `rankEntriesWithHoles` (true hole-by-hole). The fake `holeId: 1` construction is gone.

2. **`route.ts` — `allGolferIds` correctly moved earlier**: The set collection now happens before the `!allScores` early-return (lines 96–102), ensuring `getTournamentHolesForGolfers` has the required IDs in both code paths. The previous placement (after line 137) would have caused an undefined error in the early-return path.

3. **`route.ts` — Removed dead code**: `GolferRoundScoresMap` type and `getTournamentScoreRounds` import are fully removed. No trace of the old path remains in the file.

4. **Test coverage**: The new test at line 1279 (`ranks entries from tournament_holes via rankEntriesWithHoles`) correctly validates that the hole-level path is used. It verifies `getTournamentHolesForGolfers` is called with correct golfer IDs and `rankEntriesWithHoles` is called with the right signature.

5. **README.md and `docs/rules-spec.md`**: Scoring description correctly updated from "Round-based best-ball" to "Hole-by-hole best-ball". The rules-spec pseudo-code now correctly describes per-hole iteration.

6. **`scripts/ai-run-issue-v2.sh`**: Orchestrator workflow correctly split into `plan-design` (brainstorming) and `plan-write` (implementation plan) phases. Removes obsolete fallback plan-logic.

---

## Unresolved Note

The file `quality-review-task-1.md` (included in the diff at lines 730–747) **explicitly identifies the critical Map serialization bug** as needing a fix:

> **Line 159: `golferStatuses` Map won't serialize correctly in JSON response**
> `golferStatuses: Object.fromEntries(golferStatuses),`

The quality review rates the implementation **NEEDS_WORK** and states the fix "must be fixed before this is production-ready." However, the code-review.md was written without the fix being applied. The finding was documented but not resolved.

---

## Verdict

**Do not merge** until the critical `golferStatuses` serialization bug at `route.ts:159` is fixed with `Object.fromEntries(golferStatuses)`.
