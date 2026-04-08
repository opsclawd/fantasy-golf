# On-Demand Tournament Scoring Refresh Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace unreliable cron-only scoring with a user-triggered on-demand refresh that checks if data is stale (>15 minutes) before fetching fresh scores. Cron remains as a safety net.

**Architecture:** User page load triggers a staleness check. If data is >15 minutes old, a refresh is initiated. User sees "Refreshing... • Last updated Xm ago" inline with the timestamp. Cron continues firing every 4 hours for baseline reliability when no users visit.

---

## Scope

- On-demand refresh triggered by user page load
- Staleness check using `pool.refreshed_at` timestamp
- Inline "Refreshing..." indicator tied to timestamp
- Cron remains as safety net
- Error handling: show stale data with timestamp (no banner)

---

## Behavior

### On-Demand Refresh Flow

1. User navigates to leaderboard page
2. Server reads `pool.refreshed_at` from database
3. If `now - refreshed_at > 15 minutes`:
   - Initiate refresh from external API
   - Return response with `isRefreshing: true` flag and current `refreshedAt`
4. User sees: "Refreshing... • Last updated 18m ago"
5. After refresh completes, broadcast updates via Supabase Realtime
6. All connected clients receive updated scores

### Staleness Check

- Threshold: `STALE_THRESHOLD_MS = 15 * 60 * 1000` (15 minutes)
- Fixed global constant — not configurable per pool/tournament
- If `refreshed_at` is null, treat as stale

### Cron (Safety Net)

- Continues firing every 4 hours as baseline reliability
- Handles cases where no users visit during between-cron gaps
- Does not conflict with on-demand refreshes

### Error Handling

- If refresh fails, return stale data with honest timestamp
- No error banner — just "Last updated Xm ago"
- Error is logged but user experience is not degraded

---

## File Structure

### New Files

- `src/app/api/scoring/refresh/route.ts` — on-demand refresh endpoint

### Modify

- `src/app/api/leaderboard/[poolId]/route.ts` — add staleness check and `isRefreshing` flag
- `src/app/(app)/leaderboard/page.tsx` — handle refreshing state in UI
- `src/lib/scoring.ts` or constants file — add `STALE_THRESHOLD_MS` constant

---

## API Design

### `POST /api/scoring/refresh`

**Auth:** Bearer token (CRON_SECRET)

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

**Response additions:**
```json
{
  "data": {
    "pool": { ... },
    "ranked": [...],
    "completedRounds": 2,
    "refreshedAt": "2026-04-08T11:45:00.000Z",
    "isRefreshing": true
  }
}
```

---

## Components

### Staleness Check (`isPoolStale`)

```ts
const STALE_THRESHOLD_MS = 15 * 60 * 1000

export function isPoolStale(pool: Pool): boolean {
  if (!pool.refreshed_at) return true
  const age = Date.now() - new Date(pool.refreshed_at).getTime()
  return age > STALE_THRESHOLD_MS
}
```

### Refresh Indicator UI

Location: inline with "Last updated" timestamp in leaderboard header

States:
- **Current**: "Last updated 12m ago"
- **Refreshing**: "Refreshing... • Last updated 18m ago"
- **Error/Stale**: "Last updated 23m ago" (no indicator, just honest age)

---

## Implementation Notes

- Multiple simultaneous users triggering refreshes is acceptable — cron fills gaps if redundant
- Realtime broadcast ensures all connected clients see updates after refresh
- Pool's `refreshed_at` updated on both cron-triggered and on-demand refreshes
- The `isUpdating` mutex in `/api/scoring` prevents concurrent refresh operations

---

## Out of Scope

- Per-pool or per-tournament configurable thresholds
- Deduplication of simultaneous refresh requests
- Error banners or toast notifications for failed refreshes
- Webhooks from external scoring API
