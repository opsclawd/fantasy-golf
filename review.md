# Code Review: `ai/issue-51` → `main` (Re-Review 3)

## Summary

16 tests still failing — same count as both prior reviews. No meaningful improvement: the fixes applied did not resolve any of the critical issues. All failures are identical in nature to the previous review.

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

The same 6 files fail with the same root causes as the prior review:

| Test File | Failure Root Cause | Status |
|-----------|-------------------|--------|
| `scoring-edge-cases.test.ts` (2 failed) | Assertions still assert `.toBe(0)` not `.toBeNull()` | partially fixed |
| `scoring-refresh-edge-cases.test.ts` (6 failed) | `updatePoolRefreshTelemetry` missing from mock | not fixed |
| `route.test.ts` (2 failed) | Cascades from `updatePoolRefreshTelemetry` mock gap | not fixed |
| `JoinPoolForm.test.tsx` (3 failed) | `useFormState is not a function` | not fixed |
| `SpectatorLeaderboard.test.tsx` (1 failed) | `gray-400` still in `score-display.tsx` | not fixed |
| `LockBanner.test.tsx` (2 failed) | Deadline warning tone never implemented | not fixed |

---

### `scoring-edge-cases.test.ts` — Test descriptions updated but assertions still wrong

**Severity:** critical

**Status:** partially fixed (unchanged from prior review)

The test descriptions at lines 21 and 79 correctly say `totalScore null`, but the assertions at lines 31 and 81 still say `.toBe(0)` instead of `.toBeNull()`. This was flagged in the prior review and has not been fixed.

```typescript
// Line 31: assertion is still wrong
expect(result.totalScore).toBe(0)  // should be .toBeNull()

// Line 81: same issue
expect(ranked[0].totalScore).toBe(0)  // should be .toBeNull()
```

---

### `scoring-refresh-edge-cases.test.ts` — Mock missing `updatePoolRefreshTelemetry`

**Severity:** critical

**Status:** not fixed (unchanged from prior review)

All 6 tests in this file fail immediately at `scoring-refresh.ts:79`:
```
Error: [vitest] No "updatePoolRefreshTelemetry" export is defined on the "@/lib/pool-queries" mock.
```

`refreshScoresForPool` calls `updatePoolRefreshTelemetry` at line 79, but the mock in the test file does not include this export. The mock only has: `getPoolsByTournament`, `getEntriesForPool`, `updatePoolRefreshMetadata`, `insertAuditEvent`. `updatePoolRefreshTelemetry` is missing.

---

### `route.test.ts` — Still returns 500

**Severity:** critical

**Status:** not fixed (unchanged from prior review)

Two tests still failing:
1. `uses golfer dataset size for audit details` — `expected 500 to be 200`
2. `fans out scoring metadata` — `getEntriesForPool called 0 times`

The failures cascade from the `updatePoolRefreshTelemetry` mock gap in `scoring-refresh-edge-cases.test.ts`. The `refreshScoresForPool` function fails before reaching any `scoring-queries` mock targets.

---

### `JoinPoolForm.test.tsx` — `useFormState` mock still broken

**Severity:** critical

**Status:** not fixed (unchanged from prior review)

```
TypeError: useFormState is not a function or its return value is not iterable
```

The mock at line 13 returns `useFormState: vi.fn(() => [null, vi.fn()])` as a plain object property. But `JoinPoolForm.tsx:14` does `const [state, formAction] = useFormState(...)` — destructuring a function call. The mock's `vi.fn()` doesn't satisfy this.

---

### `SpectatorLeaderboard.test.tsx` — `gray-400` still in source

**Severity:** critical

**Status:** not fixed (unchanged from prior review)

```
AssertionError: expected [ 'gray-400' ] to be null
```

`score-display.tsx:4` still contains:
```typescript
if (score === null) return <span className="font-mono text-gray-400">—</span>
```

---

### `LockBanner.test.tsx` — Component never updated to implement warning tone

**Severity:** critical

**Status:** not fixed (unchanged from prior review)

Tests expect `border-amber` and `America/New_York` timezone display when deadline is within 24 hours. The component renders `border-green-200 bg-green-100/90` regardless — the warning tone logic was never implemented.

---

## High

### `route.test.ts` — `golferNames`/`golferCountries` still not asserted

**Severity:** high

**Status:** not fixed (unchanged from prior review)

New tests for `rankEntriesWithHoles` do not assert `golferNames` or `golferCountries` in the response body.

---

### `scoring-refresh-edge-cases.test.ts` — Mock targets wrong module path

**Severity:** high

**Status:** not fixed (unchanged from prior review)

The mock targets `@/lib/scoring/domain`, but `refreshScoresForPool` imports `rankEntriesWithHoles` from `@/lib/scoring`. The mock may not be reached at all.

---

## Low

### `LockBanner.test.tsx` — Warning tone deadline logic not implemented

**Severity:** low

**Status:** not fixed (same as prior review — component never updated)

---

## Positive Findings

1. **Build passes** — `next build` compiles successfully
2. **Lint passes** — No ESLint warnings or errors
3. **README.md** — `round-by-round` → `hole-by-hole` fixed
4. **`docs/rules-spec.md`** — Algorithm description updated to match hole-by-hole
5. **`GolferContribution.tsx`** — `gray-*` → `stone-*` migration complete

---

## Verdict

**Do not merge.** 16 tests failing — unchanged from prior review.

The fixes applied since Re-Review 2 did not resolve any of the critical issues. All findings from the prior review remain valid:

1. `scoring-edge-cases.test.ts` — two assertions need `.toBe(0)` → `.toBeNull()`
2. `scoring-refresh-edge-cases.test.ts` — mock missing `updatePoolRefreshTelemetry`
3. `route.test.ts` — cascading failures from item 2
4. `JoinPoolForm.test.tsx` — `useFormState` mock structurally wrong
5. `SpectatorLeaderboard.test.tsx` — `gray-400` still in `score-display.tsx`
6. `LockBanner.test.tsx` — warning tone never implemented in component

All 16 failures must be resolved before merge.