-- Pools table
CREATE TABLE pools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  commissioner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  tournament_id TEXT NOT NULL,
  tournament_name TEXT NOT NULL,
  year INTEGER NOT NULL CHECK (year >= 2000 AND year <= 2100),
  deadline TIMESTAMPTZ NOT NULL,
  format TEXT DEFAULT 'best_ball' CHECK (format IN ('best_ball')),
  picks_per_entry INTEGER DEFAULT 4 CHECK (picks_per_entry >= 1 AND picks_per_entry <= 10),
  invite_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'live', 'complete')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pool members table
CREATE TABLE pool_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'player' CHECK (role IN ('commissioner', 'player')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pool_id, user_id)
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

-- Audit events table
CREATE TABLE audit_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for foreign keys and performance
CREATE INDEX idx_pools_commissioner_id ON pools(commissioner_id);
CREATE INDEX idx_pools_invite_code ON pools(invite_code);
CREATE INDEX idx_pool_members_pool_id ON pool_members(pool_id);
CREATE INDEX idx_pool_members_user_id ON pool_members(user_id);
CREATE INDEX idx_entries_pool_id ON entries(pool_id);
CREATE INDEX idx_entries_user_id ON entries(user_id);
CREATE INDEX idx_tournament_scores_tournament ON tournament_scores(tournament_id);
CREATE INDEX idx_audit_events_pool_id ON audit_events(pool_id);
CREATE INDEX idx_audit_events_user_id ON audit_events(user_id);

-- Epic 3: Add refresh metadata to pools
ALTER TABLE pools ADD COLUMN refreshed_at TIMESTAMPTZ;
ALTER TABLE pools ADD COLUMN last_refresh_error TEXT;

-- Epic 3: Add golfer status to tournament_scores
ALTER TABLE tournament_scores ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'cut'));
