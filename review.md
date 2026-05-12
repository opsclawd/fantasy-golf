# Code Review: `ai/issue-51` → `main` (Re-Review)

## Summary

Re-reviewing after fixes were applied. Build and lint now pass. However, **16 tests are still failing** — the same count as before. Some tests were partially fixed, but regressions remain and the core mock update issues are not resolved.

---

## Critical

### Tests failing — 16 tests still failing

**Severity:** critical

**Status:** not fixed (same 16 failures as original review)

**Evidence:** `npm test` output shows:
```
Test Files  6 failed | 59 passed (65)
     Tests  16 failed | 452 passed | 1 skipped (469)
```

The same 6 test files are failing as in the original review:
- `scoring-edge-cases.test.ts` (2 failed)
- `scoring-refresh-edge-cases.test.ts` (6 failed)
- `route.test.ts` (2 failed)
- `JoinPoolForm.test.tsx` (3 failed)
- `SpectatorLeaderboard.test.tsx` (1 failed)
- `LockBanner.test.tsx` (2 failed)

**Failure pattern analysis:**

1. **`scoring-edge-cases.test.ts`** — `computeEntryScore` with all incomplete rounds returns `null` instead of `0`:
   - Test expects `totalScore: 0`, but `rankEntries` now returns `null` when no holes completed
   - The test description says "empty golferRoundScores map → all entries get totalScore 0" but the correct behavior is now `null` for no completed holes
   - **Status:** partially fixed — the behavior changed, test needs updating to reflect new contract

2. **`scoring-refresh-edge-cases.test.ts`** — All 6 tests fail with:
   ```
   Error: [vitest] No "getTournamentHolesForGolfers" export is defined on the "@/lib/scoring-queries" mock.
   ```
   Despite the fix log showing this was addressed, the mock still doesn't include `getTournamentHolesForGolfers` for the `scoring-refresh-edge-cases.test.ts` tests at the `refreshScoresForPool` call path.
   - **Status:** not fixed

3. **`route.test.ts`** — 500 error on `uses golfer dataset size for audit details`:
   - The test expects 200 but gets 500
   - `getTournamentHolesForGolfers` mock not provided in the `scoring-queries` mock
   - `getEntriesForPool` mock not being called (0 calls) in "fans out" test
   - **Status:** not fixed

4. **`JoinPoolForm.test.tsx`** — `TypeError: useFormState is not a function`:
   - The mock for `react-dom` with `useFormState` was attempted but the fix log shows the test was gutted rather than properly mocked
   - **Status:** not fixed

5. **`SpectatorLeaderboard.test.tsx`** — `gray-400` still in source:
   - `score-display.tsx` still has `text-gray-400` at line 961 despite the fix log showing an edit
   - `GolferContribution.tsx` still has multiple `gray-*` tokens
   - **Status:** partially fixed (edit attempted but incomplete)

6. **`LockBanner.test.tsx`** — Tests expect `border-amber` but component renders `border-green-200`:
   - The deadline warning behavior was not fixed — LockBanner still shows green when deadline is within 24h
   - **Status:** not fixed

---

## High

### `route.test.ts` — `getTournamentRosterGolfers` result not validated in new test

**Severity:** high

**Status:** not fixed

The new test at line 333 still doesn't assert `golferNames` or `golferCountries` in the response body.

---

### `scoring-queries.ts` — Mock missing exports in multiple test files

**Severity:** high

**Status:** not fixed

The `vi.mock('@/lib/scoring-queries')` in `route.test.ts` still doesn't include `getTournamentHolesForGolfers`. Similarly, `scoring-refresh-edge-cases.test.ts` still has the missing export error.

---

### `scoring.ts` — `rankEntries` removed but test still uses it

**Severity:** high

**Status:** partially fixed

The `scoring-refresh-edge-cases.test.ts` still imports and mocks `rankEntries` from `@/lib/scoring/domain`, but `refreshScoresForPool` calls `rankEntriesWithHoles`. The mock is misaligned with the actual code path.

---

## Low

### `LockBanner.test.tsx` — Warning tone deadline logic not implemented

**Severity:** low

**Status:** not fixed

Tests expect `border-amber` and `America/New_York` timezone display when deadline is within 24 hours, but the component still renders the "open" green state.

---

## Positive Findings

1. **Build passes** — `next build` compiles successfully with no errors
2. **Lint passes** — No ESLint warnings or errors
3. **`validation.md`** — New validation file added showing full build/test/lint output
4. **`design.md`** — New design doc added with analysis of the issue
5. **`docs/rules-spec.md`** — Algorithm pseudo-code correctly updated
6. **`README.md`** — "Round-based" → "Hole-by-hole" in scoring model description

---

## Verdict

**Do not merge.** 16 tests failing — same count as original review. The fixes attempted were partially applied but incomplete:

- Mock exports are still missing in `route.test.ts` and `scoring-refresh-edge-cases.test.ts`
- `gray-*` tokens remain in `GolferContribution.tsx` and `score-display.tsx`
- `LockBanner` deadline warning logic was never implemented
- `JoinPoolForm.test.tsx` was weakened (assertion gutted) rather than properly fixed
- `scoring-edge-cases.test.ts` test contract is outdated — reflects old behavior where no holes = 0, but new behavior is null

All 16 failures must be resolved before merge.