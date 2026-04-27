---
name: OPS-51 Reconcile Supabase Schema, Migrations, and Generated Types
description: Establish a single source of truth for the database schema by reconciling schema.sql, applied migrations, and TypeScript types
module: infrastructure
tags: [database, supabase, schema, types, migrations]
git_refs: []
problem_type: cleanup
date: 2026-04-26
---

# OPS-51: Reconcile Supabase Schema, Migrations, and Generated Types

## Problem

The persistence model exists in three places that are not fully synchronized:

1. **`src/lib/db/schema.sql`** — The legacy reference schema (outdated)
2. **`supabase/migrations/`** — The actual applied migrations (source of truth)
3. **`src/lib/supabase/types.ts`** — TypeScript type definitions

This drift creates risk during handoff. New developers reading `schema.sql` will get a wrong picture of the data model. TypeScript types may not match runtime reality.

## Scope

Reconcile the canonical data model for:
- `pools`
- `pool_members`
- `entries`
- `golfers`
- `tournament_scores`
- `tournament_score_rounds`
- `audit_events`
- `pool_deletions`
- `golfer_sync_runs`

Work includes:
- Auditing `schema.sql` against applied migrations to identify all discrepancies
- Updating `schema.sql` to reflect the actual runtime schema
- Verifying `types.ts` aligns with the canonical schema
- Documenting source data vs derived values
- Clarifying hole-level scoring storage strategy

## What Exists Today

### Migrations (Source of Truth, Chronological)

| Migration | Creates/Modifies |
|-----------|-----------------|
| `20260331100000` | Extends `golfers` with metadata cols; creates `golfer_sync_runs` |
| `20260401090000` | Creates `tournament_roster` table |
| `20260401100000` | Adds `timezone` to `pools` |
| `20260401101000` | Enables RLS on public tables |
| `20260401110000` | Adds hourly scoring dispatcher cron |
| `20260401120000` | Drops legacy golfers table |
| `20260401130000` | Updates scoring dispatcher |
| `20260401140000` | Grants service role access |
| `20260401150000` | Adds round snapshot columns |
| `20260401160000` | Drops `hole_1`–`hole_18` from `tournament_scores` |
| `20260401170000` | Creates `tournament_score_rounds` |
| `20260408100000` | Adds pool write access |
| `20260408110000` | Adds tournament golfers RLS |
| `20260408183000` | Adds `archived` to pool status; creates `pool_deletions` |
| `20260409210000` | Public entries read access |
| `20260410103000` | Grants service role tournament_score_rounds access |

### Current schema.sql (Stale)

`schema.sql` has not been updated since early development. It shows:
- `golfers` table with only `id`, `name`, `country`
- `tournament_scores` with `hole_1`–`hole_18` columns (removed)
- `pools` without `timezone`
- `pools.status` CHECK without `'archived'`
- No `pool_deletions` table
- No `golfer_sync_runs` table
- No `tournament_score_rounds` table

### Current types.ts (Mostly Correct)

`types.ts` aligns with the actual schema except for one field name discrepancy:
- `PoolDeletion.status_at_delete` in types.ts matches `pool_deletions.status_at_delete` in migration (correct)

## Canonical Schema (Target State)

### pools
```sql
CREATE TABLE pools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  commissioner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  tournament_id TEXT NOT NULL,
  tournament_name TEXT NOT NULL,
  year INTEGER NOT NULL CHECK (year >= 2000 AND year <= 2100),
  deadline TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  format TEXT DEFAULT 'best_ball' CHECK (format IN ('best_ball')),
  picks_per_entry INTEGER DEFAULT 4 CHECK (picks_per_entry >= 1 AND picks_per_entry <= 10),
  invite_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'live', 'complete', 'archived')),
  refreshed_at TIMESTAMPTZ,
  last_refresh_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### pool_members
```sql
CREATE TABLE pool_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'player' CHECK (role IN ('commissioner', 'player')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pool_id, user_id)
);
```

### entries
```sql
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
```

### golfers
```sql
CREATE TABLE golfers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT,
  search_name TEXT,
  world_rank INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  source TEXT NOT NULL DEFAULT 'legacy' CHECK (source IN ('legacy', 'monthly_sync', 'tournament_sync', 'manual_add')),
  external_player_id TEXT UNIQUE,
  last_synced_at TIMESTAMPTZ
);
```

### tournament_scores (current-state only)
```sql
CREATE TABLE tournament_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  golfer_id TEXT REFERENCES golfers(id),
  tournament_id TEXT NOT NULL,
  round_id INTEGER,
  total_score INTEGER,
  position TEXT,
  total_birdies INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'cut')),
  updated_at TIMESTAMPTZ,
  UNIQUE(golfer_id, tournament_id)
);
```

### tournament_score_rounds (per-round archive)
```sql
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
```

### pool_deletions
```sql
CREATE TABLE pool_deletions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pool_id UUID NOT NULL UNIQUE,
  commissioner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status_at_delete TEXT NOT NULL CHECK (status_at_delete IN ('open', 'live', 'complete', 'archived')),
  snapshot JSONB NOT NULL DEFAULT '{}',
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### golfer_sync_runs
```sql
CREATE TABLE golfer_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL CHECK (run_type IN ('monthly_baseline', 'pre_tournament', 'manual_add')),
  requested_by UUID,
  tournament_id TEXT,
  api_calls_used INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'blocked')),
  summary JSONB NOT NULL DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### audit_events
```sql
CREATE TABLE audit_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### tournament_roster (referenced in migrations)
```sql
-- From 20260401090000_add_tournament_roster.sql
CREATE TABLE tournament_roster (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id TEXT NOT NULL,
  golfer_id TEXT NOT NULL REFERENCES golfers(id),
  -- ... additional fields per migration
);
```

