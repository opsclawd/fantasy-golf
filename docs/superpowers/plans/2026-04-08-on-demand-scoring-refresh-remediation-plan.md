# On-Demand Scoring Refresh — Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 5 compliance gaps found in the epic implementation review so that `npm test` passes with 0 failures and all spec-required test cases exist.

**What's wrong (read this first):**

1. **3 missing tests from the plan:**
   - The refresh endpoint (`/api/scoring/refresh`) has no test for the 409 "already in progress" mutex path
   - The leaderboard route test doesn't assert the new `isRefreshing` field
   - The leaderboard route has no stale-path test that verifies `triggerBackgroundRefresh` fires
2. **4 pre-existing test failures** in files not touched by this feature but broken by the earlier `tournament_score_rounds` schema change (commit `1bedc55`):
   - `audit.test.ts` — expects `round_score` field which was removed from `TournamentScore`
   - `golfer-detail.test.ts` — expects `rounds` array and `round_score` field which were removed from `getGolferScorecard`
   - `slash-golf-client.test.ts` — expects old normalized shape (with `round_id`, `round_score`, etc.)

**Constraints:**
- Do NOT modify any production code — only test files
- Follow existing test patterns (vitest, `vi.mock()`, direct handler imports)
- Each task is one commit

---

## File Overview

| Action | File | What changes |
|--------|------|--------------|
| Modify | `src/app/api/scoring/refresh/route.test.ts` | Add 409 mutex test |
| Modify | `src/app/api/leaderboard/[poolId]/route.test.ts` | Add `isRefreshing` assertion + stale-path test |
| Modify | `src/lib/__tests__/audit.test.ts` | Fix `createScore` helper + update expectation |
| Modify | `src/lib/__tests__/golfer-detail.test.ts` | Fix `createScore` helper + remove `rounds` assertions |
| Modify | `src/lib/__tests__/slash-golf-client.test.ts` | Update expected normalized shape |

---

## Task 1: Add 409 mutex test to refresh endpoint

**Why:** The plan required a test "Returns 409 when a refresh is already in progress." It was never written.

**File:** `src/app/api/scoring/refresh/route.test.ts`

- [ ] **Step 1: Understand the problem**

The refresh endpoint at `src/app/api/scoring/refresh/route.ts` has a module-level `let isUpdating = false` mutex (line 6). When `isUpdating` is `true`, the handler returns 409 with `{ code: 'UPDATE_IN_PROGRESS' }` (lines 14-19).

The challenge: we can't easily set `isUpdating = true` from outside the module since it's not exported. But we can simulate it by making `refreshScoresForPool` hang (never resolve) so the first request holds the mutex, then send a second request.

- [ ] **Step 2: Add the test**

Open `src/app/api/scoring/refresh/route.test.ts`. Add this test inside the `describe('POST /api/scoring/refresh', () => {` block, after the last existing test (after the "returns 200 and refresh data on success" test around line 113):

```ts
it('returns 409 when a refresh is already in progress', async () => {
  const pool = { id: 'pool-1', tournament_id: 't-1', year: 2026, status: 'live' }
  vi.mocked(createAdminClient).mockReturnValue({} as never)
  vi.mocked(getPoolById).mockResolvedValue(pool as never)

  // Make refreshScoresForPool hang forever so the mutex stays held
  vi.mocked(refreshScoresForPool).mockReturnValue(new Promise(() => {}))

  const makeRequest = () =>
    new Request('http://localhost/api/scoring/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer secret',
      },
      body: JSON.stringify({ poolId: 'pool-1' }),
    })

  // First request: starts and holds the mutex (will never resolve)
  const first = POST(makeRequest())

  // Second request: should get 409 because mutex is held
  const second = await POST(makeRequest())

  expect(second.status).toBe(409)
  const body = await second.json()
  expect(body.error.code).toBe('UPDATE_IN_PROGRESS')

  // Clean up: we don't await `first` since it will never resolve.
  // The module-level isUpdating will stay true for this test file,
  // but vi.clearAllMocks() + module re-evaluation in vitest handles isolation.
})
```

**Important:** This test must be the LAST test in the describe block. Because the first request never resolves, the module-level `isUpdating` stays `true` for the rest of the module's lifetime. If other tests run after this one in the same file, they'd also get 409. Placing it last avoids this.

- [ ] **Step 3: Run the test**

```bash
npx vitest run src/app/api/scoring/refresh/route.test.ts
```

Expected: 6 passed (6).

