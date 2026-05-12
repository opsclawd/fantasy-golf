---
title: Issue #51 was verification-only — code was already correct
date: 2026-05-12
last_updated: 2026-05-12
category: docs/solutions/workflow-issues/
module: leaderboard
problem_type: workflow_issue
component: api
severity: low
tags: [verification, documentation, leaderboard, scoring, round-level, hole-level]
git_refs: [f83d8d7, f627545, df83cb9]
---

# Issue #51: Confirmed — No Code Changes Required

## Context

Issue #51 was opened with the premise that `GET /api/leaderboard/[poolId]` was still using round-level pseudo-hole scoring via `tournament_score_rounds`, contradicting the true hole-by-hole model used by the refresh/broadcast path. The issue asked to:

1. Fix the leaderboard GET endpoint to use `tournament_holes` via `rankEntriesWithHoles`
2. Remove the `getTournamentScoreRounds` path
3. Update docs to match

After code analysis and implementation, **no code changes were required** — the GET endpoint was already correct.

## Root Cause / Wrong Premise

The issue description was based on **pre-work state**. The leaderboard GET endpoint had already been migrated to the correct hole-by-hole path in a prior commit, but:

1. The issue was written during a transition period before that migration was complete
2. The issue author may have been looking at a stale branch or pre-migration code
3. No one had verified the actual state of the GET handler before filing the issue

The only remaining gap was **documentation consistency** — `README.md` line 3 said "round-by-round" instead of "hole-by-hole".

## What Was Actually Done

### Verification Steps (Tasks 3 & 4)

**Task 3 — `docs/rules-spec.md` verification:**
- Read lines 1–50 of `docs/rules-spec.md`
- Confirmed Section 2 (Algorithm) already correctly describes hole-by-hole best-ball: per-hole `scoreToPar` minimum among active golfers
- No changes needed — document was already correct

**Task 4 — Test coverage verification:**
- Ran `npm test -- src/app/api/leaderboard/[poolId]/route.test.ts` → **7/7 tests PASS**
- Ran `rg "getTournamentScoreRounds" src/app/api/` → **0 matches in live API code**
- Confirmed only `route.test.ts` (test file) references `getTournamentScoreRounds`

### What the Code Actually Does

`src/app/api/leaderboard/[poolId]/route.ts` at time of verification:

| Line | Operation | Data Source |
|------|-----------|-------------|
| 67–89 | Fetch pool entries | `entries` table |
| 91–123 | Fetch tournament scores for status/golfer display | `tournament_scores` (display only) |
| 135–143 | Fetch golfer names | `tournament_roster` |
| 147 | Fetch hole data | `tournament_holes` via `getTournamentHolesForGolfers` |
| 149 | Rank entries | `rankEntriesWithHoles(entries, holesByGolfer, golferStatuses, completedRounds)` |

`getTournamentScoreRounds` is **never called** in the GET handler. It exists only in `src/lib/scoring-queries.ts` but is not imported or invoked by the live API path.

## Key Files

| File | Role |
|------|------|
| `src/app/api/leaderboard/[poolId]/route.ts:3,7,148-149` | Correct hole-level path — `rankEntriesWithHoles` + `getTournamentHolesForGolfers` |
| `src/app/api/leaderboard/[poolId]/route.test.ts:322` | Regression test: "ranks entries from tournament_holes via rankEntriesWithHoles, not tournament_score_rounds" |
| `src/lib/scoring-queries.ts` | Contains `getTournamentScoreRounds` (deprecated, not called in live path) |
| `docs/rules-spec.md:30-35` | Already correct hole-by-hole algorithm description |

## Gotchas

### 1. Issue Description Was Obsolete

An implementer reading issue #51 literally and trying to "fix" the GET endpoint would find no `getTournamentScoreRounds` call to remove and no `holeId: 1` pseudo-hole construction to fix. The correct action was to **verify and confirm**, not modify.

**Mitigation:** Always read `design.md` alongside the issue when starting work. Design.md explicitly notes: "The issue appears to have been written during a transition period, and the work may have been done in a prior commit."

### 2. `tournament_score_rounds` Is an Archive Table

The cron writes to both `tournament_score_rounds` (archive) and `tournament_holes` (source of truth). The GET handler only reads `tournament_holes`. This is correct architecture — `tournament_score_rounds` is not dead code, it preserves round-level data for audit/analysis.

### 3. Quality Review Flagged Committed Build Artifacts

The quality review for Task 3 identified that `implement-task-1.log` (a 2045-line build artifact) was committed as part of the work. This should have been added to `.gitignore` before committing. **This is a recurring pattern** in this worktree — implementer agents are committing log artifacts.

**Action:** Add `*.log` to `.gitignore` in the root directory to prevent future artifact commits.

### 4. Deprecated Scoring Functions Still Exist

`buildGolferRoundScoresMapFromScores` and `rankEntries` (round-level) were removed from the live API path but `rankEntriesLegacy` is preserved for the audit tooling at:
```
src/app/(app)/commissioner/pools/[poolId]/audit/score-trace/page.tsx
```
This is intentional — audit tooling may need to inspect historical round-level data.

## Guidance

1. **Before treating an issue as a code fix, read `design.md`** — it contains current-state analysis that may contradict the issue description
2. **Run existing tests before making any changes** — they often reveal the issue is already resolved
3. **Grep for deprecated function names** in `src/app/api/` to confirm whether a path is still in use
4. **Never commit `*.log` files** — add them to `.gitignore` before committing

## Verification

```bash
# Run leaderboard tests — should pass (7/7)
npm test -- src/app/api/leaderboard/\[poolId\]/route.test.ts

# Confirm getTournamentScoreRounds is absent from live API
rg "getTournamentScoreRounds" src/app/api/  # expect: no live hits

# Confirm README line 3 says "hole-by-hole"
rg "hole-by-hole" README.md  # expect: >0 hits
rg "round-by-round" README.md  # expect: 0 hits

# Confirm rules-spec describes hole-by-hole correctly
rg "hole-by-hole" docs/rules-spec.md  # expect: >0 hits
```

## Related

- `design.md` — Current-state analysis that correctly identified the issue as verification-only
- `src/app/api/leaderboard/[poolId]/route.test.ts:322` — Existing regression test for hole-level path
- `src/lib/scoring.ts` — Contains `rankEntriesWithHoles` (hole-level) and removed `rankEntries` (round-level)
- `src/lib/scoring-queries.ts` — Contains `getTournamentScoreRounds` (deprecated, not called)
