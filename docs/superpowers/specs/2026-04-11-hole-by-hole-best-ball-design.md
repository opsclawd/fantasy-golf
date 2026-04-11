---
name: Hole-by-Hole Best Ball Scoring Design
description: Fetch and store per-hole scores from Slash Golf scorecards API, calculate contributing holes, and display clearly on picks page
module: scoring
tags: [scoring, api, database, best-ball]
git_refs: []
problem_type: feature
date: 2026-04-11
---

# Hole-by-Hole Best Ball Scoring

## Problem

The current "Counted in 1 round" metric on the participant picks page is misleading. The code at `src/lib/golfer-detail.ts` compares each golfer's tournament running total (`total_score`) against the lowest tournament total in the entry. That is not best-ball scoring.

Best-ball is decided hole-by-hole.

What the UI should communicate is:

"Across the holes we have verified for this entry, how many holes did this golfer match the best ball on?"

## Key Constraints

1. The Slash Golf `/scorecard` endpoint is one player per request.
2. The leaderboard response does not include `roundComplete`. The usable completion signal from the leaderboard is `thru === 18`.
3. The scorecard response returns all rounds for one golfer in a single response.
4. `refreshScoresForPool()` is shared by both cron-driven refreshes and the on-demand refresh route. Any new hole-sync work must run inside that shared path, not in a cron-only branch.
5. `tournament_score_rounds` is an archive of leaderboard snapshots. It is useful for detecting that a round row exists, but it is not the authoritative source of hole-level completion.
6. Hole contribution data is supplemental. Leaderboard refresh must still succeed even if some scorecard fetches fail.
7. Hole tables are internal server-owned data. Do not widen RLS to let all authenticated users read them directly.

## Solution Overview

Use `tournament_holes` as the only new persistent store.

Flow:

1. `refreshScoresForPool()` fetches leaderboard data and upserts `tournament_scores` plus `tournament_score_rounds` exactly as it does today.
2. After the core score upserts succeed, it computes missing hole rounds for the tournament:
   - Fast path: any golfer with `thru === 18` for `current_round`
   - Backfill path: any `(golfer_id, round_id)` in `tournament_score_rounds` with no corresponding hole rows yet
3. Missing rounds are grouped by golfer.
4. For each golfer, fetch `/scorecard` once with `cache: 'no-store'`.
5. From that single scorecard response, persist every missing round that is both:
   - explicitly marked `roundComplete === true`
   - non-empty (`holes` has entries)
6. Hole upserts are idempotent. If two refreshes race, duplicate external calls are acceptable; duplicate writes are harmless.
7. The picks page reads stored hole rows server-side after membership validation and computes contribution summaries from persisted data only.

## Why No Claim Table

The previous revision introduced a durable claim table. That created permanent retry blockers if a worker crashed after claiming but before releasing.

This design intentionally does not add a claim/lock table.

Reasons:

1. The current scoring refresh architecture already tolerates occasional duplicate work because score upserts are idempotent.
2. Hole writes are also idempotent via `ON CONFLICT` upserts.
3. The scorecard endpoint is one request per golfer and returns all rounds, so round-scoped claims do not even match the external API's granularity.
4. Removing the claim abstraction keeps the design aligned with the current system's known concurrency model rather than introducing a second, fragile locking system.

Known limitation:

- Two concurrent refreshes may still fetch the same golfer's scorecard twice.
- That is acceptable because the write path is idempotent and the user-facing goal here is correctness, not perfect external-call deduplication.

## API Response Shape

The Slash Golf scorecard endpoint returns:

```json
[
  {
    "roundId": 1,
    "roundComplete": true,
    "currentHole": 18,
    "currentRoundScore": "-5",
    "holes": {
      "1": { "holeId": 1, "holeScore": 4, "par": 4 },
      "2": { "holeId": 2, "holeScore": 4, "par": 5 }
    },
    "totalShots": 67
  },
  {
    "roundId": 2,
    "roundComplete": false,
    "currentHole": 11,
    "holes": {
      "1": { "holeId": 1, "holeScore": 5, "par": 4 }
    },
    "totalShots": 0
  }
]
```

Important:

- the per-hole field is `holeScore`, not `strokes`
- `roundComplete` exists only on the scorecard response, not the leaderboard response

## Data Model

### New table: `tournament_holes`

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

