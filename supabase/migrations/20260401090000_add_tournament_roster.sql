create table tournament_golfers (
  tournament_id text not null,
  id text not null,
  external_player_id text not null,
  name text not null,
  search_name text not null,
  country text not null default '',
  world_rank integer,
  is_active boolean not null default true,
  source text not null check (source in ('refresh', 'manual_add', 'seeded')),
  last_synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (tournament_id, id)
);

create unique index tournament_golfers_tournament_external_player_id_key
  on tournament_golfers (tournament_id, external_player_id);

create index tournament_golfers_tournament_id_idx
  on tournament_golfers (tournament_id);

create index tournament_golfers_search_name_idx
  on tournament_golfers (tournament_id, search_name);

grant select, insert, update, delete on table public.tournament_golfers to authenticated;
