---
name: OPS-52 Integrate Slash Golf scorecard-driven scoring flow
description: Build a clean multi-endpoint adapter layer for Slash Golf tournament/leaderboard/scorecard flows with status normalization, fixture capture, and selective scorecard refresh strategy
module: scoring / provider-adapter
tags: [scoring, slash-golf, provider-adapter, hole-level, scorecard]
git_refs: []
problem_type: feature
date: 2026-04-26
---

# OPS-52: Integrate Slash Golf Scorecard-Driven Scoring Flow

## Problem

The app currently relies on aggregate leaderboard data as the sole scoring source of truth. OPS-50 identified that true hole-level best-ball scoring requires per-hole data. The Slash Golf API provides `/tournament`, `/leaderboard`, `/scorecard`, and `/stats` endpoints, but no clean adapter strategy exists for using them together.

The deliverable is a documented, tested provider adapter layer that:
- Uses the correct endpoints for each data type
- Normalizes player status values including `complete` / `wd` / `dq` / `cut`
- Captures real payload fixtures
- Defines an explicit selective scorecard fetch strategy

## What Exists Today

### `src/lib/slash-golf/client.ts` (current state)

| Function | Endpoint | Status |
|----------|-----------|--------|
| `getTournamentScores(tournamentId, year)` | `GET /leaderboard` | Works, normalizes leaderboard rows |
| `getGolfers(tournamentId, year)` | `GET /tournament` | Works, normalizes player array |

**Missing:**
- No `/scorecard` endpoint integration
- No `/stats` endpoint integration
- No fixture capture for any endpoint
- Status normalization only handles `'withdrawn'` / `'cut'` → `'active'`; does not handle `'complete'`, `'dq'`
- No `tournament_holes` table integration (per OPS-50 spec)
- No documented call strategy for selective scorecard refreshes

### `src/lib/slash-golf/types.ts`

`GolferScoreRound` already exists as a type that maps to the leaderboard round structure. It does **not** have hole-level fields.

## Design

### 1. New Endpoint Functions in `client.ts`

#### `getTournamentMeta(tournamentId: string, year?: number): Promise<SlashTournamentMeta>`

Hits `GET /tournament`. Returns tournament-level metadata: field status, course info, round count.

```ts
export interface SlashTournamentMeta {
  tournId: string
  name: string
  year: string
  status: 'published' | 'In Progress' | 'Complete' | 'Canceled'
  currentRound: number | null
  courses: Array<{ courseId: string; courseName: string }>
  format: string | null
  date: string | null
}
```

#### `getLeaderboard(tournamentId: string, year?: number): Promise<SlashLeaderboard>`

Hits `GET /leaderboard`. Returns tournament status, round progress, and refresh targeting info.

```ts
export interface SlashLeaderboard {
  tournId: string
  year: string
  status: 'In Progress' | 'Round Complete' | 'Tournament Complete' | string
  roundId: number
  roundStatus: 'In Progress' | 'Round Complete' | 'Pre' | string
  timestamp: string
  leaderboardRows: SlashGolferRow[]
}
```

**Refresh targeting use:** `roundStatus === 'In Progress'` means live scoring — cron should refresh at higher frequency. `roundStatus === 'Round Complete'` means round boundary — scorecard fetch is worthwhile.

#### `getScorecard(tournamentId: string, golferId: string, year?: number): Promise<SlashScorecard>`

Hits `GET /scorecard`. Returns per-player hole scores for one golfer.

```ts
export interface SlashScorecard {
  tournId: string
  playerId: string
  year: string
  status: SlashGolferStatus
  currentRound: number
  holes: SlashHole[]
}

export interface SlashHole {
  holeId: number        // 1–18
  par: number
  strokes: number
  scoreToPar: number   // strokes - par
}

export type SlashGolferStatus = 'active' | 'withdrawn' | 'cut' | 'dq' | 'complete'
```

#### `getStats(tournamentId: string, year?: number): Promise<SlashStats>`

Hits `GET /stats`. For ranking-tier features. Returns world ranking changes, OWGR points.

```ts
export interface SlashStats {
  tournId: string
  playerId: string
  worldRank: number | null
  projectedOWGR: number | null
  // ...
}
```

**MVP scope note:** Stats endpoint is not needed for current MVP scoring. Included for near-term compatibility only.

### 2. Status Normalization

The Slash Golf API uses diverse status values. The normalizer must handle all observed variants:

