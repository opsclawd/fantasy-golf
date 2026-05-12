# Code Review: ai/issue-51 vs origin/main

## Summary

**Nothing from the issue was implemented.** The diff modifies only `scripts/ai-run-issue-v2.sh` (orchestrator workflow script). No changes to the leaderboard GET endpoint, no README.md update, no docs fixes, no test verification.

---

## Finding 1 — Critical: Wrong Deliverable

**Severity:** critical
**File:** (none — missing)
**Evidence:** The diff only touches `scripts/ai-run-issue-v2.sh`. The issue asks to fix `src/app/api/leaderboard/[poolId]/route.ts` to use `tournament_holes` + `rankEntriesWithHoles` instead of `tournament_score_rounds`, and to update README.md line 3 and `docs/rules-spec.md`. None of those files appear in the diff.
**Failure mode:** The branch is tagged `ai/issue-51` but contains only orchestrator improvements. The actual code described in issue.md and plan.md is untouched. This suggests either (a) the wrong work was committed, or (b) the plan was abandoned in favor of unrelated work.
**Required fix:** The implementation must address the issue scope: fix the leaderboard GET path to use hole-level scoring and update documentation.

---

## Finding 2 — Critical: README.md Still Has Wrong Scoring Description

**Severity:** critical
**Evidence:** `rg "round-by-round" README.md` returns line 3: `"A commissioner-first web app for running private golf pools with live round-by-round scoring."` — unchanged.
**Failure mode:** Per issue.md §C and acceptance criteria, the README must no longer say "round-by-round." This was the primary documentation fix requested and it was not made.
**Required fix:** Update README.md line 3: replace "round-by-round" with "hole-by-hole."

---

## Finding 3 — High: Plan Admitted It Was a No-Op

**Severity:** high
**File:** plan.md:7
**Evidence:** Plan states: `"This is a documentation-only task. Code analysis confirms the leaderboard GET endpoint already uses the correct hole-by-hole path via tournament_holes + rankEntriesWithHoles. The issue description was based on pre-work state. No code changes are required."`
**Failure mode:** The issue explicitly says the GET endpoint uses `tournament_score_rounds` with pseudo-hole `holeId: 1` and calls `rankEntries` (not `rankEntriesWithHoles`). The plan's claim that code is "already correct" contradicts the issue's evidence. Either the plan was wrong to begin with, or the agent decided the issue was invalid without verifying against the actual code.
**Required fix:** Verify the actual current state of `src/app/api/leaderboard/[poolId]/route.ts` — if it truly uses the wrong path, implement the fix as described in issue.md §A. If it is already correct, the issue description was stale and should be closed with explanation rather than merged as a non-finding.

---

## Finding 4 — High: No Test Verification Run

**Severity:** high
**Evidence:** plan.md §"Validation Commands" lists `npm test -- src/app/api/leaderboard/\[poolId\]/route.test.ts` and grep commands to confirm behavior, but these were never executed (no evidence of test output in any artifact).
**Failure mode:** Without running the tests, there is no proof the leaderboard GET path is correct or that the changes (if any) didn't regress it.
**Required fix:** Execute validation commands from plan.md and include results in the code review or commit log.

---

## Finding 5 — Medium: docs/rules-spec.md Not Verified

**Severity:** medium
**Evidence:** plan.md Task 3 says "confirm docs/rules-spec.md is consistent" but the task was marked no-op ("already correct per design.md"). The issue explicitly calls out this file as "internally contradictory."
**Failure mode:** If rules-spec.md was misread and still defines scoring as round-level min aggregation, users reading it will have incorrect expectations.
**Required fix:** Read docs/rules-spec.md and confirm it describes per-hole best-ball, not round-level aggregation.

---

## Finding 6 — Low: Diff Only Modifies Orchestrator Script

**Severity:** low
**File:** `scripts/ai-run-issue-v2.sh`
**Evidence:** Single-file diff — 584 insertions, 75 deletions. The orchestrator now archives worktrees to `ai/issues/{N}/`, uses worktree-relative paths, has task-level auto-resume detection, and fixes shell comparison bugs (unquoted `TASK_COUNT` and `CRITICAL_HIGH_COUNT` from awk).
**Failure mode:** While these orchestrator improvements are reasonable, they are unrelated to the issue #51 scope and were not part of the plan.md tasks.
**Required fix:** These changes should be in a separate branch/PR tied to an orchestrator-improvement issue, not bundled with issue #51.

---

## Finding 7 — Low: Missing `review.md` in Expected Location

**Severity:** low
**Evidence:** plan.md §"Execution Handoff" asks which approach to use but provides no `review.md`. The orchestrator `fix-review` phase looks for `./review.md` — if this was produced by a prior review pass, it is not present in the diff.
**Failure mode:** Without `review.md` from an earlier pass, there is no record of what was reviewed and approved.
**Required fix:** Ensure `review.md` artifacts are included or linked in the final PR description.

---

## Summary Table

| # | Severity | Area | Description |
|---|----------|------|-------------|
| 1 | critical | deliverable | Diff touches only orchestrator script; actual issue scope untouched |
| 2 | critical | docs | README.md line 3 still says "round-by-round" — no fix applied |
| 3 | high | plan | Plan declared code "already correct" without verifying against actual source |
| 4 | high | testing | No test verification run — claims untested |
| 5 | medium | docs | rules-spec.md consistency not confirmed by reading the file |
| 6 | low | scope | Orchestrator changes are unrelated to issue scope |
| 7 | low | process | Missing `review.md` artifact in expected location |

**Recommendation:** Do not merge. This diff does not address the issue. Re-brief with accurate code analysis of `src/app/api/leaderboard/[poolId]/route.ts` to determine whether the GET path needs fixing, then implement and test appropriately.