CREATE INDEX idx_tournament_holes_lookup
  ON tournament_holes(tournament_id, golfer_id, round_id);

ALTER TABLE tournament_holes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tournament_holes_service_role_all"
  ON tournament_holes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON tournament_holes TO service_role;
```

### Trust Boundary

`tournament_holes` is internal.

- `refreshScoresForPool()` writes it using `createAdminClient()`
- the participant picks page reads it server-side using `createAdminClient()` only after the user is authenticated and confirmed as a pool member
- no broad `authenticated USING (true)` read policy is added

This keeps the table private without forcing pool-level RLS logic into a tournament-scoped internal cache table.

## Slash Golf Integration

### Endpoint

```text
GET https://live-golf-data.p.rapidapi.com/scorecard?orgId=1&tournId=TournamentId&playerId=PlayerId&year=YYYY
```

### Cache Strategy

Completion-triggered scorecard fetches must use:

```ts
cache: 'no-store'
```

Reason:

- a newly completed round may briefly return empty or partial hole data if a stale cache is used
- refresh-time fetches need the latest response, not a revalidated cache snapshot

## Detecting Missing Hole Rounds

We do not create a second "completed rounds" table.

Instead, the refresh path computes missing hole rounds by comparing:

1. rounds known from leaderboard/archive data
2. rounds already represented in `tournament_holes`

### Fast path candidate

For each leaderboard golfer in `slashScores`:

- if `thru === 18`
- and `current_round` is non-null
- and no hole rows exist yet for `(golfer_id, current_round)`

then that round is a fetch candidate.

### Backfill candidate

For each `(golfer_id, round_id)` row in `tournament_score_rounds`:

- if no corresponding hole rows exist yet in `tournament_holes`

then that round is also a fetch candidate.

This lets the next successful refresh opportunistically backfill old or missed rounds without a separate admin task.

## Refresh Contract

Hole sync is best-effort supplemental work inside `refreshScoresForPool()`.

Rules:

1. If leaderboard fetch or score upsert fails, the refresh fails exactly as it does today.
2. If hole sync fails for one or more golfers, the refresh still counts as successful.
3. Hole-sync failures should be logged and included in refresh audit details, but they should not set `last_refresh_error` for the pool.

Why:

- `last_refresh_error` today represents whether tournament scoring itself is stale or failed
- hole contributions are a secondary metric on the picks page
- failing the whole refresh would make the leaderboard less reliable to protect a non-core enhancement

## Scorecard Fetch Algorithm

Fetch once per golfer, store all missing verified rounds from that response.

```ts
async function fetchAndStoreMissingRoundsForGolfer(
  supabase: SupabaseClient,
  tournamentId: string,
  golferId: string,
  year: number,
  missingRoundIds: Set<number>
): Promise<{ storedRoundIds: number[]; error: string | null }> {
  const scorecard = await getGolfersScorecard(tournamentId, golferId, year)
  const storedRoundIds: number[] = []

  for (const round of scorecard) {
    if (!missingRoundIds.has(round.roundId)) continue
    if (!round.roundComplete) continue
    if (Object.keys(round.holes).length === 0) continue

    const holes = buildTournamentHolesFromRound(golferId, tournamentId, round)
    const result = await upsertTournamentHoles(supabase, holes)
    if (result.error) {
      return { storedRoundIds, error: result.error }
    }

    storedRoundIds.push(round.roundId)
  }

  return { storedRoundIds, error: null }
}
```

Important details:

- only rounds in `missingRoundIds` are written
- only `roundComplete === true` rounds are written
- empty `holes` maps are ignored and retried on a later refresh
- one golfer fetch can fill multiple missing rounds

## Best-Ball Calculation

### Denominator Definition

`Y` is entry-level shared.

Definition:

- `Y` = number of unique `(round_id, hole_id)` pairs where at least one golfer in the entry has stored hole data
- every golfer in the entry gets the same `totalCompletedHoles`

This is a team-hole denominator, not an individual participation denominator.

### Tie Semantics

Ties count for every golfer who matched the best ball on that hole.

That means:

- two golfers can both receive credit for the same hole
- the sum of golfers' `contributingHoles` can exceed `Y`

The UI should explain this.

### Algorithm

```ts
export function calculateHoleContributions(
  entryGolferIds: string[],
  holesByGolfer: Map<string, TournamentHole[]>
): Map<string, {
  contributingHoles: number
  totalCompletedHoles: number
  hasPartialData: boolean
}> {
  const result = new Map<string, {
    contributingHoles: number
    totalCompletedHoles: number
    hasPartialData: boolean
  }>()
  const entrySet = new Set(entryGolferIds)

  for (const golferId of entryGolferIds) {
    result.set(golferId, {
      contributingHoles: 0,
      totalCompletedHoles: 0,
      hasPartialData: false,
    })
  }

  const holesIndex = new Map<string, Array<{ golferId: string; strokes: number }>>()

  for (const [golferId, holes] of holesByGolfer) {
    for (const hole of holes) {
      if (!entrySet.has(golferId)) continue

      const key = `${hole.round_id}-${hole.hole_id}`
      if (!holesIndex.has(key)) holesIndex.set(key, [])
      holesIndex.get(key)!.push({ golferId, strokes: hole.strokes })
    }
  }

  for (const entries of holesIndex.values()) {
    if (entries.length === 0) continue

    const golfersWithData = new Set(entries.map((entry) => entry.golferId))
    const isPartial = golfersWithData.size < entryGolferIds.length
    const bestBall = Math.min(...entries.map((entry) => entry.strokes))

    for (const golferId of entryGolferIds) {
      result.get(golferId)!.totalCompletedHoles += 1
      if (isPartial) {
        result.get(golferId)!.hasPartialData = true
      }
    }

    for (const entry of entries) {
      if (entry.strokes === bestBall) {
        result.get(entry.golferId)!.contributingHoles += 1
      }
    }
  }

  return result
}
```

## Display States

### Ready

If hole data exists for the entry:

- show `X of Y holes`
- if `hasPartialData === true`, show `X of Y holes (partial)`

### Syncing / Unavailable

If the entry has completed rounds in `tournament_scores` but there is still no hole data:

- do not fake `0 of 0 holes`
- show an entry-level note such as `Hole contribution details syncing.`

This distinguishes:

- no contribution data yet
- from a real `0` contribution count

### Before Any Completed Round

If no golfer in the entry has a completed round yet:

- hide the contribution metric entirely

### Copy Guidance

Add a short explainer near the picks breakdown:

`Ties count for each golfer who matched the low score on a hole.`

That prevents the metric from looking impossible when two golfers both get credit on the same hole.

## Partial Data Semantics

`(partial)` means the denominator is complete for team holes we have stored, but at least one hole is missing one or more golfers.

Typical causes:

- withdrawn or cut golfer with incomplete hole feed for a round
- feed gap that will be filled by a later refresh

The label does not try to distinguish permanent vs temporary incompleteness. It only tells the user the comparison uses incomplete per-golfer data on at least one stored hole.

## Withdrawal / Cut Handling

If one golfer has holes 1-9 and the rest of the entry has holes 1-18:

- holes 1-9 count normally
- holes 10-18 still count in the shared denominator if at least one entry golfer has data
- `hasPartialData` is true for every golfer in the entry

This is intentional. The denominator reflects team holes with stored results, not the number of holes each golfer personally finished.

## Rate Limiting

Use `p-limit` to cap concurrent scorecard fetches:

```ts
import pLimit from 'p-limit'

const limit = pLimit(3)
```

That keeps the refresh path from bursting too hard against RapidAPI while avoiding a more complex job queue.

## Out of Scope

- real-time hole-by-hole updates during an active round
- leaderboard ranking changes
- leaderboard UI contribution displays
- per-hole birdie tracking
- a separate admin backfill script

## Alternatives Considered

### 1. Add `tournament_completed_rounds`

Rejected.

`tournament_holes` already tells us whether verified hole data exists. Adding another completion ledger creates a redundant second source of truth.

### 2. Add a durable claims table

Rejected.

It introduces recovery problems on worker crash and does not match the external API's fetch granularity.

### 3. Golfer-specific denominator

Rejected.

It makes `Y` mean something different per golfer and undermines the entry-level interpretation of best-ball contribution.

### 4. Client-side direct reads from `tournament_holes`

Rejected.

The table is an internal tournament-scoped cache. Server-side reads after pool membership checks are safer than broad authenticated-table access.

### 5. Separate ops backfill task

Rejected for the implementation scope.

The normal refresh path can already backfill missing hole rounds by comparing `tournament_score_rounds` to `tournament_holes`. A separate script would expand scope for little value.
