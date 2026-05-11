# Implementation Plan: Issue #48 — Hole-by-Hole Best-Ball Scoring

## Goal

Make the live scoring path implement the intended MVP: hole-by-hole best-ball driven by Slash Golf scorecards, persisted to `tournament_holes`, ranked from hole-level data, with correct status handling across all code paths.

## Non-Goals

- season-long scoring
- all-tournament expansion
- pricing / payment work
- major UI redesign
- provider migration away from Slash Golf

## Affected Files

```
src/lib/slash-golf/client.ts
src/lib/slash-golf/types.ts
src/lib/scoring-refresh.ts
src/lib/scoring.ts
src/lib/scoring/domain.ts
src/lib/scoring-queries.ts
src/lib/supabase/types.ts
src/app/api/scoring/route.ts
src/app/api/leaderboard/[poolId]/route.ts
src/lib/__tests__/slash-golf-client.test.ts
src/lib/__tests__/slash-golf-client-edge-cases.test.ts
src/lib/__tests__/scoring-refresh.test.ts
src/lib/__tests__/scoring-refresh-edge-cases.test.ts
src/lib/__tests__/domain-scoring.test.ts
src/lib/__tests__/scoring.test.ts
```

## Ordered Implementation Tasks

### Task 1 — Fix getScorecard() parsing against real Slash Golf API contract

**File:** `src/lib/slash-golf/client.ts`

The current `normalizeScorecardResponse()` handles three shapes (flat array, `scorecards` wrapper, single object), but the issue notes the API may return an array of scorecards when `roundId` is not specified. Verify and harden the response normalization to:
- Handle when response is a bare array of scorecard objects
- Handle when response is `{ scorecards: [...] }` 
- Handle when response is a single scorecard object
- Handle when `roundId` is missing on the first scorecard (use `raw.roundId` fallback)
- Discard scorecards with no holes

Update `parseMongoNumber` usage for `roundId` extraction — it should not fall back to `1` when `roundId` is legitimately absent; it should use the outer `raw.roundId`.

**Assumption:** If `rawScorecards.length > 1`, use each scorecard's own `roundId`. If only one scorecard, fall back to `raw.roundId ?? 1`.

---

### Task 2 — Add fixture-based tests for scorecard parsing

**File:** `src/lib/__tests__/slash-golf-client-edge-cases.test.ts` (or a new `slash-golf-scorecard-fixtures.test.ts`)

Create fixture-based tests using real sample responses captured from the Slash Golf API:
- Single-round scorecard response (bare object with 18 holes)
- Multi-round scorecard response (bare array of round scorecards)
- Wrapped `{ scorecards: [...] }` response
- Response where `roundId` is absent on scorecards and must come from outer `raw.roundId`
- Response where some scorecards have empty `holes` arrays
- Response with MongoDB `$numberInt` wrappers in holes

---

### Task 3 — Normalize statuses consistently across all code paths

**File:** `src/lib/slash-golf/client.ts`

The `normalizeGolferStatus()` (used in `getTournamentScores`) currently maps unknown statuses to `'active'`. This loses information — for example, `'dq'` and `'complete'` are normalized but then overwritten to `'active'`.

Fix `normalizeGolferStatus()` to preserve all five statuses:
```typescript
function normalizeGolferStatus(value: unknown): 'active' | 'withdrawn' | 'cut' | 'dq' | 'complete' {
  if (value === 'withdrawn' || value === 'cut' || value === 'dq' || value === 'complete') return value
  return 'active'
}
```

Also fix `normalizeSlashStatus()` (used in `getLeaderboard` and `getScorecard`) to match — it already handles `'dq'` and `'complete'`, but verify consistency.

Check `scoring-refresh.ts` — `golferStatuses` map is built from `allScores` which comes from `getScoresForTournament`, which should now correctly contain the full status set.

---

### Task 4 — Verify scorecard → TournamentHole mapping and persistence

