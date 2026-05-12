# Code Review: `ai/issue-51` → `main`

## Summary

The branch scope was to fix the leaderboard GET endpoint and align docs with hole-by-hole best-ball scoring. The documentation updates are correct, and the routing logic migration looks sound. However, **16 tests are failing** — the implementation didn't complete the final verification step. The branch is not ready to merge.

---

## Critical

### Tests failing — implementation incomplete

**Severity:** critical

**Files:** Multiple test files failing (see evidence below)

**Evidence:** The `npm test` run in `implement-task-1.log` shows 16 failing tests:

```
❯ src/lib/__tests__/scoring-edge-cases.test.ts (5 tests | 2 failed)
❯ src/lib/__tests__/scoring-refresh-edge-cases.test.ts (6 tests | 6 failed)
❯ src/app/api/scoring/route.test.ts (3 tests | 2 failed)
❯ src/app/join/[inviteCode]/__tests__/JoinPoolForm.test.tsx (3 tests | 3 failed)
❯ src/components/__tests__/SpectatorLeaderboard.test.tsx (30 tests | 1 failed)
❯ src/components/__tests__/LockBanner.test.tsx (7 tests | 2 failed)
```

**Failure mode:** Pre-existing tests are broken by the changes. This is a regression — the branch modified `scoring-queries.ts` (removed `getTournamentScoreRounds`) and `scoring.ts` (removed `rankEntries` and `buildGolferRoundScoresMapFromScores`), but the test mocks for the scoring route were not updated to provide the new function names.

Specific error pattern in scoring refresh tests:
```
Error: [vitest] No "getTournamentHolesForGolfers" export is defined on the "@/lib/scoring-queries" mock.
```

The `scoring-refresh-edge-cases.test.ts` mock for `@/lib/pool-queries` is also missing `updatePoolRefreshTelemetry`.

**Required fix:** Before merging, run `npm test -- --run` and fix all 16 failing tests. Common patterns:
1. Add `getTournamentHolesForGolfers` to the `@/lib/scoring-queries` mock in `route.test.ts`
2. Add `updatePoolRefreshTelemetry` to the `@/lib/pool-queries` mock in `scoring-refresh-edge-cases.test.ts`
3. Fix `LockBanner.test.tsx` — tests expect `border-amber` but component renders `border-green-200`
4. Fix `SpectatorLeaderboard.test.tsx` — `gray-400` token still present in source

---

### `route.test.ts` — `getTournamentRosterGolfers` result not validated in new test

**Severity:** high

**File:** `src/app/api/leaderboard/[poolId]/route.test.ts:333`

**Evidence:** The new test mocks `getTournamentRosterGolfers.mockResolvedValue([])` but never asserts that `golferNames` or `golferCountries` are correctly populated from this call. The route builds these from `getTournamentRosterGolfers` output (route.ts:138–142), but the test never checks the shape or content of those fields in the response body.

**Failure mode:** Silent data shape mismatch — if `getTournamentRosterGolfers` returns unexpected structure, `golferNames`/`golferCountries` will be wrong in the response with no test catching it.

**Required fix:** Add assertions on `body.data.golferNames` and `body.data.golferCountries` in the new test, or verify the function is called with the expected tournament ID.

---

## Medium

### `scoring-queries.ts` — Removed `getTournamentScoreRounds` breaks scoring refresh path

**Severity:** high

**File:** `src/lib/scoring-queries.ts`

**Evidence:** The function `getTournamentScoreRounds` was removed from the file. However, `implement-task-1.log` shows the change was made:
```
- export async function getTournamentScoreRounds(
-   supabase: SupabaseClient,
-   tournamentId: string
- ): Promise<TournamentScoreRound[]> {
```

And `src/app/api/scoring/route.test.ts` still uses a mock for `@/lib/scoring-queries` that relies on `importOriginal` pattern but may not provide all required exports.

**Failure mode:** The scoring refresh POST handler at `src/app/api/scoring/route.ts` likely still calls `getTournamentScoreRounds` or depends on `getTournamentHolesForGolfers` — but the test mocks were not updated to include these in the `vi.mock` return value.

**Required fix:** Verify that the scoring refresh path (POST `/api/scoring`) doesn't need `getTournamentScoreRounds`. If it does, either restore the function or update the route to use the new query path.

---

### `scoring.ts` — `rankEntries` removed but referenced in `route.test.ts` mock

**Severity:** high

**File:** `src/lib/scoring.ts` (export removed), `src/app/api/leaderboard/[poolId]/route.test.ts` (mock at lines 649–652)

**Evidence:**
```
# In scoring.ts, rankEntries export was removed:
- export function rankEntries(
-   entries: Entry[],
-   golferScores: Map<string, TournamentScore>,
-   completedRounds: number
- ): ...

# In route.test.ts, mock still targets @/lib/scoring/domain:
vi.mock('@/lib/scoring/domain', () => ({
  rankEntries: vi.fn(),
  deriveCompletedRounds: vi.fn(),
}))
```

**Failure mode:** If any test or caller imports `rankEntries` from `@/lib/scoring`, it will get a runtime error (undefined export). The mock in `route.test.ts` correctly mocks the domain module, but any consumer importing from `@/lib/scoring` directly will fail.

**Required fix:** Verify no live code path imports `rankEntries` from `@/lib/scoring` — it was renamed to `rankEntriesLegacy` in the scoring domain. Update any such imports.

---

## Low

### `route.test.ts` — `deriveCompletedRounds` mock in new test returns hardcoded `2`

**Severity:** low

**File:** `src/app/api/leaderboard/[poolId]/route.test.ts:335`

**Evidence:**
```typescript
vi.mocked(deriveCompletedRounds).mockReturnValue(2)
```

The new test hardcodes `completedRounds = 2` rather than deriving it from the mocked `tournament_scores` data. The assertion at line 344 validates the value is passed through correctly.

**Failure mode:** Low — the hardcoded value is intentional in the test design.

**Suggestion:** No action required; acceptable test design.

---

## Positive Findings

1. **README.md** — Correctly updated from "Round-based best-ball" to "Hole-by-hole best-ball" at line 9. Score description now matches the actual product.

2. **docs/rules-spec.md** — Algorithm pseudo-code (lines 353–360) correctly describes per-hole iteration with `For each regulation hole in each counted round:` and steps 1–4.

3. **`route.ts`** — Correct migration from round-level pseudo-hole path to true hole-by-hole path:
   - Imports `rankEntriesWithHoles` from `@/lib/scoring`
   - Calls `getTournamentHolesForGolfers` (not `getTournamentScoreRounds`)
   - `allGolferIds` collected before early-return (lines 97–102), preventing undefined error in no-scores path
   - `golferStatuses` converted via `Object.fromEntries()` at line 159 — no Map serialization bug

4. **`scoring.ts`** — `buildGolferRoundScoresMapFromScores` (the fake `holeId: 1` constructor) successfully removed. No deprecated path remains in the main export.

5. **New regression test** at `route.test.ts:674` — `does NOT call rankEntries (round-level) from scoring domain — only rankEntriesWithHoles (hole-level)` correctly validates the new behavior.

6. **New overlapping-holes test** at `scoring.test.ts:751` — Three tests for round-gating and non-collapse of overlapping hole IDs across rounds.

---

## Verdict

**Do not merge.** The documentation updates and code migration are correct in direction, but 16 tests are failing and must be fixed before merge. The implementation was not completed — the final "Run tests and lint to verify" step in the todo list was never finished.

Run `npm test -- --run`, fix all failures, and update the code-review.md with resolved findings before requesting another review.
