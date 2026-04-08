# On-Demand Tournament Scoring Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user loads the leaderboard and scores are >15 minutes stale, automatically trigger a background refresh server-side. Show "Refreshing..." inline with the timestamp until fresh data arrives.

**How it works (read this first):**
1. User visits leaderboard → client calls `GET /api/leaderboard/[poolId]`
2. Leaderboard route checks `pool.refreshed_at` — if stale, it fires a server-side `POST /api/scoring/refresh` (fire-and-forget) and returns `isRefreshing: true`
3. Client shows "Refreshing..." in the TrustStatusBar
4. Refresh endpoint fetches scores from external API, upserts to DB, broadcasts via Supabase Realtime
5. Client receives update via Realtime listener (already wired up) or via the existing 30-second poll

**Key constraint:** The refresh endpoint uses `CRON_SECRET` for auth. The client never calls it directly — only the leaderboard route (which runs server-side) triggers it.

**Tech Stack:** Next.js route handlers, Supabase, React, vitest

---

## File Overview

| Action | File | What changes |
|--------|------|--------------|
| Modify | `src/lib/freshness.ts` | Update threshold 10m → 15m |
| Create | `src/lib/scoring-refresh.ts` | Extract shared scoring logic from cron route |
| Create | `src/lib/__tests__/scoring-refresh.test.ts` | Tests for shared logic |
| Modify | `src/app/api/scoring/route.ts` | Call shared `refreshScoresForPool()` instead of inline logic |
| Create | `src/app/api/scoring/refresh/route.ts` | New endpoint: refresh by poolId |
| Create | `src/app/api/scoring/refresh/route.test.ts` | Tests for new endpoint |
| Modify | `src/app/api/leaderboard/[poolId]/route.ts` | Staleness check → fire-and-forget refresh, return `isRefreshing` |
| Modify | `src/components/TrustStatusBar.tsx` | Add "Refreshing..." state |
| Modify | `src/components/leaderboard.tsx` | Pass `isRefreshing` to TrustStatusBar |

---

## Task 1: Update stale threshold from 10 minutes to 15 minutes

**Why:** The design spec defines a 15-minute staleness threshold. The current constant is 10 minutes.

**Files:** `src/lib/freshness.ts`

- [ ] **Step 1: Read the current file**

Open `src/lib/freshness.ts`. You'll see:
```ts
export const DEFAULT_STALE_THRESHOLD_MS = 10 * 60 * 1000
```

- [ ] **Step 2: Update the constant value**

Change line 4 from `10 * 60 * 1000` to `15 * 60 * 1000`:

```ts
// Before
export const DEFAULT_STALE_THRESHOLD_MS = 10 * 60 * 1000

// After
export const DEFAULT_STALE_THRESHOLD_MS = 15 * 60 * 1000
```

Also update the JSDoc comment on line 3 from "10 minutes" to "15 minutes".

Do NOT rename the constant. Other files import `DEFAULT_STALE_THRESHOLD_MS` and we don't want to break them.

- [ ] **Step 3: Update the test for the new threshold**

Open `src/lib/__tests__/freshness.test.ts`. The test on line 25 says:
```ts
// Default threshold (10 min) → current; custom 2 min → stale
```
Update the comment to say "15 min" instead of "10 min".

- [ ] **Step 4: Run the tests**

```bash
npm test -- src/lib/__tests__/freshness.test.ts
```

