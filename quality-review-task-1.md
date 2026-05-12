# Quality Review — Task 1: Multi-round Hole Overlap Regression Test

## Diff Summary
Single file changed: `src/app/api/leaderboard/[poolId]/route.test.ts` (+58 lines)
- Adds regression test `'does not collapse hole IDs across different rounds'`

---

## Strengths

1. **Targeted regression coverage** — Test explicitly verifies that `(roundId, holeId)` pairs are preserved, preventing pseudo-hole collapse where hole_id=1 from round 1 and hole_id=1 from round 2 would incorrectly merge into one entry.

2. **Correct mock setup** — Uses `vi.mocked` correctly for `getTournamentHolesForGolfers` and `rankEntriesWithHoles`. The `holesByGolfer` Map is constructed with two `TournamentHole` objects for the same golfer — round_id 1 and round_id 2, both with hole_id 1 — which directly exercises the edge case.

3. **Precise assertion** — Validates `golferHoles?.length === 2` and separately finds `round1` and `round2` via `.find()`, confirming each has `hole_id === 1`. This is the right way to assert the two holes are distinct.

4. **Follows existing test patterns** — Uses the same mock structure (`vi.mocked(createClient).mockResolvedValue(...)`) and fixture shape as the other tests in the file.

5. **Lint passes** — `npm run lint` returns no errors.

6. **Grep verifications pass** — `route.ts` has:
   - 0 references to `tournament_score_rounds` or `getTournamentScoreRounds` (no stale round-level reads)
   - 0 bare `rankEntries` imports (only `rankEntriesWithHoles` is used)
   - `tournament_holes` / `getTournamentHolesForGolfers` properly imported and called

---

## Issues

**None identified.** The change is a pure addition — a single regression test with no side effects.

---

## Pre-existing Failures (Not Introduced by This Diff)

16 tests fail in the full suite, but none are in the changed file. The failures are in:

| File | Failure Type | Likely Root Cause |
|------|-------------|-------------------|
| `scoring-edge-cases.test.ts` (×2) | `totalScore` returns `null` instead of `0` | Edge case where all rounds incomplete — pre-existing |
| `scoring-refresh-edge-cases.test.ts` (×6) | Mock missing `updatePoolRefreshTelemetry` export | Partial mock of `pool-queries` — pre-existing |
| `LockBanner.test.tsx` (×2) | Expects `amber` colors, gets `green` | Token migration incomplete — pre-existing |
| `SpectatorLeaderboard.test.tsx` | Expects no `gray-*` tokens | Token migration incomplete — pre-existing |
| `scoring/route.test.ts` (×2) | 500 status, mock not called | Mock setup issue — pre-existing |
| `JoinPoolForm.test.tsx` (×3) | `useFormState` not iterable | React hook mock issue — pre-existing |

The leaderboard route tests (the file this diff modifies) **all pass**: 7/7.

---

## Assessment

**APPROVED**

The diff adds a well-targeted regression test that correctly validates the `(roundId, holeId)` composite key uniqueness. No implementation code changed. The test follows existing patterns and the file's other 6 tests all pass. The 16 pre-existing failures are in unrelated files and were not introduced by this change.