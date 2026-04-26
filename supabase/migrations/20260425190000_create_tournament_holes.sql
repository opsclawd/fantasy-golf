CREATE TABLE tournament_holes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  golfer_id TEXT NOT NULL,
  tournament_id TEXT NOT NULL,
  round_id INTEGER NOT NULL CHECK (round_id BETWEEN 1 AND 4),
  hole_id INTEGER NOT NULL CHECK (hole_id BETWEEN 1 AND 18),
  strokes INTEGER NOT NULL,
  par INTEGER NOT NULL,
  score_to_par INTEGER NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(golfer_id, tournament_id, round_id, hole_id)
);

CREATE INDEX idx_tournament_holes_lookup
  ON tournament_holes(tournament_id, golfer_id, round_id);

CREATE INDEX idx_tournament_holes_tournament
  ON tournament_holes(tournament_id, round_id, hole_id);

ALTER TABLE tournament_holes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tournament_holes_service_role_all"
  ON tournament_holes FOR ALL TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON tournament_holes TO service_role;