| Raw Value | Normalized |
|----------|------------|
| `'active'`, `'In Progress'` (round), `'playing'` | `'active'` |
| `'withdrawn'`, `'wd'`, `'WD'` | `'withdrawn'` |
| `'cut'`, `'cu'`, `'CUT'` | `'cut'` |
| `'dq'`, `'DQ'` | `'dq'` |
| `'complete'`, `'finished'`, `'F'` | `'complete'` |
| `null`, `undefined`, `''` | `'active'` (default) |

```ts
export function normalizeSlashStatus(status: unknown): SlashGolferStatus {
  if (typeof status !== 'string') return 'active'
  const s = status.trim().toLowerCase()
  if (s === 'withdrawn' || s === 'wd') return 'withdrawn'
  if (s === 'cut' || s === 'cu') return 'cut'
  if (s === 'dq') return 'dq'
  if (s === 'complete' || s === 'finished' || s === 'f') return 'complete'
  return 'active'
}
```

The `GolferStatus` union in `supabase/types.ts` (`'active' | 'withdrawn' | 'cut'`) must be extended to include `'dq'` and `'complete'`:

```ts
export type GolferStatus = 'active' | 'withdrawn' | 'cut' | 'dq' | 'complete'
```

Note: `'complete'` means the golfer finished the tournament. `'active'` means currently playing. Both are distinct from cut/WD/DQ.

### 3. Tournament Holes Table (Per OPS-50)

Per the OPS-50 design spec, hole-level data must be stored in `tournament_holes`:

```ts
export interface TournamentHole {
  golfer_id: string
  tournament_id: string
  round_id: number
  hole_id: number      // 1–18
  strokes: number
  par: number
  score_to_par: number
  updated_at?: string
}
```

New function in `scoring-queries.ts`:

```ts
export async function upsertTournamentHoles(
  supabase: SupabaseClient,
  holes: TournamentHole[]
): Promise<{ error: string | null }>
```

### 4. Selective Scorecard Refresh Strategy

Fetching `/scorecard` per golfer on every refresh would be expensive (156 golfers × 4 rounds × 18 holes = 11,232 potential API calls per tournament refresh cycle). A selective strategy is required.

**Strategy:**

| Condition | Action |
|-----------|--------|
| Round is not yet complete (`roundStatus !== 'Round Complete'`) | Skip scorecard fetch — leaderboard rounds data is sufficient |
| Round just completed (`roundStatus === 'Round Complete'` for first time) | Fetch scorecard for all rostered golfers to lock in hole data |
| Tournament is live and in progress | Only fetch scorecard for golfers whose leaderboard row shows `thru < 18` (incomplete round) |
| Golfer was cut/WD/DQ | Fetch scorecard once to capture final hole, then mark golfer as inactive |
| Golfer has no `tournament_holes` data for a completed round | Fetch scorecard to backfill |

**Implementation:**
A new `ScorecardFetchPlan` type describes which golfers need scorecard fetches:

```ts
export interface ScorecardFetchPlan {
  tournamentId: string
  year: number
  fetchScorecard: Array<{ golferId: string; reason: 'round_complete_backfill' | 'in_progress_refresh' | 'status_change' }>
  skipScorecard: Array<{ golferId: string; reason: string }>
}
```

```ts
export function buildScorecardFetchPlan(
  meta: SlashTournamentMeta,
  leaderboard: SlashLeaderboard,
  existingHoleCounts: Map<string, number>  // golferId → count of stored holes
): ScorecardFetchPlan
```

The plan is consumed by a batch fetcher that calls `getScorecard` per golfer with rate limiting (sequential or capped concurrency to avoid API quota exhaustion).

### 5. Call Strategy Documentation

A strategy doc at `docs/superpowers/specs/ops-52-call-strategy.md` will document:

- Which endpoint to call when
- How to correlate round state from leaderboard with scorecard data needs
- Rate limiting assumptions (RapidAPI tier limits)
- Error handling per endpoint (fetch failures, empty responses, malformed data)
- Quota budgeting across tournament + leaderboard + scorecard calls

### 6. Type Additions