All tests should pass. The existing tests use values like "5 minutes ago" (current) and "20 minutes ago" (stale), which work with both 10m and 15m thresholds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/freshness.ts src/lib/__tests__/freshness.test.ts
git commit -m "chore: update stale threshold from 10 to 15 minutes"
```

---

## Task 2: Extract shared scoring refresh logic

**Why:** The existing cron route (`POST /api/scoring`) has ~100 lines of scoring refresh logic (fetch from API, upsert scores, broadcast, audit). The new refresh endpoint needs the same logic. Instead of duplicating it, extract it into a shared function.

**Files:**
- Create: `src/lib/scoring-refresh.ts`
- Create: `src/lib/__tests__/scoring-refresh.test.ts`

- [ ] **Step 1: Understand what to extract**

Read `src/app/api/scoring/route.ts` lines 56–195. This is the core scoring logic:
1. Find all live pools for the tournament (lines 57-58)
2. Get existing scores for diff tracking (lines 60-64)
3. Fetch scores from external API (lines 67-89)
4. Upsert scores into DB (lines 92-144)
5. Update refresh metadata (lines 147-150)
6. Compute rankings and broadcast to all live pools (lines 153-195)

All of this will move into the shared function. The cron route will keep its own responsibilities: auth check, auto-lock logic (lines 38-49), and finding the active pool (lines 51-55).

- [ ] **Step 2: Create `src/lib/scoring-refresh.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { getTournamentScores } from '@/lib/slash-golf/client'
import { rankEntries } from '@/lib/scoring'
import { buildRefreshAuditDetails } from '@/lib/audit'
import {
  getPoolsByTournament,
  getEntriesForPool,
  updatePoolRefreshMetadata,
  insertAuditEvent,
} from '@/lib/pool-queries'
import {
  upsertTournamentScore,
  getScoresForTournament,
} from '@/lib/scoring-queries'
import type { TournamentScore } from '@/lib/supabase/types'

interface RefreshablePool {
  id: string
  tournament_id: string
  year: number
  status: string
}

export interface RefreshResult {
  completedRounds: number
  refreshedAt: string
}

export interface RefreshError {
  code: 'FETCH_FAILED' | 'UPSERT_FAILED' | 'INTERNAL_ERROR'
  message: string
}

/**
 * Core scoring refresh logic shared by the cron route and the on-demand refresh endpoint.
 *
 * 1. Fetches scores from the external SlashGolf API
 * 2. Upserts scores into the tournament_scores table
 * 3. Updates refresh metadata on all live pools for the tournament
 * 4. Broadcasts ranked leaderboard via Supabase Realtime
 * 5. Writes audit events
 *
 * Returns { data, error } — exactly one will be non-null.
 */
