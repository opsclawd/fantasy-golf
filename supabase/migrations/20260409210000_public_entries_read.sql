-- Allow public (unauthenticated) read access to entries so spectator leaderboard works.
-- Authenticated users still need their existing policies for write access.

drop policy if exists "Public can read entries" on public.entries;
create policy "Public can read entries"
on public.entries
for select
to anon, authenticated
using (true);
