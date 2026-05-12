# Design: Align Leaderboard with Hole-by-Hole Best-Ball Scoring

## Problem

The `GET /api/leaderboard/[poolId]` endpoint and documentation contradict the hole-by-hole best-ball model implemented in the refresh path.

### Split-brain scoring

The scoring architecture now has two divergent paths:

| Path | Data source | Scoring model |
|------|-------------|---------------|
| Refresh/broadcast | `tournament_holes` via `getTournamentHolesForGolfers` | True hole-by-hole best-ball |
| **Leaderboard GET** | `tournament_score_rounds` via `getTournamentScoreRounds` | Round-level pseudo-hole (`holeId: 1`) |

This split causes the most user-visible endpoint to display different scores than what the refresh path produces.

### Evidence

1. **`route.ts` lines 148–161**: Builds `golferRoundScoresMap` from `getTournamentScoreRounds`, mapping every round to a single fake hole (`holeId: 1`). Calls `rankEntries`, not `rankEntriesWithHoles`.

2. **README line 80**: "Round-based best-ball (lowest score among 4 golfers per completed round)" — contradicts the hole-by-hole spec.

3. **`docs/rules-spec.md` line 30–31**: Defines scoring as round-level min aggregation, not hole-by-hole.

4. **`scoring.ts` line 53–55**: `buildGolferRoundScoresMapFromScores` is marked `@deprecated Non-production`. The live leaderboard still uses it.

---

## Why It Matters

A commissioner running a live pool sees different rankings depending on which path their client hits. Participants see different scores on the leaderboard than what the broadcast refresh produces. The documentation misrepresents the product to new users and during handoff.

---

## Design Decision: Migrate Leaderboard GET to Hole-by-Hole

### Option A: Migrate leaderboard GET to `rankEntriesWithHoles` (recommended)

Fetch `tournament_holes` for rostered golfers via `getTournamentHolesForGolfers`, build `golferStatuses` from `tournament_scores`, call `rankEntriesWithHoles`.

**Trade-offs:**
- ✅ Consistent with refresh path — same data source, same scoring function
- ✅ Uses the production-deployed `tournament_holes` table
- ✅ `rankEntriesWithHoles` already exists and is tested
- ⚠️ Requires `tournament_holes` to be populated — depends on refresh path populating it

### Option B: Dual-mode fallback

If `tournament_holes` is empty for a golfer, fall back to `tournament_score_rounds`. Keep both paths.

**Trade-offs:**
- ✅ More resilient if `tournament_holes` is partially populated
- ⚠️ Maintains two code paths, doubling future regression risk
- ⚠️ Hides data quality issues instead of surfacing them

### Option C: Do nothing

Keep round-level scoring for leaderboard, add hole-level display on picks page only.

**Trade-offs:**
- ⚠️ Split-brain persists on the most visible endpoint
- ⚠️ Does not address the stated goal of "consistent" paths

**Decision: Option A.** The refresh path already populates `tournament_holes`. The leaderboard should use it.

---

## Proposed Approach

### A. Fix `GET /api/leaderboard/[poolId]`

1. Remove `getTournamentScoreRounds` import and call
2. Keep `tournament_scores` query — still needed for `golferStatuses` and `golferScores`
3. After fetching entries, collect all rostered `golfer_ids`
4. Call `getTournamentHolesForGolfers(supabase, pool.tournament_id, allGolferIds)` to get real hole data
5. Build `golferStatuses` map from `allScores`
6. Call `rankEntriesWithHoles(entries, holesByGolfer, golferStatuses, completedRounds)` instead of `rankEntries`
7. Keep response contract intact — all existing fields preserved

Key impl note: `rankEntriesWithHoles` takes `golferStatuses` as a `Map<string, GolferStatus>` (not a plain object), so build it as `Map<string, 'active' | 'cut' | 'withdrawn'>`.

### B. Update documentation

- **README.md line 80**: Replace "Round-based best-ball (lowest score among 4 golfers per completed round)" with "Hole-by-hole best-ball (lowest score-to-par per hole among active golfers)"
- **docs/rules-spec.md section 2.1**: The conceptual description in lines 25–32 is already correct (says "Best Ball, Hole-by-Hole") but the pseudo-code block contradicts it. Fix the pseudo-code block to reflect hole-level computation.

### C. Add regression tests

In `route.test.ts`:
- Add mock for `getTournamentHolesForGolfers`
- Assert that with a fixture of two rounds with overlapping hole IDs, the endpoint produces ranked entries from `tournament_holes`, not from `tournament_score_rounds`
- Assert `getTournamentHolesForGolfers` is called (not `getTournamentScoreRounds`)

---

## Assumptions

1. **`tournament_holes` is populated** by the refresh path before the leaderboard GET is called. If `tournament_holes` is empty (no refresh has run yet), the leaderboard returns entries with `totalScore: null` — acceptable fallback behavior.

2. **`scoring-refresh.ts` correctly populates `tournament_holes`** — verified separately in existing tests.

3. **`rankEntriesWithHoles` output shape matches the leaderboard response contract** — it returns `Entry & { totalScore, totalBirdies, rank, isTied }` which is compatible with the existing `entries` field in the response.

4. **`completedRounds` can be derived from `tournament_holes` data** — if the leaderboard has only `tournament_holes` and no `tournament_scores`, use `deriveCompletedRounds` on holes instead of scores. The refresh path uses a separate `completedRounds` derivation; the leaderboard should match that behavior.

5. **`tournament_holes` table exists and `getTournamentHolesForGolfers` is implemented** — per `supabase/migrations/20260425190000_create_tournament_holes.sql` and `scoring-queries.ts:133`.

---

## In Scope

- `src/app/api/leaderboard/[poolId]/route.ts` — migrate to hole-level ranking
- `README.md` — update scoring model description
- `docs/rules-spec.md` — fix contradictory pseudo-code
- `src/app/api/leaderboard/[poolId]/route.test.ts` — add regression coverage

## Out of Scope

- Replacing Slash Golf API
- Season-long scoring
- UI redesign
- Modifying refresh lock behavior
- Changing `scoring-refresh.ts` (already correct)
- Creating new migration (table already exists)

---

## Risks and Concerns

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `tournament_holes` not populated yet (fresh DB) → leaderboard shows null scores | Medium | Acceptable; refresh must run first to populate holes |
| `getTournamentHolesForGolfers` performance with large golfer sets | Low | Query uses `.in('golfer_id', golferIds)` with index; 4 golfers per entry is small |
| `rankEntriesWithHoles` signature mismatch with existing response fields | Low | Function returns `Entry & { totalScore, totalBirdies, rank, isTied }` — matches existing contract |
| Tests rely on `tournament_score_rounds` mocks — will break on change | High | Tests will be updated to mock `getTournamentHolesForGolfers` instead |