export async function refreshScoresForPool(
  supabase: SupabaseClient,
  pool: RefreshablePool
): Promise<{ data: RefreshResult | null; error: RefreshError | null }> {
  const tournamentPools = await getPoolsByTournament(supabase, pool.tournament_id)
  const livePools = tournamentPools.filter((p) => p.status === 'live')

  const existingScores = await getScoresForTournament(supabase, pool.tournament_id)
  const oldScoresMap = new Map<string, TournamentScore>()
  for (const score of existingScores) {
    oldScoresMap.set(score.golfer_id, score)
  }

  // Step 1: Fetch scores from external API
  let slashScores
  try {
    slashScores = await getTournamentScores(pool.tournament_id, pool.year)
  } catch (fetchError) {
    const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error'

    await updatePoolRefreshMetadata(supabase, pool.id, {
      last_refresh_error: errorMessage,
    })

    await insertAuditEvent(supabase, {
      pool_id: pool.id,
      user_id: null,
      action: 'scoreRefreshFailed',
      details: { error: errorMessage },
    })

    return {
      data: null,
      error: { code: 'FETCH_FAILED', message: errorMessage },
    }
  }

  // Step 2: Upsert scores into DB
  const refreshedAt = new Date().toISOString()
  const upsertFailures: Array<{ golfer_id: string; error: string }> = []
  for (const score of slashScores) {
    const upsertResult = await upsertTournamentScore(supabase, {
      golfer_id: score.golfer_id,
      tournament_id: pool.tournament_id,
      round_id: score.round_id ?? null,
      round_score: score.round_score ?? null,
      total_score: score.total_score ?? null,
      position: score.position ?? null,
      round_status: score.round_status ?? null,
      current_hole: score.current_hole ?? null,
      tee_time: score.tee_time ?? null,
      updated_at: score.updated_at ?? refreshedAt,
      total_birdies: score.total_birdies ?? 0,
      status: score.status ?? 'active',
    } as any)

    if (upsertResult.error) {
      upsertFailures.push({ golfer_id: score.golfer_id, error: upsertResult.error })
    }
  }

  if (upsertFailures.length > 0) {
    const failureMessage = `Upsert failed for ${upsertFailures.length} golfer(s): ${upsertFailures
      .map((f) => `${f.golfer_id} (${f.error})`)
      .join(', ')}`

    await updatePoolRefreshMetadata(supabase, pool.id, {
      last_refresh_error: failureMessage,
    })

    await insertAuditEvent(supabase, {
      pool_id: pool.id,
      user_id: null,
      action: 'scoreRefreshFailed',
      details: {
        error: failureMessage,
        failures: upsertFailures,
      },
    })

    return {
      data: null,
      error: { code: 'UPSERT_FAILED', message: 'Failed to persist one or more golfer scores' },
    }
  }

  // Step 3: Update refresh metadata (success)
  await updatePoolRefreshMetadata(supabase, pool.id, {
    refreshed_at: refreshedAt,
    last_refresh_error: null,
  })

  // Step 4: Compute rankings, broadcast, and audit for each live pool
  const allScores = await getScoresForTournament(supabase, pool.tournament_id)

  const golferScoresMap = new Map<string, TournamentScore>()
  for (const score of allScores) {
    golferScoresMap.set(score.golfer_id, score)
  }

  const completedRounds = slashScores.length > 0
    ? Math.max(...slashScores.map((s) => s.round_id ?? 0))
    : 0

  const refreshDetails = buildRefreshAuditDetails(
    oldScoresMap,
    allScores,
    completedRounds,
    allScores.length
  )

  for (const tournamentPool of livePools) {
    const entries = await getEntriesForPool(supabase, tournamentPool.id)
    const ranked = rankEntries(entries as never[], golferScoresMap, completedRounds)

    await supabase.channel('pool_updates').send({
      type: 'broadcast',
      event: 'scores',
      payload: { poolId: tournamentPool.id, ranked, completedRounds, updatedAt: refreshedAt },
    })

    await updatePoolRefreshMetadata(supabase, tournamentPool.id, {
      refreshed_at: refreshedAt,
      last_refresh_error: null,
    })

    await insertAuditEvent(supabase, {
      pool_id: tournamentPool.id,
      user_id: null,
      action: 'scoreRefreshCompleted',
      details: {
        ...refreshDetails,
        entryCount: (entries || []).length,
      },
    })
  }

  return {
    data: { completedRounds, refreshedAt },
    error: null,
  }
}
```

- [ ] **Step 3: Write tests for the shared function**

Create `src/lib/__tests__/scoring-refresh.test.ts`. Follow the same vitest mock patterns used in `src/app/api/scoring/route.test.ts` — use `vi.mock()` for dependencies and test the function directly.

Write tests for:
1. Happy path: fetches scores, upserts, broadcasts, returns `{ data, error: null }`
2. External API failure: returns `{ data: null, error: { code: 'FETCH_FAILED' } }`
3. Upsert failure: returns `{ data: null, error: { code: 'UPSERT_FAILED' } }`
4. Broadcasts to all live pools on the same tournament

Use the existing test in `src/app/api/scoring/route.test.ts` as a reference for mock setup patterns.

- [ ] **Step 4: Run the tests**

```bash
npm test -- src/lib/__tests__/scoring-refresh.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring-refresh.ts src/lib/__tests__/scoring-refresh.test.ts
git commit -m "refactor: extract shared scoring refresh logic into scoring-refresh.ts"
```

---

## Task 3: Refactor cron route to use shared logic

**Why:** Now that the scoring logic is extracted, the cron route should call it instead of having inline code.

**Files:** `src/app/api/scoring/route.ts`

- [ ] **Step 1: Read the current cron route**

Open `src/app/api/scoring/route.ts`. Note that it has two responsibilities:
1. **Auto-lock** open pools past deadline (lines 38–49) — this stays in the cron route
2. **Score refresh** (lines 51–195) — this is now in `refreshScoresForPool()`

- [ ] **Step 2: Refactor the route**

Replace lines 51–200 with a call to `refreshScoresForPool`. The route should look like:

```ts
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getActivePool,
  getOpenPoolsPastDeadline,
  updatePoolStatus,
  insertAuditEvent,
} from '@/lib/pool-queries'
import { refreshScoresForPool } from '@/lib/scoring-refresh'

