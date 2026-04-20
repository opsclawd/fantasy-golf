# Codebase Audit

**Issue:** [PAP-13 Phase 1 — audit the current codebase against the product rules](/PAP/issues/PAP-13)
**Date:** 2026-04-20
**Status:** Phase 1 complete

---

## 1. Scoring Path End-to-End

### 1a. Entry Creation Path

**File:** `src/lib/entry-queries.ts` (`upsertEntry`)

Entries are created with `golfer_ids TEXT[]` array and `total_birdies INTEGER DEFAULT 0`. The entry stores no score data at creation time — scores are computed at read time by joining against `tournament_scores`.

**Finding:** No issues found. Entry creation is correct.

---

### 1b. Stored Score Model

**Files:**
- `src/lib/db/schema.sql` (declared schema — see section 2 for staleness issues)
- `src/lib/supabase/types.ts` (`TournamentScore`, `TournamentScoreRound`)
- `supabase/migrations/20260401170000_create_tournament_score_rounds.sql`

**Actual tables in production:**

| Table | Purpose |
|---|---|
| `tournament_scores` | Current-state per golfer (total_score, position, total_birdies, status) |
| `tournament_score_rounds` | Per-round archive snapshot (round_id, strokes, score_to_par, etc.) |

**Finding — CRITICAL BUG — `total_birdies` always 0:**

`src/lib/scoring-refresh.ts` line 95:
```typescript
total_birdies: score.total_birdies ?? 0,
```

`score.total_birdies` comes from the Slash Golf leaderboard response. The `GolferScore` type in `src/lib/slash-golf/types.ts` defines `total_birdies` as optional and defaults to `0`:

```typescript
total_birdies?: number  // line 38
```

Examining `sample.json` (representative Slash Golf leaderboard response), there is **no birdie field** in any leaderboard row. The `total_birdies` field is never present in the raw response.

**Impact:** The PRD (FR23, FR28) specifies birdies as a tiebreaker. The ranking function in `src/lib/scoring.ts` line 78 uses birdies as a tiebreaker:

```typescript
return b.totalBirdies - a.totalBirdies
```

Since `total_birdies` is always `0` for every golfer, **the birdie tiebreaker produces random ordering** for all tied-score entries. This directly violates the product's own success criterion: "Best-ball scoring, ties, birdies, withdrawals, and lock-time behavior are correct under test."

---

### 1c. Slash Golf Ingest Path

**File:** `src/lib/slash-golf/client.ts` (`getTournamentScores`)

The ingest path hits `GET /leaderboard` with `orgId`, `tournId`, and `year` parameters. The response is normalized via `normalizeTournamentScores` which handles multiple response shapes (top-level array, `leaderboardRows`, `data`, `scores`, `players`).

**Key observations:**
- The endpoint provides **round totals only** — `total` field per golfer (e.g., `"-6"` for 6-under-par)
- Per-round data IS included in the `rounds[]` array: `roundId`, `strokes`, `scoreToPar`, `courseName`
- **No hole-level data** is included in the leaderboard response
- No birdie counts are included

**Finding:** The ingest correctly captures what the leaderboard endpoint provides. However, this endpoint does NOT provide the hole-by-hole data needed for true best-ball scoring. See section 4.

---

### 1d. Refresh Job

**File:** `src/lib/scoring-refresh.ts` (`refreshScoresForPool`)

Flow:
1. Fetch via `getTournamentScores` (leaderboard only)
2. Upsert to `tournament_scores` (current state) and `tournament_score_rounds` (per-round archive) via `upsertTournamentScore`
3. Update `refreshed_at` metadata
4. Compute rankings via `rankEntries`
5. Broadcast via Supabase Realtime
6. Write audit event

**Finding — `completedRounds` inference may be unreliable during live play:**

`src/lib/scoring.ts` (`deriveCompletedRounds`, line 56):
```typescript
export function deriveCompletedRounds(allScores: TournamentScore[]): number {
  const rounds = allScores
    .map((score) => score.round_id)
    .filter((roundId): roundId is number => typeof roundId === 'number' && Number.isFinite(roundId))
  return rounds.length > 0 ? Math.max(...rounds) : 0
}
```

`round_id` in `TournamentScore` is set to `current_round` from the Slash Golf API (see `upsertTournamentScore` line 62). During an active round, `current_round = 1` and `rounds` may contain one entry with `roundId = 1` — but this does not distinguish "round 1 complete" from "round 1 in progress with partial data." The `roundComplete` flag exists only in the scorecard endpoint, not the leaderboard.

**Impact:** The `completedRounds` value shown in the UI may be slightly misleading during live play. This is a minor display issue, not a correctness issue for rankings.

---

### 1e. Ranking / Leaderboard Render Path

**File:** `src/app/api/leaderboard/[poolId]/route.ts` (GET handler)

