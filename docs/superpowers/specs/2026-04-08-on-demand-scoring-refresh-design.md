# On-Demand Tournament Scoring Refresh Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace unreliable cron-only scoring with a user-triggered on-demand refresh that checks if data is stale (>15 minutes) before fetching fresh scores. Cron remains as a safety net.

**Architecture:** When the leaderboard API route detects stale data, it triggers a background refresh server-side and returns `isRefreshing: true` to the client. The client shows "Refreshing..." inline with the timestamp. Once the refresh completes, Supabase Realtime broadcasts the update to all connected clients. The existing 30-second poll also catches updates. Cron continues firing every 4 hours for baseline reliability.

**Data model:** Tournament data uses a two-table architecture:
- `tournament_scores` — current-state only (slim: `golfer_id`, `tournament_id`, `round_id`, `total_score`, `position`, `total_birdies`, `status`). Used for leaderboard ranking.
- `tournament_score_rounds` — append-only per-round archive with full round data (strokes, score_to_par, course info, tee times, etc.). Used for detailed views and auditing.

The `upsertTournamentScore()` function writes to both tables atomically — it takes the slim current-state fields plus the full `GolferScore` from the API (which contains the `rounds` array).

---

## Scope

- On-demand refresh triggered server-side when leaderboard data is stale
- Staleness check using `pool.refreshed_at` timestamp (15-minute threshold)
- New `POST /api/scoring/refresh` endpoint for pool-specific refresh
- Shared scoring logic extracted from existing cron route to avoid duplication
- Inline "Refreshing..." indicator in TrustStatusBar
- Cron remains as safety net (unchanged)
- Error handling: show stale data with honest timestamp (no error banner)

---

## Behavior

### On-Demand Refresh Flow

1. User navigates to leaderboard page
2. Client fetches `GET /api/leaderboard/[poolId]`
3. Server checks `pool.refreshed_at` — if stale (>15 minutes old or null):
   a. **Server-side** fires a background `POST /api/scoring/refresh` call (fire-and-forget, using `CRON_SECRET` from the server environment)
   b. Returns response with `isRefreshing: true` and current `refreshedAt`
4. Client shows: "Refreshing... • Last updated 18m ago"
5. Refresh endpoint fetches scores from external API, upserts to DB, broadcasts via Supabase Realtime
6. All connected clients receive the update via Realtime (or via the existing 30-second poll)

**Key design choice:** The leaderboard route triggers the refresh server-side. The client never calls the refresh endpoint directly. This avoids exposing `CRON_SECRET` to the browser and needs no new auth mechanism.

### Staleness Check

- Threshold: `STALE_THRESHOLD_MS = 15 * 60 * 1000` (15 minutes)
- Replaces the current `DEFAULT_STALE_THRESHOLD_MS` of 10 minutes in `src/lib/freshness.ts`
- Fixed global constant — not configurable per pool/tournament
- If `refreshed_at` is null, treat as stale (`classifyFreshness` returns `'unknown'`)

### Cron (Safety Net)

- Continues firing every 4 hours as baseline reliability
- Handles cases where no users visit between cron runs
- The cron route (`POST /api/scoring`) keeps its auto-lock and active-pool-finding logic
- The new refresh route (`POST /api/scoring/refresh`) is a targeted, pool-specific variant

### Error Handling

- If refresh fails, user sees stale data with honest timestamp ("Last updated 23m ago")
- No error banner — just the timestamp age
- Errors are logged server-side and recorded in `pool.last_refresh_error`

---

## File Structure

### New Files

- `src/lib/scoring-refresh.ts` — shared scoring refresh logic (extracted from cron route)
- `src/lib/__tests__/scoring-refresh.test.ts` — tests for the shared logic
- `src/app/api/scoring/refresh/route.ts` — on-demand refresh endpoint (thin wrapper)
- `src/app/api/scoring/refresh/route.test.ts` — endpoint tests

### Modify

