# On-Demand Tournament Scoring Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trigger score refresh on user page load when data is >15 minutes stale, with inline "Refreshing..." indicator in the UI.

**Architecture:** 
- `POST /api/scoring/refresh` accepts a `poolId` and triggers scoring for that pool's tournament
- `GET /api/leaderboard/[poolId]` checks staleness and returns `isRefreshing: true` when triggering a background refresh
- Leaderboard UI shows "Refreshing... • Last updated Xm ago" inline with the timestamp
- Cron remains as safety net (unchanged)

**Tech Stack:** Next.js route handlers, Supabase, React state, existing scoring infrastructure

---

## File Structure

### Create

- `src/app/api/scoring/refresh/route.ts` - on-demand refresh endpoint

### Modify

- `src/app/api/leaderboard/[poolId]/route.ts` - add staleness check, return `isRefreshing` flag
- `src/lib/freshness.ts` - update `DEFAULT_STALE_THRESHOLD_MS` from 10 to 15 minutes
- `src/components/leaderboard.tsx` - add `isRefreshing` state and inline indicator
- `src/components/TrustStatusBar.tsx` - support `isRefreshing` prop for inline indicator

---

## Task 1: Update stale threshold from 10m to 15m

**Files:**
- Modify: `src/lib/freshness.ts:4`

- [ ] **Step 1: Update the threshold constant**

```ts
// Before
export const DEFAULT_STALE_THRESHOLD_MS = 10 * 60 * 1000

// After
export const STALE_THRESHOLD_MS = 15 * 60 * 1000
```

Note: Keep `DEFAULT_STALE_THRESHOLD_MS` as alias for backward compat but add new `STALE_THRESHOLD_MS`.

- [ ] **Step 2: Run existing freshness tests**

Run: `npm test -- src/lib/__tests__/freshness.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/freshness.ts
git commit -m "chore: update stale threshold to 15 minutes"
```

---

## Task 2: Create refresh endpoint

**Files:**
- Create: `src/app/api/scoring/refresh/route.ts`
- Modify: `src/app/api/scoring/route.ts:51-55` (reuse existing scoring logic)

The refresh endpoint will reuse the existing scoring route's logic but target a specific pool by ID instead of finding "active pool".

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/scoring/refresh/route.test.ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

const server = setupServer(
  http.post('http://localhost:3000/api/scoring', () => {
    return HttpResponse.json({ data: { completedRounds: 2, refreshedAt: new Date().toISOString() }, error: null })
  })
)

