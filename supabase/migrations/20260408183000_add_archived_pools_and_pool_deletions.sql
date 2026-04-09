alter table public.pools drop constraint if exists pools_status_check;

alter table public.pools
  add constraint pools_status_check
  check (status in ('open', 'live', 'complete', 'archived'));

create table if not exists public.pool_deletions (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null unique,
  commissioner_id uuid references auth.users(id) on delete set null,
  deleted_by uuid references auth.users(id) on delete set null,
  status_at_delete text not null
    check (status_at_delete in ('open', 'live', 'complete', 'archived')),
  snapshot jsonb not null default '{}'::jsonb,
  deleted_at timestamptz not null default now()
);

create index if not exists idx_pool_deletions_deleted_at
  on public.pool_deletions (deleted_at);

alter table public.pool_deletions enable row level security;

grant select, insert, update, delete on table public.pool_deletions to service_role;
