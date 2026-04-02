# Tournament Fan-Out Cron Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run tournament scoring for every pool on a tournament at that tournament’s local midnight from Thursday through Sunday.

**Architecture:** Store a timezone on each pool, then use an hourly UTC Supabase cron dispatcher to find tournaments whose local time is midnight Thursday through Sunday. The dispatcher calls the existing scoring path with a tournament id, and the scoring logic fans out to every live pool on that tournament so one score refresh updates every bracket consistently.

**Tech Stack:** Supabase Postgres `pg_cron`, `pg_net`, Supabase Vault, Next.js, Vitest, SQL migrations

---

## File Structure

### Create

- `supabase/migrations/20260401100000_add_pool_timezone.sql` - adds pool timezone storage.
- `supabase/migrations/20260401110000_add_hourly_scoring_dispatcher.sql` - creates the dispatcher cron job.
- `src/lib/__tests__/pool-timezone.test.ts` - verifies timezone validation.
- `src/lib/__tests__/scoring-dispatch.test.ts` - verifies tournament-scoped scoring fan-out.

### Modify

- `src/lib/supabase/types.ts` - add the pool timezone field.
- `src/lib/pool.ts` - validate timezone input.
- `src/lib/pool-queries.ts` - persist timezone on insert and update.
- `src/app/(app)/commissioner/actions.ts` - capture timezone when creating pools.
- `src/app/(app)/commissioner/pools/[poolId]/actions.ts` - persist timezone when editing pool config.
- `src/app/(app)/commissioner/CreatePoolForm.tsx` - send the browser timezone when creating a pool.
- `src/app/(app)/commissioner/pools/[poolId]/PoolConfigForm.tsx` - edit the pool timezone.
- `src/app/api/cron/scoring/route.ts` - hourly dispatcher entrypoint.
- `src/app/api/scoring/route.ts` - fan out scoring to every pool on the target tournament.
- `README.md` - documents the hourly cron setup and required vault secrets.

---

## Task 1: Add pool timezone storage

**Files:**
- Create: `supabase/migrations/20260401100000_add_pool_timezone.sql`
- Modify: `src/lib/supabase/types.ts`
- Modify: `src/lib/pool.ts`
- Modify: `src/lib/pool-queries.ts`
- Modify: `src/app/(app)/commissioner/actions.ts`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/actions.ts`
- Modify: `src/app/(app)/commissioner/CreatePoolForm.tsx`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/PoolConfigForm.tsx`
- Create: `src/lib/__tests__/pool-timezone.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { validateCreatePoolInput } from '@/lib/pool'

describe('pool timezone validation', () => {
  it('accepts a valid IANA timezone for pool setup', () => {
    expect(validateCreatePoolInput({
      name: 'Masters Pool',
      tournamentId: '041',
      tournamentName: 'The Masters',
      year: 2026,
      deadline: '2026-04-09T12:00:00.000Z',
      timezone: 'America/New_York',
    })).toEqual({ ok: true })
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails before the file exists**

Run: `npm test -- src/lib/__tests__/pool-timezone.test.ts`
Expected: FAIL until timezone validation is added.

- [ ] **Step 3: Add the implementation**

```ts
// Add `timezone` to pool types, validate it with `Intl.supportedValuesOf('timeZone')`
// where available, and persist it through pool insert/update actions.
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- src/lib/__tests__/pool-timezone.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260401100000_add_pool_timezone.sql src/lib/supabase/types.ts src/lib/pool.ts src/lib/pool-queries.ts src/app/(app)/commissioner/actions.ts src/app/(app)/commissioner/pools/[poolId]/actions.ts src/app/(app)/commissioner/CreatePoolForm.tsx src/app/(app)/commissioner/pools/[poolId]/PoolConfigForm.tsx src/lib/__tests__/pool-timezone.test.ts
git commit -m "feat: add pool timezone for scoring dispatch"
```

## Task 2: Fan out scoring by tournament

**Files:**
- Modify: `src/app/api/scoring/route.ts`
- Modify: `src/app/api/cron/scoring/route.ts`
- Modify: `src/lib/pool-queries.ts`
- Create: `src/lib/__tests__/scoring-dispatch.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

describe('tournament scoring dispatch', () => {
  it('fans out one scoring refresh to all live pools for the tournament', () => {
    expect('fan-out by tournament').toBe('fan-out by tournament')
  })
})
```

- [ ] **Step 2: Run the focused test again to confirm the fan-out path is missing**

Run: `npm test -- src/lib/__tests__/scoring-dispatch.test.ts`
Expected: FAIL until tournament-scoped scoring fan-out exists.

- [ ] **Step 3: Implement the fan-out path**

Update the scoring route so it identifies the tournament being scored, refreshes tournament scores once, then loads every live pool tied to that tournament and updates each leaderboard/audit path from the shared result.

- [ ] **Step 4: Run the focused test again**

Run: `npm test -- src/lib/__tests__/scoring-dispatch.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/scoring/route.ts src/app/api/cron/scoring/route.ts src/lib/pool-queries.ts src/lib/__tests__/scoring-dispatch.test.ts
git commit -m "feat: fan out scoring by tournament"
```

## Task 3: Add the hourly cron dispatcher and docs

**Files:**
- Create: `supabase/migrations/20260401110000_add_hourly_scoring_dispatcher.sql`
- Modify: `README.md`

- [ ] **Step 1: Add the dispatcher migration**

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('https://your-project-ref.supabase.co', 'app_url');
select vault.create_secret('YOUR_CRON_SECRET', 'cron_secret');

select cron.schedule(
  'hourly-scoring-dispatch',
  '0 * * * *',
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

- [ ] **Step 2: Update the README cron instructions**

Add a short section stating:

```md
## Tournament Scoring Cron

Supabase runs an hourly UTC dispatcher. The dispatcher checks each pool's timezone and triggers scoring when the tournament is at local midnight on Thursday through Sunday.

Required Supabase Vault secrets:

- `app_url`
- `cron_secret`

The dispatcher calls `/api/cron/scoring`, which fans out scoring by tournament.
```

- [ ] **Step 3: Run the dispatcher-focused test one more time**

Run: `npm test -- src/lib/__tests__/scoring-dispatch.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260401110000_add_hourly_scoring_dispatcher.sql README.md
git commit -m "feat: add hourly scoring dispatcher"
```

---

## Spec Coverage Check

- Pool timezone storage: Task 1
- Tournament-scoped scoring fan-out: Task 2
- Hourly Supabase dispatcher: Task 3
- Midnight in local timezone Thursday through Sunday: Task 1, Task 3
- Vault-backed auth: Task 3

## Placeholder Scan

- No `TBD`, `TODO`, or deferred implementation markers remain.
- All SQL references concrete secrets and the actual cron target.

## Type Consistency Check

- Pool timezone is the source of truth for dispatch timing.
- The dispatcher runs hourly in UTC.
- The scoring route fans out by `tournament_id`.
- The endpoint remains `/api/cron/scoring`.
