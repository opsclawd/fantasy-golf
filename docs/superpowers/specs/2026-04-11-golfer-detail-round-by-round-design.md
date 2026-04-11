---
name: Golfer Detail Round-by-Round Design
description: Add per-round scoring display to the golfer detail popup
module: golfer-detail
tags: [frontend, ui, scoring]
git_refs: []
problem_type: feature
date: 2026-04-11
---

# Golfer Detail Round-by-Round Scoring

## Problem

The golfer detail popup (`GolferDetailSheet`) only shows data from `tournament_scores` (aggregate one-row-per-golfer table). It displays a single round's summary. Per-round data stored in `tournament_score_rounds` is never queried or displayed, leaving users without round-by-round visibility.

## Solution

Enhance `GolferDetailSheet` to fetch and display all rounds from `tournament_score_rounds`, giving users a tabbed round-by-round view with strokes, score-to-par, thru, position, tee time, and course name.

## Data

### Current state
- `GolferDetailSheet` receives `TournamentScore | null` as the `score` prop
- `getGolferScorecard(score)` returns `GolferScorecard` with `completedRounds`, `totalScore`, `totalBirdies`, `status` — no per-round breakdown

### New data source
- `tournament_score_rounds` table: one row per golfer per tournament per round
- Fields available: `round_id`, `strokes`, `score_to_par`, `course_name`, `course_id`, `round_status`, `position`, `total_score`, `thru`, `starting_hole`, `tee_time`, `current_round`, `total_strokes_from_completed_rounds`, `is_amateur`
- Fetched via the new `GET /api/golfers/[golferId]/rounds` API route from `GolferDetailSheet`

### Out of scope
- Per-round birdie counts (not stored in DB; only tournament total `total_birdies` from `tournament_scores`)
- Changes to leaderboard API, scoring logic, or any server-side scoring code

## API

**New endpoint: `GET /api/golfers/[golferId]/rounds`**

Returns all `TournamentScoreRound` rows for a specific golfer and tournament.

Query params:
- `tournamentId` (required)

Response shape: `TournamentScoreRound[]`

This keeps the data fetching server-side validated and consistent with the rest of the app's API patterns.

## UI Layout

### Popup header (unchanged)
- Golfer name
- Country flag badge
- Status badge ("Round N", "Cut", "Withdrawn")

### Scoring Details section
1. **Round tab bar** — horizontal tabs: R1, R2, R3, R4
   - Each tab shows the round's **score-to-par** (e.g., "−3") or "--" if not yet played. Never shows raw strokes on the tab.
   - Active tab visually distinct (green background for completed/current, grey for future)
2. **Selected round detail card** — shows for the active tab:
   - Course name (since pro-ams can rotate courses between rounds, this lives *inside* the active round card, not as a section header)
   - Strokes, Score-to-par, Thru, Position, Tee time, Round status
3. **Summary row** — bottom of section:
   - Total score thru completed rounds (from `tournament_scores`)
   - Tournament birdie total
   - Current position

### Loading state
While round data is being fetched, show a skeleton placeholder matching the layout of the scoring section.

### Empty / no-data state
If `tournament_score_rounds` returns zero rows for this golfer but `tournament_scores` has a row (golfer hasn't teed off yet, or round archive is lagging), render the tabbed UI with all four tabs showing `--` and an informational message inside the active round card: "No round data yet — check back after the next leaderboard refresh." The summary row still shows the aggregate from `tournament_scores`. This is preferred over falling back to the old empty state because it keeps the layout stable across refreshes.

If the `tournament_scores` row itself is missing (no `score` prop), keep the existing "Scoring details coming soon" empty state exactly as today.

## Component Changes

### `src/lib/golfer-detail.ts`

**`RoundResult` interface** — rework fields. The existing `score` field is replaced by explicit `strokes` and `scoreToPar` fields so the display layer never has to guess whether a number is strokes or to-par:

```typescript
export interface RoundResult {
  round: number
  strokes: number | null      // raw strokes for this round (e.g. 70)
  scoreToPar: number | null   // round score relative to par (e.g. -2)
  totalToPar: number | null   // cumulative tournament score-to-par thru this round
  position: string | null
  roundStatus: string | null
  teeTime: string | null
  thru: number | null
  courseName: string | null   // per-round course name (pro-ams rotate courses)
}
```

Note: this is a breaking change to `RoundResult`. The existing `GolferScorecard.rounds` field is only populated by `getGolferScorecard` and consumed by `GolferScorecard.tsx`, so no external callers need updating.

**`GolferScorecard` interface** — unchanged shape. Course name lives on `RoundResult`, not on the scorecard, since it can vary per round:
```typescript
export interface GolferScorecard {
  golferId: string
  status: GolferStatus
  totalBirdies: number
  completedRounds: number
  totalScore: number
  rounds?: RoundResult[]
}
```

**`getGolferScorecard(score, rounds?)`** — second param added. When `rounds` is provided, builds the full `rounds[]` array by mapping each `TournamentScoreRound` row to a `RoundResult`. When omitted, falls back to single-round behavior (backwards compatible with existing call sites).

### `src/components/GolferScorecard.tsx`

Reworked to render:
- Course name header (if `scorecard.courseName`)
- Round tab bar (always 4 tabs, R1–R4)
- Active round detail card
- Summary row

Props unchanged (`scorecard: GolferScorecard`), but `scorecard.rounds` is now always populated when data is available.

### `src/components/GolferDetailSheet.tsx`

Changes:
- **No new prop needed.** `TournamentScore.tournament_id` already exists on the `score` prop, so the fetch uses `score.tournament_id` directly.
- `useEffect` on mount fetches round data from `/api/golfers/[golferId]/rounds?tournamentId=X` when `score?.tournament_id` is present
- Show skeleton loading state during fetch
- Pass round data to `getGolferScorecard(score, rounds)`

### `src/app/api/golfers/[golferId]/rounds/route.ts` (new file)

Server-side route that:
- Accepts `tournamentId` query param (400 if missing)
- Authenticates the caller via `supabase.auth.getUser()` and returns 401 if there is no session (round data should not be publicly readable by golfer id)
- Queries `tournament_score_rounds` for the given golfer + tournament
- Returns `TournamentScoreRound[]` rows ordered by `round_id`

## Files Changed

| File | Change |
|------|--------|
| `src/lib/golfer-detail.ts` | Extend `RoundResult`, `GolferScorecard`, `getGolferScorecard` |
| `src/components/GolferScorecard.tsx` | Full rework for tabbed round display |
| `src/components/GolferDetailSheet.tsx` | Add fetch, loading state, pass `tournamentId` |
| `src/app/api/golfers/[golferId]/rounds/route.ts` | New API route |

## Files Not Changed

- `src/lib/scoring.ts`
- `src/lib/scoring-queries.ts`
- `src/app/api/leaderboard/[poolId]/route.ts`
- `src/app/api/scoring/refresh/route.ts`
- Any database migration (schema is already in place)