**Potential issue:** If vitest runs tests in this file in parallel or reorders them, the mutex state could leak. If the test fails with a 409 on a *different* test case, you need to use `vi.resetModules()` in `beforeEach` and dynamically import the module in each test. But try the simple approach first — vitest runs tests within a `describe` sequentially by default.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/scoring/refresh/route.test.ts
git commit -m "test: add 409 mutex test for refresh endpoint"
```

---

## Task 2: Add `isRefreshing` assertion and stale-path test to leaderboard route

**Why:** The plan required two things: (1) the existing leaderboard test should assert `body.data.isRefreshing` exists, and (2) a new stale-path test should verify `isRefreshing: true` and that `triggerBackgroundRefresh` fires (via `vi.spyOn(global, 'fetch')`).

**File:** `src/app/api/leaderboard/[poolId]/route.test.ts`

- [ ] **Step 1: Read the current test file**

Open `src/app/api/leaderboard/[poolId]/route.test.ts`. There is one existing test: "preserves ranked entries when no tournament scores are available". It mocks `classifyFreshness` to return `'current'` and the pool status is `'live'`.

Since freshness is `'current'`, `isStale` is `false`, so `isRefreshing` should be `false`.

- [ ] **Step 2: Add `isRefreshing` assertion to the existing test**

At line 89 (after `expect(body.data.completedRounds).toBe(0)`), add:

```ts
expect(body.data.isRefreshing).toBe(false)
```

- [ ] **Step 3: Add the stale-path test**

Add this test inside the `describe('GET /api/leaderboard/[poolId]', () => {` block, after the existing test:

```ts
it('returns isRefreshing true and triggers background refresh when data is stale', async () => {
  const pool = {
    id: 'pool-1',
    status: 'live',
    refreshed_at: '2026-03-29T00:00:00.000Z',
    last_refresh_error: null,
    tournament_id: 't-1',
  }
  const entries = [{ id: 'entry-1', golfer_ids: ['g1'], user_id: 'u1' }]
  const rankedEntries = [
    {
      id: 'entry-1',
      golfer_ids: ['g1'],
      user_id: 'u1',
      rank: 1,
      totalScore: 0,
      totalBirdies: 0,
    },
  ]

  // Mock freshness as 'stale' — this triggers the refresh
  vi.mocked(classifyFreshness).mockReturnValue('stale')

  vi.mocked(createClient).mockResolvedValue({
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'pools') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: pool, error: null }),
            }),
          }),
        }
      }

      if (table === 'entries') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: entries }),
          }),
        }
      }

      if (table === 'tournament_scores') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [] }),
          }),
        }
      }

      throw new Error(`Unexpected table ${table}`)
    }),
  } as never)

  vi.mocked(rankEntries).mockReturnValue(rankedEntries as never)

  // Spy on global.fetch to verify triggerBackgroundRefresh fires
  const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response())

  const response = await GET(new Request('http://localhost/api/leaderboard/pool-1'), {
    params: Promise.resolve({ poolId: 'pool-1' }),
  })
  const body = await response.json()

  expect(response.status).toBe(200)
  expect(body.data.isRefreshing).toBe(true)

  // Verify triggerBackgroundRefresh called fetch to the refresh endpoint
  expect(fetchSpy).toHaveBeenCalledWith(
    expect.stringContaining('/api/scoring/refresh'),
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ poolId: 'pool-1' }),
    })
  )

  fetchSpy.mockRestore()
})
```

- [ ] **Step 4: Add `afterEach` for fetch spy cleanup**

At the top of the `describe` block (after `beforeEach`), add an `afterEach` to ensure the fetch spy doesn't leak:

```ts
afterEach(() => {
  vi.restoreAllMocks()
})
```

You'll also need to add `afterEach` to the import on line 1:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
```

- [ ] **Step 5: Run the test**

```bash
npx vitest run 'src/app/api/leaderboard/[poolId]/route.test.ts'
```

Expected: 2 passed (2).

- [ ] **Step 6: Commit**

```bash
git add 'src/app/api/leaderboard/[poolId]/route.test.ts'
git commit -m "test: add isRefreshing assertion and stale-path test to leaderboard route"
```

---

## Task 3: Fix `audit.test.ts` — remove `round_score` from expected diff

**Why:** The `tournament_score_rounds` schema change removed `round_score` from `TournamentScore`. The `computeScoreDiff` function no longer tracks `round_score` changes. The test still expects it.

**File:** `src/lib/__tests__/audit.test.ts`

- [ ] **Step 1: Fix the `createScore` helper (lines 5-27)**

The helper creates a `TournamentScore` object with fields that no longer exist on the type. Update it to match the current `TournamentScore` interface.

Replace the `createScore` function (lines 5-27) with:

```ts
function createScore(
  golferId: string,
  roundId: number | null,
  totalScore: number | null,
  status: GolferStatus = 'active',
  birdies: number = 0
): TournamentScore {
  return {
    golfer_id: golferId,
    tournament_id: 't1',
    round_id: roundId,
    total_score: totalScore,
    total_birdies: birdies,
    status,
    position: null,
    updated_at: null,
  }
}
```

Note: the `roundScore` parameter is removed (3rd param). The function now takes 2 required params (`golferId`, `roundId`) plus `totalScore` as the 3rd.

- [ ] **Step 2: Update ALL `createScore` call sites**

Every call to `createScore` in the file currently passes `(golferId, roundId, roundScore, totalScore, ...)`. Since `roundScore` is removed, you need to drop that argument. The new signature is `(golferId, roundId, totalScore, status?, birdies?)`.

Search the file for all `createScore(` calls and update them. Examples:

```ts
// Before (line 32):
const oldScore = createScore('g1', 1, -1, -2)
// After:
const oldScore = createScore('g1', 1, -2)

// Before (line 33):
const newScore = createScore('g1', 1, -1, -2)
// After:
const newScore = createScore('g1', 1, -2)

// Before (line 40):
const oldScore = createScore('g1', 1, -1, -2)
// After:
const oldScore = createScore('g1', 1, -2)

// Before (line 41):
const newScore = createScore('g1', 1, -2, -3)
// After:
const newScore = createScore('g1', 1, -3)
```

Go through EVERY `createScore` call in the file. The pattern is: remove the 3rd argument (the old `roundScore`) so the old 4th argument (`totalScore`) becomes the new 3rd.

- [ ] **Step 3: Fix the "detects round score changes" test expectation (line 44)**

The test currently expects:

```ts
expect(diff.fields).toEqual({ round_score: { old: -1, new: -2 }, total_score: { old: -2, new: -3 } })
```

Since `round_score` no longer exists, update to:

```ts
expect(diff.fields).toEqual({ total_score: { old: -2, new: -3 } })
```

Also rename the test to something more accurate, e.g. "detects total score changes":

```ts
it('detects total score changes', () => {
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run src/lib/__tests__/audit.test.ts
```

Expected: 11 passed (11).

- [ ] **Step 5: Commit**

```bash
git add src/lib/__tests__/audit.test.ts
git commit -m "test: fix audit tests for TournamentScore schema change (round_score removed)"
```

---

## Task 4: Fix `golfer-detail.test.ts` — remove `rounds` array and `round_score` expectations

**Why:** The `getGolferScorecard` function no longer returns a `rounds` array (it was removed in the schema change). The `createScore` helper also references the removed `round_score` field.

**File:** `src/lib/__tests__/golfer-detail.test.ts`

- [ ] **Step 1: Fix the `createScore` helper (lines 6-23)**

Same fix as Task 3 — update to match the current `TournamentScore` interface. Replace lines 6-23:

```ts
function createScore(
  golferId: string,
  roundId: number,
  totalScore: number | null,
  status: GolferStatus = 'active',
  birdies: number = 0
): TournamentScore {
  return {
    golfer_id: golferId,
    tournament_id: 't1',
    round_id: roundId,
    total_score: totalScore,
    total_birdies: birdies,
    status,
  }
}
```

Note: the `roundScore` parameter (3rd param) is removed. Same pattern as Task 3.

- [ ] **Step 2: Update ALL `createScore` call sites**

Search the file for all `createScore(` calls. Remove the old 3rd argument (`roundScore`). Examples:

```ts
// Before (line 28):
const score = createScore('g1', 3, -2, -4, 'active', 2)
// After:
const score = createScore('g1', 3, -4, 'active', 2)

// Before (line 49):
const score = createScore('g1', 0, null, null, 'active')
// After:
const score = createScore('g1', 0, null, 'active')
```

Go through EVERY call in the file.

- [ ] **Step 3: Fix "returns round-level data for an active golfer" test (lines 27-46)**

The test expects `card.rounds` to be a specific array. But `getGolferScorecard` no longer returns `rounds`. Remove the `rounds` assertion entirely:

```ts
it('returns round-level data for an active golfer', () => {
  const score = createScore('g1', 3, -4, 'active', 2)
  const card = getGolferScorecard(score)

  expect(card.golferId).toBe('g1')
  expect(card.status).toBe('active')
  expect(card.totalBirdies).toBe(2)
  expect(card.completedRounds).toBe(3)
  expect(card.totalScore).toBe(-4)
})
```

- [ ] **Step 4: Fix "returns zero total for a golfer with no round data" test (lines 48-55)**

