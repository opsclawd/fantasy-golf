# Design: Align Leaderboard GET with True Hole-by-Hole Best-Ball

**Date:** 2026-05-12
**Issue:** #51 — Leaderboard GET uses round-based pseudo-hole path
**Status:** Draft

---

## 1. Problem Statement

The GitHub issue asserts that `GET /api/leaderboard/[poolId]` still uses round-level pseudo-hole scoring via `tournament_score_rounds`. However, **code analysis shows the endpoint already uses the correct hole-by-hole path**. The issue appears to have been written during a transition period, and the work may have been done in a prior commit.

The remaining gap is **documentation consistency** — `README.md` and `docs/rules-spec.md` contain language that either contradicts or ambiguously describes the scoring model.

**Why this matters:** Commissioners and participants reading public docs see "round-based best-ball" and round-level algorithm descriptions. This creates confusion about what the product actually does and undermines trust in the scoring system.

---

## 2. Code Analysis Findings

### 2.1 Leaderboard GET Endpoint — Already Correct

The current `src/app/api/leaderboard/[poolId]/route.ts` (lines 1–180) already implements the correct hole-by-hole path:

| Line | Operation | Data Source |
|------|-----------|-------------|
| 67–89 | Fetch pool entries | `entries` table |
| 91–123 | Fetch tournament scores for status/golfer display | `tournament_scores` (display only, not ranking) |
| 135–143 | Fetch golfer names | `tournament_roster` |
| 147 | Fetch hole data | `tournament_holes` via `getTournamentHolesForGolfers` |
| 149 | Rank entries | `rankEntriesWithHoles(entries, holesByGolfer, golferStatuses, completedRounds)` |

The endpoint **does not call** `getTournamentScoreRounds`. The `tournament_score_rounds` table is never referenced in the GET handler. The deprecated `buildGolferRoundScoresMapFromScores` (which created `holeId: 1` pseudo-holes) is only used in legacy audit tooling, not in the live scoring path.

### 2.2 Scoring Domain — Correctly Implements Hole-by-Hole

`src/lib/scoring/domain.ts:computeEntryScore` (lines 45–106) implements true hole-by-hole best-ball:

1. Indexes all hole scores by `"roundId-holeId"` key (line 59)
2. Enforces round completeness gating — a round only counts if **all** golfers have `isComplete: true` for that round (lines 72–82)
3. For each completed hole, selects the minimum `scoreToPar` among active golfers (lines 84–93)
4. Counts birdies when `scoreToPar < 0` (line 97)

This matches the algorithm described in `docs/rules-spec.md` section 2.1.

### 2.3 Test Coverage — Already Present

`src/app/api/leaderboard/[poolId]/route.test.ts` line 322–389 ("ranks entries from tournament_holes via rankEntriesWithHoles, not tournament_score_rounds") already validates:
- `getTournamentHolesForGolfers` is called (not `getTournamentScoreRounds`)
- `rankEntriesWithHoles` is called with the holes data
- Two rounds of overlapping hole IDs do not collapse into pseudo-holes

---

## 3. What the Issue Got Wrong (or Obsolete)

The issue's Section A ("Fix leaderboard GET endpoint") describes work that **appears to already be done**:

| Issue Claim | Current Code Reality |
|-------------|---------------------|
| "imports `rankEntries` from `src/lib/scoring/domain`" | Line 3 imports `rankEntriesWithHoles` from `@/lib/scoring` |
| "calls `getTournamentScoreRounds(...)`" | `getTournamentScoreRounds` is **not called** in the GET handler |
| "creates score entries with `holeId: 1`" | Only in deprecated `buildGolferRoundScoresMapFromScores`, not in the GET path |
| "calls `rankEntries(...)`" | Line 149 calls `rankEntriesWithHoles(...)` |

The GET handler was likely updated in a prior commit that migrated to the scoring refresh path, but the issue was written before that work was complete, or the issue author was looking at a stale branch.

---

## 4. Remaining Work: Documentation Alignment

### 4.1 `README.md` — Line 3 and Scoring Section

**Line 3** currently reads:
```
A commissioner-first web app for running private golf pools with live round-by-round scoring.
```

"round-by-round" is imprecise. Should remain "live hole-by-hole scoring" to match the feature description on line 80.

**Lines 78–83** currently read:
```
- **Hole-by-hole** best-ball (lowest score-to-par per hole among active golfers)
- Lower total score is better
- Tiebreaker: total birdies across all 4 golfers (higher is better)
- Cut and withdrawn golfers excluded after they occur
```

This is **correct**. The only fix needed is line 3 to say "hole-by-hole" instead of "round-by-round".

