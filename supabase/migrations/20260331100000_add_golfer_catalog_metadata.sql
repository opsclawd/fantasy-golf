alter table golfers
  add column if not exists search_name text,
  add column if not exists world_rank integer,
  add column if not exists is_active boolean,
  add column if not exists source text,
  add column if not exists external_player_id text,
  add column if not exists last_synced_at timestamptz;

alter table golfers
  alter column is_active set default true,
  alter column source set default 'legacy';

update golfers
set
  search_name = lower(regexp_replace(trim(name), '\s+', ' ', 'g')),
  is_active = coalesce(is_active, true),
  source = case
    when source is null then 'legacy'
    when source in ('legacy', 'monthly_sync', 'tournament_sync', 'manual_add') then source
    else 'legacy'
  end
where search_name is null
   or is_active is null
   or source is null
   or source not in ('legacy', 'monthly_sync', 'tournament_sync', 'manual_add');

alter table golfers
  alter column is_active set not null,
  alter column source set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'golfers_source_check'
      and conrelid = 'golfers'::regclass
  ) then
    alter table golfers
      add constraint golfers_source_check
      check (source in ('legacy', 'monthly_sync', 'tournament_sync', 'manual_add'));
  end if;
end $$;

create unique index if not exists golfers_external_player_id_key
  on golfers (external_player_id)
  where external_player_id is not null;

create index if not exists golfers_search_name_idx
  on golfers (search_name);

create table if not exists golfer_sync_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null check (run_type in ('monthly_baseline', 'pre_tournament', 'manual_add')),
  requested_by uuid,
  tournament_id text,
  api_calls_used integer not null default 0,
  status text not null check (status in ('success', 'failed', 'blocked')),
  summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists golfer_sync_runs_created_at_idx
  on golfer_sync_runs (created_at desc);
