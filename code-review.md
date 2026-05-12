# Code Review: `ai/issue-51` → `main` (Re-Review 2)

## Summary

16 tests still failing — same count as original review. The diff shows significant refactoring effort (round-level → hole-level scoring, mock updates), but mocks remain incomplete and several issues are unfixed or only partially addressed.

---

## Critical

### Tests failing — 16 tests still failing

**Severity:** critical

**Status:** not fixed (16 failures → 16 failures)

**Evidence:** `npm test` output:
```
Test Files  6 failed | 59 passed (65)
     Tests  16 failed | 452 passed | 1 skipped (469)
```

Same 6 files failing as in original review, with one important correction on the actual missing export:

| Test File | Failure Root Cause | Status |
|-----------|-------------------|--------|
| `scoring-edge-cases.test.ts` (2 failed) | Test assertions still expect `0`, not `null` | partially fixed |
| `scoring-refresh-edge-cases.test.ts` (6 failed) | Mock missing `updatePoolRefreshTelemetry` (not `getTournamentHolesForGolfers` as originally reported) | not fixed |
| `route.test.ts` (2 failed) | `getTournamentHolesForGolfers` mock provided but 500 still occurs | not fixed |
| `JoinPoolForm.test.tsx` (3 failed) | `useFormState` mock doesn't satisfy React DOM's `useFormState` | not fixed |
| `SpectatorLeaderboard.test.tsx` (1 failed) | `gray-400` still in `score-display.tsx` | partially fixed |
| `LockBanner.test.tsx` (2 failed) | Deadline warning tone never implemented in component | not fixed |

---

### `scoring-edge-cases.test.ts` — Test descriptions updated but assertions still wrong

**Severity:** critical

**Status:** partially fixed

The test descriptions were updated to say `totalScore null` (lines 21 and 79), which correctly reflects the new behavior. However, the actual assertions at lines 31 and 81 still assert `.toBe(0)` instead of `.toBeNull()`:

```typescript
// Line 21: description says "totalScore null" ✓
// Line 31: assertion says .toBe(0) ✗  ← should be .toBeNull()
expect(result.totalScore).toBeNull()  // correct assertion
```

Same issue at line 81 for `rankEntries` test.

---

### `scoring-refresh-edge-cases.test.ts` — Mock missing `updatePoolRefreshTelemetry`

**Severity:** critical

**Status:** not fixed

The actual missing export is `updatePoolRefreshTelemetry` (not `getTournamentHolesForGolfers` as the original review stated). The `scoring-refresh.ts` now calls `updatePoolRefreshTelemetry` at line 79, but the `vi.mock('@/lib/pool-queries')` in the test file only includes:

- `getPoolsByTournament`
- `getEntriesForPool`
- `updatePoolRefreshMetadata`
- `insertAuditEvent`

`updatePoolRefreshTelemetry` is missing from the mock. This causes all 6 tests in this file to fail at the first line of `refreshScoresForPool` (line 79: `await updatePoolRefreshTelemetry(...)`).

---

### `route.test.ts` — Still returns 500

**Severity:** critical

**Status:** not fixed

Two tests still failing:
1. `uses golfer dataset size for audit details` — 500 error
2. `fans out scoring metadata` — `getEntriesForPool` called 0 times

The mock now includes `getTournamentHolesForGolfers`, but the `scoring-queries` mock only has `upsertTournamentScore`, `getScoresForTournament`, `upsertTournamentHoles`, and `getTournamentHolesForGolfers`. `getTournamentHolesForGolfers` is provided but the test still fails with 500 — likely because `refreshScoresForPool` also calls `updatePoolRefreshTelemetry` which is missing from the `pool-queries` mock.

The `getEntriesForPool` "fans out" test failure (0 calls) confirms the scoring path is failing early due to the `updatePoolRefreshTelemetry` missing export before it reaches the `getEntriesForPool` call.

---

### `JoinPoolForm.test.tsx` — `useFormState` mock insufficient

