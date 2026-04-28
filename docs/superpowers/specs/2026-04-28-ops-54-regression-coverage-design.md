# OPS-54: Regression Coverage — Scoring, Provider Mapping, Refresh Flow

## Problem

OPS-53 and OPS-52 introduced significant scoring pipeline changes (distributed locking, new Slash Golf endpoints, hole-level scoring paths, scorecard normalization). The existing test suite covers happy paths but has material gaps in:

1. **Scoring domain** — edge cases in `computeEntryScore`, missing golfer IDs, all-rounds-incomplete scenarios
2. **Provider mapping** (`slash-golf-client.test.ts`) — empty leaderboard responses, alternate response shapes, DQ status normalization
3. **Refresh flow** (`scoring-refresh.test.ts`) — empty API responses, partial upsert failures, error handling on metadata/telemetry writes, pool with zero entries
4. **pool-queries** — no unit tests for the four functions called by `refreshScoresForPool`

Absence of coverage means future changes can silently break these edge cases.

## What Exists Today

### Existing Test Files

| File | Coverage |
|------|----------|
| `src/lib/__tests__/scoring.test.ts` | `getEntryRoundScore`, `rankEntries`, `calculateEntryBirdies`, `calculateEntryTotalScore`, `deriveCompletedRounds` |
| `src/lib/__tests__/domain-scoring.test.ts` | `isActiveGolfer`, `computeEntryScore`, `deriveCompletedRounds`, `rankEntries` (score/birdies tie) |
| `src/lib/__tests__/slash-golf-client.test.ts` | `getTournamentScores` (3 shapes), `getTournamentMeta`, `getLeaderboard`, `getScorecard`, `getStats` |
| `src/lib/__tests__/scoring-refresh.test.ts` | Happy path, `FETCH_FAILED`, `UPSERT_FAILED`, multi-pool broadcast |
| `src/lib/__tests__/scoring-queries.test.ts` | `upsertTournamentScore` (round archive, no round_status), `upsertTournamentHoles` |
| `src/lib/__tests__/picks.test.ts` | `validatePickSubmission`, `isPoolLocked`, `calculateRemainingPicks`, `shouldAutoLock`, `getTournamentLockInstant`, `isCommissionerPoolLocked` |

### Test-Neglected Areas

| Area | Functions / Paths | Status |
|------|-------------------|--------|
| Scoring domain | `computeEntryScore` — all rounds incomplete; golfer ID in entry but not in score map | **No test** |
| Scoring domain | `rankEntries` — empty entries array | **No test** |
| Slash Golf client | `getTournamentScores` — empty `leaderboardRows` | **No test** |
| Slash Golf client | `getTournamentScores` — non-200 HTTP with JSON error body | **No test** |
| Slash Golf client | `getTournamentScores` — alternate shapes (`data`, `scores`, `players` arrays) | **No test** |
| Slash Golf client | `parseScoreValue` — `'-'` and `'72*'` variants | **No test** |
| Slash Golf client | `normalizeSlashStatus` — `'dq'` maps to `'dq'` but `normalizeGolferStatus` discards it | **Partial** |
| Refresh flow | Empty `slashScores` array returned by API | **No test** |
| Refresh flow | Partial upsert failure (2 OK, 1 fail) | **No test** |
| Refresh flow | `updatePoolRefreshMetadata` failure on success path (line 136) | **No test** |
| Refresh flow | `insertAuditEvent` failure on success path (line 187) | **No test** |
| Refresh flow | Pool with zero entries (empty array from `getEntriesForPool`) | **No test** |
| Refresh flow | `deriveCompletedRounds === 0` (tournament not started) | **No test** |
| pool-queries | `getPoolsByTournament`, `getEntriesForPool`, `updatePoolRefreshMetadata`, `insertAuditEvent` | **No unit tests** |

---

## Design

### Strategy

Add new focused test files rather than bloating existing ones. This keeps test intent clear and makes it easy to verify coverage is complete per gap.

### New Test Files

