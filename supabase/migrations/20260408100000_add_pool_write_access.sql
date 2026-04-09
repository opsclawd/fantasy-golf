grant insert, update on table public.pools to authenticated;

drop policy if exists "Pool commissioners can create pools" on public.pools;
create policy "Pool commissioners can create pools"
on public.pools
for insert
to authenticated
with check (commissioner_id = auth.uid());

drop policy if exists "Pool commissioners can update pools" on public.pools;
create policy "Pool commissioners can update pools"
on public.pools
for update
to authenticated
using (commissioner_id = auth.uid())
with check (commissioner_id = auth.uid());
