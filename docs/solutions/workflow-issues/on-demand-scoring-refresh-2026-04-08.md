---
title: On-demand scoring refresh
date: 2026-04-08
category: docs/solutions/workflow-issues/
module: scoring
problem_type: workflow_issue
component: api
severity: medium
tags: [scoring, leaderboard, freshness, background-refresh, cron-alternative]
---

# On-demand scoring refresh

## Context

Cron-only scoring creates a stale data problem in golf pool leaderboards. With polling only every 4 hours, users between cron runs see outdated tournament scores with no indication the data is old. This erodes trust in the leaderboard — users cannot distinguish between genuinely stable scores and stale data that hasn't been refreshed yet.

## Guidance

### On-Demand Background Refresh Pattern

The solution introduces a **server-triggered on-demand refresh** that fires when a client requests leaderboard data that is stale (older than 15 minutes). This combines the reliability of cron polling with the responsiveness of event-driven updates.

**Key architectural elements:**

1. **Staleness check at read time** — The leaderboard endpoint (`GET /api/leaderboard/[poolId]`) checks `pool.refreshed_at` before returning. If data is older than 15 minutes, it flags `isRefreshing: true` and triggers a background refresh.

2. **Fire-and-forget refresh trigger** — The background refresh is initiated server-side via an internal fetch to `POST /api/scoring/refresh`. This keeps the `CRON_SECRET` bearer token never exposed to the client:

```ts
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

3. **Shared refresh logic** — `refreshScoresForPool()` in `src/lib/scoring-refresh.ts` is the single function used by both the cron job and the on-demand endpoint. It handles:
   - Fetching from external Slash Golf API
   - Upserting to `tournament_scores` (current state) and `tournament_score_rounds` (per-round archive)
   - Updating `pool.refreshed_at`
   - Broadcasting via Supabase Realtime
   - Writing audit events

4. **Mutex to prevent stampede** — An `isUpdating` flag prevents concurrent refresh attempts for the same pool. If a refresh is already in progress, subsequent triggers receive a 409 and are silently ignored.

5. **Client-side honest display** — `TrustStatusBar` shows "Refreshing scores..." when `isRefreshing: true`, and otherwise displays the actual `refreshed_at` timestamp with no deception about data freshness.

### Key file changes

| File | Change |
|------|--------|
| `src/lib/scoring-refresh.ts` | NEW — shared `refreshScoresForPool()` function |
| `src/app/api/scoring/refresh/route.ts` | NEW — `POST /api/scoring/refresh` endpoint |
| `src/app/api/leaderboard/[poolId]/route.ts` | Added staleness check + fire-and-forget trigger |
| `src/lib/freshness.ts` | Updated threshold from 10m to 15m |
| `src/components/TrustStatusBar.tsx` | Added "Refreshing..." state |
| `src/app/api/scoring/route.ts` | Refactored to call shared `refreshScoresForPool()` |

## Why This Matters

- **User trust** — Users always know whether scores are current or being refreshed. No silent staleness.
- **Decoupled architecture** — Cron jobs and on-demand requests share the same code path, reducing divergence between scheduled and ad-hoc refreshes.
- **Server-to-server auth** — `CRON_SECRET` is never exposed to the browser, preventing token leakage through client code.
- **Resilient UX** — If the background refresh fails, the client shows stale data with an honest timestamp rather than an error banner or false "up to date" state.

## When to Apply

- When a polling-based data source (e.g., external API) backs a user-facing view
- When the data freshness requirements exceed what cron alone can provide
- When you want users to see near-real-time data without hammering the external API on every page load
- When the external API does not support webhooks or push notifications

## Examples

**Leaderboard route staleness check and trigger:**

```ts
// GET /api/leaderboard/[poolId]
const pool = await getPool(poolId)
const freshness = classifyFreshness(pool.refreshed_at)
const isStale = freshness === 'stale' || freshness === 'unknown'

if (isStale && pool.status === 'live') {
  triggerBackgroundRefresh(poolId) // fire-and-forget
}

return NextResponse.json({
  data: {
    ...leaderboardData,
    isRefreshing: isStale && pool.status === 'live',
    refreshedAt: pool.refreshed_at,
    freshness,
  }
})
```

**Shared refresh function signature:**

```ts
// src/lib/scoring-refresh.ts
export interface RefreshResult {
  completedRounds: number
  refreshedAt: string
}

export interface RefreshError {
  code: 'FETCH_FAILED' | 'UPSERT_FAILED' | 'INTERNAL_ERROR'
  message: string
}

export async function refreshScoresForPool(
  supabase: SupabaseClient,
  pool: RefreshablePool
): Promise<{ data: RefreshResult | null; error: RefreshError | null }> {
  // 1. Fetch from external API
  // 2. Upsert tournament_score_rounds (append-only per round)
  // 3. Upsert tournament_scores (latest state)
  // 4. Update pool.refreshed_at
  // 5. Broadcast via Supabase Realtime
  // 6. Write audit event
  // Uses isUpdating mutex to prevent concurrent refreshes
}
```

**TrustStatusBar client behavior:**

```tsx
<TrustStatusBar
  isRefreshing={data.isRefreshing}
  refreshedAt={data.refreshedAt}
  freshness={data.freshness}
  // ...
/>

// Inside TrustStatusBar:
if (isRefreshing) {
  return { label: 'Refreshing', message: 'Refreshing scores... Last updated at {refreshedAt}' }
}
```

## Known Limitations

**In-process mutex (`isUpdating` flag) is not safe for serverless deployments.**

The `isUpdating` flag in both `POST /api/scoring/refresh` and `POST /api/scoring` is a module-level boolean. In Next.js serverless deployments (Vercel, AWS Lambda, etc.), each request may run in a different isolate with its own event loop. This means:
- Concurrent refresh requests for **different pools** could incorrectly block each other
- Two requests arriving simultaneously on different isolates both see `false` and both proceed

**Mitigation:** The upserts are idempotent, so concurrent refreshes produce the same result. The worst case is redundant work, not data corruption. For higher reliability, a distributed lock (Supabase row-level advisory lock, or a dedicated `refresh_locks` table) would be needed.

This is documented as a known limitation rather than a bug fix because concurrent refresh races are rare in practice and the UX impact (redundant work) is acceptable.

## Related

- `docs/solutions/database-issues/tournament-scores-overwriting-per-round-data.md` — related scoring schema issue
- `docs/superpowers/plans/2026-04-08-on-demand-scoring-refresh-plan.md` — implementation plan
- `docs/superpowers/specs/2026-04-08-on-demand-scoring-refresh-design.md` — design spec
