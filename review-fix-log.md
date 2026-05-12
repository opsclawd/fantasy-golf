# Review Fix Log — Loop 2

## Finding: `typecheck` script missing from package.json (Medium)
- **Status:** FIXED
- **Action:** Added `"typecheck": "tsc --noEmit"` to `package.json` scripts
- **Verification:** `pnpm typecheck` runs (pre-existing type errors in test files unrelated to issue-51 — not a regression)

## Finding: `rankEntriesLegacy` still present in scoring.ts (Minor)
- **Status:** NOT FIXED — Will Not Fix
- **Action:** Reviewed usage via grep — `rankEntriesLegacy` is imported and used by:
  - `src/app/(app)/commissioner/pools/[poolId]/audit/score-trace/page.tsx:5` — audit tooling
  - `src/lib/__tests__/scoring.test.ts:6` — test file
- **Rationale:** This function is intentionally preserved for the audit/score-trace tooling. It is marked `@deprecated` with clear documentation that it must not be used for production scoring. Removing it would break the audit page. The review's own recommendation was "remove entirely, OR at minimum verify it is not imported anywhere else" — the latter applies here. The function is not used in any production scoring path.

## Finding: Pre-existing typecheck failures in test files
- **Status:** NOT FIXED — Pre-existing
- **Action:** No changes made — these errors exist in test files unrelated to issue-51:
  - `design-tokens.test.ts` — tailwind theme typing issues
  - `scoring-edge-cases.test.ts` — missing `holeId` property
  - `scoring-queries.test.ts` — unexported `TournamentHole` type
  - `scoring-refresh-edge-cases.test.ts` — missing `rankEntriesWithHoles` export
  - `scoring.test.ts` — `round_score` property issue
- **Rationale:** These are pre-existing issues (noted in original review). Not regressions from this branch.