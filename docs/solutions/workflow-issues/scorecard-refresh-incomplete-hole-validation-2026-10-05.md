---
title: Fail visibly on incomplete scorecard hole data
date: 2026-10-05
last_updated: 2026-10-05
category: docs/solutions/workflow-issues/
module: scoring
problem_type: workflow_issue
component: lib
severity: high
tags: [scoring, scorecard, hole-data, refresh, validation, standings-corruption, stale-fallback]
git_refs: []
---

# Fail visibly on incomplete scorecard hole data

## Context

In the hole-by-hole best-ball scoring format, entry scores are computed from hole rows stored in `tournament_holes`. Previously, the scoring refresh pipeline lacked per-golfer completeness validation: if some rostered golfers had scorecard rows in `tournament_holes` while others failed to ingest (due to API timeouts, rate limits, or provider defects), the refresh pipeline proceeded unimpeded. It computed best-ball scores across the incomplete golfer set, marked `refreshed_at` and `last_refresh_success_at` as successful, and broadcast corrupted standings over Realtime as authoritative.

## Root cause / wrong premise

The previous pipeline assumed that checking whether any hole rows existed (`holesByGolfer.size === 0`) was sufficient, or assumed that per-golfer scorecard fetch errors could be silently swallowed without verifying whether missing scorecards affected rostered scoring golfers. Furthermore, `updatePoolRefreshMetadata` was invoked to update `refreshed_at` and `last_refresh_success_at` *before* scorecard fetching even occurred.

## Guidance

1. **Pool-Scoped Authoritative Golfer Set:** Determine required golfers from actual pool entries (`getRequiredScoringGolferIds`), intersecting with scoring-relevant statuses (excluding `cut`, `withdrawn`, and `dq`).
2. **Completeness Gate Before Success Metadata:** Never write `refreshed_at`, `last_refresh_success_at`, `scoreRefreshCompleted` audit logs, or Realtime broadcasts until hole data completeness validation passes for all required golfers across all completed rounds.
3. **Explicit Error Code (`INCOMPLETE_HOLE_DATA`):** On partial scorecard failure, set `last_refresh_error`, log `scoreRefreshFailed` with missing and required golfer details, and return HTTP 502 Bad Gateway.
4. **Preserve Stale-But-Valid Standings on Read:** If latest round hole data is incomplete, `GET /api/leaderboard/[poolId]` uses `getLatestCompleteRound()` to fall back to the highest round where all required golfers possess complete hole data, marking `freshness: 'stale'` and setting `lastRefreshError`.

## Verification

- Unit tests in `src/lib/__tests__/scoring.test.ts` verify `isScoringRelevantGolfer`, `getRequiredScoringGolferIds`, `validateHoleDataCompleteness`, `getLatestCompleteRound`, and `filterHolesByRound`.
- Integration tests in `src/lib/__tests__/scoring-refresh.test.ts` verify that empty and partial hole data fail with `INCOMPLETE_HOLE_DATA`, suppress broadcasts, and do not advance success metadata.
- Read path tests in `src/app/api/leaderboard/[poolId]/route.test.ts` verify fallback to latest complete round standings when current round has incomplete hole data.

## Related

- `docs/solutions/logic-errors/pap-18-phase-2-hole-level-scoring-design.md`
- `docs/solutions/workflow-issues/on-demand-scoring-refresh-2026-04-08.md`
- `AGENTS.md` (Scoring Architecture & Freshness Rules)
