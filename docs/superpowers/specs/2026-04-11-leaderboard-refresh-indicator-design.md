# Leaderboard Refresh Indicator — Design Spec

## Context

On the spectator leaderboard page, when scoring data is stale the API triggers a background refresh. However, after the refresh completes, the leaderboard UI doesn't update until the user manually refreshes the page. Additionally, there is no visual feedback that a refresh is in progress — the "Refreshing scores..." state exists in the `TrustStatusBar` component but is never activated client-side.

## Goals

1. Show "Refreshing scores..." indicator when a fetch is in progress (triggered by real-time event or any future fetch)
2. Show "Scores are current" with a green checkmark when fresh data arrives
3. Replace the 30-second polling interval with an event-driven refresh model — the server already owns staleness via a 15m threshold and refreshes upstream on fetch, so the client only needs to fetch when something actually changes or a recovery condition is detected
4. Use the existing `TrustStatusBar` component as the display surface

## Refresh Model

The client re-fetches the leaderboard on exactly these triggers:

1. **Mount** — initial load.
2. **Realtime `scores` broadcast** — low-latency update path when Slash Golf data changes.
3. **Realtime channel reconnect** — when the Supabase channel transitions back to `SUBSCRIBED` after a drop. Closes the "silent channel failure" gap that made pure event-driven models unsafe.
4. **Tab visibility → `visible`** — handles laptop sleep, backgrounded tabs, and proxy timeouts. One fetch per transition, not a loop.
5. **Slow heartbeat safety net** — a single `setInterval` at 120s. With the 15m server staleness threshold, most heartbeats return cached data without an upstream API call, so cost is negligible. This exists only to guarantee eventual consistency if triggers 2–4 all fail.

No 30s polling. Freshness and "refreshing" state must remain visible in the UI at all times per CLAUDE.md.

## Design

### Data Flow

```
User visits page
    └─ fetchLeaderboard() → API returns data (isRefreshing=true if background refresh triggered)
           └─ TrustStatusBar shows "Refreshing scores..." (first render)
           └─ TrustStatusBar shows "Scores are current" (after background refresh completes)

Slash Golf scores update → refreshScoresForPool() → broadcasts 'scores' event
    └─ Leaderboard receives broadcast → fetchLeaderboard() → API returns fresh data
           └─ isFetching=true during request
           └─ TrustStatusBar shows "Refreshing scores..." during fetch
           └─ TrustStatusBar shows "Scores are current" (green checkmark) on success
```

### Changes

#### 1. `src/components/TrustStatusBar.tsx`

Add `isFetching` as a new prop alongside the existing `isRefreshing` prop. Both indicate a refresh is happening — the source differs (client vs server) but the user-facing state is identical.

- `getFreshnessLabel`: treat `isFetching || isRefreshing` the same — return `'Refreshing'`
- `getFreshnessMessage`: treat `isFetching || isRefreshing` the same — return `'Refreshing scores...'` with optional last-updated suffix
- `getTrustStatusBarState`: pass `isFetching` through to the freshness helpers

No visual changes to the component itself — the existing "Refreshing" state already renders appropriately with the info tone.

#### 2. `src/components/leaderboard.tsx`

- Add `isFetching` state (boolean, default false) plus an `inFlightRef` counter (useRef) to guard against overlapping fetches clearing state prematurely
- At start of `fetchLeaderboard()`: increment `inFlightRef`, set `isFetching = true`
- In the `finally` block: decrement `inFlightRef`, set `isFetching = false` only when the counter reaches 0
- Remove the 30s `setInterval`, the `pollInterval` prop, and the `DEFAULT_POLL_INTERVAL` constant
- Add a 120s heartbeat `setInterval` as a slow safety net (see Refresh Model)
- Subscribe to channel status; on transition back to `SUBSCRIBED` after a prior drop, call `fetchLeaderboard()` once
- Add a `visibilitychange` listener that calls `fetchLeaderboard()` when `document.visibilityState === 'visible'`
- Pass `isFetching` to `TrustStatusBar` and `LeaderboardHeader`

#### 3. `src/components/LeaderboardHeader.tsx`

When `freshness === 'current'` and `!isFetching`, render a green checkmark inline before the "Live standings" label (top-left of the header). Use an escaped Unicode codepoint (`'\u2705'`) to match the house style used by `TrustStatusBar` for its lock glyphs (`'\uD83D\uDD12'`), not a raw emoji literal.

When `isFetching` is true, **supplement** the round text rather than replacing it — render as `Round 2 · Refreshing…`. Replacing the round text causes it to flicker out on every realtime tick and drops useful context.

The component receives `completedRounds`, `freshness`, and `isFetching` as props.

### Component Props

#### `TrustStatusBar` (modified)
```typescript
interface TrustStatusBarProps extends GetTrustStatusBarStateInput {
  className?: string
  // existing:
  isRefreshing?: boolean
  // new:
  isFetching?: boolean
}
```

#### `LeaderboardHeader` (modified)
```typescript
interface LeaderboardHeaderProps {
  completedRounds: number
  freshness: FreshnessStatus
  isFetching: boolean
}
```

### States

| State | `freshness` | `isRefreshing` | `isFetching` | TrustStatusBar | LeaderboardHeader |
|-------|------------|----------------|--------------|----------------|-------------------|
| Initial load | varies | true/false | false (set during fetch) | "Refreshing..." or "Scores current" | checkmark or rounds |
| Real-time update in flight | current | false | true | "Refreshing scores..." | "Refreshing..." |
| Real-time update complete | current | false | false | "Scores are current" ✅ | green checkmark |
| Error state | stale | false | false | "Scores may be delayed" | stale indicator |

### No Changes

- API route (`src/app/api/leaderboard/[poolId]/route.ts`) — already returns `isRefreshing` and `freshness` correctly
- `refreshScoresForPool` (`src/lib/scoring-refresh.ts`) — already broadcasts on completion
- No new files created
- No changes to scoring logic or database

## Testing

Add unit tests mirroring the existing `isRefreshing` coverage in `src/components/__tests__/TrustStatusBar.test.tsx`:

- `getTrustStatusBarState` returns `freshnessLabel: 'Refreshing'` and `'Refreshing scores...'` message when `isFetching=true` (mirrors the existing `isRefreshing` test at line 180)
- `getTrustStatusBarState` treats `isRefreshing || isFetching` identically — either alone, or both, yields the same refreshing state
- `isFetching` takes priority over a `lastRefreshError` (mirrors the existing `isRefreshing` priority test at line 209)
- `TrustStatusBar` renders "Scores are current" when `freshness=current` and both flags are false

Leaderboard-level behaviors to verify (manual or integration):

- No initial-mount loading spinner re-appears on subsequent fetches
- Real-time broadcast triggers a re-fetch with `isFetching=true` during the request
- After the re-fetch completes, the green checkmark appears in `LeaderboardHeader`
- Two rapid broadcasts do not clear `isFetching` until both fetches settle (overlapping-fetch guard)
- Tab visibility transition to `visible` triggers exactly one fetch
- Channel reconnect after a forced drop triggers exactly one fetch
- DevTools Network tab shows no 30s cadence — only event-driven fetches plus a 120s heartbeat