let isUpdating = false

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (isUpdating) {
    return NextResponse.json({ message: 'Update in progress' }, { status: 409 })
  }
  isUpdating = true

  try {
    const supabase = createAdminClient()

    // Step 1: Auto-lock any open pools past their deadline
    const poolsToLock = await getOpenPoolsPastDeadline(supabase)
    for (const pool of poolsToLock) {
      const { error } = await updatePoolStatus(supabase, pool.id, 'live', 'open')
      if (!error) {
        await insertAuditEvent(supabase, {
          pool_id: pool.id,
          user_id: null,
          action: 'entryLocked',
          details: { reason: 'deadline_passed', deadline: pool.deadline },
        })
      }
    }

    // Step 2: Find the active (live) pool and refresh scores
    const pool = await getActivePool(supabase)
    if (!pool) {
      return NextResponse.json({ data: { message: 'No live pool' }, error: null })
    }

    const result = await refreshScoresForPool(supabase, pool)

    if (result.error) {
      const statusMap = {
        FETCH_FAILED: 502,
        UPSERT_FAILED: 500,
        INTERNAL_ERROR: 500,
      } as const
      return NextResponse.json(
        { data: null, error: result.error },
        { status: statusMap[result.error.code] }
      )
    }

    return NextResponse.json({ data: result.data, error: null })
  } catch (error) {
    console.error('Scoring update failed:', error)
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Update failed',
        },
      },
      { status: 500 }
    )
  } finally {
    isUpdating = false
  }
}
```

- [ ] **Step 3: Run existing cron route tests**

```bash
npm test -- src/app/api/scoring/route.test.ts
```

The tests mock the same dependencies (`getTournamentScores`, `upsertTournamentScore`, etc.) that are now called inside `refreshScoresForPool`. Since vitest hoists `vi.mock()` calls, the mocks still apply — they intercept the imports inside `scoring-refresh.ts` too.

If tests fail, check that all imports in the test file still match the dependencies. You may need to add a mock for `refreshScoresForPool` itself if you want to test the cron route in isolation, OR keep the existing mocks of the underlying dependencies (which test the integration).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/scoring/route.ts
git commit -m "refactor: cron scoring route now calls shared refreshScoresForPool()"
```

---

## Task 4: Create the on-demand refresh endpoint

**Why:** This is the endpoint that the leaderboard route will call (server-to-server) when it detects stale data. It takes a `poolId` instead of finding the "active" pool.

**Files:**
- Create: `src/app/api/scoring/refresh/route.ts`
- Create: `src/app/api/scoring/refresh/route.test.ts`

- [ ] **Step 1: Create the endpoint**

Create `src/app/api/scoring/refresh/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPoolById } from '@/lib/pool-queries'
import { refreshScoresForPool } from '@/lib/scoring-refresh'

let isUpdating = false

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (isUpdating) {
    return NextResponse.json(
      { data: null, error: { code: 'UPDATE_IN_PROGRESS', message: 'Refresh already running' } },
      { status: 409 }
    )
  }

  const { poolId } = await request.json()
  if (!poolId) {
    return NextResponse.json(
      { data: null, error: { code: 'BAD_REQUEST', message: 'poolId required' } },
      { status: 400 }
    )
  }

  isUpdating = true

  try {
    const supabase = createAdminClient()

    const pool = await getPoolById(supabase, poolId)
    if (!pool) {
      return NextResponse.json(
        { data: null, error: { code: 'NOT_FOUND', message: 'Pool not found' } },
        { status: 404 }
      )
    }

    const result = await refreshScoresForPool(supabase, pool)

    if (result.error) {
      const statusMap = {
        FETCH_FAILED: 502,
        UPSERT_FAILED: 500,
        INTERNAL_ERROR: 500,
      } as const
      return NextResponse.json(
        { data: null, error: result.error },
        { status: statusMap[result.error.code] }
      )
    }

    return NextResponse.json({ data: result.data, error: null })
  } catch (error) {
    console.error('Refresh failed:', error)
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Update failed',
        },
      },
      { status: 500 }
    )
  } finally {
    isUpdating = false
  }
}
```

- [ ] **Step 2: Write tests**

