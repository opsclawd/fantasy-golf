# Review Fix Log — Issue #51 Loop 1

## Finding 1 — Critical: Wrong Deliverable
**Status:** Invalid — The previous worktree committed only orchestrator changes. The actual issue scope (README, rules-spec, leaderboard GET) was not touched in the prior loop. This worktree correctly implements the actual scope.

## Finding 2 — Critical: README.md Still Has Wrong Scoring Description
**Status:** Fixed
**Action:** Changed README.md line 3 from "round-by-round" to "hole-by-hole"
**Verification:** `rg "round-by-round|hole-by-hole" README.md docs/rules-spec.md` → only "hole-by-hole" hits remain

## Finding 3 — High: Plan Admitted It Was a No-Op
**Status:** Invalid — The plan (previous loop) was wrong to declare no code changes needed. However, code inspection of `src/app/api/leaderboard/[poolId]/route.ts` confirms it already uses `getTournamentHolesForGolfers` + `rankEntriesWithHoles`. The issue description was based on stale pre-work state. No code change to the GET path was actually needed.

## Finding 4 — High: No Test Verification Run
**Status:** Fixed
**Action:** Ran `npm test -- src/app/api/leaderboard/[poolId]/route.test.ts`
**Result:** 7 passed, 1 test file passed

## Finding 5 — Medium: docs/rules-spec.md Not Verified
**Status:** Invalid — docs/rules-spec.md already correctly describes hole-by-hole best-ball scoring (Section 2.1). The issue's claim of internal contradiction was incorrect — rules-spec.md says "Best Ball, Hole-by-Hole" and defines per-hole min scoreToPar, which is correct.

## Finding 6 — Low: Diff Only Modifies Orchestrator Script
**Status:** Invalid for this loop — This finding is about the previous loop's work. This worktree does not include orchestrator changes.

## Finding 7 — Low: Missing `review.md` in Expected Location
**Status:** Noted — review.md was provided at `./review.md` relative to the worktree root, which is the correct location for the next review pass.

## Summary of Actual Changes in This Loop
1. README.md line 3: "round-by-round" → "hole-by-hole"
2. Tests run and passing (7/7)
3. Verified `getTournamentScoreRounds` not used in live API code paths
4. Verified rules-spec.md already correct