#### 1. `src/lib/__tests__/scoring-edge-cases.test.ts`

Covers edge cases in the scoring domain that existing tests don't reach.

**Tests:**
- `computeEntryScore`: all golfers have every round with `isComplete: false` → `totalScore: 0, totalBirdies: 0, completedHoles: 0`
- `computeEntryScore`: entry contains a golfer ID not present in `golferRoundScores` map → that golfer is silently skipped (no crash, no score contribution)
- `computeEntryScore`: entry has fewer than 4 golfers → still computes a valid score (lowest score among available)
- `rankEntries`: empty entries array → returns empty array without crash
- `rankEntries`: `golferRoundScores` map is empty → all entries get `totalScore: 0` (no crash)

#### 2. `src/lib/__tests__/slash-golf-client-edge-cases.test.ts`

Covers edge cases in the Slash Golf provider adapter.

**Tests:**
- `getTournamentScores`: API returns `leaderboardRows: []` (empty tournament) → returns `[]`, no error thrown
- `getTournamentScores`: API returns non-200 HTTP response with JSON error body → throws `Error('Failed to fetch scores')` with status info logged
- `getTournamentScores`: response wrapped in `{ data: [...] }` shape → normalizes correctly (hit the alternate shape path at line 47)
- `getTournamentScores`: response wrapped in `{ scores: [...] }` shape → normalizes correctly
- `getTournamentScores`: response wrapped in `{ players: [...] }` shape → normalizes correctly
- `getTournamentScores`: `total: '-'` in response → `total_score: null` (exercises `parseScoreValue` null case)
- `getTournamentScores`: `total: '72*'` in response → `total_score: 72` (asterisk stripped)
- `getTournamentScores`: `status: 'dq'` in golfer row → normalized to `'dq'` via `normalizeSlashStatus`; `GolferScore.status` is `'dq'`
- `getLeaderboard`: response missing `roundId` or `roundStatus` fields → still returns a valid `SlashLeaderboard` with nullish defaults
- `getScorecard`: empty `holes: []` → returns scorecard with empty holes array
- `getStats`: null `worldRank` and `projectedOWGR` → both returned as `null`

#### 3. `src/lib/__tests__/scoring-refresh-edge-cases.test.ts`

Covers error and edge-case paths in the refresh pipeline.

**Tests:**
- API returns empty `slashScores` array → `{ data: null, error: { code: 'NO_SCORES' } }` returned (new error code, distinguishes empty from fetch-failed)
- Partial upsert failure: 3 golfers from API, 2 upsert OK, 1 fails → `{ data: null, error: { code: 'UPSERT_FAILED' } }` with failure message listing the failed golfer
- `updatePoolRefreshMetadata` fails on success path (after all upserts succeed) → `{ data: null, error: { code: 'INTERNAL_ERROR' } }`
- `insertAuditEvent` fails on success path → `{ data: null, error: { code: 'INTERNAL_ERROR' } }`
- Pool has zero entries (`getEntriesForPool` returns `[]`) → broadcast sends with empty `ranked` array (no crash)
- `deriveCompletedRounds === 0` (tournament not started, no scores yet) → returns `{ data: { completedRounds: 0, refreshedAt } }` with no error

#### 4. `src/lib/__tests__/pool-queries-for-scoring-refresh.test.ts`

Unit tests for the four pool-queries functions that `refreshScoresForPool` depends on but currently only have integration/mock coverage.

**Tests:**

`getPoolsByTournament`:
- Returns pools filtered by `tournament_id`
- Returns empty array when no pools match
- Throws when query fails (error propagated)

`getEntriesForPool`:
- Returns entries for a specific pool
- Returns empty array when pool has no entries
- Throws when query fails

`updatePoolRefreshMetadata`:
- Calls `pools.update()` with correct fields (`refreshed_at`, `last_refresh_error`) for success case
- Calls `pools.update()` with `last_refresh_error: string` for failure case
- Does not call `pools.update()` when `refreshed_at` is `null` (no-op on success path — current behavior: always called with an object even if all fields are null)
- Returns `{ error: null }` on success
- Returns `{ error: 'message' }` on failure

