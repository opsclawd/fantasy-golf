# PAP-14 Phase 2 — Scoring Domain Implementation Plan

**Issue:** [PAP-14 Phase 2 — fix the scoring model at the domain level](/PAP/issues/PAP-14)
**Date:** 2026-04-20
**Status:** Implementation plan — for subagent/Builder execution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace broken scoring functions with a deterministic, rule-correct best-ball scoring domain module.

**Architecture:** Pure scoring module (`src/lib/scoring/domain.ts`) with zero DB/network deps.

---

## Tasks

### Task 1: Create `src/lib/scoring/domain.ts`

**Files:** Create `src/lib/scoring/domain.ts`

- [ ] Write domain types: `PlayerHoleScore`, `EntryScoreAccumulator`, `EntryLeaderboardSummary`
- [ ] Implement `computeEntryScore(golferRoundScores, activeGolferIds)`
- [ ] Implement `rankEntries(entries, golferRoundScores, completedRounds)`
- [ ] Implement `deriveCompletedRounds(allScores)`
- [ ] Commit

### Task 2: Update `src/lib/scoring.ts`

**Files:** Modify `src/lib/scoring.ts`

- [ ] Import and re-export from domain module
- [ ] Keep `getEntryRoundScore` for UI backward compat
- [ ] Commit

### Task 3: Update `src/lib/scoring-refresh.ts`

**Files:** Modify `src/lib/scoring-refresh.ts`, add `getTournamentScoreRounds` to `scoring-queries.ts`

- [ ] Build `golferRoundScoresMap` from per-round archive data
- [ ] Call `domainRankEntries` instead of old `rankEntries`
- [ ] Commit

### Task 4: Extend scoring tests with 6 fixtures

**Files:** Modify `src/lib/__tests__/scoring.test.ts`

Fixtures:
1. Normal 4 active, complete round
2. One golfer cut (excluded post-cut)
3. One golfer WD mid-round (excluded post-WD)
4. Partial round (only completed holes count)
5. Tie on score, broken by birdies
6. Tie on score and birdies, shared rank

- [ ] Add all 6 fixtures
- [ ] Run tests, verify PASS
- [ ] Commit

---

## Exit Criteria

- Domain module has zero DB/network imports
- Birdies derived from score_to_par (not zero field)
- Cut/WD correctly excluded post-status-change
- Partial rounds only count completed holes
- Tiebreaking deterministic (score → birdies → shared rank)
- All 6 fixtures pass
