# Spec Review — Issue #51 Task 2 & 3 & 4

## Task 2: route.ts stale references — ✅ PASS

| Check | Pattern | Result |
|-------|---------|--------|
| Step 1 | `tournament_score_rounds\|getTournamentScoreRounds` | 0 matches — PASS |
| Step 2 | `rankEntries[^W]\|from.*scoring/domain` | 0 matches — PASS (only `rankEntriesWithHoles` used) |
| Step 3 | `tournament_holes\|getTournamentHolesForGolfers` | 2 matches at lines 7,146 — PASS |

**Verdict:** `route.ts` correctly uses `tournament_holes` via `getTournamentHolesForGolfers` and `rankEntriesWithHoles`. No stale `tournament_score_rounds` or bare `rankEntries` references remain.

---

## Task 3: docs match hole-by-hole model — ❌ ISSUE FOUND

**README.md line 3:**
```
A commissioner-first web app for running private golf pools with live round-by-round scoring.
```

This phrase "round-by-round scoring" is ambiguous. It is not the same as "hole-by-hole" as described in `rules-spec.md` section 2.1. "Round-by-round" could be interpreted as round-level aggregation (score per round, then aggregate), which is NOT the implemented model.

The scoring description at README lines 80-83 correctly says "Hole-by-hole best-ball", so the inconsistency at line 3 creates a misleading first impression.

**rules-spec.md lines 56, 201** reference `src/lib/scoring/domain.ts:computeEntryScore` with a "round-level `isComplete` gating" comment. However, the path `src/lib/scoring/domain.ts` does not exist — the file is `src/lib/scoring/domain.ts` (no extra `scoring/` subdirectory). This is a documentation bug.

**rules-spec.md section 2.1 algorithm** (lines 25-35): correctly describes hole-by-hole best-ball. No round-level `min(scoreToPar)` aggregation is present in the algorithm text.

**Recommendation:** Update README line 3 to say "live hole-by-hole scoring" or "live scoring" to be consistent with the actual model and README's own line 80 wording.

---

## Task 4: regression test — ❌ ISSUES FOUND

The proposed test at lines 328-359 has multiple problems:

### Problem 1: Wrong assertion data structure

The test expects `callArg` to be `Record<string, Record<string, GolfHoleData>>` keyed by `roundId → holeId`, then checks `holeData[1].1` and `holeData[2].1`.

But `rankEntriesWithHoles` (src/lib/scoring.ts:123-131) calls `buildGolferRoundScoresMap(holesByGolfer, golferStatuses)` which transforms the input into `GolferRoundScoresMap` — a `Map<golferId, Array<{roundId, holeId, scoreToPar, status, isComplete}>>`.

So `mockRankEntriesWithHoles.mock.calls[0][0]` is the raw `holesByGolfer` map (first arg), but the test's expected shape `Record<roundId, Record<holeId, GolfHoleData>>` is never what `buildGolferRoundScoresMap` produces. The test assertion would always fail against the actual implementation.

### Problem 2: `mockRankEntriesWithHoles.mock` doesn't exist

The route.test.ts uses `vi.mock('@/lib/scoring', () => ({ rankEntriesWithHoles: mockRankEntriesWithHoles }))`. When you do `vi.mock` with a factory, the exported value (`mockRankEntriesWithHoles`) is the actual mock function — it has a `.mock` property because it's a vi.fn(). But the import alias `rankEntriesWithHoles` inside the module under test is what gets called, and the factory gives it the variable name `mockRankEntriesWithHoles`.

Actually, this works — the mock function set up in the factory has a `.mock` property. So this is probably fine.

### Problem 3: The test cannot run in the actual codebase

The test file at line 328 already has an overlapping-holes test (different name: "ranks entries from tournament_holes via rankEntriesWithHoles, not tournament_score_rounds"). The proposed test would be a duplicate that would fail against the actual `buildGolferRoundScoresMap` output structure.

**Verdict:** The regression test as specified would not pass because its shape assertion (`holeData[1].1`) doesn't match how `buildGolferRoundScoresMap` structures data.

---

## Summary

| Task | Status | Notes |
|------|--------|-------|
| Task 2 | ✅ PASS | route.ts correctly migrated |
| Task 3 | ❌ ISSUE | README line 3 "round-by-round" inconsistent with hole-by-hole model; rules-spec path reference has wrong directory structure |
| Task 4 | ❌ ISSUE | Test data shape mismatch with `buildGolferRoundScoresMap` output; assertion `holeData[1].1` won't match actual Map structure |