**File:** `src/lib/scoring-refresh.ts` (function `scorecardToTournamentHoles`)

The current `scorecardToTournamentHoles()` maps all holes from all scorecards into a flat array, using `scorecard.roundId` as the `round_id`. When multiple scorecards are returned (one per round), each round's holes are mapped with that scorecard's `roundId`.

**Verify** the roundId assignment: If `getScorecard()` returns 2 scorecards (round 1 and round 2), the merged `allHoles` in `getScorecard()` already has holes from each round. The `scorecardToTournamentHoles()` uses `scorecard.roundId` per-hole which is correct because the holes are already deduplicated per-round in the API response.

**Risk:** If the API returns scorecards with the same `holeId` across rounds (e.g., hole 1 in round 1 and hole 1 in round 2), the current code correctly uses `roundId` as part of the upsert key (`golfer_id,tournament_id,round_id,hole_id`), so each round's hole is a separate row. This is correct.

**Edge case to handle:** `scorecardToTournamentHoles` receives a `roundId` that is the first scorecard's roundId when multiple scorecards are present. Since `getScorecard` flattens holes from all scorecards into one `SlashScorecard.holes` array but only keeps `first.roundId`, this could assign wrong `round_id` to holes from later rounds. Fix: pass the per-scorecard `roundId` when mapping each scorecard's holes.

Fix `getScorecard()` to return the full array of `SlashScorecard` objects (or add a new function `getScorecards()` that returns the raw array), then update `scorecardToTournamentHoles` in scoring-refresh to map each scorecard's holes with its correct `roundId`.

---

### Task 5 — Ensure live ranking path uses hole-level data exclusively

**File:** `src/lib/scoring-refresh.ts`

The refresh flow (line 225) already calls `rankEntriesWithHoles(entries, holesByGolfer, golferStatuses, completedRounds)`. This is the correct production path.

**Verify** that no code path can accidentally use the deprecated `rankEntries()` or `rankEntriesLegacy()`. Audit all call sites:
- Search for `rankEntries` and `rankEntriesLegacy` usages
- Confirm all live ranking goes through `rankEntriesWithHoles`
- Confirm `buildGolferRoundScoresMapFromScores` is unreachable in production code

**Task 5a:** Add a runtime guard in `scoring-refresh.ts` that asserts `holesByGolfer` is non-empty before calling `rankEntriesWithHoles`. If `holesByGolfer` is empty (no scorecards persisted), log a warning — this means the scorecard fetch failed silently for all golfers and ranking would be based on stale data.

---

### Task 6 — Remove or quarantine legacy aggregate scoring code

**File:** `src/lib/scoring.ts`

The following are deprecated and should be removed from production use:
- `buildGolferRoundScoresMapFromScores()` (lines 86-98) — remove entirely
- `rankEntriesLegacy()` (lines 113-146) — remove entirely
- `rankEntries()` (lines 100-107) — remove entirely (it delegates to the deprecated path)

After removal, `scoring.ts` should export only:
- `getRoundScore()` — keep (used by `calculateEntryTotalScore`)
- `calculateEntryTotalScore()` — keep for compatibility but note it's not used in live path
- `getEntryRoundScore()` — keep (used by picks UI)
- `calculateEntryBirdies()` — keep (used by picks UI)
- `deriveCompletedRounds()` — keep (used by `scoring-refresh.ts`)
- `buildGolferRoundScoresMap()` — keep (used by `rankEntriesWithHoles`)
- `rankEntriesWithHoles()` — keep (production path)

Update all imports in `src/app/api/leaderboard/[poolId]/route.ts` and any other consumers to remove references to the deleted functions.

---

### Task 7 — Fix or remove /stats client

**File:** `src/lib/slash-golf/client.ts`

`getStats()` is already marked `@deprecated`. The issue says the contract is wrong and it's unused.

**Decision:** Remove `getStats()` entirely from the client and remove all references to it. If needed in the future, implement against real API response shapes with fixture tests.