The test expects `card.rounds?.[0].score` to be `null`. But `rounds` no longer exists. Replace the assertion:

```ts
it('returns zero total for a golfer with no round data', () => {
  const score = createScore('g1', 0, null, 'active')
  const card = getGolferScorecard(score)

  expect(card.completedRounds).toBe(0)
  expect(card.totalScore).toBe(0)
  expect(card.rounds).toBeUndefined()
})
```

- [ ] **Step 5: Check remaining tests in the file**

Read the rest of the file. Any other test that references `round_score` in a `createScore` call or asserts `card.rounds` needs the same treatment. The `getGolferContribution` tests use `createScore` too — make sure you update those call sites.

- [ ] **Step 6: Run the tests**

```bash
npx vitest run src/lib/__tests__/golfer-detail.test.ts
```

Expected: 14 passed (14).

- [ ] **Step 7: Commit**

```bash
git add src/lib/__tests__/golfer-detail.test.ts
git commit -m "test: fix golfer-detail tests for TournamentScore schema change (rounds removed)"
```

---

## Task 5: Fix `slash-golf-client.test.ts` — update expected normalized shape

**Why:** The `normalizeTournamentScores` function now returns a richer shape with `rounds`, `current_round`, `course_id`, etc. The test expects the old shape with `round_id`, `round_score`, `round_status`.

**File:** `src/lib/__tests__/slash-golf-client.test.ts`

- [ ] **Step 1: Understand the current output**

The test sends this API response:
```json
{ "leaderboardRows": [{ "playerId": "g1", "total": "-1", "currentRoundScore": "-1", "thru": "2" }] }
```

The current `normalizeTournamentScores` function (in `src/lib/slash-golf/client.ts` lines 87-110) produces:
```ts
{
  golfer_id: 'g1',
  tournament_id: '',
  strokes: null,
  score_to_par: null,
  course_id: null,
  course_name: null,
  total_score: -1,
  total_strokes_from_completed_rounds: null,
  position: null,
  current_hole: null,
  thru: 2,
  starting_hole: null,
  current_round: null,
  current_round_score: -1,
  tee_time: null,
  tee_time_timestamp: null,
  is_amateur: null,
  updated_at: null,
  rounds: [],
  total: -1,
  total_birdies: 0,
  status: 'active',
}
```

- [ ] **Step 2: Update the expected value**

Replace the assertion block (lines 20-35) with:

```ts
await expect(getTournamentScores('041', 2026)).resolves.toEqual([
  {
    golfer_id: 'g1',
    tournament_id: '',
    strokes: null,
    score_to_par: null,
    course_id: null,
    course_name: null,
    total_score: -1,
    total_strokes_from_completed_rounds: null,
    position: null,
    current_hole: null,
    thru: 2,
    starting_hole: null,
    current_round: null,
    current_round_score: -1,
    tee_time: null,
    tee_time_timestamp: null,
    is_amateur: null,
    updated_at: null,
    rounds: [],
    total: -1,
    total_birdies: 0,
    status: 'active',
  },
])
```

- [ ] **Step 3: Run the test**

```bash
npx vitest run src/lib/__tests__/slash-golf-client.test.ts
```

Expected: 1 passed (1).

- [ ] **Step 4: Commit**

```bash
git add src/lib/__tests__/slash-golf-client.test.ts
git commit -m "test: fix slash-golf-client test for new GolferScore shape (rounds array)"
```

---

## Task 6: Verify full suite passes

**Why:** The spec's done-when clause requires `npm test` to exit 0.

- [ ] **Step 1: Run the full suite**

```bash
npx vitest run
```

Expected: 208 passed (208), 0 failed. Exit code 0.

If any test still fails, read the error output carefully and fix it before proceeding.

- [ ] **Step 2: Commit (if any additional fixes were needed)**

Only commit if you made additional changes beyond Tasks 1-5.

---

## Verification Checklist

After all tasks are complete, confirm:

| Check | Command | Expected |
|-------|---------|----------|
| Refresh endpoint 409 test | `npx vitest run src/app/api/scoring/refresh/route.test.ts` | 6 passed |
| Leaderboard stale-path test | `npx vitest run 'src/app/api/leaderboard/[poolId]/route.test.ts'` | 2 passed |
| Audit tests | `npx vitest run src/lib/__tests__/audit.test.ts` | 11 passed |
| Golfer-detail tests | `npx vitest run src/lib/__tests__/golfer-detail.test.ts` | 14 passed |
| Slash-golf-client tests | `npx vitest run src/lib/__tests__/slash-golf-client.test.ts` | 1 passed |
| Full suite | `npx vitest run` | 208 passed, 0 failed |
