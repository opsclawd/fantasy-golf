-- Pools table
CREATE TABLE pools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  tournament_id TEXT NOT NULL,
  tournament_name TEXT NOT NULL,
  deadline TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'live', 'complete')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Entries table
CREATE TABLE entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  golfer_ids TEXT[] NOT NULL DEFAULT '{}',
  total_birdies INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pool_id, user_id)
);

-- Golfers table
CREATE TABLE golfers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT
);

-- Tournament scores table
CREATE TABLE tournament_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  golfer_id TEXT REFERENCES golfers(id),
  tournament_id TEXT NOT NULL,
  hole_1 INTEGER,
  hole_2 INTEGER,
  hole_3 INTEGER,
  hole_4 INTEGER,
  hole_5 INTEGER,
  hole_6 INTEGER,
  hole_7 INTEGER,
  hole_8 INTEGER,
  hole_9 INTEGER,
  hole_10 INTEGER,
  hole_11 INTEGER,
  hole_12 INTEGER,
  hole_13 INTEGER,
  hole_14 INTEGER,
  hole_15 INTEGER,
  hole_16 INTEGER,
  hole_17 INTEGER,
  hole_18 INTEGER,
  total_birdies INTEGER DEFAULT 0,
  UNIQUE(golfer_id, tournament_id)
);

-- Index for faster lookups
CREATE INDEX idx_entries_pool_id ON entries(pool_id);
CREATE INDEX idx_entries_user_id ON entries(user_id);
CREATE INDEX idx_tournament_scores_tournament ON tournament_scores(tournament_id);
