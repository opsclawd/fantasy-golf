# Code Review: ai/issue-51 — Ninth Revalidation

## Review Basis

- **Branch:** ai/issue-51
- **Base:** origin/main
- **Issue:** #51 — Align leaderboard GET with hole-by-hole best-ball
- **Revalidation of:** ./review.md (eighth revalidation), ./revalidate-9.log

---

## Build/Lint/Test Status

| Check | Result | Notes |
|-------|--------|-------|
| `pnpm build` | PASS | Compiled successfully |
| `pnpm lint` | PASS | No ESLint warnings or errors |
| `pnpm typecheck` | FAIL | 64 TypeScript errors (all in design-tokens.test.ts — pre-existing) |
| `pnpm test` | PASS | 468 passed, 1 skipped |

### typecheck Errors

64 errors, **all** in `src/lib/__tests__/design-tokens.test.ts`. Pre-existing tailwind config typing issues unrelated to this PR. No implementation files have type errors. Same as prior review — no regression.

---

## Acceptance Criteria Verification

| Criterion | Status | Verification |
|-----------|--------|--------------|
| `GET /api/leaderboard/[poolId]` ranks from `tournament_holes` | **FIXED** | `route.ts:146` calls `getTournamentHolesForGolfers(...)` — verified by direct file read |
| `GET /api/leaderboard/[poolId]` no longer builds fake `holeId: 1` records | **FIXED** | `getTournamentScoreRounds` absent from scoring-queries.ts (file ends at line 143) |
| Normal page load and realtime paths use same scoring model | **FIXED** | Both paths at `route.ts:105` (empty scores) and `route.ts:148` (with scores) use `rankEntriesWithHoles` |
| README no longer says round-based best-ball | **FIXED** | README.md line 3: "hole-by-hole scoring" |
| `docs/rules-spec.md` no longer defines scoring as round-level | **FIXED** | Section 2.1 describes per-hole algorithm (lines 25–37) |
| Tests cover the corrected leaderboard GET path | **FIXED** | Three tests at `route.test.ts:329, 398, 438` confirmed by direct file read |

---

## Implementation Review

### route.ts — `GET /api/leaderboard/[poolId]`

All original findings verified against current source at line references:

| Line | Finding | Status |
|------|---------|--------|
| 3 | `rankEntriesWithHoles` imported from `@/lib/scoring` | **FIXED** |
| 7 | `getTournamentHolesForGolfers` from `@/lib/scoring-queries` | **FIXED** |
| 96–102 | `allGolferIds` collected before scores query | **FIXED** |
| 105 | `rankEntriesWithHoles(entries, new Map(), new Map(), 0)` for empty scores | **FIXED** |
| 126 | `golferStatuses` as `Map<string, 'active' \| 'cut' \| 'withdrawn'>` | **FIXED** |
| 146 | `getTournamentHolesForGolfers(supabase, pool.tournament_id, Array.from(allGolferIds))` | **FIXED** |
| 148 | `rankEntriesWithHoles(entries, holesByGolfer, golferStatuses, completedRounds)` | **FIXED** |
| 159 | `Object.fromEntries(golferStatuses)` | **FIXED** |

**Assessment:** FIXED. All line references verified against actual source.

### route.test.ts — Tests

| Line | Test | Status |
|------|------|--------|
| 329 | "ranks entries from tournament_holes via rankEntriesWithHoles, not tournament_score_rounds" | **FIXED** |
| 398 | "does NOT call rankEntries (round-level)" with `domainRankEntries.not.toHaveBeenCalled()` | **FIXED** |
| 438 | "does not collapse hole IDs across different rounds" | **FIXED** |

**Assessment:** FIXED. All three tests confirmed in source.

### scoring-queries.ts

| Finding | Status |
|---------|--------|
| `getTournamentScoreRounds` removed (was round-level aggregation) | **FIXED** — file ends at line 143, function not present |

---

## Original Findings Summary

| Finding | Status |
|---------|--------|
| All 6 acceptance criteria | **FIXED** |
| route.ts implementation | **FIXED** |
| route.test.ts coverage | **FIXED** |
| README.md updates | **FIXED** |
| docs/rules-spec.md updates | **FIXED** |
| Removed getTournamentScoreRounds | **FIXED** |
| Removed deprecated scoring exports | **FIXED** |
| Build passes | **FIXED** |
| Lint passes | **FIXED** |
| Tests pass | **FIXED** |
| typecheck configured | **NOT FIXED** (pre-existing, still no script in package.json — though the command itself runs) |

---

## Carried-Forward Minor Issues (unchanged from prior review)

### 1. `rankEntriesLegacy` still present in scoring.ts (Minor)

**File:** `src/lib/scoring.ts:88–121`

Deprecated function with fake `holeId: 1` round-level aggregation logic remains exported. Marked `@deprecated` but not removed.

**Risk:** Low — correctly guarded with deprecation comment, leaderboard GET no longer calls it.

**Current usage:** Only imported in `src/lib/__tests__/scoring.test.ts:6` for backward-compatibility test coverage.

**Recommendation:** Consider removing if no production imports exist. Verify with `grep` confirms only test file imports remain.

### 2. `pnpm typecheck` failures in test files (Minor)

64 TypeScript errors, all in `src/lib/__tests__/design-tokens.test.ts`. Pre-existing tailwind config typing issues unrelated to this PR.

**Recommendation:** Fix design-tokens.test.ts types as a separate cleanup task. Not a merge blocker.

---

## New Issues

None discovered.

---

## Recommendation

**Ready to merge.** All original acceptance criteria verified fixed. Minor issues remain, none blocking:

1. **Minor:** `rankEntriesLegacy` deprecated function — low risk, only test coverage remains
2. **Minor:** typecheck errors in test files only — pre-existing, not a regression

Build, lint, and all 468 tests pass. Implementation is correct. typecheck failures are exclusively in test files and do not affect production behavior.

(End of file)