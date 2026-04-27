# OPS-52 Call Strategy — Slash Golf Multi-Endpoint Integration

## Endpoint Overview

| Endpoint | Function | When to Call | Data It Provides |
|----------|----------|--------------|-----------------|
| `GET /tournament` | `getTournamentMeta()` | On pool open; on demand | Field list, course info, tournament status |
| `GET /leaderboard` | `getLeaderboard()` | Every refresh cycle (cron + on-demand) | Round status, player status, refresh targeting |
| `GET /scorecard` | `getScorecard()` | Selective (see below) | Per-hole strokes for one golfer |
| `GET /stats` | `getStats()` | Not in MVP scope | World rank, OWGR projections |

## Refresh Targeting via Leaderboard

The `leaderboard.roundStatus` field drives the scorecard fetch strategy:

| `roundStatus` | Meaning | Action |
|---------------|---------|--------|
| `'Pre'` | Round not started | Skip scorecard fetches |
| `'In Progress'` | Live round | Only fetch scorecard for golfers with `thru < 18` |
| `'Round Complete'` | Round just finished | Fetch scorecard for all rostered golfers to lock hole data |
| `'Tournament Complete'` | Tournament over | Fetch scorecards for any golfers missing hole data |

## Selective Scorecard Fetch Logic

### ScorecardFetchPlan

```ts
interface ScorecardFetchPlan {
  tournamentId: string
  year: number
  fetchScorecard: Array<{
    golferId: string
    reason: 'round_complete_backfill' | 'in_progress_refresh' | 'status_change'
  }>
  skipScorecard: Array<{
    golferId: string
    reason: string
  }>
}
```

### Decision Rules (implement in scoring-refresh.ts)

```
GIVEN leaderboard data for a tournament + existing hole counts per golfer:

FOR each golfer in leaderboardRows:
  1. If roundStatus === 'Pre':
     - Skip scorecard. No round has started.

  2. If roundStatus === 'Round Complete' AND golfer has fewer than 18 holes stored:
     - Fetch scorecard (reason: 'round_complete_backfill')

  3. If roundStatus === 'In Progress':
     - If golfer.thru < 18 AND golfer.status === 'active':
       - Fetch scorecard (reason: 'in_progress_refresh')
     - Else skip.

  4. If golfer.status just changed (active -> cut/wd/dq):
     - Fetch scorecard once to capture final state (reason: 'status_change')
     - After fetch, mark golfer inactive for subsequent refreshes.

  5. If golfer has 0 holes stored for a completed round:
     - Fetch scorecard (reason: 'round_complete_backfill')

  6. Otherwise skip.
```

## Rate Limiting

RapidAPI Slash Golf tier limits apply. Default tier: ~100 calls/minute.

**Budget per refresh cycle (assumes 156 golfers, 4 rounds):**

| Operation | Calls | Budget |
|-----------|-------|--------|
| Tournament meta | 1 | Fixed |
| Leaderboard | 1 | Fixed |
| Scorecard (backfill all rostered after round complete) | 156 | 1.6s at 100/min |
| Scorecard (in-progress only for active golfers with thru < 18) | ~50 | 0.5s at 100/min |
| Stats | 0 (out of MVP scope) | — |

**Rate limit strategy:** Call `getScorecard` sequentially (not parallel) to stay within RapidAPI limits. Add a 600ms delay between scorecard calls. Alternatively, use a concurrency cap of 3.

```ts
async function fetchScorecardsWithRateLimit(
  fetches: Array<() => Promise<SlashScorecard>>,
  maxConcurrent = 3,
  delayMs = 600
): Promise<SlashScorecard[]> {
  const results: SlashScorecard[] = []
  for (let i = 0; i < fetches.length; i += maxConcurrent) {
    const batch = fetches.slice(i, i + maxConcurrent)
    const batchResults = await Promise.all(batch.map(f => f()))
    results.push(...batchResults)
    if (i + maxConcurrent < fetches.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
  return results
}
```

## Error Handling Per Endpoint

### Tournament Meta
- 404: Tournament not published → throw `'Tournament field has not been published yet.'`
- 429: Rate limited → exponential backoff, max 3 retries
- 5xx: Server error → fail open with warning (tournament metadata is non-critical)

### Leaderboard
- Empty `leaderboardRows`: Log warning, return empty array. Do not throw.
- 429: Rate limited → exponential backoff, max 3 retries
- Network error → throw so cron can retry on next cycle

### Scorecard
- 404 for individual golfer → log and skip (golfer may have withdrawn before any data)
- 429: Rate limited → wait and retry once; if still limited, skip
- Per-golfer errors must not fail the entire refresh cycle

### Stats
- Not called in MVP. Errors are logged but non-fatal.

## Quota Tracking

Track API calls per refresh to stay within daily/monthly RapidAPI quotas.

```ts
let apiCallsThisCycle = 0

async function refreshWithQuotaTracking(pool: RefreshablePool) {
  // leaderboard call
  const board = await getLeaderboard(pool.tournamentId, pool.year)
  apiCallsThisCycle++

  // scorecard calls (rate-limited)
  for (const fetch of scorecardFetches) {
    if (apiCallsThisCycle >= QUOTA_LIMIT) {
      console.warn('[slash-golf] quota limit reached, skipping remaining scorecards')
      break
    }
    await fetch()
    apiCallsThisCycle++
  }
}
```

## Out-of-Scope Details

- Tournament hole data storage: handled by `upsertTournamentHoles` (OPS-50)
- Cron scheduling/frequency: handled by OPS-29
- Real-time scorecard updates during live play: future work

## Fixture Capture

Capture real payloads for CI reproducibility:

```
fixtures/slash-golf/
  tournament-{tournamentId}.json    # from /tournament endpoint
  leaderboard-{tournamentId}.json  # from /leaderboard endpoint
  scorecard-{tournamentId}-{golferId}.json  # from /scorecard endpoint
  stats-{tournamentId}-{golferId}.json       # from /stats endpoint
```

Fixture files should include a JSON comment header:
```json
{
  // fixture: slash-golf scorecard
  // tournamentId: 014
  // golferId: 22405
  // captured: 2026-04-10
  // note: "status field uses 'complete' not 'finished'"
  ...
}
```
