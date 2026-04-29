# Fantasy Golf MVP — Rules Specification

**Status:** Frozen as of OPS-49
**Purpose:** Single authoritative source for MVP game rules. All implementation, tests, and UI reference this document.
**Scope:** MVP only. Future features (playoff rules, season-long, ranking tiers) are explicitly excluded.

---

## 1. Pool Structure

### 1.1 Entry Composition

| Rule | Value | Source |
|------|-------|--------|
| Golfers per entry | Exactly `picks_per_entry` (default: 4, range: 1–10) | `pool.ts:validatePoolFormat`, `picks.ts:validatePickSubmission` |
| Pool format | `best_ball` only | `pool.ts:VALID_FORMATS` |
| Duplicate golfers | Not allowed within same entry | `picks.ts:validatePickSubmission` |

**Constraint:** `picks_per_entry` is configured at pool creation and cannot be changed after the pool is created.

---

## 2. Scoring

### 2.1 Core Algorithm: Best Ball, Hole-by-Hole

For each round, the entry's score is the **lowest `scoreToPar`** among all **active** golfers in the entry.

```
Entry round score = min(scoreToPar of active golfers)
Entry total score = sum(Entry round score for each completed round)
```

**Source:** `src/lib/scoring/domain.ts:computeEntryScore`

### 2.2 Golfer Status Filtering

| Status | Counts in scoring? | Notes |
|--------|-------------------|-------|
| `active` | Yes | Normal playing status |
| `cut` | No (excluded after cut occurs) | Removed from tournament at cut line |
| `withdrawn` | No (excluded after WD occurs) | Player voluntarily withdrew |
| `dq` | Not modeled in types | External data may contain; treated as `withdrawn` if encountered |

**Source:** `src/lib/scoring/domain.ts:isActiveGolfer` (status === 'active')

### 2.3 Score Accumulation Rules

1. **Round completion gating:** A round only counts toward the entry total if **all golfers** in the entry have `isComplete: true` for that round.
2. **Partial rounds:** If any golfer in the entry has `isComplete: false` for a round, that round is skipped entirely.
3. **Golfer drop after status change:** A golfer who is `cut` or `withdrawn` is excluded from best-ball calculation for all subsequent rounds, but their completed rounds still count.

**Source:** `src/lib/scoring/domain.ts:computeEntryScore` (round-level `isComplete` gating at lines 90–95)

### 2.4 Tiebreaker Order

| Priority | Criterion | Direction | Source |
|----------|-----------|----------|--------|
| 1 | Total score | Lower is better | `domain.ts:rankEntries` |
| 2 | Total birdies | Higher is better | `domain.ts:rankEntries` |
| 3 | Shared rank | Both entries receive same rank | `domain.ts:rankEntries` |

**Note:** If two entries have identical total score AND identical birdie count, they share a rank with no further tiebreak.

### 2.5 Birdie Definition

A birdie is any hole where `scoreToPar < 0` (i.e., one under par or better).

**Source:** `src/lib/scoring/domain.ts:isBirdie` (line 39: `scoreToPar < 0`)

---

## 3. Pool Lifecycle

### 3.1 Status Transitions

```
open → live → complete → open | archived
```

No other transitions are allowed.

**Source:** `src/lib/pool.ts:STATUS_TRANSITIONS`, `pool.ts:canTransitionStatus`

### 3.2 Auto-Lock Behavior

An `open` pool automatically transitions to `live` when the deadline passes (as determined by `shouldAutoLock`).

**Source:** `src/lib/picks.ts:shouldAutoLock`

---

## 4. Picks Locking

### 4.1 Lock Condition

A pool is **locked** when EITHER of these is true:
1. Pool status is not `open`
2. Current time >= lock instant

**Source:** `src/lib/picks.ts:isPoolLocked`

### 4.2 Lock Instant Calculation

The lock instant is **midnight (00:00) in the pool's configured timezone** on the deadline date.

- Input: `deadline` (ISO date string like `2026-04-10`) and `timezone` (IANA timezone like `America/New_York`)
- The deadline represents a local date in the pool's timezone
- The lock instant is computed via iterative offset resolution (up to 3 iterations) to handle DST transitions
- UTC midnight in the pool timezone = lock time

**Source:** `src/lib/picks.ts:getTournamentLockInstant`

**Example:**
```
deadline = "2026-04-09T00:00:00+00:00"
timezone = "America/New_York"
lockAt = 2026-04-09T04:00:00.000Z  (midnight ET = 4am UTC)
```

### 4.3 Locked Pool Behavior

- All pick mutations are rejected with error: "This pool is locked. Picks can no longer be changed."
- Picks can no longer be changed for any user (including commissioner)
- Spectators can still view the leaderboard

**Source:** `src/lib/picks.ts:validatePickSubmission`

### 4.4 Picks Lock for All Users

Commissioner picks are subject to the same locking rules as player picks.

**Source:** `src/lib/picks.ts:isCommissionerPoolLocked`

---

## 5. Golfer Status Handling

### 5.1 Cut

- Occurs when a golfer fails to make the cut line
- Post-cut, the golfer's scores are archived but the golfer is excluded from best-ball calculation
- An entry with 1 cut golfer + 3 active golfers still uses best ball among the 3 active golfers for remaining rounds

### 5.2 Withdrawn (WD)

- Occurs when a golfer voluntarily withdraws mid-tournament
- Post-WD, the golfer is excluded from best-ball calculation
- Same treatment as cut for scoring purposes

### 5.3 Disqualified (DQ)

