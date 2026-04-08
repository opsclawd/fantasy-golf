---
title: "Tournament scores overwriting per-round data due to schema design flaw"
date: "2026-04-08"
category: database-issues
module: scoring
problem_type: database_issue
component: database
symptoms:
  - round_id always showed latest round, not historical rounds
  - round_score overwritten each API refresh — only current round's score-to-par remained
  - Per-round details like course, strokes per round, and score-to-par were not persisted
  - No way to reconstruct how a golfer's score evolved over the tournament
root_cause: logic_error
resolution_type: migration
severity: high
tags:
  - supabase
  - postgresql
  - schema-design
  - scoring
---

# Tournament scores overwriting per-round data due to schema design flaw

## Problem

The `tournament_scores` table was designed to store one row per golfer per tournament, with `round_id` indicating the current round. However, the Slash Golf API sends **per-round snapshot data** for each golfer as the tournament progresses (e.g., round 1 data, then round 2 data with updated totals).

The original design **overwrote** `round_id`, `round_score`, `total_score`, etc. with each API refresh, losing historical round-by-round data.

## Symptoms

- `round_id` in `tournament_scores` always showed the **latest** round, not historical rounds
- `round_score` overwritten each refresh — only current round's score-to-par remained
- Per-round details like course, strokes per round, and score-to-par were not persisted
- No way to reconstruct how a golfer's score evolved over the tournament

## What Didn't Work

**Keeping all data in `tournament_scores` with round_id as a column:** The unique constraint was `(golfer_id, tournament_id)`, so each golfer had only one row. Adding `round_id` to the same table meant overwriting — same problem.

**Only storing current state:** We tried keeping only the latest snapshot, but the API sends complete per-round data in the `rounds` array that we were discarding.

## Solution

Split into two tables:

1. **`tournament_scores`** — current-state only (latest round's data for leaderboard queries)
2. **`tournament_score_rounds`** — append-only archive (one row per golfer per round)

### Schema Changes

**`tournament_score_rounds`** (new, append-only):
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
  status TEXT DEFAULT 'active',
  total_birdies INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(golfer_id, tournament_id, round_id)
);
```

**`tournament_scores`** (current-state only, modified):
- Dropped: `round_score`, `round_status`, `current_hole`, `tee_time`
- Kept: `round_id` (current/latest round), `total_score`, `position`, `total_birdies`, `status`

### API Parsing

The Slash Golf API returns a `rounds` array with per-round data:

```typescript
interface GolferScoreRound {
  round_id: number
  strokes: number | null
  score_to_par: number | null
  course_id: string | null
  course_name: string | null
}
```

The client now parses the full `rounds` array and writes each round individually.

### Dual Write in scoring-queries.ts

```typescript
export async function upsertTournamentScore(
  supabase: SupabaseClient,
  score: Omit<TournamentScore, 'status'> & { status?: string },
  golferScore: GolferScore
): Promise<{ error: string | null }> {
  // Write each round from the rounds array to the archive
  if (golferScore.rounds && golferScore.rounds.length > 0) {
    const roundRecords = golferScore.rounds.map((r): Omit<TournamentScoreRound, 'id'> => ({
      golfer_id: golferScore.golfer_id,
      tournament_id: score.tournament_id,
      round_id: r.round_id,
      strokes: r.strokes ?? null,
      score_to_par: r.score_to_par ?? null,
      course_id: r.course_id ?? null,
      course_name: r.course_name ?? null,
      // ... other fields
    }))

    for (const roundRecord of roundRecords) {
      await supabase
        .from('tournament_score_rounds')
        .upsert(roundRecord, { onConflict: 'golfer_id,tournament_id,round_id' })
    }
  }

  // Write current state to tournament_scores
  await supabase
    .from('tournament_scores')
    .upsert({ ... }, { onConflict: 'golfer_id,tournament_id' })
}
```

## Why This Works

1. **Append-only archive** — `tournament_score_rounds` uses `upsert` with `onConflict: 'golfer_id,tournament_id,round_id'`, so each round is inserted once and never modified
2. **Current state for leaderboards** — `tournament_scores` stays lean with only what's needed for ranking queries
3. **Full round data preserved** — `strokes`, `score_to_par`, `course_id`, `course_name` stored per round for future analysis
4. **API-aligned** — Schema now matches what the Slash Golf API actually provides

## Prevention

1. **Design for immutability** — When an external API provides time-series or snapshot data, preserve it in an archive table before normalizing into current-state tables
2. **Use composite keys for append-only tables** — `(golfer_id, tournament_id, round_id)` ensures no duplicate round entries
3. **Audit before overwriting** — Before modifying a scoring or state table, ask: "does this data need to be preserved for history?"
4. **Parse the full API response** — The `rounds` array existed in the API; we were discarding it because our schema didn't support it. Always map API responses to storage, not just to what the current UI needs

## Related Issues

- Commits: `fcdf15c415f98f4a1b8b8823545d407169ff0d8b`, `1bedc558c6a92f9e8c5f79a6d4c53b9f5b8c3a1e`