Flow:
1. Fetch pool
2. Check freshness, optionally trigger background refresh
3. Fetch entries and all scores for the tournament
4. Build `golferScoresMap` from `tournament_scores`
5. Call `rankEntries` → returns sorted entries with `totalScore`, `totalBirdies`, `rank`

**Finding:** The leaderboard path is correct. It reads current-state scores and produces accurate rankings based on `total_score`. The birdie tiebreaker is broken (see 1b).

---

## 2. Schema Reality vs. Declared Schema

**File:** `src/lib/db/schema.sql`

### Finding — `schema.sql` is stale on two fronts:

**Stale item 1:** `tournament_scores` still declares `hole_1` through `hole_18` INTEGER columns (lines 53–70 of schema.sql). These were dropped by migration `20260401160000_drop_hole_columns.sql`.

**Stale item 2:** `schema.sql` does not declare `tournament_score_rounds` at all. This table was created by migration `20260401170000_create_tournament_score_rounds.sql` and is actively used by `upsertTournamentScore` in `scoring-queries.ts`.

**Impact:** Anyone referencing `schema.sql` for the actual database structure will have an incorrect picture. The schema file should be updated to reflect the post-migration state.

---

## 3. Provider Payload Assumptions

**Question from audit brief:** Does Slash Golf provide hole-by-hole data, round totals only, or leaderboard-only data?

**Answer:** The leaderboard endpoint (`/leaderboard`) provides **round totals only** per golfer, plus a `rounds[]` array with per-round stroke totals. It does NOT provide hole-by-hole data.

The Slash Golf scorecard endpoint (`/scorecard`) provides hole-by-hole data (`holes` object with `holeScore` per hole), but this endpoint is **not currently called** by the codebase.

**Evidence:**
- `src/lib/slash-golf/client.ts` only exports `getTournamentScores` (leaderboard) and `getGolfers` (tournament roster). No scorecard fetcher exists.
- The implementation plan `docs/superpowers/plans/2026-04-11-hole-by-hole-best-ball-implementation.md` describes the scorecard endpoint and `tournament_holes` table, but this was never implemented.
- No `tournament_holes` migration exists in `supabase/migrations/`.

**Impact on MVP premise:** The current MVP uses round-level totals from the leaderboard, not true hole-by-hole best-ball. This is a **scope gap** between what the PRD's best-ball definition implies and what the implementation delivers. See section 4.

---

## 4. UI Contract

**Question from audit brief:** Does the leaderboard copy describe the correct game?

### Finding — "Counted in X rounds" metric is misleading:

`src/lib/golfer-detail.ts` (`getGolferContribution`) computes contribution by comparing each golfer's `total_score` (running tournament total) against the best `total_score` in the entry. The spec `docs/superpowers/specs/2026-04-11-hole-by-hole-best-ball-design.md` explicitly identifies this as wrong:

> "The current 'Counted in 1 round' metric on the participant picks page is misleading. The code at `src/lib/golfer-detail.ts` compares each golfer's tournament running total (`total_score`) against the lowest tournament total in the entry. That is not best-ball scoring."

**What best-ball actually is:** On each hole, the entry's score is the lowest score among its golfers on that hole. The entry's total is the sum of per-hole best-ball scores. This requires hole-level data, which the current system does not store.

**No scorecard UI exists** because `tournament_holes` was never built. The specced `GolferScorecard` component (per `docs/superpowers/plans/2026-04-11-golfer-detail-round-by-round.md`) is not in the codebase.

---

## Summary of Defects

| # | Severity | Area | Description |
|---|---|---|---|
| 1 | **Critical** | Scoring | `total_birdies` is always 0 — birdie tiebreaker is non-functional |
| 2 | **High** | Schema | `schema.sql` still shows `hole_1`–`hole_18` that were dropped; missing `tournament_score_rounds` |
| 3 | **High** | Product | Hole-by-hole best-ball specced but not built — the picks page metric is wrong by design |
| 4 | **Medium** | Scoring | `completedRounds` may display as 1 during live round 1 before round is officially complete |
| 5 | **Low** | Schema | `schema.sql` is not kept in sync with applied migrations |

---

## Stop-the-Line Assessment

> "If Slash Golf does **not** provide reliable hole-level scorecard data through the chosen endpoint, the current MVP premise breaks and the provider strategy must be corrected before continuing."

**Answer:** Slash Golf DOES provide hole-level data — but through the `/scorecard` endpoint (one request per golfer), NOT the `/leaderboard` endpoint currently in use. The leaderboard provides round totals and per-round stroke totals, but no per-hole data.

The MVP premise does not "break" — round-level best-ball (lowest round total among golfers) is a reasonable approximation of best-ball that can be computed from the current data. However, the **hole-by-hole best-ball feature is not implemented**, and the picks page currently shows a metric that is "not best-ball scoring" per the team's own spec.

**Recommendation:** The birdie tiebreaker bug (defect #1) should be fixed first since it affects live rankings. The hole-by-hole feature (defect #3) is a planned enhancement that should be tracked as a separate story.