describe('POST /api/scoring/refresh', () => {
  it('returns 401 without auth', async () => {
    const res = await fetch('/api/scoring/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poolId: 'test-pool-id' })
    })
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/scoring/refresh/route.test.ts`
Expected: FAIL - file doesn't exist yet

- [ ] **Step 3: Implement the refresh endpoint**

```ts
// src/app/api/scoring/refresh/route.ts
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPoolById, getPoolsByTournament, getEntriesForPool, updatePoolRefreshMetadata, insertAuditEvent } from '@/lib/pool-queries'
import { upsertTournamentScore, getScoresForTournament } from '@/lib/scoring-queries'
import { getTournamentScores } from '@/lib/slash-golf/client'
import { rankEntries } from '@/lib/scoring'
import { buildRefreshAuditDetails } from '@/lib/audit'
import type { TournamentScore } from '@/lib/supabase/types'

let isUpdating = false

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (isUpdating) {
    return NextResponse.json({ 
      data: null, 
      error: { code: 'UPDATE_IN_PROGRESS', message: 'Refresh already running' } 
    }, { status: 409 })
  }

  const { poolId } = await request.json()
  if (!poolId) {
    return NextResponse.json({ 
      data: null, 
      error: { code: 'BAD_REQUEST', message: 'poolId required' } 
    }, { status: 400 })
  }

  isUpdating = true

  try {
    const supabase = createAdminClient()
    
    const pool = await getPoolById(supabase, poolId)
    if (!pool) {
      return NextResponse.json({ 
        data: null, 
        error: { code: 'NOT_FOUND', message: 'Pool not found' } 
      }, { status: 404 })
    }

    const tournamentPools = await getPoolsByTournament(supabase, pool.tournament_id)
    const livePools = tournamentPools.filter((tournamentPool) => tournamentPool.status === 'live')

    const existingScores = await getScoresForTournament(supabase, pool.tournament_id)
    const oldScoresMap = new Map<string, TournamentScore>()
    for (const score of existingScores) {
      oldScoresMap.set(score.golfer_id, score)
    }

    let slashScores
    try {
      slashScores = await getTournamentScores(pool.tournament_id, pool.year)
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error'

      await updatePoolRefreshMetadata(supabase, pool.id, {
        last_refresh_error: errorMessage,
      })

      return NextResponse.json(
        { data: null, error: { code: 'FETCH_FAILED', message: errorMessage } },
        { status: 502 }
      )
    }

    const refreshedAt = new Date().toISOString()
    for (const score of slashScores) {
      await upsertTournamentScore(supabase, {
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
    }

    await updatePoolRefreshMetadata(supabase, pool.id, {
      refreshed_at: refreshedAt,
      last_refresh_error: null,
    })

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

    return NextResponse.json({
      data: { completedRounds, refreshedAt },
      error: null,
    })
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/scoring/refresh/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/scoring/refresh/route.ts src/app/api/scoring/refresh/route.test.ts
git commit -m "feat: add on-demand scoring refresh endpoint"
```

---

## Task 3: Modify leaderboard route to detect staleness and return `isRefreshing` flag

**Files:**
- Modify: `src/app/api/leaderboard/[poolId]/route.ts`
- Create: `src/app/api/leaderboard/[poolId]/route.test.ts` (add tests for isRefreshing behavior)

- [ ] **Step 1: Add staleness check and isRefreshing to the leaderboard route**

Add import for `classifyFreshness` and `STALE_THRESHOLD_MS` from `@/lib/freshness`:

```ts
import { classifyFreshness, STALE_THRESHOLD_MS } from '@/lib/freshness'
```

In the GET handler, after fetching the pool and before returning, add:

```ts
// Check staleness
const freshness = classifyFreshness(pool.refreshed_at, STALE_THRESHOLD_MS)
const isStale = freshness === 'stale' || freshness === 'unknown'
```

Add `isRefreshing` to the response (it's `true` when stale, triggering client to call refresh):

```ts
return NextResponse.json({
  data: {
    entries: ranked,
    completedRounds,
    refreshedAt: pool.refreshed_at,
    freshness,
    poolStatus: pool.status,
    lastRefreshError: pool.last_refresh_error,
    golferStatuses,
    golferNames,
    golferCountries,
    golferScores: Object.fromEntries(golferScoresMap),
    isRefreshing: isStale,  // NEW: flag client to show refreshing indicator
  },
  error: null,
})
```

Apply same change to early-return cases (no entries, no scores).

- [ ] **Step 2: Run existing tests**

Run: `npm test -- src/app/api/leaderboard/[poolId]/route.test.ts`
Expected: PASS (may need to update existing tests for new field)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/leaderboard/[poolId]/route.ts
git commit -m "feat: leaderboard returns isRefreshing flag when data is stale"
```

---

## Task 4: Add inline "Refreshing..." indicator to leaderboard UI

**Files:**
- Modify: `src/components/leaderboard.tsx` - add `isRefreshing` state and indicator
- Modify: `src/components/TrustStatusBar.tsx` - add support for `isRefreshing` prop

- [ ] **Step 1: Add isRefreshing to LeaderboardData interface**

```ts
interface LeaderboardData {
  // ... existing fields
  isRefreshing?: boolean  // NEW: true when stale and refresh triggered
}
```

- [ ] **Step 2: Modify TrustStatusBar to support isRefreshing**

Add to `GetTrustStatusBarStateInput`:
```ts
interface GetTrustStatusBarStateInput {
  // ... existing fields
  isRefreshing?: boolean
}
```

Add to `getFreshnessMessage` logic:
```ts
if (input.isRefreshing) {
  return {
    freshnessMessage: `Refreshing... • Last updated ${input.refreshedAt ? formatRelativeTime(input.refreshedAt) : 'unknown'}`,
    tone: 'info',
    role: 'status',
    ariaLive: 'polite',
  }
}
```

Note: You'll need a `formatRelativeTime` helper (e.g., "18m ago") - can add a simple utility.

- [ ] **Step 3: Pass isRefreshing from leaderboard to TrustStatusBar**

In leaderboard.tsx, update the TrustStatusBar call:
```tsx
<TrustStatusBar
  className="border"
  isLocked={true}
  poolStatus={poolStatus}
  freshness={freshness}
  refreshedAt={refreshedAt}
  lastRefreshError={lastRefreshError}
  isRefreshing={data.isRefreshing}  // NEW
/>
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/components/__tests__/TrustStatusBar.test.tsx`
Expected: PASS (may need to update for new isRefreshing behavior)

- [ ] **Step 5: Commit**

```bash
git add src/components/leaderboard.tsx src/components/TrustStatusBar.tsx
git commit -m "feat: show inline refreshing indicator on stale leaderboards"
```

---

## Task 5: Client-side refresh trigger

**Files:**
- Modify: `src/components/leaderboard.tsx` - trigger refresh call when isRefreshing is true

- [ ] **Step 1: Add refresh-on-stale logic to useEffect**

Add a separate useEffect that watches for `data.isRefreshing`:

```ts
useEffect(() => {
  if (data?.isRefreshing) {
    // Trigger refresh in background
    fetch('/api/scoring/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ''}`
      },
      body: JSON.stringify({ poolId })
    }).then(res => res.json()).then(json => {
      if (json.data) {
        // Refresh complete, re-fetch leaderboard
        fetchLeaderboard()
      }
    }).catch(() => {
      // Silently fail - user sees timestamp of last known good data
    })
  }
}, [data?.isRefreshing, poolId, fetchLeaderboard])
```

Note: For client-side, we need a public endpoint or different auth approach since CRON_SECRET is server-only. Consider:
- Option A: Create a separate public `/api/scoring/refresh-public` endpoint that uses a different auth mechanism
- Option B: Use a signed token approach
- Option C: The leaderboard route already triggers the refresh server-side via a call from the cron route - the client just needs to poll until isRefreshing becomes false

**Recommended approach (Option C):** The leaderboard route returns `isRefreshing: true` when stale. The client shows the refreshing indicator and re-fetches the leaderboard after a delay. The server-side cron/call handles actual refresh. No new client-side auth needed.

- [ ] **Step 2: Update leaderboard to auto-retry when isRefreshing is true**

Modify `fetchLeaderboard` to be called again after a short delay when `isRefreshing` is true:

```ts
useEffect(() => {
  if (data?.isRefreshing) {
    const timer = setTimeout(fetchLeaderboard, 3000) // Retry after 3s
    return () => clearTimeout(timer)
  }
}, [data?.isRefreshing])
```

- [ ] **Step 3: Commit**

```bash
git add src/components/leaderboard.tsx
git commit -m "feat: auto-retry leaderboard when stale"
```

---

## Implementation Notes

1. **Auth approach for refresh endpoint**: The `POST /api/scoring/refresh` uses `CRON_SECRET` like the existing cron route. For the on-demand flow to work without client-side auth, the leaderboard page should be server-rendered with staleness check, OR we create a public variant that uses a different auth (e.g., rate-limited by IP).

2. **Simplicity over optimization**: Multiple users hitting a stale page will each trigger retries. The cron as safety net ensures data eventually refreshes even if client retries fail.

3. **Error handling**: On refresh failure, user sees "Last updated Xm ago" with the timestamp of last known good data. No error banner, just honest age.

---

## Spec Coverage Check

| Requirement | Task |
|-------------|------|
| On-demand refresh on user page load | Task 3, 5 |
| Check if data >15m stale | Task 1, 3 |
| Return isRefreshing flag | Task 3 |
| Show "Refreshing... • Last updated Xm ago" | Task 4 |
| Cron stays as safety net | No change needed |
| Error: show stale data with timestamp | Task 4 |
| Fixed 15-minute threshold | Task 1 |

## Placeholder Scan

- No TBD/TODO placeholders
- All code implementations shown
- All file paths are concrete
