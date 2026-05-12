# Align Leaderboard GET with True Hole-by-Hole Best-Ball — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close documentation gap — update README.md line 3 to say "hole-by-hole" (not "round-by-round"), and confirm no other docs describe round-based best-ball as the active scoring model.

**Architecture:** This is a documentation-only task. Code analysis confirms the leaderboard GET endpoint already uses the correct hole-by-hole path via `tournament_holes` + `rankEntriesWithHoles`. The issue description was based on pre-work state. No code changes are required.

**Tech Stack:** N/A (documentation only)

---

## File Map

| File | Responsibility |
|------|----------------|
| `README.md` | Project README — line 3 says "round-by-round" instead of "hole-by-hole" |
| `docs/rules-spec.md` | Scoring rules spec — already correct per design.md Section 4.2 |

---

## Tasks

### Task 1: Sweep for Round-Based Language in Docs

**Files:**
- Search: `README.md`, `docs/rules-spec.md`, `docs/` subdirectory

- [ ] **Step 1: Search for "round-by-round" in docs**

Run: `rg "round-by-round" docs/ README.md`
Expected: Hits only in README.md line 3 (the change target) and possibly rules-spec comments

- [ ] **Step 2: Search for "round-level" or "round based" scoring references**

Run: `rg "round.level|rounds?based" docs/ README.md -i`
Expected: Any hits outside deprecated/archived docs should be reviewed

- [ ] **Step 3: Commit sweep result**

```bash
git add -A
git commit -m "docs: confirm round-based language locations"
```

---

### Task 2: Update README.md Line 3

**Files:**
- Modify: `README.md:3`

- [ ] **Step 1: Verify current README.md line 3 text**

Run: `rg -n "round-by-round" README.md`
Expected: Line 3 contains "live round-by-round scoring"

- [ ] **Step 2: Update line 3 to say "hole-by-hole"**

Change: "A commissioner-first web app for running private golf pools with live round-by-round scoring."
To: "A commissioner-first web app for running private golf pools with live hole-by-hole scoring."

- [ ] **Step 3: Verify the change**

Run: `rg "hole-by-hole" README.md` and `rg "round-by-round" README.md`
Expected: "hole-by-hole" hits > 0, "round-by-round" hits = 0

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: align README with hole-by-hole scoring model"
```

---

### Task 3: Confirm docs/rules-spec.md Is Consistent

**Files:**
- Read: `docs/rules-spec.md` lines 1–50

- [ ] **Step 1: Read rules-spec.md scoring description**

Confirm section 2 (Algorithm) describes hole-by-hole best-ball (per-hole min scoreToPar among active golfers)

- [ ] **Step 2: No changes needed** — document is already correct per design.md Section 4.2

- [ ] **Step 3: Commit confirmation**

```bash
git add -A
git commit -m "docs: confirm rules-spec.md already describes hole-by-hole correctly"
```

---

### Task 4: Verify Existing Test Coverage

**Files:**
- Run: `src/app/api/leaderboard/[poolId]/route.test.ts` — existing test at line 322

- [ ] **Step 1: Run the leaderboard test suite**

Run: `npm test -- src/app/api/leaderboard/\[poolId\]/route.test.ts`
Expected: PASS — existing test "ranks entries from tournament_holes via rankEntriesWithHoles, not tournament_score_rounds" validates the correct behavior

- [ ] **Step 2: Confirm no getTournamentScoreRounds in live API path**

Run: `rg "getTournamentScoreRounds" src/app/api/`
Expected: Only hits in `route.test.ts` (test file) — no live code path uses this for ranking

- [ ] **Step 3: Commit confirmation**

```bash
git add -A
git commit -m "test: confirm leaderboard endpoint uses hole-level path"
```

---

## Tests to Add or Update

No new tests required. The existing test at `route.test.ts:322` already covers:
- `getTournamentHolesForGolfers` is called (not `getTournamentScoreRounds`)
- `rankEntriesWithHoles` is called with holes data
- Two rounds of overlapping hole IDs do not collapse into pseudo-holes

If the grep sweep in Task 1 uncovers additional round-based language in other doc files, add corresponding verification steps.

---

## Validation Commands

```bash
# Run leaderboard tests — should pass
npm test -- src/app/api/leaderboard/\[poolId\]/route.test.ts

# Verify README line 3 fix
rg "hole-by-hole" README.md   # >0 hits
rg "round-by-round" README.md # 0 hits

# Verify no round-based scoring paths in live API code
rg "getTournamentScoreRounds" src/app/api/  # only in test file

# Verify rules-spec is consistent
rg "hole-by-hole" docs/rules-spec.md  # >0 hits
```

---

## Risk Areas

| Risk | Assessment |
|------|-----------|
| Issue description misleads implementer into reverting correct code | **Medium** — The issue asks to "fix" a GET path that is already correct. An implementer reading the issue literally could accidentally introduce the old round-based path. Mitigation: design.md documents the current state; Task 4 runs existing tests to confirm no regression. |
| Other docs still describe round-based scoring | **Low** — Tasks 1–3 sweep all docs. Any additional round-based language found will be addressed in Task 1's expanded scope. |
| `tournament_score_rounds` table written but never read | **Low** — This is correct architecture. `tournament_score_rounds` is an archive table. `tournament_holes` is the source of truth. Cron writes both; GET handler reads `tournament_holes` only. |

---

## Stop Conditions

- **If** the grep sweep in Task 1 finds round-based scoring language in `docs/rules-spec.md` algorithm section (not just comments), add a Task 5 to fix that document before closing.
- **If** the existing test at `route.test.ts:322` fails, the GET path may have been reverted. Abort and re-analyze before proceeding.
- **If** `rg "getTournamentScoreRounds" src/app/api/` returns hits outside `route.test.ts` in live code paths, the issue is not resolved — abort and escalate.
- **If** any code changes are discovered to be necessary beyond documentation, abort this plan and re-brief with updated design.md.

---

## Execution Handoff

**Plan complete and saved to `./plan.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
