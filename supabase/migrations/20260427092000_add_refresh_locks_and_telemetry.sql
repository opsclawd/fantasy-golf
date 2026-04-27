create table if not exists public.refresh_locks (
  tournament_id text primary key,
  locked_by text not null,
  locked_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.refresh_locks enable row level security;

create policy "refresh_locks_service_role_all"
  on public.refresh_locks for all to service_role
  using (true) with check (true);

grant select, insert, update, delete on public.refresh_locks to service_role;

alter table public.pools
  add column if not exists last_refresh_success_at timestamptz;

alter table public.pools
  add column if not exists refresh_attempt_count integer default 0;

alter table public.pools
  add column if not exists last_refresh_attempt_at timestamptz;
