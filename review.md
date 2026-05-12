# Code Review: `ai/issue-51` → `main`

## Summary

16 tests failing across 6 test files. The branch successfully updated documentation (README.md, docs/rules-spec.md) but introduced no fixes for any of the pre-existing test failures. Build passes, lint passes, but tests do not.

---

## Critical (Must Fix)

### 1. `src/lib/__tests__/scoring-edge-cases.test.ts` — Two assertions still wrong

**Severity:** critical

**File:** `src/lib/__tests__/scoring-edge-cases.test.ts:31` and `src/lib/__tests__/scoring-edge-cases.test.ts:81`

**Evidence:**
```
AssertionError: expected null to be +0 // Object.is equality
```

- Line 31: `expect(result.totalScore).toBe(0)` — test says "totalScore 0" but `rankEntries` returns `null` when no holes completed
- Line 81: `expect(ranked[0].totalScore).toBe(0)` — same issue in `rankEntries` empty-map test

**Failure mode:** `computeEntryScore` returns `null` for `totalScore` when no rounds have all golfers complete. The tests incorrectly assert `0`. This is not a new regression — the assertions were always wrong.

**Required fix:** Change `.toBe(0)` → `.toBeNull()` at both lines.

---

### 2. `src/lib/__tests__/scoring-refresh-edge-cases.test.ts` — Mock missing `updatePoolRefreshTelemetry`

**Severity:** critical

**File:** `src/lib/__tests__/scoring-refresh-edge-cases.test.ts:38`

**Evidence:**
```
Error: [vitest] No "updatePoolRefreshTelemetry" export is defined on the "@/lib/pool-queries" mock.
```

All 6 tests in this file fail immediately at `scoring-refresh.ts:79`:
```typescript
await updatePoolRefreshTelemetry(supabase, pool.id, { ... })
```

**Failure mode:** The mock for `@/lib/pool-queries` does not include `updatePoolRefreshTelemetry`. The function is called by the code under test but was never added to the mock. This blocks all 6 tests in the file from running at all.

**Required fix:** Add `updatePoolRefreshTelemetry: vi.fn()` to the `@/lib/pool-queries` mock.

---

### 3. `src/app/api/scoring/route.test.ts` — Missing `getTournamentHolesForGolfers` in mock + cascading failures

**Severity:** critical

**File:** `src/app/api/scoring/route.test.ts:69`

**Evidence:**
```
AssertionError: expected 500 to be 200 // Object.is equality
```
```
AssertionError: expected "vi.fn()" to be called with arguments: [ Anything, 'pool-1' ]
Number of calls: 0
```

Two tests fail. The failures cite a missing `getTournamentHolesForGolfers` export in the `@/lib/scoring-queries` mock. The mock targets `@/lib/scoring-queries` but the code at `scoring-refresh.ts:206` calls `getTournamentHolesForGolfers` which is not mocked. Additionally, `getEntriesForPool` is called 0 times, indicating the mock chain is broken before the code under test can run.

**Required fix:** Add `getTournamentHolesForGolfers: vi.fn()` and `upsertTournamentHoles: vi.fn()` to the `@/lib/scoring-queries` mock. Verify `updatePoolRefreshTelemetry` is also in the `@/lib/pool-queries` mock (see issue #2 above — cascading).

---

### 4. `src/app/join/[inviteCode]/__tests__/JoinPoolForm.test.tsx` — `useFormState` mock structurally wrong

**Severity:** critical

**File:** `src/app/join/[inviteCode]/__tests__/JoinPoolForm.test.tsx:14`

**Evidence:**
```
TypeError: useFormState is not a function or its return value is not iterable
```

The component at `JoinPoolForm.tsx:14` does:
```typescript
const [state, formAction] = useFormState(joinPool, initialState)
```

The test mocks `useFormState` as a plain `vi.fn(() => [null, vi.fn()])` property on `react-dom`, but the destructuring `const [state, formAction] = ...` fails because `vi.fn()` doesn't properly return an array.

**Required fix:** The mock should be a function that returns an array, not a `vi.fn()` that happens to return an array. Correct pattern:
```typescript
useFormState: vi.fn(() => [null, vi.fn()])
```
should work — but it must be in a `vi.mock('react-dom', ...)` block that properly replaces the module, not as a side-effect import.

---

### 5. `src/components/__tests__/SpectatorLeaderboard.test.tsx` — `gray-400` still in source

**Severity:** critical

**File:** `src/components/score-display.tsx:4`

**Evidence:**
```
AssertionError: expected [ 'gray-400' ] to be null
```

`score-display.tsx:4` still contains `text-gray-400`:
```typescript
if (score === null) return <span className="font-mono text-gray-400">—</span>
```

**Required fix:** Replace `text-gray-400` → `text-stone-400` in `score-display.tsx`.

---

### 6. `src/components/__tests__/LockBanner.test.tsx` — Warning tone never implemented

**Severity:** critical

**File:** `src/components/LockBanner.tsx` (component lacks deadline-warning logic)

**Evidence:**
```
AssertionError: expected '<div class="rounded-3xl border border…' to contain 'border-amber'
```

Tests at lines 79 and 95 expect `border-amber` and `America/New_York` timezone display when deadline is within 24 hours. The component renders `border-green-200 bg-green-100/90` regardless of deadline proximity. The warning tone for near-deadline state was never implemented.

**Required fix:** Implement the deadline-warning tone in `LockBanner` — when `isLocked === false` and deadline is within 24 hours, render `border-amber`/`bg-amber` styling and show the timezone in the secondary line.

---

## High

### 7. `src/app/api/scoring/route.test.ts` — `golferNames`/`golferCountries` not asserted

**Severity:** high

**Status:** not fixed (noted in prior reviews, no movement)

---

### 8. `src/lib/__tests__/scoring-refresh-edge-cases.test.ts` — `rankEntriesWithHoles` also missing from mock

**Severity:** high

**File:** `src/lib/__tests__/scoring-refresh-edge-cases.test.ts:588`

`rankEntriesWithHoles` is called by `refreshScoresForPool` at `scoring-refresh.ts:225` but is not in the `@/lib/scoring/domain` mock. After fixing the `updatePoolRefreshTelemetry` gap, tests will likely fail here next.

**Required fix:** Add `rankEntriesWithHoles: vi.fn()` to the `@/lib/scoring/domain` mock.

---

## Positive Findings

1. **Build passes** — `next build` compiles successfully
2. **Lint passes** — No ESLint warnings or errors
3. **Documentation correctly updated** — README.md line 9 and docs/rules-spec.md algorithm section now correctly describe hole-by-hole best-ball
4. **`score-display.tsx` gray-400 fix was attempted** — The fix-review-1.log shows `text-gray-400 → text-stone-400` was applied in a prior session, but the file at `score-display.tsx:4` still shows `text-gray-400` in the current diff

---

## Verdict

**Do not merge.** 16 tests failing — unchanged from pre-branch state.

The branch correctly updated documentation but did not address any of the test failures. All 16 failures pre-existed and remain. The test fixes are well-understood (mock gaps, wrong assertions, unimplemented component logic) and are documented in the pre-existing `code-review.md` in this diff.

All Critical issues must be resolved before merge.
