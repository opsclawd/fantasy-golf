# Issue #51 — Hole-by-Hole Scoring Consistency Design

## Context

Issue #48 was closed after migrating the refresh/broadcast path to use hole-level scoring via `tournament_holes`. Issue #51 identifies that the main leaderboard GET endpoint and documentation may still reference round-based scoring, creating a split-brain scoring model where different paths produce inconsistent results.

**Code analysis finding:** The current `src/app/api/leaderboard/[poolId]/route.ts` (lines 147-149) already calls `getTournamentHolesForGolfers()` and `rankEntriesWithHoles()`, using `tournament_holes` for ranking. The issue description reflects the pre-#48 state of the codebase.

---

## Problem Statement

The core risk is **split-brain scoring**: different code paths computing different scores for the same entry. Specifically:

- Refresh/broadcast path: hole-by-hole via `tournament_holes` + `rankEntriesWithHoles`
- Normal leaderboard fetch path: potentially round-based via `tournament_score_rounds` + deprecated `rankEntries`

This would cause spectators to see different leaderboard positions depending on how they loaded the page.

---

## Key Design Decisions

### 1. Single Scoring Source of Truth

Both the leaderboard GET endpoint and the refresh broadcast path must rank entries using the same function and data source:

- **Scoring function:** `rankEntriesWithHoles` from `src/lib/scoring.ts`
- **Data source:** `tournament_holes` via `getTournamentHolesForGolfers(supabase, tournamentId, golferIds)`
- **Deprecated path:** `rankEntries` + `buildGolferRoundScoresMapFromScores` must not be called by any live scoring path

The current code already satisfies this requirement. The route uses `rankEntriesWithHoles` with `tournament_holes`.

### 2. Response Contract Stability

The existing leaderboard response shape must be preserved:

| Field | Type | Notes |
|-------|------|-------|
| `entries` | `Entry[]` | Ranked entries with `totalScore`, `totalBirdies`, `rank`, `isTied` |
| `completedRounds` | `number` | Derived from `tournament_scores` `round_id` max |
| `refreshedAt` | `string` | ISO timestamp from `pool.refreshed_at` |
| `freshness` | `'current' \| 'stale' \| 'unknown'` | From `classifyFreshness` |
| `isRefreshing` | `boolean` | True when stale + live + no last error |
| `poolStatus` | `string` | Pool status |
| `lastRefreshError` | `string \| null` | Error from last refresh |
| `golferStatuses` | `Record<string, 'active' \| 'cut' \| 'withdrawn'>` | From `tournament_scores` |
| `golferNames` | `Record<string, string>` | From `getTournamentRosterGolfers` |
| `golferCountries` | `Record<string, string>` | From `getTournamentRosterGolfers` |
| `golferScores` | `Record<string, TournamentScore>` | From `tournament_scores` |

No new fields should be added in this issue.

### 3. `tournament_holes` as Primary Data

`TournamentHole` records are the authoritative source for hole-by-hole scoring. `tournament_score_rounds` remains the append-only per-round archive (useful for detailed round views and auditing) but is **not** used for live leaderboard ranking.

### 4. `completedRounds` Derivation

`completedRounds` is computed from `tournament_scores` rows (max `round_id`), not from `tournament_holes`. This is already the current behavior.

---

## Proposed Approach

### Phase A: Verify Current Implementation

Inspect `src/app/api/leaderboard/[poolId]/route.ts` to confirm:

1. It imports `rankEntriesWithHoles` (not `rankEntries`) from `@/lib/scoring`
2. It calls `getTournamentHolesForGolfers` with rostered golfer IDs
3. It passes the returned `holesByGolfer` map to `rankEntriesWithHoles`
4. It does **not** call `getTournamentScoreRounds` or use round-level pseudo-hole `holeId: 1` records

**Current state:** All four conditions are met. The route was already updated in a prior commit.

### Phase B: Verify Test Coverage

Confirm `route.test.ts` contains a test that:

1. Provides a `holesByGolfer` fixture with **multiple rounds and overlapping hole IDs** (e.g., round 1 holes 1-2, round 2 hole 1)
2. Asserts `getTournamentHolesForGolfers` is called with correct arguments
3. Asserts `rankEntriesWithHoles` receives the `holesByGolfer` map directly
4. Asserts entries are ranked from hole-level data, not collapsed into one pseudo-hole per round

**Current state:** Test at line 322 "ranks entries from tournament_holes via rankEntriesWithHoles, not tournament_score_rounds" exists. Fixture has g1 with round 1 holes 1-2 and round 2 hole 1, validating multi-round behavior.

### Phase C: Documentation Audit

Verify `README.md` and `docs/rules-spec.md` correctly describe hole-by-hole best-ball:

**README.md (current):**
- Line 80: "Hole-by-hole best-ball (lowest score-to-par per hole among active golfers)" — **Correct**