`insertAuditEvent`:
- Calls `audit_events.insert()` with correct fields (`pool_id`, `user_id: null`, `action`, `details`)
- Returns `{ error: null }` on success
- Returns `{ error: 'message' }` on failure
- Throws when `pool_id` is missing (error propagates from caller)

---

## File Changes

| File | Change |
|------|--------|
| `src/lib/__tests__/scoring-edge-cases.test.ts` | **New** — scoring domain edge cases |
| `src/lib/__tests__/slash-golf-client-edge-cases.test.ts` | **New** — Slash Golf client edge cases |
| `src/lib/__tests__/scoring-refresh-edge-cases.test.ts` | **New** — refresh pipeline edge cases |
| `src/lib/__tests__/pool-queries-for-scoring-refresh.test.ts` | **New** — pool-queries unit tests for refresh dependencies |

No production code changes. No new dependencies.

---

## Design Decisions

### 1. New `NO_SCORES` error code vs. silently succeeding

**Decision:** Add `NO_SCORES` error code (`'NO_SCORES' | 'FETCH_FAILED' | 'UPSERT_FAILED' | 'INTERNAL_ERROR'` on `RefreshError`). An empty leaderboard response from the API is a meaningful signal — the tournament may not be published yet — and should not be silently treated as success.

**Alternative:** Treat empty as no-op success (return `{ data: { completedRounds: 0, refreshedAt } }`). Rejected because downstream consumers (UI) need to distinguish "no data yet" from "refresh succeeded with no golfers."

### 2. `updatePoolRefreshMetadata` failure is `INTERNAL_ERROR`

**Decision:** `updatePoolRefreshMetadata` failure on the success path (after all upserts succeeded) is a hard failure returned as `INTERNAL_ERROR`. The scores are persisted; the telemetry just didn't update. But this signals to the caller that something is wrong and retry may be needed.

### 3. `insertAuditEvent` failure is `INTERNAL_ERROR`

Same reasoning as above — audit event write failure after scores are persisted is a `INTERNAL_ERROR`, not silently swallowed.

### 4. `getPoolsByTournament` throws on DB error

**Decision:** `getPoolsByTournament` currently returns `[]` on DB error (no throw). This means a DB failure during refresh silently proceeds with no pools updated. The new test will document the current behavior (no throw, returns `[]`) and any future changes to make it throw are a separate decision.

For the test, we'll verify current behavior: no throw, returns empty array on error.

---

## Out of Scope

- Integration tests or e2e tests
- Changes to scoring logic or API routes
- Migration files

**Note:** The `NO_SCORES` error code addition is a minimal production code change scoped to exactly what's needed for the refresh flow to handle empty API responses correctly. It does not change the locking, scoring calculation, or broadcast behavior.

---

## Dependencies

- None — all gaps are coverage-only, no dependent stories

---

## Acceptance Criteria

1. `src/lib/__tests__/scoring-edge-cases.test.ts` exists and all tests pass
2. `src/lib/__tests__/slash-golf-client-edge-cases.test.ts` exists and all tests pass
3. `src/lib/__tests__/scoring-refresh-edge-cases.test.ts` exists and all tests pass
4. `src/lib/__tests__/pool-queries-for-scoring-refresh.test.ts` exists and all tests pass
5. Each test file has at least one test per identified gap in the gap analysis
6. New `NO_SCORES` error code is added to `RefreshError` type in `scoring-refresh.ts`:
   ```ts
   export interface RefreshError {
     code: 'NO_SCORES' | 'FETCH_FAILED' | 'UPSERT_FAILED' | 'INTERNAL_ERROR'
     message: string
   }
   ```
7. Empty `slashScores` path in `scoring-refresh.ts` returns `{ data: null, error: { code: 'NO_SCORES', message: '...' }`
8. `npm test -- --run` passes with no failures across all test files