Also remove:
- `SlashStats` type from `src/lib/slash-golf/types.ts`
- Any imports of `getStats` in test files
- Any `getStats` mocks in test files

---

### Task 8 — Add integration test proving scorecards drive live ranking

**File:** `src/lib/__tests__/scoring-refresh-edge-cases.test.ts`

Add a test that:
1. Mocks `getTournamentScores` returning 2 golfers with round-level scores
2. Mocks `getScorecard` returning 18-hole scorecards for each golfer with known `scoreToPar` values
3. Mocks `getTournamentHolesForGolfers` returning the persisted holes
4. Calls `refreshScoresForPool`
5. Verifies `rankEntriesWithHoles` was called with the correct `holesByGolfer` map (not round-level aggregates)
6. Verifies the broadcast payload contains correctly ranked entries based on hole-by-hole best-ball

This proves the live path uses scorecards, not round aggregates.

---

## Tests to Add or Update

| Test File | Tests to Add |
|-----------|-------------|
| `src/lib/__tests__/slash-golf-client-edge-cases.test.ts` | Fixture-based scorecard parsing tests covering all response shapes |
| `src/lib/__tests__/scoring-refresh-edge-cases.test.ts` | Integration test proving scorecards → holes → ranking pipeline |
| `src/lib/__tests__/slash-golf-client.test.ts` | Update status normalization tests for `dq` and `complete` |
| `src/lib/__tests__/scoring.test.ts` | Remove tests for deprecated functions when those functions are removed |

## Validation Commands

```bash
# Run all tests
npm test

# Run scoring-specific tests
npm test -- --grep "scoring\|scorecard\|refresh"

# Run slash-golf client tests
npm test -- src/lib/__tests__/slash-golf-client.test.ts

# Run domain scoring tests
npm test -- src/lib/__tests__/domain-scoring.test.ts

# Type check
npm run typecheck

# Lint
npm run lint

# Build
npm run build
```

## Risk Areas

1. **Scorecard roundId assignment**: When `getScorecard()` returns multiple scorecards (multiple rounds), the `roundId` assigned to holes from later rounds may be incorrect if `getScorecard()` only returns the first scorecard's roundId. This is the highest-risk item — fix in Task 4.

2. **Silent scorecard failures**: Per-golfer scorecard errors are caught and ignored (`catch {}`). If all scorecard fetches fail, `holesByGolfer` will be empty and ranking will be based on stale `tournament_scores` data. The runtime guard in Task 5a addresses this.

3. **Status normalization propagation**: Fixing `normalizeGolferStatus` to preserve `dq` and `complete` must be propagated correctly to `tournament_scores.status` column and then to `golferStatuses` map used in ranking.

4. **Legacy function removal**: Removing `rankEntries()` which may be imported in route handlers. Must audit all imports first.

5. **Supabase real-time broadcast**: After ranking, the broadcast must include the fresh `ranked` entries from `rankEntriesWithHoles`. No changes expected but should verify the payload shape.

## Stop Conditions

**Abort and escalate if any of these occur:**

1. The Slash Golf API response shape for `/scorecard` is substantively different from what the current normalization handles, requiring a breaking contract change. Document the actual shape and create a new issue.

2. Removing `rankEntries()` or `rankEntriesLegacy()` would break a code path that is actually used in production (not just importable). If found, quarantine those functions with `@deprecated` comments and an explicit `throw new Error('Do not call')` instead of removing.

3. The `tournament_holes` table schema or the `upsertTournamentHoles` on-conflict configuration does not support per-round hole rows with the same `hole_id` across different `round_id` values. Check migration files in `supabase/migrations/` if this is suspected.

4. Running `npm test` shows new failures in existing tests that would require nontrivial changes to fix (vs. expected failures from removing deprecated functions). Keep the deprecated functions and mark them non-production instead of removing, pending a cleanup PR.