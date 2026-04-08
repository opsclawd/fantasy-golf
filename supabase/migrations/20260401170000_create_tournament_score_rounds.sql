-- Immutable per-round archive: one row per (golfer, tournament, round)
-- Stores full round data from the Slash Golf API rounds array
CREATE TABLE tournament_score_rounds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  golfer_id TEXT NOT NULL,
  tournament_id TEXT NOT NULL,
  round_id INTEGER NOT NULL,
  strokes INTEGER,
  score_to_par INTEGER,
  course_id TEXT,
  course_name TEXT,
  round_status TEXT,
  position TEXT,
  total_score INTEGER,
  total_strokes_from_completed_rounds INTEGER,
  current_hole INTEGER,
  thru INTEGER,
  starting_hole INTEGER,
  current_round INTEGER,
  current_round_score INTEGER,
  tee_time TEXT,
  tee_time_timestamp TIMESTAMPTZ,
  is_amateur BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'cut')),
  total_birdies INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(golfer_id, tournament_id, round_id)
);

CREATE INDEX idx_tournament_score_rounds_tournament ON tournament_score_rounds(tournament_id);
CREATE INDEX idx_tournament_score_rounds_golfer ON tournament_score_rounds(golfer_id);

-- Keep tournament_scores as current-state only (most recent round data)
ALTER TABLE public.tournament_scores
  DROP COLUMN IF EXISTS round_score,
  DROP COLUMN IF EXISTS round_status,
  DROP COLUMN IF EXISTS current_hole,
  DROP COLUMN IF EXISTS tee_time;
