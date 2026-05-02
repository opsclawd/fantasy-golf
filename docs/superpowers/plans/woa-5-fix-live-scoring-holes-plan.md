# WOA-5 Plan: Fix Live Scoring — Hole-by-Hole Best Ball

## Context

The issue: [opsclawd/fantasy-golf#48](https://github.com/opsclawd/fantasy-golf/issues/48)

Existing design artifacts:
- `docs/superpowers/specs/ops-52-call-strategy.md` — endpoint strategy, rate limiting, scorecard fetch decision rules
- `docs/superpowers/plans/2026-04-27-ops-52-slash-golf-scorecard-driven-scoring-flow-plan.md` — scorecard client + call strategy implementation tasks

The infrastructure exists:
- `getScorecard()` in `client.ts` — has bugs (array response not handled, roundId not extracted)
- `upsertTournamentHoles()` in `scoring-queries.ts` — exists, works
- `rankEntriesWithHoles()` in `scoring.ts` — exists, correct
- `TournamentHole` type in `supabase/types.ts` — defined

What is broken:
1. `refreshScoresForPool()` uses round aggregates (`tournament_score_rounds` with `holeId: 1`) for ranking — not hole-level
2. Scorecard parser doesn't handle per-round array responses from Slash Golf API
3. `normalizeGolferStatus` only handles 3 states; `normalizeSlashStatus` handles 5 — inconsistency in the normalization path used by `getTournamentScores`
4. Status normalization in `getTournamentScores` doesn't preserve `dq`/`complete`

## Scope

### A. Fix scorecard ingestion
- Fix `getScorecard()` to handle per-round array responses from Slash Golf `/scorecard`
- Extract `roundId` from response (currently missing)
- Add fixture-based tests

### B. Wire scorecards into refresh
- `refreshScoresForPool()` fetches scorecards for relevant golfers
- Maps scorecards → `TournamentHole[]` via `upsertTournamentHoles()`
- Uses `rankEntriesWithHoles()` instead of round-based ranking

### C. Fix status normalization
- Make `normalizeTournamentScores` use 5-state normalization (`dq`, `complete`)
- Unify status handling across `getTournamentScores`, `getLeaderboard`, `getScorecard`

### D. Clean up legacy code
- Mark `buildGolferRoundScoresMapFromScores` and `rankEntriesLegacy` clearly as non-production

### E. Fix or remove `/stats` client
- Remove misleading implementation; mark as out-of-scope until needed

## Implementation Order

1. Fix `getScorecard()` array response handling + add roundId extraction
2. Fix status normalization in `normalizeTournamentScores` (use 5-state)
3. Add scorecard-to-holes mapping function
4. Update `refreshScoresForPool()` to fetch scorecards and use hole-level ranking
5. Mark legacy functions clearly
6. Fix/remove `getStats`
7. Run tests, verify, commit

## Files to Change

| File | Change |
|------|--------|
| `src/lib/slash-golf/client.ts` | Fix `getScorecard()` for array responses; fix status normalization |
| `src/lib/scoring-refresh.ts` | Wire scorecard fetch + `rankEntriesWithHoles` into refresh pipeline |
| `src/lib/scoring-queries.ts` | Add `getTournamentHolesForGolfers` if not present |
| `src/lib/scoring.ts` | Mark legacy functions as non-production |
| `src/lib/__tests__/slash-golf-client.test.ts` | Add scorecard array response tests |
| `src/lib/__tests__/scoring-refresh.test.ts` | Add hole-level refresh tests |
| `fixtures/slash-golf/scorecard-STUB.json` | Replace stub with fixture matching real API response shape |

## Verification

- `npx vitest run src/lib/__tests__/slash-golf-client.test.ts src/lib/__tests__/scoring-refresh.test.ts` — all pass
- `npx tsc --noEmit` — no errors
- Live refresh flow: scorecards fetched → holes persisted → entries ranked from hole data (unit-test proven)