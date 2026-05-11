# Problem

The recent hardening work improved the codebase, but the implementation is still not correct relative to the intended MVP game.

The app is still effectively scoring a round-based best-ball variant, not the intended hole-by-hole best-ball format driven by Slash Golf scorecards.

This is now a product correctness issue, not just a cleanup issue.

## What is wrong

### 1) Live refresh still uses leaderboard / round aggregates, not scorecards

refreshScoresForPool() currently fetches getTournamentScores() and builds the scoring map from tournament_score_rounds, using one pseudo-hole per round (holeId: 1).

That means ranking is still based on round-level score_to_par, not real hole-by-hole best-ball.

### 2) Hole-level infrastructure exists but is not wired into the live path

The repo now contains:
- TournamentHole
- upsertTournamentHoles(...)
- rankEntriesWithHoles(...)

But the refresh pipeline does not use them.

### 3) Slash Golf /scorecard integration is likely incorrect

The current getScorecard() implementation assumes the response is a single object with raw.holes.

Per the Slash Golf OpenAPI spec, /scorecard returns scorecard data per round and may return an array of scorecards when roundId is not specified.

That means the current parser may silently fail or ignore valid scorecard data.

### 4) Status normalization is inconsistent

The type layer includes: active, withdrawn, cut, dq, complete.

But the live getTournamentScores() normalization path still only preserves withdrawn and cut, defaulting everything else to active.

### 5) Old aggregate scoring code still exists

Legacy aggregate-scoring helpers are still present and can confuse future maintainers or accidentally be reused.

### 6) /stats client contract appears wrong

The current getStats() implementation does not match the Slash Golf API contract.

# Goal

Make the live scoring path truly implement the intended MVP: hole-by-hole best-ball driven by Slash Golf scorecards, persisted to tournament_holes, ranked from hole-level data, with correct status handling.

# Approved Design Direction

Implement in this order:
1. Fix getScorecard() parsing against real payload shape
2. Add fixture-based tests for scorecard parsing
3. Map scorecards to TournamentHole[]
4. Persist holes via upsertTournamentHoles(...)
5. Update refresh flow to fetch relevant scorecards
6. Rank live entries from hole-level data
7. Normalize statuses consistently
8. Remove or quarantine legacy aggregate code
9. Fix or remove /stats

# Non-Goals

- season-long scoring
- all-tournament expansion
- pricing / payment work
- major UI redesign
- provider migration away from Slash Golf

# Acceptance Criteria

## Product correctness
- Live leaderboard reflects hole-by-hole best-ball, not round-level min score
- Entry score is derived from best score on each hole among that entrys selected golfers

## Data flow
- Slash Golf scorecards are fetched and parsed correctly
- Hole-level rows are persisted into tournament_holes
- Live ranking is generated from hole-level data

## Reliability
- Scorecard parser is covered by fixture-based tests using real sample responses
- Refresh flow tests prove scorecards are used in the live scoring path
- Status handling is consistent across leaderboard, scorecard, and scoring logic

## Codebase hygiene
- Legacy aggregate scoring helpers are removed, isolated, or clearly marked non-production
- /stats client no longer misrepresents the Slash API contract

# Technical Notes

## Scope A: Fix scorecard ingestion
- Update getScorecard() to match the real Slash Golf response contract
- Support per-round scorecard payloads correctly
- Add captured fixture payloads from real API responses
- Add parsing tests against those fixtures

## Scope B: Wire scorecards into refresh
- Uses leaderboard / tournament endpoints only for targeting and status awareness
- Fetches scorecards for relevant golfers
- Derives hole rows from scorecards
- Writes hole rows to tournament_holes
- Ranks entries from hole-level data, not round aggregates

## Scope C: Switch ranking to true hole-level path
- Replace round-based ranking in the live scoring path with rankEntriesWithHoles(...)
- Ensure best-ball is computed per hole across selected golfers

## Scope D: Normalize statuses consistently
- Unify across: getTournamentScores(), getLeaderboard(), getScorecard(), scoring / refresh pipeline
- Support: active, withdrawn, cut, dq, complete

## Scope E: Remove or quarantine legacy aggregate scoring paths
- Remove unused / incorrect helpers where possible
- If retained temporarily, mark clearly as legacy and ensure production live scoring cannot use them

## Scope F: Fix or remove misleading /stats implementation
- Either implement it correctly or remove / de-scope it until actually needed

# Open Questions

None.
