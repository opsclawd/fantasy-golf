alter table public.tournament_scores
  add column if not exists round_id integer,
  add column if not exists round_score integer,
  add column if not exists total_score integer,
  add column if not exists position text,
  add column if not exists round_status text,
  add column if not exists current_hole integer,
  add column if not exists tee_time text,
  add column if not exists updated_at timestamptz;
