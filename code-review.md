# Code Review: `ai/issue-51` → `main` (Re-Review 4)

## Summary

16 tests still failing — identical count and root causes to all prior reviews. No meaningful improvement: the fixes applied did not resolve any of the critical issues.

---

## Critical

### Tests failing — 16 tests still failing

**Severity:** critical

**Status:** not fixed (16 failures → 16 failures, unchanged)

**Evidence:** `npm test` output:
```
Test Files  6 failed | 59 passed (65)
     Tests  16 failed | 452 passed | 1 skipped (469)
```

The same 6 files fail with the same root causes as all prior reviews:

| Test File | Failure Root Cause | Status |
|-----------|-------------------|--------|
| `scoring-edge-cases.test.ts` (2 failed) | Assertions still assert `.toBe(0)` not `.toBeNull()` | not fixed |
| `scoring-refresh-edge-cases.test.ts` (6 failed) | `updatePoolRefreshTelemetry` missing from mock | not fixed |
| `route.test.ts` (2 failed) | Cascades from `updatePoolRefreshTelemetry` mock gap + missing `getTournamentHolesForGolfers` | not fixed |
| `JoinPoolForm.test.tsx` (3 failed) | `useFormState is not a function` | not fixed |
| `SpectatorLeaderboard.test.tsx` (1 failed) | `gray-400` still in `score-display.tsx` | not fixed |
| `LockBanner.test.tsx` (2 failed) | Deadline warning tone never implemented | not fixed |

---

### `scoring-edge-cases.test.ts` — Assertions still wrong after multiple reviews

**Severity:** critical

**Status:** not fixed

Test descriptions at lines 21 and 79 correctly say `totalScore null`, but the assertions at lines 31 and 81 still say `.toBe(0)` instead of `.toBeNull()`. This has been flagged in every prior review and has never been fixed.

---

### `scoring-refresh-edge-cases.test.ts` — Mock still missing `updatePoolRefreshTelemetry`

**Severity:** critical

**Status:** not fixed

All 6 tests fail immediately at `scoring-refresh.ts:79`:
```
Error: [vitest] No "updatePoolRefreshTelemetry" export is defined on the "@/lib/pool-queries" mock.
```

---

### `route.test.ts` — Still returns 500, now also missing `getTournamentHolesForGolfers`

**Severity:** critical

**Status:** not fixed

Two tests failing with the same root causes:
1. `uses golfer dataset size for audit details` — `expected 500 to be 200` (cascades from mock gaps)
2. `fans out scoring metadata` — `getEntriesForPool called 0 times`

The failures now also cite a new gap: `getTournamentHolesForGolfers` is missing from the `@/lib/scoring-queries` mock. The mock continues to not reach the actual code under test.

---

### `JoinPoolForm.test.tsx` — `useFormState` mock still structurally wrong

**Severity:** critical

**Status:** not fixed

```
TypeError: useFormState is not a function or its return value is not iterable
```

The mock returns `useFormState: vi.fn(() => [null, vi.fn()])` as a plain property, but `JoinPoolForm.tsx:14` does `const [state, formAction] = useFormState(...)` — the mock's `vi.fn()` doesn't properly simulate the React hook.

---

### `SpectatorLeaderboard.test.tsx` — `gray-400` still in source

**Severity:** critical

**Status:** not fixed

```
AssertionError: expected [ 'gray-400' ] to be null
```

`score-display.tsx:4` still contains `text-gray-400`.

---

### `LockBanner.test.tsx` — Warning tone never implemented

**Severity:** critical

**Status:** not fixed

Tests expect `border-amber` and `America/New_York` timezone display when deadline is within 24 hours. The component still renders `border-green-200 bg-green-100/90` regardless — the warning tone logic was never implemented.

---

## High

### `route.test.ts` — `golferNames`/`golferCountries` still not asserted

**Severity:** high

**Status:** not fixed

---

### `scoring-refresh-edge-cases.test.ts` — Mock targets wrong module path

**Severity:** high

**Status:** not fixed

The mock targets `@/lib/scoring/domain`, but `refreshScoresForPool` imports `rankEntriesWithHoles` from `@/lib/scoring`. The mock is never reached.

---

## Positive Findings

1. **Build passes** — `next build` compiles successfully
2. **Lint passes** — No ESLint warnings or errors

---

## Verdict

**Do not merge.** 16 tests failing — unchanged across all 4 reviews.

All findings from original review remain valid and unfixed:

1. `scoring-edge-cases.test.ts` — two assertions need `.toBe(0)` → `.toBeNull()`
2. `scoring-refresh-edge-cases.test.ts` — mock missing `updatePoolRefreshTelemetry`
3. `route.test.ts` — cascading failures from mock gaps (`updatePoolRefreshTelemetry` + `getTournamentHolesForGolfers`)
4. `JoinPoolForm.test.tsx` — `useFormState` mock structurally wrong
5. `SpectatorLeaderboard.test.tsx` — `gray-400` still in `score-display.tsx`
6. `LockBanner.test.tsx` — warning tone never implemented in component

All 16 failures must be resolved before merge.