Create `src/app/api/scoring/refresh/route.test.ts`. Follow the same pattern as `src/app/api/scoring/route.test.ts` (vitest mocks, direct handler import).

Test cases:
1. Returns 401 without auth header
2. Returns 400 when `poolId` is missing
3. Returns 404 when pool doesn't exist
4. Returns 200 and calls `refreshScoresForPool` on success
5. Returns 409 when a refresh is already in progress

Example test structure:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPoolById } from '@/lib/pool-queries'
import { refreshScoresForPool } from '@/lib/scoring-refresh'

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/pool-queries', () => ({
  getPoolById: vi.fn(),
}))

vi.mock('@/lib/scoring-refresh', () => ({
  refreshScoresForPool: vi.fn(),
}))

const originalEnv = { ...process.env }

describe('POST /api/scoring/refresh', () => {
  beforeEach(() => {
    process.env = { ...originalEnv, CRON_SECRET: 'secret' }
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns 401 without auth', async () => {
    const request = new Request('http://localhost/api/scoring/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poolId: 'pool-1' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('returns 400 when poolId is missing', async () => {
    const request = new Request('http://localhost/api/scoring/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer secret',
      },
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('returns 404 when pool does not exist', async () => {
    vi.mocked(createAdminClient).mockReturnValue({} as never)
    vi.mocked(getPoolById).mockResolvedValue(null)

    const request = new Request('http://localhost/api/scoring/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer secret',
      },
      body: JSON.stringify({ poolId: 'nonexistent' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(404)
  })

  it('returns 200 and refresh data on success', async () => {
    const pool = { id: 'pool-1', tournament_id: 't-1', year: 2026, status: 'live' }
    vi.mocked(createAdminClient).mockReturnValue({} as never)
    vi.mocked(getPoolById).mockResolvedValue(pool as never)
    vi.mocked(refreshScoresForPool).mockResolvedValue({
      data: { completedRounds: 2, refreshedAt: '2026-04-08T12:00:00.000Z' },
      error: null,
    })

    const request = new Request('http://localhost/api/scoring/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer secret',
      },
      body: JSON.stringify({ poolId: 'pool-1' }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.completedRounds).toBe(2)
    expect(refreshScoresForPool).toHaveBeenCalledWith(expect.anything(), pool)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm test -- src/app/api/scoring/refresh/route.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/scoring/refresh/route.ts src/app/api/scoring/refresh/route.test.ts
git commit -m "feat: add on-demand scoring refresh endpoint"
```

---

## Task 5: Leaderboard route triggers refresh when stale

**Why:** This is the core on-demand behavior. When the leaderboard route detects stale data, it fires a server-side request to the refresh endpoint (fire-and-forget) and returns `isRefreshing: true` to the client.

**Files:** `src/app/api/leaderboard/[poolId]/route.ts`

- [ ] **Step 1: Read the current leaderboard route**

Open `src/app/api/leaderboard/[poolId]/route.ts`. Note:
- Line 4: already imports `classifyFreshness`
- Line 29: already calls `classifyFreshness(pool.refreshed_at)`
- The `freshness` value is already included in all response paths

- [ ] **Step 2: Add the fire-and-forget refresh trigger**

Add this helper function at the top of the file (after the imports, before the `GET` handler):

```ts
import { DEFAULT_STALE_THRESHOLD_MS } from '@/lib/freshness'

/**
 * Fire-and-forget: trigger a background scoring refresh for this pool.
 * Runs server-side using CRON_SECRET — the client never sees this call.
 * Errors are silently swallowed (stale data is shown with honest timestamp).
 */
function triggerBackgroundRefresh(poolId: string): void {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  fetch(`${baseUrl}/api/scoring/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
    body: JSON.stringify({ poolId }),
  }).catch(() => {
    // Silently swallow — user sees stale data with honest timestamp
  })
}
```

- [ ] **Step 3: Add staleness detection and `isRefreshing` to the response**

After line 29 (`const freshness = classifyFreshness(pool.refreshed_at)`), add:

```ts
const isStale = freshness === 'stale' || freshness === 'unknown'
if (isStale && pool.status === 'live') {
  triggerBackgroundRefresh(poolId)
}
```

Only trigger refresh for `'live'` pools — `'open'` pools don't have scores yet, and `'complete'` pools don't need refreshing.

- [ ] **Step 4: Add `isRefreshing` to ALL response paths**

There are three `NextResponse.json()` calls in this file (lines 37, 62, 110). Add `isRefreshing` to the `data` object in each one:

```ts
isRefreshing: isStale && pool.status === 'live',
```

Add it alongside the existing `freshness` field in each response.

- [ ] **Step 5: Update existing leaderboard tests**

Open `src/app/api/leaderboard/[poolId]/route.test.ts`. The existing test checks `body.data.entries` and `body.data.completedRounds`. You may need to:
- Assert that `body.data.isRefreshing` exists (should be `false` since the mock returns `freshness: 'current'`)
- Add a new test case for the stale path that verifies `isRefreshing: true` and that `triggerBackgroundRefresh` was called

To test the fire-and-forget fetch, you can mock `global.fetch` in that test:
```ts
const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response())
```

- [ ] **Step 6: Run tests**

```bash
npm test -- src/app/api/leaderboard/[poolId]/route.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/app/api/leaderboard/[poolId]/route.ts src/app/api/leaderboard/[poolId]/route.test.ts
git commit -m "feat: leaderboard triggers background refresh when data is stale"
```

---

## Task 6: Add "Refreshing..." state to TrustStatusBar

**Why:** When the leaderboard returns `isRefreshing: true`, the TrustStatusBar should show "Refreshing scores..." instead of the normal freshness message.

**Files:**
- `src/components/TrustStatusBar.tsx`
- `src/components/__tests__/TrustStatusBar.test.tsx`

- [ ] **Step 1: Add `isRefreshing` to the input interface**

In `src/components/TrustStatusBar.tsx`, add `isRefreshing` to `GetTrustStatusBarStateInput` (line 6-12):

```ts
interface GetTrustStatusBarStateInput {
  isLocked: boolean
  poolStatus: PoolStatus
  freshness: FreshnessStatus
  refreshedAt: string | null
  lastRefreshError: string | null
  isRefreshing?: boolean  // NEW
}
```

- [ ] **Step 2: Handle `isRefreshing` in `getFreshnessMessage`**

In the `getFreshnessMessage` function (line 48-88), add a check for `isRefreshing` as the FIRST condition (before the error check):

You need to update the function signature to accept `isRefreshing`:

```ts
function getFreshnessMessage(
  freshness: FreshnessStatus,
  refreshedAt: string | null,
  lastRefreshError: string | null,
  isRefreshing?: boolean,
): Pick<TrustStatusBarState, 'freshnessMessage' | 'tone' | 'role' | 'ariaLive'> {
  if (isRefreshing) {
    const suffix = refreshedAt ? ` Last updated at ${refreshedAt}.` : ''
    return {
      freshnessMessage: `Refreshing scores...${suffix}`,
      tone: 'info',
      role: 'status',
      ariaLive: 'polite',
    }
  }

  // ... rest of existing logic unchanged
```

- [ ] **Step 3: Add a `'Refreshing'` option to `freshnessLabel`**

Update the `TrustStatusBarState` type to allow `'Refreshing'` as a label:

```ts
freshnessLabel: 'Current' | 'Stale' | 'No data' | 'Refresh failed' | 'Refreshing'
```

Update `getFreshnessLabel` to handle `isRefreshing`:

```ts
function getFreshnessLabel(
  freshness: FreshnessStatus,
  lastRefreshError: string | null,
  isRefreshing?: boolean,
): TrustStatusBarState['freshnessLabel'] {
  if (isRefreshing) return 'Refreshing'
  if (lastRefreshError) return 'Refresh failed'
  // ... rest unchanged
```

- [ ] **Step 4: Pass `isRefreshing` through the call chain**

In `getTrustStatusBarState` (line 120), update the calls to pass `isRefreshing`:

```ts
const freshnessState = getFreshnessMessage(
  input.freshness,
  input.refreshedAt,
  input.lastRefreshError,
  input.isRefreshing,  // NEW
)
```

And for the label:
```ts
freshnessLabel: getFreshnessLabel(input.freshness, input.lastRefreshError, input.isRefreshing),
```

- [ ] **Step 5: Add tests**

Add these tests to `src/components/__tests__/TrustStatusBar.test.tsx`:

```ts
it('shows refreshing state when isRefreshing is true', () => {
  const result = getTrustStatusBarState({
    isLocked: true,
    poolStatus: 'live',
    freshness: 'stale',
    refreshedAt: '2026-04-08T11:45:00.000Z',
    lastRefreshError: null,
    isRefreshing: true,
  })

  expect(result.freshnessLabel).toBe('Refreshing')
  expect(result.freshnessMessage).toContain('Refreshing scores...')
  expect(result.tone).toBe('info')
})

it('prioritizes isRefreshing over refresh error', () => {
  const result = getTrustStatusBarState({
    isLocked: true,
    poolStatus: 'live',
    freshness: 'stale',
    refreshedAt: '2026-04-08T11:45:00.000Z',
    lastRefreshError: 'PGATour API timed out',
    isRefreshing: true,
  })

  expect(result.freshnessLabel).toBe('Refreshing')
  expect(result.freshnessMessage).toContain('Refreshing scores...')
})
```

- [ ] **Step 6: Run tests**

```bash
npm test -- src/components/__tests__/TrustStatusBar.test.tsx
```

- [ ] **Step 7: Commit**

```bash
git add src/components/TrustStatusBar.tsx src/components/__tests__/TrustStatusBar.test.tsx
git commit -m "feat: TrustStatusBar shows 'Refreshing...' state"
```

---

## Task 7: Pass `isRefreshing` from leaderboard component to TrustStatusBar

**Why:** Wire up the new `isRefreshing` flag from the API response to the UI component.

**Files:**
- `src/components/leaderboard.tsx`

- [ ] **Step 1: Add `isRefreshing` to the `LeaderboardData` interface**

In `src/components/leaderboard.tsx` line 17-27, add:

```ts
interface LeaderboardData {
  entries: RankedEntry[]
  completedRounds: number
  refreshedAt: string | null
  freshness: FreshnessStatus
  poolStatus: PoolStatus
  lastRefreshError: string | null
  golferStatuses: Record<string, string>
  golferNames: Record<string, string>
  golferCountries: Record<string, string>
  golferScores: Record<string, TournamentScore>
  isRefreshing?: boolean  // NEW
}
```

- [ ] **Step 2: Pass `isRefreshing` to the TrustStatusBar**

Find the `<TrustStatusBar>` usage (line 161-167). Add the `isRefreshing` prop:

```tsx
<TrustStatusBar
  className="border"
  isLocked={true}
  poolStatus={poolStatus}
  freshness={freshness}
  refreshedAt={refreshedAt}
  lastRefreshError={lastRefreshError}
  isRefreshing={data.isRefreshing}
/>
```

That's it — the existing `fetchLeaderboard` callback already reads `json.data` and sets `data` (line 59), so `isRefreshing` will flow through automatically.

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```

Make sure nothing is broken across all tests.

- [ ] **Step 4: Commit**

```bash
git add src/components/leaderboard.tsx
git commit -m "feat: pass isRefreshing to TrustStatusBar in leaderboard"
```

---

## Spec Coverage Check

| Requirement | Task |
|-------------|------|
| On-demand refresh on user page load | Task 5 (leaderboard triggers server-side refresh) |
| Check if data >15m stale | Task 1 (threshold), Task 5 (detection) |
| Shared scoring logic (no duplication) | Task 2 (extract), Task 3 (cron uses it), Task 4 (refresh uses it) |
| Return `isRefreshing` flag | Task 5 |
| Show "Refreshing... • Last updated Xm ago" | Task 6, Task 7 |
| Cron stays as safety net | Task 3 (cron route preserved, just calls shared function) |
| Error: show stale data with timestamp | Task 6 (TrustStatusBar falls back gracefully) |
| No client-side auth needed | Task 5 (server-side fire-and-forget) |

## Placeholder Scan

- No TBD/TODO placeholders
- All code implementations shown
- All file paths are concrete and verified against codebase
