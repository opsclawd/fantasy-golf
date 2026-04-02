# Supabase RLS Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable row-level security on the exposed Supabase tables without breaking the app's public reads or cron-driven scoring writes.

**Architecture:** Keep user-facing tables readable to anon/authenticated clients where the app already depends on public reads, but add explicit RLS policies so access is intentional instead of implicit. For cron-only writes, introduce a small server-side Supabase admin client that uses the service role key, so the scoring route can bypass RLS safely while the browser and normal server client remain constrained.

**Tech Stack:** Supabase SQL migrations, Next.js server routes, `@supabase/ssr`, Vitest

---

### Task 1: Add the RLS migration

**Files:**
- Create: `supabase/migrations/20260401100000_enable_rls_on_public_tables.sql`

- [ ] **Step 1: Write the migration**

```sql
alter table public.golfers enable row level security;
alter table public.pools enable row level security;
alter table public.pool_members enable row level security;
alter table public.entries enable row level security;
alter table public.audit_events enable row level security;
alter table public.tournament_scores enable row level security;
alter table public.golfer_sync_runs enable row level security;

grant select on table public.golfers to anon, authenticated;
grant select on table public.pools to anon, authenticated;
grant select on table public.pool_members to authenticated;
grant select, insert, update, delete on table public.entries to authenticated;
grant select, insert on table public.audit_events to authenticated;
grant select, insert, update, delete on table public.tournament_scores to authenticated;
grant select, insert, update, delete on table public.golfer_sync_runs to authenticated;

drop policy if exists "Public golfers are readable" on public.golfers;
create policy "Public golfers are readable"
on public.golfers
for select
to anon, authenticated
using (true);

drop policy if exists "Public pools are readable" on public.pools;
create policy "Public pools are readable"
on public.pools
for select
to anon, authenticated
using (true);

drop policy if exists "Members can read pool membership" on public.pool_members;
create policy "Members can read pool membership"
on public.pool_members
for select
to authenticated
using (
  exists (
    select 1
    from public.pool_members pm
    where pm.pool_id = pool_members.pool_id
      and pm.user_id = auth.uid()
  )
);

drop policy if exists "Members can join pools" on public.pool_members;
create policy "Members can join pools"
on public.pool_members
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Pool commissioners can manage pool membership" on public.pool_members;
create policy "Pool commissioners can manage pool membership"
on public.pool_members
for all
to authenticated
using (
  exists (
    select 1
    from public.pools p
    where p.id = pool_members.pool_id
      and p.commissioner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.pools p
    where p.id = pool_members.pool_id
      and p.commissioner_id = auth.uid()
  )
);

drop policy if exists "Members can read their entries" on public.entries;
create policy "Members can read their entries"
on public.entries
for select
to authenticated
using (
  exists (
    select 1
    from public.pool_members pm
    where pm.pool_id = entries.pool_id
      and pm.user_id = auth.uid()
  )
);

drop policy if exists "Members can manage their entries" on public.entries;
create policy "Members can manage their entries"
on public.entries
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.pool_members pm
    where pm.pool_id = entries.pool_id
      and pm.user_id = auth.uid()
  )
);

drop policy if exists "Members can update their entries" on public.entries;
create policy "Members can update their entries"
on public.entries
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.pool_members pm
    where pm.pool_id = entries.pool_id
      and pm.user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.pool_members pm
    where pm.pool_id = entries.pool_id
      and pm.user_id = auth.uid()
  )
);

drop policy if exists "Members can read audit events" on public.audit_events;
create policy "Members can read audit events"
on public.audit_events
for select
to authenticated
using (
  exists (
    select 1
    from public.pool_members pm
    where pm.pool_id = audit_events.pool_id
      and pm.user_id = auth.uid()
  )
);

drop policy if exists "Authenticated users can write audit events" on public.audit_events;
create policy "Authenticated users can write audit events"
on public.audit_events
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can read tournament scores" on public.tournament_scores;
create policy "Authenticated users can read tournament scores"
on public.tournament_scores
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can write tournament scores" on public.tournament_scores;
create policy "Authenticated users can write tournament scores"
on public.tournament_scores
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update tournament scores" on public.tournament_scores;
create policy "Authenticated users can update tournament scores"
on public.tournament_scores
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can read sync runs" on public.golfer_sync_runs;
create policy "Authenticated users can read sync runs"
on public.golfer_sync_runs
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can write sync runs" on public.golfer_sync_runs;
create policy "Authenticated users can write sync runs"
on public.golfer_sync_runs
for insert
to authenticated
with check (true);
```

- [ ] **Step 2: Verify the migration is present**

Run: `git diff -- supabase/migrations/20260401100000_enable_rls_on_public_tables.sql`
Expected: new SQL migration with grants and policies for all seven tables.

### Task 2: Add a service-role Supabase client for cron writes

**Files:**
- Create: `src/lib/supabase/admin.ts`
- Modify: `src/app/api/scoring/route.ts`

- [ ] **Step 1: Write the admin client helper**

```ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
```

- [ ] **Step 2: Switch the scoring route to the admin client**

Replace the current client creation in `src/app/api/scoring/route.ts`:

```ts
import { createAdminClient } from '@/lib/supabase/admin'
```

and:

```ts
const supabase = createAdminClient()
```

Keep the cron secret check unchanged.

- [ ] **Step 3: Verify scoring still uses the same data flow**

Run: `npm test -- src/app/api/scoring/route.test.ts`
Expected: PASS with the mocked Supabase client behavior unchanged.

### Task 3: Verify the RLS surface end to end

**Files:**
- No code changes expected unless a failing test exposes a policy mismatch.

- [ ] **Step 1: Run targeted app tests that depend on the affected tables**

Run:
`npm test -- src/app/api/leaderboard/[poolId]/route.ts src/app/(app)/participant/picks/[poolId]/actions.ts src/app/join/[inviteCode]/actions.ts src/app/api/scoring/route.ts`

Expected: PASS.

- [ ] **Step 2: Sanity-check the migration file in git diff**

Run: `git diff -- supabase/migrations/20260401100000_enable_rls_on_public_tables.sql src/lib/supabase/admin.ts src/app/api/scoring/route.ts`
Expected: only the RLS migration, the new admin helper, and the scoring route client swap.

- [ ] **Step 3: Commit the changes**

```bash
git add supabase/migrations/20260401100000_enable_rls_on_public_tables.sql src/lib/supabase/admin.ts src/app/api/scoring/route.ts
git commit -m "fix: enable RLS on public supabase tables"
```