```ts
// src/lib/slash-golf/types.ts

export interface SlashTournamentMeta {
  tournId: string
  name: string
  year: string
  status: string
  currentRound: number | null
  courses: Array<{ courseId: string; courseName: string }>
  format: string | null
  date: string | null
}

export interface SlashLeaderboard {
  tournId: string
  year: string
  status: string
  roundId: number
  roundStatus: string
  timestamp: string
  leaderboardRows: SlashGolferRow[]
}

export interface SlashGolferRow {
  playerId: string
  lastName: string
  firstName: string
  isAmateur: boolean
  status: SlashGolferStatus
  currentRound: number
  total: string | { $numberInt: string }
  currentRoundScore: string | { $numberInt: string }
  position: string | null
  totalStrokesFromCompletedRounds: string | null
  rounds: SlashRound[]
  thru: string | null
  startingHole: number | null
  currentHole: number | null
  courseId: string | null
  teeTime: string | null
  teeTimeTimestamp: string | null
}

export interface SlashRound {
  roundId: number
  courseId: string
  courseName: string
  strokes: number | { $numberInt: string }
  scoreToPar: number | { $numberInt: string }
}

export interface SlashHole {
  holeId: number
  par: number
  strokes: number
  scoreToPar: number
}

export interface SlashScorecard {
  tournId: string
  playerId: string
  year: string
  status: SlashGolferStatus
  currentRound: number
  holes: SlashHole[]
}

export type SlashGolferStatus = 'active' | 'withdrawn' | 'cut' | 'dq' | 'complete'
```

## File Changes

| File | Change |
|------|--------|
| `src/lib/slash-golf/types.ts` | Add `SlashTournamentMeta`, `SlashLeaderboard`, `SlashGolferRow`, `SlashRound`, `SlashHole`, `SlashScorecard`, `SlashGolferStatus` |
| `src/lib/slash-golf/client.ts` | Add `getTournamentMeta`, `getLeaderboard`, `getScorecard`, `getStats` functions; update `normalizeGolferStatus` |
| `src/lib/supabase/types.ts` | Extend `GolferStatus` to include `'dq' \| 'complete'` |
| `src/lib/scoring-queries.ts` | Add `upsertTournamentHoles` |
| `docs/superpowers/specs/ops-52-call-strategy.md` | New — call strategy documentation |

## Payload Fixtures

Capture real payloads for:
- `GET /tournament` response shape
- `GET /leaderboard` response shape
- `GET /scorecard` response shape
- `GET /stats` response shape (if available)

Fixtures directory: `fixtures/slash-golf/` with files:
- `tournament-{tournamentId}.json`
- `leaderboard-{tournamentId}.json`
- `scorecard-{tournamentId}-{golferId}.json`
- `stats-{tournamentId}-{golferId}.json`

Each fixture includes a header comment with:
- Capture date
- Tournament ID
- Source endpoint
- Any notable observations (e.g., "status field uses 'complete' not 'finished'")

## Out of Scope

- Actual `tournament_holes` table creation and population (OPS-50 scope)
- Cron pipeline changes to use the new scorecard fetch strategy (OPS-29 scope)
- UI changes to display hole-level scoring (OPS-50/OPS-32 scope)
- Switching away from Slash Golf

## Dependencies

- OPS-51 (Supabase schema reconciliation) — schema types must be stable before adapter typing
- OPS-50 (scoring engine rebuild) — `tournament_holes` table must exist before scorecard data can be persisted
- OPS-49 (MVP rules freeze) — status normalization rules must be finalized

## Acceptance Criteria

1. All four Slash Golf endpoints (`/tournament`, `/leaderboard`, `/scorecard`, `/stats`) have typed adapter functions in `client.ts`
2. Status normalization handles `'complete'`, `'dq'`, `'wd'` (in addition to existing `'withdrawn'`/`'cut'`)
3. `GolferStatus` in `types.ts` includes `'dq'` and `'complete'`
4. `upsertTournamentHoles` function exists in `scoring-queries.ts`
5. At least one real payload fixture is captured and committed for each endpoint
6. Call strategy doc exists at `docs/superpowers/specs/ops-52-call-strategy.md`
7. No leaderboard aggregates are used as sole scoring source of truth — scorecard data can replace them

## Alternative Approaches

### A) Extend existing `getTournamentScores` to also fetch scorecard (not recommended)

Adding scorecard logic into the existing function would violate single-responsibility. The current function already handles 3 response shapes. It would become unmaintainable.

### B) Create separate adapter files per endpoint (e.g., `slash-golf/tournament.ts`, `slash-golf/scorecard.ts`)

Too fine-grained. All Slash Golf provider logic belongs in one module with consistent error handling and rate limiting. A single `client.ts` with named exports is sufficient.

### C) Use GraphQL wrapper over REST endpoints

Not supported by the Slash Golf API. REST only.

**Recommended:** Single `client.ts` module with clearly named functions per endpoint. Consistent error handling, shared status normalization, fixture capture for all endpoints.
