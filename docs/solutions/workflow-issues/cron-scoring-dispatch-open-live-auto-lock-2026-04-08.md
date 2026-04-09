---
title: Cron scoring dispatch and pool auto-lock workflow
date: 2026-04-08
category: docs/solutions/workflow-issues/
module: scoring
problem_type: workflow_issue
component: background_job
severity: medium
applies_when:
  - When understanding how pools auto-transition from 'open' to 'live' after deadline
  - When modifying the scoring cron schedule or dispatch logic
  - When debugging why a pool didn't auto-lock or why scores aren't refreshing
tags:
  - cron
  - scoring
  - pool-status
  - supabase-pg-cron
  - auto-lock
  - deadline
  - refresh
related_components:
  - api/scoring
  - api/cron/scoring
  - database/pools
  - scoring-refresh
---

# Cron scoring dispatch and pool auto-lock workflow

## Context

The Fantasy Golf Pool app has a single pg_cron job that handles two responsibilities: transitioning pools from `open` to `live` when their deadline passes, and refreshing tournament scores for the active pool. Before a 2026-04-08 refactor, an hourly cron was used; it was replaced with a 4-hour interval to reduce unnecessary load while maintaining acceptable score freshness.

The `/api/scoring` route is the **core scoring orchestration** entry point used by both the cron job and the newer on-demand refresh endpoint (`POST /api/scoring/refresh`). Understanding the two-step sequence in this route is essential for debugging staleness, modifying the refresh cadence, or changing pool status transitions.

## Guidance

### Cron Architecture

**Migration:** `supabase/migrations/20260401130000_update_scoring_dispatcher.sql`

```sql
select cron.unschedule('hourly-scoring-dispatch');

select cron.schedule(
  'four-hour-scoring-dispatch',
  '0 */4 * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/cron/scoring',
      headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 5000
    );
  $$
);
```

The cron job was migrated from hourly (`hourly-scoring-dispatch`, `0 * * * *`) to 4-hour (`0 */4 * * *`). The previous hourly schedule was unscheduled before the new one was registered. The cron hits `/api/cron/scoring`, which is a thin relay that POSTs to `/api/scoring` with the `CRON_SECRET` bearer token.

**Cron relay route** (`src/app/api/cron/scoring/route.ts`):