**docs/rules-spec.md (current):**
- Section 2.1: "Best Ball, Hole-by-Hole" with correct algorithm description — **Correct**

**Finding:** Documentation is already correct.

### Phase D: Identify Residual Issues

After inspecting all paths, the following residual items should be addressed:

1. **Deprecated function cleanup:** `buildGolferRoundScoresMapFromScores` in `src/lib/scoring.ts` (lines 57-69) is marked `@deprecated Non-production`. Its only consumer was the old leaderboard path. Confirm no live code calls it and remove it if confirmed dead.
2. **`getTournamentScoreRounds` import presence:** The leaderboard route no longer imports `getTournamentScoreRounds`. The issue's concern about the old path is addressed.

---

## Assumptions

1. **The `tournament_holes` table is populated** by the Slash Golf refresh path. If `tournament_holes` is empty for a tournament, `rankEntriesWithHoles` receives an empty map and all entries get `null` scores — this is correct behavior (no data yet).

2. **`getTournamentHolesForGolfers` returns only completed holes.** Incomplete holes (round in progress) are filtered or have `isComplete: false`. The `computeEntryScore` function in `domain.ts` gates scoring on `roundCompleteness` — only rounds where all golfers have `isComplete: true` contribute to the score.

3. **Cut/WD status is determined from `tournament_scores`** (not `tournament_holes`). The `golferStatuses` map is built from `tournament_scores` rows where `status !== 'active'`.

4. **`tournament_score_rounds` remains an append-only archive.** It is written by `upsertTournamentScore` during refresh but is never read by the leaderboard GET path for ranking purposes.

---

## In Scope

- Ensuring `GET /api/leaderboard/[poolId]` uses `tournament_holes` via `rankEntriesWithHoles`
- Ensuring no live scoring path uses round-level pseudo-hole `holeId: 1` aggregation
- Verifying tests confirm the correct scoring path
- Confirming documentation accurately describes hole-by-hole best-ball
- Confirming the deprecated `buildGolferRoundScoresMapFromScores` is unused by live code

---

## Out of Scope

- Replacing Slash Golf API integration
- Adding season-long or all-tournament scoring
- Large UI redesign or new features
- Changing refresh lock behavior
- Payments or commissioner monetization
- Creating or modifying database migrations (schema is already in place)
- Modifying `tournament_score_rounds` archive behavior
- Modifying the refresh/broadcast path (already correct per issue #48)

---

## Risks and Concerns

### Risk 1: `tournament_holes` May Not Be Populated for All Golfers

If the Slash Golf refresh path writes to `tournament_scores` but fails to write `tournament_holes` for some golfers, those golfers' holes would be missing from the leaderboard calculation. The current code would treat missing holes as no contribution.

**Mitigation:** The refresh path (`scoring-refresh.ts`) writes `tournament_holes` via `getTournamentHolesForGolfers` being populated during the same refresh cycle. Verify the refresh path writes both `tournament_scores` and `tournament_holes` in the same operation.

### Risk 2: `completedRounds` Derived from `tournament_scores` May Diverge from Actual Completed Holes

`completedRounds` is the max `round_id` from `tournament_scores`, which tracks the latest completed round. But if a round is partially complete (some golfers finished, some not), `tournament_holes` for that round may be incomplete. The scoring algorithm handles this via `roundCompleteness` gating in `computeEntryScore`, so entries don't accumulate score for incomplete rounds.

### Risk 3: `buildGolferRoundScoresMapFromScores` Is Still Present

This deprecated function could be accidentally used by future code. It should be confirmed unused and removed.

**Mitigation:** Search for any call sites of `buildGolferRoundScoresMapFromScores`. If none exist, remove it from `scoring.ts`.

### Risk 4: Documentation May Drift Again

README and rules-spec may describe the correct model today but drift in future changes.

**Mitigation:** Add a note in `docs/rules-spec.md` referencing `src/lib/scoring/domain.ts:computeEntryScore` as the authoritative algorithm. This creates a direct traceability path.

---

## Verification

1. **Code path verification:**
   ```bash
   rg 'getTournamentScoreRounds' src/app/api/leaderboard/
   # Should return no matches

   rg 'rankEntries\b' src/app/api/leaderboard/
   # Should return no matches (only rankEntriesWithHoles)
   ```

2. **Test existence:**
   ```bash
   rg 'tournament_holes.*rankEntriesWithHoles|rankEntriesWithHoles.*tournament_holes' src/
   # Should find test confirming the correct path
   ```

3. **Response shape verification:**
   - Fetch `GET /api/leaderboard/[poolId]` and confirm `entries` contain `totalScore`, `totalBirdies`, `rank`, `isTied` from `rankEntriesWithHoles`
   - No `holeId: 1` pseudo-hole records should appear in any response field

4. **Deprecated function check:**
   ```bash
   rg 'buildGolferRoundScoresMapFromScores' src/
   # Only occurrences should be the function definition and its @deprecated JSDoc
   ```