**Severity:** critical

**Status:** not fixed

The mock added:
```typescript
vi.mock('react-dom', () => ({
  useFormState: vi.fn(() => [null, vi.fn()]),
  useFormStatus: vi.fn(() => ({ pending: false })),
}))
```

But `useFormState` is not exported from `react-dom` — it's from `react-dom/form` or a separate hook export. The mock returns a plain object with a `useFormState` property, but `JoinPoolForm.tsx:14` does `const [state, formAction] = useFormState(...)` which still fails with `useFormState is not a function`.

---

### `SpectatorLeaderboard.test.tsx` — `gray-400` still in `score-display.tsx`

**Severity:** critical

**Status:** partially fixed

`GolferContribution.tsx` was updated (all `gray-*` → `stone-*`). But `score-display.tsx:4` still has:
```typescript
if (score === null) return <span className="font-mono text-gray-400">—</span>
```

The test at line 51 (`expect(grayMatches).toBeNull()`) correctly fails because `gray-400` remains in the source file.

---

### `LockBanner.test.tsx` — Deadline warning logic never implemented

**Severity:** critical

**Status:** not fixed

The tests were updated to use `vi.setSystemTime()` to control the deadline proximity check, but the `LockBanner` component itself was never updated to implement the warning tone. The component still renders `border-green-200` (the "open" state) even when deadline is within 24 hours. The tests set the system time correctly but the component has no logic to check it.

---

## High

### `route.test.ts` — `golferNames`/`golferCountries` still not asserted

**Severity:** high

**Status:** not fixed

The new tests added for `rankEntriesWithHoles` (lines 333–495) do not assert `golferNames` or `golferCountries` in the response body. The original finding stands.

---

### `scoring-refresh-edge-cases.test.ts` — Mock misalignment with actual code path

**Severity:** high

**Status:** partially fixed

The mock now includes `rankEntriesWithHoles` alongside `rankEntries`. However, the actual `refreshScoresForPool` calls `rankEntriesWithHoles` from `@/lib/scoring`, not `@/lib/scoring/domain`. The `scoring-refresh-edge-cases.test.ts` mocks `@/lib/scoring/domain`, but the real code imports from `@/lib/scoring`. The mock target may not even be reached.

---

## Low

### `LockBanner.test.tsx` — Warning tone deadline logic not implemented

**Severity:** low

**Status:** not fixed (same as original — component never updated)

---

## Positive Findings

1. **Build passes** — `next build` compiles successfully
2. **Lint passes** — No ESLint warnings or errors
3. **`LeaderboardRoute`** — Significant refactoring: now calls `getTournamentHolesForGolfers` and `rankEntriesWithHoles` correctly
4. **`scoring.ts`** — `rankEntries` removed, `buildGolferRoundScoresMapFromScores` removed (deprecated code cleaned up)
5. **`scoring-queries.ts`** — `getTournamentScoreRounds` removed (unused)
6. **`GolferContribution.tsx`** — `gray-*` → `stone-*` migration complete
7. **`scoring-edge-cases.test.ts`** — Test descriptions correctly updated to reflect new `null` behavior
8. **New tests in `route.test.ts`** — 3 new tests verifying `rankEntriesWithHoles` usage with proper round separation

---

## Verdict

**Do not merge.** 16 tests failing — same count as original review.

The core issues are:
1. `scoring-refresh-edge-cases.test.ts` mock is missing `updatePoolRefreshTelemetry` (the actual failing export, not `getTournamentHolesForGolfers` as originally reported)
2. `scoring-edge-cases.test.ts` has correct test descriptions but wrong assertions (`0` instead of `null`)
3. `JoinPoolForm.test.tsx` `useFormState` mock is structurally wrong
4. `score-display.tsx` still has `gray-400`
5. `LockBanner` component never got the deadline warning tone logic
6. `route.test.ts` scoring failures cascade from the `updatePoolRefreshTelemetry` mock gap

All 16 failures must be resolved before merge.