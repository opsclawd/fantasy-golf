# Spec Review: Task 3 - Implementation Verification

## Review Summary

**Date:** 2026-05-12
**Task:** Verify implementation matches rules-spec.md hole-by-hole scoring

---

## Step 1: rules-spec.md Scoring Description

**File:** `docs/rules-spec.md` lines 23–35

**Finding:** ✅ **Compliant**

Section 2.1 "Core Algorithm: Best Ball, Hole-by-Hole" correctly describes:
- Per-hole `scoreToPar` comparison among active golfers
- Lowest score-to-par wins the hole for the entry
- Birdies/eagles counted when `scoreToPar < 0`

---

## Step 2: Live API Path Uses Hole-Level Scoring

**Files checked:**
- `src/app/api/leaderboard/[poolId]/route.ts`
- `src/lib/scoring.ts`

**Findings:**

| Check | Result |
|-------|--------|
| `getTournamentScoreRounds` in `src/app/api/` | 0 matches — not used in live API |
| `rankEntriesWithHoles` in `route.ts:148` | ✅ Correct — uses hole-level data |
| `holesByGolfer` fetched at `route.ts:146` | ✅ `getTournamentHolesForGolfers` — hole-level |

The implementation correctly routes through `rankEntriesWithHoles` with `holesByGolfer` data, not round-level `tournament_score_rounds`.

---

## Step 3: Test Coverage

**File:** `src/app/api/leaderboard/[poolId]/route.test.ts:328`

**Test name:** `ranks entries from tournament_holes via rankEntriesWithHoles, not tournament_score_rounds`

**Result:** ✅ PASS (7/7 tests passed)

---

## Conclusion

✅ **Spec compliant** — Implementation correctly uses hole-by-hole best-ball scoring as specified in rules-spec.md Section 2.1. No deviations found.
