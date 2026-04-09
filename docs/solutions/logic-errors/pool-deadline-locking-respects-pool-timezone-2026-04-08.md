---
title: Pool deadlines must lock in the pool timezone
date: 2026-04-08
last_updated: 2026-04-08
category: logic-errors
module: pools
problem_type: logic_error
component: service_object
symptoms:
  - Participant "My Pools" showed pools as locked or open at the wrong time near midnight boundaries
  - `pool.timezone` was missing from the member pool query, so `isPoolLocked()` fell back to the server timezone
  - Commissioners could still start or update an open pool after the deadline until cron flipped the row status
root_cause: logic_error
resolution_type: code_fix
severity: high
related_components:
  - participant-pools
  - commissioner-pools
  - cron
tags:
  - pool-locking
  - timezone
  - deadline
  - participant
  - commissioner
  - cron
---

# Pool deadlines must lock in the pool timezone

## Problem

Pool deadlines were stored as absolute timestamps, but the app needed to treat `2026-04-09 00:00:00` in the pool's configured timezone as the actual lock instant. Some code paths evaluated that deadline without the pool timezone, so lock state drifted around midnight boundaries. The participant read path could also lose `timezone` from the joined pool shape, and commissioner actions stayed available until the cron job updated the persisted row.

## Symptoms

- Participant pools could show `locked` too early or too late around deadline boundaries
- The participant pool query returned `deadline` without `timezone`, so lock checks used the server default timezone
- Commissioner actions still depended on `pool.status === 'open'`, which lagged behind the computed lock instant
- The participant page could not safely call `isPoolLocked(..., pool.timezone)` until the joined type included `timezone`

## What Didn't Work

- Calling `isPoolLocked(status, deadline)` without passing `pool.timezone`
- Relying on the persisted `pool.status` column as the only gate for commissioner actions
- Hiding the commissioner start button without also enforcing the lock instant in server actions
- Waiting for cron to flip the row to `live` before treating the pool as locked
- (session history) An early pass focused only on the participant read path and its test fixtures, but the commissioner mutation path also needed the timezone-aware lock check at the server layer

## Solution

Carry the pool timezone through every deadline check and use the same computed lock instant for both display and mutation paths.

```ts
// src/app/(app)/participant/pools/page.tsx
const isLocked = isPoolLocked(pool.status as PoolStatus, pool.deadline, pool.timezone)
```

```ts
// src/lib/entry-queries.ts
select('pool_id, pools(id, name, tournament_name, status, deadline, timezone, picks_per_entry)')
```

That same `timezone` value must be present on the joined pool type before the participant page can call `isPoolLocked()` without falling back to the server timezone.

```ts
// src/lib/entry-queries.ts
type MemberPool = {
  // ...
  timezone: string | null
}
```

Commissioner actions now check the timezone-aware lock state before allowing start or update operations, and the commissioner page hides the start action once the lock instant has passed.

```ts
if (isCommissionerPoolLocked(pool.status, pool.deadline, pool.timezone)) {
  throw new Error('Pool is locked')
}
```

```tsx
// src/app/(app)/commissioner/pools/[poolId]/page.tsx
{pool.status === 'open' && !isLocked ? <StartPoolButton poolId={pool.id} /> : null}
```

## Why This Works

The deadline `2026-04-09 00:00:00` does not mean the same moment in every timezone. Resolving that local midnight against the pool's configured timezone makes the lock instant deterministic and independent of the server's timezone.

Using the same helper for participant display and commissioner mutations also removes the gap between "computed lock" and "cron eventually updated the row." The UI and the server now agree on when the pool is locked, even if the `status` column has not caught up yet.

## Prevention

- Always select `timezone` alongside any deadline field that feeds lock logic
- Keep the joined type in sync with the query shape so the participant page can pass `pool.timezone` into the lock helper
- Reuse one shared lock helper for participant views, commissioner actions, and background jobs
- Add regression tests that cover midnight boundaries in non-UTC pool timezones
- Add server-side tests for commissioner start/update actions so UI gating cannot drift from mutation enforcement
- Treat cron-updated status as lagging state when a computed lock instant already exists

## Related Issues

- [`docs/solutions/workflow-issues/on-demand-scoring-refresh-2026-04-08.md`](../workflow-issues/on-demand-scoring-refresh-2026-04-08.md) - related because it also deals with cron lag and user-visible freshness, but the root cause and fix are different
- No related GitHub issues were found in a `gh issue list` search for `pool timezone lock deadline`
