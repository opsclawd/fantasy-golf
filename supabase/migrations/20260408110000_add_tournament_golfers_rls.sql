alter table public.tournament_golfers enable row level security;

grant select on table public.tournament_golfers to anon, authenticated;
grant insert, update, delete on table public.tournament_golfers to authenticated;

drop policy if exists "Public tournament golfers are readable" on public.tournament_golfers;
create policy "Public tournament golfers are readable"
on public.tournament_golfers
for select
to anon, authenticated
using (true);

drop policy if exists "Commissioners can manage tournament golfers" on public.tournament_golfers;
create policy "Commissioners can manage tournament golfers"
on public.tournament_golfers
for all
to authenticated
using (
  exists (
    select 1
    from public.pools p
    where p.tournament_id = tournament_golfers.tournament_id
      and p.commissioner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.pools p
    where p.tournament_id = tournament_golfers.tournament_id
      and p.commissioner_id = auth.uid()
  )
);