### 4.2 `docs/rules-spec.md` — Section 2 Algorithm Description

The issue notes that `docs/rules-spec.md` says "Best Ball, Hole-by-Hole" but then defines the algorithm as round-level aggregation. However, reading the document reveals the description (lines 30–35) actually **does** describe hole-by-hole:

```
For each regulation hole in each counted round:
  1. Look at the selected golfers in the entry who are active.
  2. Use the lowest score-to-par among golfers with a valid score for that hole.
  3. Add that best hole score to the entry total.
  4. Count birdies/eagles as scoreToPar < 0 for the best-ball hole result.
```

This matches the implementation. The issue author's reading of the document may have been confused by the phrase "Entry round score = min(scoreToPar of active golfers)" in the Issue #48 description, which was describing a different (round-level) algorithm that has since been superseded.

**No changes needed to `docs/rules-spec.md`** — it already describes the correct hole-by-hole algorithm.

### 4.3 Other Docs

Search for any other references to "round-based best-ball" or "round-level" scoring in `docs/` and `README.md`. The main cleanup is line 3 of `README.md`.

---

## 5. Proposed Approach

### Step 1: Verify No Other Round-Based Paths Exist

Before closing the issue, do a final sweep:

```bash
# Confirm getTournamentScoreRounds is not called in any API route
rg "getTournamentScoreRounds" src/app/api/

# Confirm no round-level ranking in scoring path
rg "rankEntries\(" src/app/api/ -- -N
```

**Assumption:** These searches will return only the deprecated audit tooling path and the test file.

### Step 2: Update README.md

- Line 3: Change "round-by-round" → "hole-by-hole"
- Confirm lines 78–83 are accurate (they are)

### Step 3: Verify rules-spec.md Is Consistent

- Confirm section 2 algorithm description matches implementation
- The document appears correct as-is; no changes needed

### Step 4: Confirm Test Coverage Is Sufficient

The existing test "ranks entries from tournament_holes via rankEntriesWithHoles, not tournament_score_rounds" (line 322) already covers the key requirement. No new tests needed unless the sweep in Step 1 finds something unexpected.

### Step 5: Close Issue #51

If the sweep confirms the code is correct and docs are updated, the issue is resolved.

---

## 6. Assumptions

1. **The leaderboard GET work was already done** in a prior commit and the issue description is based on pre-work state.
2. **No other live code paths use `getTournamentScoreRounds`** for ranking — only the deprecated audit tooling path.
3. **The docs/rules-spec.md section 2 description is accurate** as written; the issue author's concern about it may have been a misreading.
4. **AGENTS.md's note** "Recent work: Migrated from hole-by-hole to round-based scoring model" refers to a data model change (the `tournament_score_rounds` archive table), not a scoring algorithm change. The scoring algorithm stayed hole-by-hole throughout.

---

## 7. Scope

### In Scope
- Update `README.md` line 3 to say "hole-by-hole" not "round-by-round"
- Sweep for any remaining "round-based best-ball" language in docs
- Confirm via grep that `getTournamentScoreRounds` is not used in any live scoring path
- Verify test at `route.test.ts:322` passes (it should, it already tests the correct behavior)

### Out of Scope
- Any code changes to the leaderboard GET endpoint (already correct)
- Changes to `docs/rules-spec.md` (already correct)
- Replacing Slash Golf API integration
- Season-long scoring
- UI changes

---

## 8. Risks and Concerns

| Risk | Assessment |
|------|-----------|
| Issue description misleads implementer into reverting correct code | **Medium** — The issue explicitly asks to remove `getTournamentScoreRounds` from the GET path, but the GET path already doesn't use it. An implementer reading the issue literally might accidentally introduce the old round-based path thinking they are "fixing" something. |
| `tournament_score_rounds` table is still written by cron but never read by leaderboard | **Low** — This is correct. `tournament_score_rounds` is an archive table. `tournament_holes` is the source of truth for hole-level scoring. The cron writes both; the GET handler reads `tournament_holes` only. |
| Documentation drift between README and rules-spec | **Low** — Both now describe hole-by-hole correctly. Only README line 3 had imprecise "round-by-round" language. |

---

## 9. Verification

After implementation:

```bash
# Run the leaderboard test — should pass without modification
npm test -- src/app/api/leaderboard/\[poolId\]/route.test.ts

# Verify README line 3 says "hole-by-hole"
rg "hole-by-hole" README.md  # should have >0 hits
rg "round-by-round" README.md  # should have 0 hits

# Verify getTournamentScoreRounds is not in live scoring path
rg "getTournamentScoreRounds" src/app/api/  # should only hit route.test.ts
```