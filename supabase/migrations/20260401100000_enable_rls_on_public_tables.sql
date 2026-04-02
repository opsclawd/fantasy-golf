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

drop policy if exists "Pool commissioners can update pools" on public.pools;
create policy "Pool commissioners can update pools"
on public.pools
for update
to authenticated
using (commissioner_id = auth.uid())
with check (commissioner_id = auth.uid());

drop policy if exists "Members can read pool membership" on public.pool_members;
create policy "Members can read pool membership"
on public.pool_members
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.pools p
    where p.id = pool_members.pool_id
      and p.commissioner_id = auth.uid()
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
to anon, authenticated
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