- Not explicitly modeled in `GolferStatus` type (`'active' | 'withdrawn' | 'cut'`)
- If external data contains `dq` status, it should be treated equivalently to `withdrawn`
- **Open question:** DQ is not explicitly tested; clarify if DQ should be treated differently than WD

### 5.4 Incomplete Round (Thru < 18)

- When a golfer has `thru < 18` (round in progress), `isComplete: false`
- Per round-gating rule (2.3), incomplete rounds do not contribute to the entry score
- This means a round where any entry golfer is mid-round does not count

---

## 6. Playoff Handling

**Playoff holes do NOT count toward MVP scoring.**

The scoring system only processes regulation rounds (1–18 holes). Playoff holes are not modeled in `TournamentScore` or `TournamentScoreRound` and are excluded from:
- Score accumulation
- Leaderboard rankings
- Birdie counts

---

## 7. Spectator Visibility

### 7.1 Data Freshness

| Threshold | Value | Behavior |
|-----------|-------|---------|
| Staleness threshold | 15 minutes | Data older than 15 min is considered stale |
| Server-side | Auto-refresh | Cron job or manual refresh updates scores |
| Client-side | Re-fetch triggers | Re-fetch on: mount, broadcast, reconnect, visibility change |

**Source:** `src/app/api/leaderboard/[poolId]/route.ts`, `CLAUDE.md`

### 7.2 In-Progress Round Display

Spectators see in-progress data based on last refresh. There is no real-time push; the UI polls on visibility change.

---

## 8. Archive Rules

### 8.1 Archive Before Write

Before writing current score data, the system archives all round-level data to `tournament_score_rounds`.

**Source:** `src/lib/scoring-queries.ts:upsertTournamentScore`

### 8.2 Archive Record Exclusions

Archive records (`tournament_score_rounds`) must **NOT** include `round_status`.

This is a Board-authorized rule to prevent circular dependencies with leaderboard state.

**Source:** `src/lib/scoring-queries.ts` (test at `scoring-queries.test.ts:109`), `audit.ts`

---

## 9. Edge Case Matrix

### 9.1 Scoring Edge Cases

| Scenario | Entry Golfers | Round 1 | Round 2 | Expected Score | Birdies | Notes |
|----------|--------------|---------|---------|----------------|---------|-------|
| Normal | g1(-1), g2(-1), g3(0), g4(+1) | Complete | Complete | -2 | 2 | Best ball each round |
| Cut mid-tournament | g1(-1,cut), g2(-1,+1), g3(0,+1), g4(+1,0) | Complete | Complete | -1 | 1 | g1 post-cut excluded from R2 |
| WD mid-tournament | g1(-1,wd), g2(-1,-1), g3(0,0), g4(+1,+1) | Complete | Complete | -2 | 2 | g1 post-WD excluded from R2 |
| Partial round | g1(-1, incomplete), g2(-1,+1), g3(0,+1), g4(+1,0) | R1 only | — | -1 | 1 | R2 skipped (not all complete) |
| All cut after R1 | g1(cut), g2(cut), g3(cut), g4(cut) | Complete | — | 0 | 0 | No valid R2, score is 0 |
| Entry has no active golfers | all withdrawn/cut | Complete | Complete | null | 0 | totalScore is null, ranks last |
| Tie score, tie birdies | e1: -2 total, 2 birdies; e2: -2 total, 2 birdies | — | — | -2 each | 2 each | Shared rank 1 |

### 9.2 Leaderboard Edge Cases

| Scenario | Display Behavior |
|----------|-----------------|
| Null totalScore | Entry shown at bottom with `—` or `null` |
| Shared rank | Both entries show same rank number; next rank skips (e.g., 1, 1, 3) |
| In-progress round | Last completed round only; in-progress not reflected |
| Stale data (>15 min) | UI shows stale indicator |

### 9.3 Locking Edge Cases

| Scenario | Locked? | Notes |
|----------|---------|-------|
| Open, deadline in future | No | Normal state |
| Open, deadline in past | Yes | Auto-locked via `shouldAutoLock` |
| Live pool | Yes | Locked regardless of deadline |
| Complete pool | Yes | Locked regardless of deadline |
| Archived pool | Yes | Locked; no reopening |
| Invalid deadline string | Yes | Failsafe: lock the pool |
| DST transition day | Correct | Iterative offset resolution handles this |

---

## 10. Out of Scope for MVP

The following are **explicitly excluded** from MVP rules and should not be implemented unless added as a separate story:

- Playoff hole scoring and tiebreaker
- Season-long points or rolling standings
- Ranking tier rules beyond documenting future compatibility
- Multiple pool formats beyond `best_ball`
- Multi-entry support (one entry per user per pool is enforced by absence of multi-entry logic)
- Real-time push updates (polling only)
- Custom tiebreaker beyond birdies
- Reskin or configurable picks-per-entry after pool creation

---

## 11. Open Questions

| # | Question | Impact | Resolution Needed From |
|---|----------|--------|----------------------|
| 1 | How should `dq` status be handled? Should it be treated like `withdrawn` or flagged differently? | Low (unlikely in MVP sample data) | Product Planner |
| 2 | If all 4 golfers in an entry are cut/WD before any round completes, should the entry show `null` score or be excluded? | Medium (affects UI display) | Product Planner |
| 3 | Is the archive record exclusion (`round_status` not in archive) intentional and permanent, or a temporary workaround? | High (affects data model) | Board/Technical |

---

*This document is the single source of truth for MVP rules. When implementation and this document disagree, this document should be updated first and implementation adjusted to match.*
