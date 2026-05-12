## Problem

Issue #48 was closed, and the refresh/broadcast path now partially uses scorecard-driven hole-level scoring. However, the main leaderboard GET endpoint still uses the old round-based pseudo-hole path.

This means the app can produce split-brain scoring:

- refresh broadcast path: closer to true hole-level scoring
- normal leaderboard fetch path: still round-based via `tournament_score_rounds`

That is not handoff-ready. The most user-visible leaderboard endpoint must use the same true hole-by-hole best-ball model as the refresh path.

## Evidence

### 1) `src/app/api/leaderboard/[poolId]/route.ts` still uses round-level pseudo-hole scoring

The endpoint currently:

- imports `rankEntries` from `src/lib/scoring/domain`
- reads `tournament_score_rounds` via `getTournamentScoreRounds(...)`
- creates score entries with `holeId: 1`
- calls `rankEntries(...)`

That means it is still ranking from round aggregates, not from `tournament_holes`.

### 2) README still describes the old model

`README.md` still says:

- "live round-by-round scoring"
- "Round-based best-ball (lowest score among 4 golfers per completed round)"

That contradicts the intended MVP and the direction of issue #48.

### 3) `docs/rules-spec.md` is internally contradictory

It says "Best Ball, Hole-by-Hole," but defines the algorithm as:

```txt
Entry round score = min(scoreToPar of active golfers)
Entry total score = sum(Entry round score for each completed round)
```

That is not hole-by-hole best-ball. It is round-level best-ball.

# Goal

Make all user-visible scoring paths and docs consistently use true hole-by-hole best-ball.

# Scope

## A. Fix leaderboard GET endpoint

Update `src/app/api/leaderboard/[poolId]/route.ts` so it:

- fetches entries for the pool
- derives rostered golfer IDs from those entries
- fetches `tournament_scores` only for golfer statuses / display metadata
- fetches `tournament_holes` for rostered golfers via `getTournamentHolesForGolfers(...)`
- builds `golferStatuses`
- calls `rankEntriesWithHoles(...)`
- removes the `getTournamentScoreRounds(...)` pseudo-hole ranking path

## B. Keep response contract stable

Preserve the existing leaderboard response shape as much as possible:

- `entries`
- `completedRounds`
- `refreshedAt`
- `freshness`
- `isRefreshing`
- `poolStatus`
- `lastRefreshError`
- `golferStatuses`
- `golferNames`
- `golferCountries`
- `golferScores`

Do not break UI consumers unless required.

## C. Update docs to match the actual product

Update:

- `README.md`
- `docs/rules-spec.md`
- any operations/handoff docs that still reference round-based best-ball

Docs should define scoring as:

```txt
For each regulation hole in each counted round:
1. Look at the selected golfers in the entry.
2. Use the lowest score-to-par among golfers with a valid score for that hole.
3. Add that best hole score to the entry total.
4. Count birdies/eagles as `scoreToPar < 0` for the best-ball hole result.
```

## D. Add regression coverage

Add or update tests proving:

- leaderboard GET uses `tournament_holes`, not `tournament_score_rounds`
- leaderboard GET calls/ranks through `rankEntriesWithHoles(...)` or equivalent hole-level path
- a fixture with two rounds and overlapping hole IDs does not collapse into one pseudo-hole per round
- docs no longer describe round-based best-ball as the MVP model

# Out of Scope

- replacing Slash Golf
- season-long scoring
- all-tournament expansion
- large UI redesign
- changing refresh lock behavior
- payments or commissioner monetization

# Acceptance Criteria

- `GET /api/leaderboard/[poolId]` ranks from `tournament_holes`
- `GET /api/leaderboard/[poolId]` no longer builds fake `holeId: 1` records from `tournament_score_rounds`
- normal page load and realtime refresh paths use the same scoring model
- README no longer says round-based best-ball
- `docs/rules-spec.md` no longer defines scoring as round-level min aggregation
- tests cover the corrected leaderboard GET path

# Notes

This issue exists because #48 fixed part of the data/refresh path but left the normal leaderboard fetch path and docs on the old model.

Do not close this issue until the user-visible leaderboard endpoint and documentation are aligned with true hole-by-hole best-ball.
