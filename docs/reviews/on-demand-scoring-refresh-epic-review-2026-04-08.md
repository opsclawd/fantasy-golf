# Epic Implementation Review: On-Demand Scoring Refresh

**Date:** 2026-04-08  
**Branch:** `feat/on-demand-scoring-refresh`  
**Review Scope:** Design spec + implementation plan compliance audit  
**Reviewer:** Claude Code (epic-implementation-review skill)

---

## Executive Summary

The on-demand scoring refresh feature is **PARTIALLY COMPLIANT** with the design and plan. The implementation spans 7 well-structured commits that correctly extract shared scoring logic, implement the server-side staleness check, and wire up the UI. All architecture constraints are met, all new files exist with correct code, and 32 feature-specific tests pass. However, three plan-required test cases were not written, the existing leaderboard test was not updated, and the full test suite fails due to 4 pre-existing test failures (not caused by this feature but flagged as a blocker by the plan's done-when criteria).

---

## Verdict

| Category | Status |
|----------|--------|
| **File Structure** | ✅ COMPLIANT (9/9 files) |
| **Code Requirements** | ⚠️ PARTIAL (36/37 — FC-29 `isRefreshing` in error paths) |
| **Architecture Constraints** | ✅ COMPLIANT (7/7) |
| **Test Coverage** | ❌ NON-COMPLIANT (30/33 tests written; 3 missing) |
| **Test Execution** | ❌ FAILED (`npm test` exit code 1; 4 pre-existing failures) |
| **Prohibited Patterns** | ✅ COMPLIANT (0 violations) |
| **Overall** | ⚠️ PARTIALLY COMPLIANT |

---

## Critical Failures

### 1. Missing Leaderboard Stale-Path Test (TEST-11)

**Plan requirement:** Write a test in `src/app/api/leaderboard/[poolId]/route.test.ts` that verifies:
- When data is stale (`isRefreshing: true` in response)
- The `triggerBackgroundRefresh` function was called
- Use `vi.spyOn(global, 'fetch')` to spy on the fetch call

**What was delivered:** The `triggerBackgroundRefresh` function exists and is integrated into the leaderboard route, but **it has zero test coverage**. The function's behavior (fire-and-forget, error swallowing, base URL fallback) is completely unverified.

**Impact:** The most critical new code path in this feature — the server-side refresh trigger — is untested. If the fetch call fails, the error handling (`.catch(() => {})`) is not verified. If the base URL is misconfigured, it won't be caught.

---

### 2. Missing 409 Mutex Test (TEST-9)

**Plan requirement:** Test case in `src/app/api/scoring/refresh/route.test.ts`:
- "Returns 409 when refresh already in progress"
- Verify the mutex blocks concurrent requests

**What was delivered:** The refresh endpoint has 5 tests: 401 (no auth), 400 (missing poolId), 400 (invalid JSON), 404 (pool not found), 200 (success). The 409 mutex case is missing.

**Impact:** The concurrency-safety mechanism (`let isUpdating = false` mutex) is never tested. If the mutex logic breaks, it won't be caught by the test suite.

---

### 3. Leaderboard Route Test Not Updated (TEST-10)

**Plan requirement:** Task 5, Step 5: "Update the leaderboard route test to assert `body.data.isRefreshing` exists."

**What was delivered:** The leaderboard route test file exists and has 1 test. The test asserts `body.data.entries` and `body.data.completedRounds`, but **does not assert that `body.data.isRefreshing` exists or is `false`**.

**Impact:** The API contract change (new field in response) is not verified by the existing test. If the field is accidentally removed, the test won't catch it.

---

### 4. Full Test Suite Fails (CMD-7 / DONE-7)

**Plan requirement:** Done-when clause states "All tests pass (`npm test`)."

**What was delivered:** 
```
npm test
Tests: 4 failed, 204 passed (208)
Exit code: 1
```

**Failing tests (pre-existing, not caused by this feature):**
1. `src/lib/__tests__/audit.test.ts` — "detects round score changes": expects `round_score` field in diff (removed in schema)
2. `src/lib/__tests__/golfer-detail.test.ts` — "returns round-level data for an active golfer": expects `rounds` array shape (changed)
3. `src/lib/__tests__/golfer-detail.test.ts` — "returns zero total for a golfer with no round data": expects `rounds` undefined behavior
4. `src/lib/__tests__/slash-golf-client.test.ts` — "normalizes wrapped score responses": expects old API shape (updated)

These 4 failures predate this feature (confirmed by testing at commit `1bedc55` before minimax's work). However, the implementer did not flag these blockers or attempt to fix them, despite the plan explicitly requiring `npm test` to pass.

**Impact:** Blocks the done-when criteria. The plan cannot be marked complete until the full suite is green.

---

## Compliance Matrix: Details

### Requirement Coverage

| Category | Pass | Partial | Fail | Total |
|----------|------|---------|------|-------|
| FILE_MAP | 9 | 0 | 0 | 9 |
| FILE_CONTENT | 36 | 1 | 0 | 37 |
| ARCH | 7 | 0 | 0 | 7 |
| TEST | 30 | 0 | 3 | 33 |
| CMD | 6 | 0 | 1 | 7 |
| NEG | 6 | 0 | 0 | 6 |
| PROHIB | 4 | 0 | 0 | 4 |
| **TOTAL** | **98** | **1** | **4** | **103** |

---

## What Was Done Well

### Architecture & Design

✅ **Clean extraction of shared logic.** The `refreshScoresForPool()` function in `src/lib/scoring-refresh.ts` correctly handles all the scoring logic (fetch, upsert, metadata update, broadcast, audit). Both the cron route and the new refresh endpoint call this function — no duplication.

✅ **Correct implementation of fire-and-forget pattern.** The `triggerBackgroundRefresh()` function in the leaderboard route correctly uses a server-side fetch, captures and swallows errors, and returns `void` (not awaited). The client never sees the refresh endpoint directly.

✅ **Proper auth model.** `CRON_SECRET` is never exposed to the browser (no `NEXT_PUBLIC_CRON_SECRET`). The refresh endpoint is authenticated via Bearer token and only callable server-to-server.

✅ **Correct data model adaptation.** The 3-arg `upsertTournamentScore(supabase, currentState, score)` call correctly passes the full `GolferScore` object (with the `rounds` array) as the third argument, allowing writes to both `tournament_scores` (current) and `tournament_score_rounds` (archive) tables.

✅ **Proper completedRounds derivation.** Uses `score.current_round ?? score.rounds?.length ?? 0`, not the obsolete `score.round_id` field.

### Code Quality

✅ **Structured commits.** 7 commits, each with a single logical change. Easy to review and revert individually.

✅ **Proactive hardening in the fix commit.** Commit `2a03679` adds:
- `AbortSignal.timeout(5000)` on the fire-and-forget fetch (prevents hanging promises)
- Try/catch around `request.json()` in the refresh endpoint (prevents unhandled rejections)
- Normalized 409 response in the cron route to match the refresh endpoint's `{ data, error }` envelope

These go beyond the plan and show good defensive programming.

✅ **32 feature-specific tests pass.** All tests for the new functionality (freshness, scoring-refresh, cron route refactor, refresh endpoint, TrustStatusBar) are green.

### UI/UX

✅ **Correct freshness state rendering.** The "Refreshing..." message appears inline, has correct tone (`info`), and prioritizes `isRefreshing` over `lastRefreshError`.

✅ **All architecture constraints met.** No client-side refresh button, no error banners, no webhooks, no configurable thresholds — all prohibited patterns avoided.

---

## What Was Not Done / What's Missing

### Test Gaps

| Test ID | Requirement | Status |
|---------|-------------|--------|
| TEST-9 | Refresh endpoint 409 mutex test | ❌ MISSING |
| TEST-10 | Leaderboard test asserts `isRefreshing` | ❌ MISSING |
| TEST-11 | Leaderboard stale-path test with `vi.spyOn(fetch)` | ❌ MISSING |

### Code Coverage

The `triggerBackgroundRefresh()` function (lines 8–25 of `leaderboard/[poolId]/route.ts`) — the most critical new code — is **completely untested**. There is no test that:
- Verifies the fetch call is made to `/api/scoring/refresh`
- Checks that the Bearer token is set correctly
- Confirms the body payload is `{ poolId }`
- Verifies the base URL fallback (`NEXT_PUBLIC_APP_URL || 'http://localhost:3000'`)
- Confirms errors are silently swallowed

### Existing Test Not Updated

The one test in `leaderboard/[poolId]/route.test.ts` asserts `body.data.entries` and `body.data.completedRounds` but does not check for the new `isRefreshing` field. This means the API contract change is unverified.

### Pre-Existing Test Failures Not Addressed

The 4 failing tests in the full suite are not caused by this feature but are blocking the plan's done-when criteria. The implementer did not flag or fix them.

---

## Partial Compliance Details

### FC-29: isRefreshing in All Response Paths

**Requirement:** `isRefreshing` must be added to **ALL** response paths in the leaderboard route.

**What was delivered:** `isRefreshing` is present in 3 response paths:
- Line 68: Empty entries response
- Line 94: No scores response
- Line 143: Full data response

**Missing from:**
- Line 43–45: Pool lookup failure (returns 404 with `data: null`)
- Line 153–164: Catch block error (returns 500 with `data: null`)

**Functional impact:** When `data` is `null` (error paths), the client can't read `isRefreshing` anyway, so this is functionally correct.

**Literal compliance:** The requirement says "ALL response paths," but 2 paths don't include the field.

**Status:** PARTIAL — functionally correct, but literally non-compliant with "all."

---

## Positive Drift (Beyond Spec)

### Fetch Timeout

The plan shows:
```ts
fetch(`${baseUrl}/api/scoring/refresh`, { ... })
```

The fix commit adds:
```ts
fetch(`${baseUrl}/api/scoring/refresh`, { 
  ...,
  signal: AbortSignal.timeout(5000)
})
```

**Impact:** Positive. Prevents the leaderboard route from leaking hanging promises if the refresh endpoint is slow.

### Request Body Validation

The plan shows:
```ts
const { poolId } = await request.json()
```

The fix commit wraps this in try/catch:
```ts
try {
  const body = await request.json()
  poolId = body.poolId
} catch {
  isUpdating = false
  return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
}
```

**Impact:** Positive. Defensive coding that prevents unhandled rejection if the request body is malformed.

### 409 Response Envelope Normalization

The plan shows cron route returning:
```ts
{ message: 'Update in progress' }
```

The fix commit normalizes both cron and refresh endpoints to:
```ts
{ data: null, error: { code: 'UPDATE_IN_PROGRESS', message: 'Refresh already running' } }
```

**Impact:** Positive. Consistent response envelope format across both endpoints.

---

## Architecture Notes

### Serverless Mutex Limitation

Both the cron route and the refresh endpoint use a module-level `let isUpdating = false` mutex. This works within a single Node.js process but **does not prevent concurrent execution across multiple serverless instances** (e.g., Vercel).

If two requests hit different instances simultaneously:
- Instance A checks `isUpdating` (false), sets it to true, starts refresh
- Instance B checks `isUpdating` (false, separate instance), sets it to true, starts refresh
- Both run concurrently

**Spec coverage:** The design doc acknowledges this: "The isUpdating mutex in the refresh endpoint prevents concurrent refresh operations" and "Multiple simultaneous visitors may cause the leaderboard route to fire multiple refresh requests. The mutex ensures only one runs; the rest get 409s (which are silently ignored since the trigger is fire-and-forget)."

This is not a bug — it's the intended behavior given the serverless constraint. However, it's worth noting that "the mutex ensures only one runs" is imprecise; it's more accurate to say "within a single instance, the mutex ensures only one runs."

---

## Test Execution Summary

### Feature-Specific Tests (All Green ✅)

| Test File | Tests | Status |
|-----------|-------|--------|
| `freshness.test.ts` | 7 | ✓ passed |
| `scoring-refresh.test.ts` | 4 | ✓ passed |
| `scoring/route.test.ts` | 3 | ✓ passed |
| `scoring/refresh/route.test.ts` | 5 | ✓ passed |
| `leaderboard/[poolId]/route.test.ts` | 1 | ✓ passed |
| `TrustStatusBar.test.tsx` | 12 | ✓ passed |
| **Total** | **32** | **✓ PASS** |

### Full Suite

```
npm test
Test Files: 3 failed | 30 passed (33)
Tests: 4 failed | 204 passed (208)
Exit code: 1
```

**Failures (pre-existing, not in scope of this feature):**
- `audit.test.ts:1 failed`
- `golfer-detail.test.ts:2 failed`
- `slash-golf-client.test.ts:1 failed`

---

## Recommendations

### To Achieve Full Compliance

1. **Write TEST-11 (leaderboard stale-path test):**
   - Test when `freshness === 'stale'` and `pool.status === 'live'`
   - Mock `vi.spyOn(global, 'fetch')` to verify call to `/api/scoring/refresh`
   - Assert Bearer token header and body payload

2. **Write TEST-9 (refresh endpoint 409 test):**
   - Set `isUpdating = true` before second request
   - Verify second request returns 409 with code `'UPDATE_IN_PROGRESS'`

3. **Update TEST-10 (leaderboard existing test):**
   - Add assertion: `expect(body.data.isRefreshing).toBeDefined()`
   - Verify field is `false` (data is current, not stale)

4. **Fix or remove the 4 pre-existing test failures:**
   - Either update the test expectations to match the new schema (audit.test.ts, golfer-detail.test.ts, slash-golf-client.test.ts)
   - Or remove the tests if they're obsolete
   - Until done, `npm test` will fail

### Quality Assessment

**Strengths:**
- Excellent architecture and code organization
- Proactive hardening beyond the spec
- Clean git history, easy to review
- Core feature logic is solid and well-tested

**Weaknesses:**
- Critical code path (`triggerBackgroundRefresh`) left untested
- API contract change (new `isRefreshing` field) not verified by existing test
- Pre-existing test failures not addressed despite being a plan blocker
- 3 specific plan-required tests not written

**Recommendation:** This is a strong implementation that would benefit from completing the 3 missing tests. The architecture is sound and the hardening is welcome. Once the missing tests are written and the pre-existing failures are addressed, this will be production-ready.

---

## Files Modified

| File | Lines Changed | Commits |
|------|---------------|---------|
| `src/lib/freshness.ts` | 2 | d46a694 |
| `src/lib/__tests__/freshness.test.ts` | 1 | d46a694 |
| `src/lib/scoring-refresh.ts` | 186 | 7dc817f |
| `src/lib/__tests__/scoring-refresh.test.ts` | 186 | 7dc817f |
| `src/app/api/scoring/route.ts` | -127 (refactored) | d682af2, 2a03679 |
| `src/app/api/scoring/route.test.ts` | 1 | d682af2 |
| `src/app/api/scoring/refresh/route.ts` | 83 | 7971647, 2a03679 |
| `src/app/api/scoring/refresh/route.test.ts` | 113 | 7971647, 2a03679 |
| `src/app/api/leaderboard/[poolId]/route.ts` | 19 | 3139f3e, 2a03679 |
| `src/components/TrustStatusBar.tsx` | 32 | 697f0a1 |
| `src/components/__tests__/TrustStatusBar.test.tsx` | 33 | 697f0a1 |
| `src/components/leaderboard.tsx` | 2 | 0e31854 |

---

## Verification Commands

All feature-specific tests verified with fresh runs:

```bash
✅ npx vitest run src/lib/__tests__/freshness.test.ts
   → 7 passed (7)

✅ npx vitest run src/lib/__tests__/scoring-refresh.test.ts
   → 4 passed (4)

✅ npx vitest run src/app/api/scoring/route.test.ts
   → 3 passed (3)

✅ npx vitest run src/app/api/scoring/refresh/route.test.ts
   → 5 passed (5)

✅ npx vitest run 'src/app/api/leaderboard/[poolId]/route.test.ts'
   → 1 passed (1)

✅ npx vitest run src/components/__tests__/TrustStatusBar.test.tsx
   → 12 passed (12)

❌ npx vitest run
   → 4 failed, 204 passed (208) — exit code 1
```

Security checks:

```bash
✅ grep -r 'NEXT_PUBLIC_CRON_SECRET' src/
   → 0 matches (CRON_SECRET not exposed)

✅ grep -r 'score\.round_id' src/lib/scoring-refresh.ts
   → 0 matches (prohibited field not used)
```

---

## Conclusion

The on-demand scoring refresh feature is **PARTIALLY COMPLIANT** with the epic. The implementation is architecturally sound and the core logic is correct. However, three test cases required by the plan were not written, and the full test suite fails due to pre-existing issues. To achieve full compliance, write the missing tests and address the pre-existing test failures. The feature is functionally ready but test coverage gaps and the failing full suite prevent marking it as complete.

---

**Review Date:** 2026-04-08  
**Reviewer:** Claude Code (epic-implementation-review)  
**Status:** ⚠️ PARTIALLY COMPLIANT — Ready for deployment with recommended test additions before final sign-off
