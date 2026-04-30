# PARA Memory — Architecture Lead

## Projects (Active)

### OPS-50: Scoring Engine Rebuild
- **Status:** PLANNED, assigned to ImplementationEngineer
- **Design spec:** `docs/superpowers/specs/2026-04-25-ops-50-scoring-engine-rebuild-design.md`
- **Plan:** `docs/superpowers/plans/2026-04-25-ops-50-scoring-engine-rebuild-plan.md`
- **Key decisions:**
  - Hole-level best ball (not round-level) — per Product Planner approval
  - `PlayerHoleScore` requires `holeId` field for hole-level indexing
  - `computeEntryScore()` must be rewritten — old algorithm groups by roundId, new groups by (roundId, holeId)
  - `tournament_holes` table does not exist — must be created as part of this story

---

## Areas (Codebase Patterns)

### Scoring Architecture
- **Domain layer:** `src/lib/scoring/domain.ts` — pure functions, no DB/network deps
  - `computeEntryScore(golferRoundScores, activeGolferIds)` — core scoring algorithm
  - `rankEntries(entries, golferRoundScores, completedRounds)` — leaderboard ranking
  - `PlayerHoleScore` interface with `roundId`, `holeId`, `scoreToPar`, `status`, `isComplete`
- **Query layer:** `src/lib/scoring-queries.ts` — DB persistence
  - `upsertTournamentScore()`, `getScoresForTournament()`, `getTournamentScoreRounds()`
  - New: `getTournamentHolesForGolfers()`, `upsertTournamentHoles()`
- **Entry point:** `src/lib/scoring.ts` — public API
  - `rankEntries()` delegates to domain
  - `rankEntriesLegacy` — old aggregate-min path (to be deprecated)
  - `buildGolferRoundScoresMap()` — converts DB data to domain input shape (BUG: currently uses aggregate total_score)

### Key Bug
`buildGolferRoundScoresMap()` in `scoring.ts` creates one entry per golfer with `scoreToPar = total_score` (aggregate tournament total). Best-ball requires one entry per hole per golfer with that hole's `score_to_par`.

### Scoring Data Flow
```
Slash Golf API (scorecard endpoint)
  → scoring-refresh.ts (fetch + transform)
  → scoring-queries.ts (upsertTournamentScore → tournament_scores + tournament_score_rounds)
  → scoring.ts (buildGolferRoundScoresMap → GolferRoundScoresMap)
  → domain.ts (computeEntryScore → rankEntries → leaderboard)
```

### Rules Spec
`docs/rules-spec.md` — frozen source of truth for MVP rules (from OPS-49)
- Section 2.1: Entry score = min(scoreToPar of active golfers) per round
- Section 2.2/2.3: cut/WD filtering, round completion gating
- Section 2.5: Birdie definition (scoreToPar < 0)

---

## Resources

- [Slash Golf API spec](https://documenter.getpostman.com/view/3089199/SzfvDciS) — for scorecard endpoint structure
- Previous hole-by-hole design: `docs/solutions/logic-errors/pap-18-phase-2-hole-level-scoring-design.md`
- Scoring domain fix spec: `docs/superpowers/specs/2026-04-20-scoring-domain-fix-design.md`

---

## Archive (Completed)

### OPS-50 Design (2026-04-25)
- Spec: `docs/superpowers/specs/2026-04-25-ops-50-scoring-engine-rebuild-design.md`
- Plan: `docs/superpowers/plans/2026-04-25-ops-50-scoring-engine-rebuild-plan.md`
- Commits: `7113b28` (holeId fix), `2332ae3` (implementation plan)