- `src/app/api/scoring/route.ts` — refactor to call shared `refreshScoresForPool()`
- `src/app/api/leaderboard/[poolId]/route.ts` — add staleness check, fire-and-forget refresh trigger, return `isRefreshing`
- `src/lib/freshness.ts` — update threshold from 10m to 15m
- `src/components/leaderboard.tsx` — pass `isRefreshing` to TrustStatusBar
- `src/components/TrustStatusBar.tsx` — show "Refreshing..." state

---

## API Design

### `POST /api/scoring/refresh`

**Auth:** Bearer token (`CRON_SECRET`) — only called server-to-server, never from client

**Request Body:**
```json
{
  "poolId": "uuid"
}
```

**Response (200 OK):**
```json
{
  "data": {
    "refreshedAt": "2026-04-08T12:00:00.000Z",
    "completedRounds": 2
  },
  "error": null
}
```

**Response (409 Conflict — refresh already in progress):**
```json
{
  "data": null,
  "error": { "code": "UPDATE_IN_PROGRESS", "message": "Refresh already running" }
}
```

### `GET /api/leaderboard/[poolId]`

**New fields in response:**
```json
{
  "data": {
    "entries": [...],
    "completedRounds": 2,
    "refreshedAt": "2026-04-08T11:45:00.000Z",
    "freshness": "stale",
    "isRefreshing": true,
    "poolStatus": "live",
    "lastRefreshError": null,
    "golferStatuses": {},
    "golferNames": {},
    "golferCountries": {},
    "golferScores": {}
  }
}
```

`isRefreshing` is `true` when the server detected staleness and triggered a background refresh. It is `false` when data is current.

---

## Components

### Shared Scoring Logic (`refreshScoresForPool`)

Extracted from `src/app/api/scoring/route.ts` into `src/lib/scoring-refresh.ts`:

```ts
export async function refreshScoresForPool(
  supabase: SupabaseClient,
  pool: RefreshablePool
): Promise<{ data: RefreshResult | null; error: RefreshError | null }>
```

This function handles:
1. Fetch `GolferScore[]` from external API via `getTournamentScores()`
2. For each golfer, call `upsertTournamentScore(supabase, currentState, golferScore)` — this writes both the slim `tournament_scores` row and the per-round `tournament_score_rounds` archive rows
3. Derive `completedRounds` from `score.current_round ?? score.rounds?.length ?? 0`
4. Update refresh metadata, compute rankings, broadcast via Realtime, write audit events

Both the cron route and the refresh endpoint call this function. The upsert call passes the slim current-state fields (`golfer_id`, `tournament_id`, `total_score: score.total`, `position`, `total_birdies`, `status`) as the second arg, and the full `GolferScore` (which contains the `rounds` array) as the third arg.

### Staleness Detection (existing `classifyFreshness`)

Already exists in `src/lib/freshness.ts`. The leaderboard route already calls it. We just need to:
1. Update the threshold from 10m to 15m
2. Use the result to set `isRefreshing` in the response

### Refresh Indicator UI

Location: inline with freshness section in TrustStatusBar

States:
- **Current**: "Scores are current. Last updated at {timestamp}."
- **Refreshing**: "Refreshing scores... Last updated {relative time} ago."
- **Stale (no refresh running)**: "Scores may be delayed. Data is stale."

---

## Implementation Notes

- **No client-side auth needed:** The leaderboard route runs server-side and has access to `CRON_SECRET`. It triggers the refresh internally.
- **Existing infrastructure handles delivery:** Supabase Realtime broadcasts are already wired up in the leaderboard component. The 30-second poll is a fallback.
- **The `isUpdating` mutex** in the refresh endpoint prevents concurrent refresh operations. If a cron run is already in progress, the on-demand trigger gets a 409 and the client simply waits for the next poll.
- **Multiple simultaneous visitors** may cause the leaderboard route to fire multiple refresh requests. The mutex ensures only one runs; the rest get 409s (which are silently ignored since the trigger is fire-and-forget).

---

## Out of Scope

- Per-pool or per-tournament configurable thresholds
- Client-side refresh button
- Error banners or toast notifications for failed refreshes
- Webhooks from external scoring API
- Deduplication of simultaneous refresh triggers (mutex is sufficient)
