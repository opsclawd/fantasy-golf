# Spec Review: Hole-by-Hole Migration

## Task 1: Route Tests — ✅ PASS
- Test at line 328: `rankEntriesWithHoles` is called. Confirmed.
- Test at line 397: `getTournamentScoreRounds` is NOT called. Confirmed via `domainRankEntries` mock check.
- Test at line 437: Multi-round hole overlap regression test present. Confirmed.

All 7 tests pass.

## Task 2: route.ts — ✅ PASS
- `tournament_score_rounds` / `getTournamentScoreRounds`: 0 matches. Confirmed.
- `rankEntries[^W]` / bare `rankEntries` from scoring domain: 0 matches. Confirmed.
- `tournament_holes` / `getTournamentHolesForGolfers`: 2 matches (import + call). Confirmed.

## Task 3: docs/rules-spec.md — ⚠️ ISSUES FOUND

### Issue 1: README.md tagline uses deprecated term
- **File:** `README.md:3`
- **Finding:** `round-by-round scoring` in tagline contradicts `Hole-by-hole` claim at line 80
- **Spec reference:** "Hole-by-hole best-ball" (line 80) is correct; tagline should match

### Issue 2: rules-spec.md references legacy paths
- **File:** `docs/rules-spec.md:56`
  - **Text:** `src/lib/scoring/domain.ts:computeEntryScore` (round-level `isComplete` gating at lines 90–95)
  - **Problem:** `domain.ts` doesn't exist in current structure; scoring logic is in `scoring.ts`
- **File:** `docs/rules-spec.md:201`
  - **Text:** `tournament_score_rounds` mentioned as archival sink
  - **Problem:** While the table still exists structurally, the docs describe it as the scoring source (round-level aggregation), which was replaced by `tournament_holes`

### Issue 3: rules-spec.md section 2.1 algorithm is correct but source refs are stale
- Section 2.1 describes hole-by-hole algorithm correctly
- Source citation `domain.ts:computeEntryScore` is stale — actual implementation is in `scoring.ts`

## Summary
- **Spec compliant (implementation):** ✅ route.ts and route.test.ts fully match hole-by-hole model
- **Spec compliant (documentation):** ❌ `README.md` tagline and `rules-spec.md` source references are stale

## Action Items
1. Fix `README.md:3` tagline: "round-by-round" → "hole-by-hole"
2. Update `docs/rules-spec.md:56` source path: `domain.ts` → `scoring.ts`
3. Update `docs/rules-spec.md:201` framing: `tournament_score_rounds` is archival only, not the live scoring source