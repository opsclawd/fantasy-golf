# Data Contract Audit

**Issue:** [PAP-13 Phase 1 — audit the current codebase against the product rules](/PAP/issues/PAP-13)
**Date:** 2026-04-20
**Status:** Phase 1 complete

---

## 1. Slash Golf API — What We Actually Get

### Leaderboard Endpoint (`/leaderboard`)

**Used by:** `src/lib/slash-golf/client.ts` (`getTournamentScores`)

**Used in:** `refreshScoresForPool` (`scoring-refresh.ts`)

**Representative response shape** (from `sample.json`):

```json
{
  "orgId": "1",
  "year": "2026",
  "tournId": "041",
  "roundId": 1,
  "lastUpdated": "2026-04-02T19:36:12.904000",
  "leaderboardRows": [
    {
      "playerId": "29725",
      "lastName": "Finau",
      "firstName": "Tony",
      "status": "active",
      "position": "1",
      "total": "-6",
      "currentRoundScore": "-6",
      "totalStrokesFromCompletedRounds": "66",
      "currentHole": 9,
      "startingHole": 10,
      "roundComplete": true,
      "rounds": [
        {
          "scoreToPar": "-6",
          "roundId": 1,
          "strokes": 66,
          "courseId": "770",
          "courseName": "TPC San Antonio - The Oaks Course"
        }
      ],
      "thru": "F*",
      "currentRound": 1,
      "teeTime": "9:48am"
    }
  ]
}
```

**What the leaderboard provides:**

| Field | Present? | Notes |
|---|---|---|
| Per-golfer total score (`total`) | ✅ | Score-to-par string, e.g. `"-6"` |
| Per-round strokes (`rounds[].strokes`) | ✅ | Only when round is complete or in-progress |
| Per-round score-to-par (`rounds[].scoreToPar`) | ✅ | Same |
| Position/standing (`position`) | ✅ | e.g. `"1"`, `"T2"`, `"T9"` |
| Birdie counts | ❌ | Not present in response |
| Hole-by-hole scores | ❌ | Not present in response |
| Per-hole strokes | ❌ | Not present in response |

### Scorecard Endpoint (`/scorecard`)

**NOT currently used.** This is a separate endpoint (one request per golfer) that returns:

```json
[
  {
    "roundId": 1,
    "roundComplete": true,
    "currentHole": 18,
    "currentRoundScore": "-5",
    "holes": {
      "1": { "holeId": 1, "holeScore": 4, "par": 4 },
      "2": { "holeId": 2, "holeScore": 4, "par": 5 }
      // ... holes 3–18
    },
    "totalShots": 67
  }
]
```

**Key differences from leaderboard:**
- Provides `holes` object with per-hole `holeScore` (not `strokes`)
- Only available per golfer, not for the full field
- Would be required for true hole-by-hole best-ball scoring

---

## 2. Internal Data Contract — What We Store

### `tournament_scores` (current state)

| Column | Source field from leaderboard | Notes |
|---|---|---|
| `golfer_id` | `playerId` | Required |
| `tournament_id` | `tournId` (from request) | Passed in, not from body |
| `round_id` | `currentRound` | Not a completed-round counter; the active round number |
| `total_score` | `total` (score-to-par) | Parsed to integer; `null` if `"-"` |
| `position` | `position` | String, e.g. `"T2"` |
| `total_birdies` | `total_birdies ?? 0` | **Always 0** — not in leaderboard response |
| `status` | `status` | `active`, `withdrawn`, `cut` |
| `updated_at` | `timestamp` | From response top-level `lastUpdated` |

### `tournament_score_rounds` (per-round archive)

| Column | Source field | Notes |
|---|---|---|
| `golfer_id` | `playerId` | |
| `tournament_id` | `tournId` | |
| `round_id` | `rounds[].roundId` | Only populated when `rounds.length > 0` |
| `strokes` | `rounds[].strokes` | Round total strokes |
| `score_to_par` | `rounds[].scoreToPar` | Parsed integer |
| `course_id`, `course_name` | `rounds[].courseId`, `rounds[].courseName` | |
| `total_score`, `position`, `status` | Duplicated from top-level record | See above |
| `total_birdies` | `total_birdies ?? 0` | **Always 0** |

### What is NOT stored anywhere

- **Hole-level strokes** — no `tournament_holes` table exists (planned in spec, not implemented)
- **Birdie counts** — not provided by either Slash Golf endpoint
- **Per-hole par values** — not provided by Slash Golf

---

## 3. Scorecard Endpoint Availability

**Finding:** The Slash Golf scorecard endpoint EXISTS and is documented in `docs/superpowers/specs/2026-04-11-hole-by-hole-best-ball-design.md` and `docs/superpowers/plans/2026-04-11-hole-by-hole-best-ball-implementation.md`. The implementation plan (task 2 of that plan) describes adding `getGolfersScorecard` to `src/lib/slash-golf/client.ts`.

**Current state:** The function `getGolfersScorecard` does NOT exist in the codebase. No migration creates `tournament_holes`. The scorecard endpoint has never been integrated.

**If hole-by-hole is required:** The scorecard endpoint must be integrated. The plan exists. The work was not done.

---

## 4. Gap Analysis: Declared vs. Actual

| Product claim (PRD) | Implementation delivers? | Notes |
|---|---|---|
| FR17: Lock entries at tournament deadline | ✅ | `getTournamentLockInstant` in `picks.ts` |
| FR18: Refresh scores on recurring cadence | ✅ | Cron route `api/cron/scoring/route.ts` |
| FR19: Calculate standings from scoring rules | ✅ | `rankEntries` in `scoring.ts` |
| FR20: Display live leaderboard | ✅ | `api/leaderboard/[poolId]/route.ts` |
| FR21: Show whether data is current or stale | ✅ | `freshness.ts` + `leaderboard-trust-status.tsx` |
| FR22: Show score changes | ⚠️ | Only total score changes; birdies always 0 |
| FR23: Tie-breaking rules | ❌ | Birdies tiebreaker is non-functional (always 0) |
| FR24: Handle withdrawals/cuts | ✅ | Status field in `TournamentScore` |
| FR28: Record scoring changes | ✅ | `audit_events` table + `refreshDetails` in `audit.ts` |

---

## 5. Risk Summary

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Birdie tiebreaker is random | **High** (it is currently broken) | Medium — violates PRD correctness requirement | Fix `total_birdies` sourcing or remove birdie tiebreaker from spec |
| Hole-by-hole feature never shipped | High (scope gap) | Medium — picks page metric is wrong per team's own spec | Prioritize `tournament_holes` + scorecard integration |
| `schema.sql` misleads developers | Medium | Low — only affects documentation | Update `schema.sql` to reflect applied migrations |
| `completedRounds` display during live play | Low | Low — display only | Accept as known limitation or use scorecard `roundComplete` |

---

## 6. Required Actions

1. **[Critical]** Fix birdie tiebreaker — either source `total_birdies` from a real data source or remove the tiebreaker from `rankEntries` until data is available
2. **[High]** Update `schema.sql` to reflect current database structure (remove `hole_1`–`hole_18`, add `tournament_score_rounds`)
3. **[High]** Decide whether hole-by-hole best-ball is in-scope for MVP or deferred — if deferred, the picks page metric should be removed or relabeled
4. **[Medium]** If hole-by-hole is required: implement `getGolfersScorecard` and `tournament_holes` table per the existing spec