```ts
// src/app/api/cron/scoring/route.ts
export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const targetUrl = new URL('/api/scoring', appUrl).toString()
  const res = await fetch(targetUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` }
  })
  // ...
}
```

The relay route must have `export const dynamic = 'force-dynamic'` — without it, Next.js statically prerenders the route at build time, causing the self-fetch to fail during build.

### The Two-Step Scoring Route (`POST /api/scoring`)

**File:** `src/app/api/scoring/route.ts`

**Step 1 — Auto-lock open pools past deadline (lines 30–42):**

```ts
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
```

**Step 2 — Refresh scores for the active (live) pool (lines 44–50):**

```ts
const pool = await getActivePool(supabase)
if (!pool) {
  return NextResponse.json({ data: { message: 'No live pool' }, error: null })
}
const result = await refreshScoresForPool(supabase, pool)
```

Only **one** live pool gets its scores refreshed per cron run — the pool returned by `getActivePool()`, which uses `limit(1).maybeSingle()` with no explicit ordering. In practice this returns the most recently created live pool.

### Pool Deadline Detection

**File:** `src/lib/pool-queries.ts` (lines 226–243)

```ts
export async function getOpenPoolsPastDeadline(
  supabase: SupabaseClient,
  now: Date = new Date()
): Promise<Pool[]> {
  const { data } = await supabase
    .from('pools')
    .select('*')
    .eq('status', 'open')

  return ((data as Pool[]) || []).filter((pool) => {
    if (pool.status !== 'open') return false
    const lockAt = getTournamentLockInstant(pool.deadline)
    return lockAt !== null && lockAt.getTime() <= now.getTime()
  })
}
```

`getTournamentLockInstant()` (in `src/lib/picks.ts`) normalizes the deadline to midnight UTC:

```ts
export function getTournamentLockInstant(deadline: string): Date | null {
  const deadlineDate = new Date(deadline)
  if (Number.isNaN(deadlineDate.getTime())) return null
  return new Date(
    deadlineDate.getUTCFullYear(),
    deadlineDate.getUTCMonth(),
    deadlineDate.getUTCDate()
  )
}
```

The timezone-aware version of this lock check (used in participant UI and commissioner actions) accepts `pool.timezone` — see `docs/solutions/logic-errors/pool-deadline-locking-respects-pool-timezone-2026-04-08.md`. The cron uses the UTC midnight variant.

### Status Transition with Optimistic Locking

```ts
// src/lib/pool-queries.ts
export async function updatePoolStatus(
  supabase: SupabaseClient,
  poolId: string,
  status: PoolStatus,
  expectedCurrentStatus?: PoolStatus
): Promise<{ error: string | null }> {
  let query = supabase.from('pools').update({ status }).eq('id', poolId)
  if (expectedCurrentStatus) {
    query = query.eq('status', expectedCurrentStatus)
  }
  const { data, error } = await query.select('id')
  if (error) return { error: error.message }
  if (expectedCurrentStatus && (!data || data.length === 0)) {
    return { error: 'Pool state changed. Please refresh and try again.' }
  }
  return { error: null }
}
```

The `expectedCurrentStatus = 'open'` argument ensures the auto-lock only succeeds if the pool hasn't already transitioned (e.g., by a concurrent cron run or manual commissioner action).

### Shared Refresh Logic

`refreshScoresForPool()` in `src/lib/scoring-refresh.ts` is the single function used by **both** the cron path and the on-demand refresh path (`POST /api/scoring/refresh`). It handles fetch from Slash Golf API, upserts to `tournament_scores` and `tournament_score_rounds`, updates `pool.refreshed_at`, broadcasts via Supabase Realtime, and writes audit events.

## Why This Matters

- **Two responsibilities in one route**: The `/api/scoring` route conflates auto-lock (a pool state transition) with score refresh (a data fetch). A single cron tick can lock multiple pools AND refresh scores for one pool — but only one pool's scores are refreshed per tick.
- **Active pool is implicitly the most recent live pool**: `getActivePool()` has no explicit `ORDER BY`, so it returns whichever live pool the database encounters first. This is typically the most recently created live pool.
- **Idempotent upserts**: Both score tables use `ON CONFLICT` upserts, so concurrent refresh attempts produce the same result without corruption.
- **Audit trail**: Every auto-lock fires an `entryLocked` audit event; every successful refresh fires a `scoreRefreshCompleted` event with diff details.

## When to Apply

- Modifying cron schedule: change `0 */4 * * *` in the migration, then `npx supabase db push`
- Adding a new pool status (e.g., `completed`): must update `getActivePool`, `getOpenPoolsPastDeadline`, and the status enum in `types.ts`
- Changing deadline interpretation: modify `getTournamentLockInstant` — affects all lock logic across the app
- Debugging why a pool didn't auto-lock: verify `pool.status === 'open'`, deadline has passed `lockAt.getTime() <= now.getTime()`, and no concurrent update already changed the status
- Understanding the difference between the cron path (auto-locks ALL overdue pools, refreshes ONE active pool) and the on-demand path (refreshes ONE specific pool by ID, no auto-lock)

## Known Limitations

**In-process mutex is not safe for serverless deployments.** The `isUpdating` boolean in `route.ts` is a module-level variable. In Next.js serverless (Vercel, AWS Lambda), each request may run in a different isolate with its own event loop. Concurrent requests on different isolates both see `false` and proceed concurrently. Mitigation: upserts are idempotent, so concurrent refreshes produce the same result. Worst case is redundant work, not data corruption.

## Session History Notes

The following approaches were tried before the current architecture (session-historian):

- **Self-fetch pattern in cron route**: The original implementation had `GET /api/cron/scoring` make an HTTP request back to the same app's `/api/scoring` endpoint. This was later recognized as an unnecessary network hop and failure mode — the relay route now POSTs directly.
- **Timezone-ignorant lock checks**: Early versions of the participant and commissioner lock checks didn't pass `pool.timezone`, causing midnight boundary issues. Fixed separately in `docs/solutions/logic-errors/pool-deadline-locking-respects-pool-timezone-2026-04-08.md`.
- **Hourly cron**: Found to be too frequent; replaced with 4-hour interval.

## Related

- [`docs/solutions/workflow-issues/on-demand-scoring-refresh-2026-04-08.md`](./on-demand-scoring-refresh-2026-04-08.md) — on-demand refresh pattern that supplements cron for responsiveness; shares `refreshScoresForPool()` with this route
- [`docs/solutions/logic-errors/pool-deadline-locking-respects-pool-timezone-2026-04-08.md`](../logic-errors/pool-deadline-locking-respects-pool-timezone-2026-04-08.md) — timezone-aware locking bug in the deadline check; separate fix from the cron architecture
- [`docs/solutions/database-issues/tournament-scores-overwriting-per-round-data.md`](../database-issues/tournament-scores-overwriting-per-round-data.md) — scoring schema design (tournament_scores + tournament_score_rounds)
- Migration: `supabase/migrations/20260401130000_update_scoring_dispatcher.sql`