## Discrepancies Found

| Item | schema.sql | Actual (Migrations) | types.ts |
|------|-----------|---------------------|----------|
| `pools.timezone` | Missing | Added `20260401100000` | `Pool.timezone: string` ✅ |
| `pools.status` CHECK | `'open', 'live', 'complete'` | + `'archived'` in `20260408183000` | `PoolStatus = 'open' \| 'live' \| 'complete' \| 'archived'` ✅ |
| `golfers` columns | `id, name, country` only | Extended in `20260331100000` | `Golfer` interface has all fields ✅ |
| `tournament_scores.hole_1-18` | Present | Dropped in `20260401160000` | `TournamentScore` has no hole cols ✅ |
| `tournament_score_rounds` | Missing | Created `20260401170000` | `TournamentScoreRound` interface ✅ |
| `pool_deletions` | Missing | Created `20260408183000` | `PoolDeletion` interface ✅ |
| `golfer_sync_runs` | Missing | Created `20260331100000` | `GolferSyncRun` interface ✅ |

## Source Data vs Derived Values

### Source Data (from external APIs)

| Table | Source | Fields |
|-------|--------|--------|
| `golfers` | Slash Golf API (via sync) | `name`, `country`, `world_rank`, `external_player_id`, `is_active`, `source`, `last_synced_at` |
| `tournament_scores` | Slash Golf `/leaderboard` | `round_id`, `total_score`, `position`, `status`, `updated_at` |
| `tournament_score_rounds` | Slash Golf `/leaderboard.rounds[]` | `round_id`, `strokes`, `score_to_par`, `course_id`, `course_name`, `round_status`, `position`, `total_score`, `total_strokes_from_completed_rounds`, `current_hole`, `thru`, `starting_hole`, `current_round`, `current_round_score`, `tee_time`, `tee_time_timestamp`, `is_amateur`, `status`, `total_birdies` |

### Derived Values (computed in application code)

| Table | Field | Computation |
|-------|-------|-------------|
| `entries` | `total_birdies` | Sum of birdies from best-ball scoring algorithm |
| `pools` | `refreshed_at` | Set by scoring refresh cron |
| `pools` | `last_refresh_error` | Set by scoring refresh cron on failure |

### Note on Birdies

`total_birdies` in both `tournament_scores` and `tournament_score_rounds` is currently always 0. The Slash Golf API does not provide birdie counts. Birdies are computed at display time via the scoring algorithm.

## Hole-Level Scoring Storage Strategy

The current schema stores round-level data in `tournament_score_rounds`, but **does not** store hole-level data. The `tournament_holes` table described in the hole-by-hole design spec (OPS-50) has not been created.

**Current state:**
- `tournament_score_rounds` stores per-round aggregates: `strokes`, `score_to_par`
- No per-hole breakdown exists in the database

**Hole-level storage (if needed per OPS-50):**

```sql
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
```

This table is **not currently in the schema** — it is pending OPS-50 implementation. The hole-level scoring strategy is deferred until OPS-50 is prioritized.

## Migration Cleanup

The `supabase/migrations/` directory should be the authoritative record of schema evolution. No migrations should be deleted or reordered. New developers should understand that:

1. Apply all migrations in filename order to reach current schema
2. `schema.sql` is for documentation only and may lag migrations
3. `types.ts` should be manually kept in sync with migrations

## Implementation Tasks

1. **Update `src/lib/db/schema.sql`** to match canonical schema above
   - Replace entire file content with canonical schema
   - Remove stale comments and legacy definitions

2. **Audit `src/lib/supabase/types.ts`**
   - Verify all types match canonical schema columns exactly
   - Add JSDoc comments linking types to tables
   - Confirm `PoolDeletion.status_at_delete` is spelled correctly (it is)

3. **Create `docs/superpowers/specs/YYYY-MM-DD-ops-51-data-model.md`**
   - Document the source/derived distinction
   - Document hole-level scoring status (not implemented)
   - Include entity-relationship summary for new developers

4. **Verify no other type files exist**
   - Check for any other TypeScript files defining database types
   - Consolidate to `types.ts` as single source

## Out of Scope

- Provider migration changes
- UI work
- Non-MVP feature expansion
- Actually implementing `tournament_holes` (OPS-50)

## Acceptance Criteria

1. `schema.sql` matches the canonical schema exactly (verified by comparing to migration output)
2. `types.ts` `PoolDeletion.status_at_delete` field name matches actual table column
3. `types.ts` `Golfer` interface fields match `golfers` table columns exactly
4. A new developer can read `schema.sql` and understand the actual runtime data model
5. `docs/superpowers/specs/YYYY-MM-DD-ops-51-data-model.md` explains source vs derived values clearly
6. Hole-level scoring storage has a clear documented status (not implemented, pending OPS-50)

## Alternative Approaches

### A) Auto-generate types from Supabase CLI
Supabase CLI can generate TypeScript types from the database schema via `supabase gen types typescript`.

**Problem:** This would overwrite the carefully crafted type names and comments. The current `types.ts` was written to be developer-friendly, not auto-generated. Auto-generation is appropriate for greenfield projects, not this codebase.

### B) Keep schema.sql as-is, document the discrepancy
**Problem:** The drift would remain. New developers would still get wrong information. This delays the problem rather than solving it.

### C) Delete schema.sql entirely, use Supabase dashboard as documentation
**Problem:** Supabase dashboard requires login. Schema.sql provides offline reference. Keep it accurate.

**Recommended:** Option A with manual oversight — update `schema.sql` to match migrations exactly, keep `types.ts` as the canonical TypeScript interface source (with manual sync discipline).