# Leaderboard Refresh Indicator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **For junior devs:** This plan is written to be followed top-to-bottom with no prior context on the codebase. Every file you need to touch is listed, every line you need to change has a "locate this" anchor, and every non-obvious decision has a **Why** note explaining it. Don't skip the Why notes — they're the difference between "it compiles" and "it's correct."

---

## Goal

Replace the current 30-second leaderboard polling loop with an **event-driven refresh model**, and show clear UI feedback when a refresh is in flight or when data is current.

**User-visible changes:**

- When the leaderboard is fetching new scores, the `TrustStatusBar` shows `Refreshing scores...` (info tone) and the `LeaderboardHeader` appends `· Refreshing…` after the round text.
- When scores are current and no fetch is in flight, the `LeaderboardHeader` shows a green checkmark (✅) before the "Live standings" label.
- Network tab no longer shows a request every 30s. Fetches only fire on real events: mount, realtime broadcast, channel reconnect, tab visibility change, or a slow 120s heartbeat.

**Under-the-hood changes:**

- New client state `isFetching` in the Leaderboard component, guarded by an in-flight counter so overlapping fetches don't prematurely clear it.
- `TrustStatusBar` accepts a new optional `isFetching` prop, treated identically to the existing `isRefreshing` prop.
- `LeaderboardHeader` accepts `freshness` and `isFetching` props.
- `pollInterval` prop and `DEFAULT_POLL_INTERVAL` constant deleted.

**Architecture constraint (from `CLAUDE.md`):** the server owns staleness via a 15-minute threshold. The API triggers upstream refreshes on its own when data is older than the threshold. The client does **not** poll on a fixed interval; it only fetches on real events. Always keep freshness / refreshing state visible in the UI.

**Tech stack touched:** React 18 (client state + hooks), TypeScript (strict), Next.js 14 App Router, Supabase Realtime Channels, Tailwind CSS, Vitest.

---

## Orientation — read this first

Before writing any code, understand the three files you'll be editing. They are all small — spend 5 minutes reading them in full before starting.

### File 1: `src/components/TrustStatusBar.tsx` (~218 lines)

A presentational component that renders a status bar with two concerns:

1. **Lock state** — is the pool open for edits, locked, or archived?
2. **Freshness state** — are scores current, stale, unknown, refreshing, or errored?

All of the decision logic lives in three pure functions you will modify:

- `getFreshnessLabel(freshness, lastRefreshError, isRefreshing)` → returns the badge text (`'Current'`, `'Stale'`, `'No data'`, `'Refresh failed'`, `'Refreshing'`).
- `getFreshnessMessage(freshness, refreshedAt, lastRefreshError, isRefreshing)` → returns the full message plus tone/role/ariaLive.
- `getTrustStatusBarState(input)` → top-level orchestrator that calls both helpers and returns the full render state.

The component has existing test coverage at `src/components/__tests__/TrustStatusBar.test.tsx` — including two tests for `isRefreshing` (one for the happy path, one for priority over a refresh error). You will mirror those tests for `isFetching`.

**Key priority order in the helpers (already implemented for `isRefreshing`, you will preserve it for `isFetching`):**

```
isRefreshing || isFetching → "Refreshing"  (highest — takes priority over error)
lastRefreshError           → "Refresh failed"
freshness === 'current'    → "Current"
freshness === 'stale'      → "Stale"
otherwise                  → "No data"
```

### File 2: `src/components/LeaderboardHeader.tsx` (15 lines)

A tiny stateless component with no current props beyond `completedRounds`. You will add two new props (`freshness`, `isFetching`) and two small render tweaks.

### File 3: `src/components/leaderboard.tsx` (~240 lines)

The main leaderboard component. Manages its own data fetching via `fetchLeaderboard`, a `useCallback` that hits `/api/leaderboard/:poolId` and stores the result in component state. The existing `useEffect` does three things you'll change:

1. Calls `fetchLeaderboard()` once on mount (**keep**).
2. Sets up a 30-second `setInterval` that calls `fetchLeaderboard()` (**delete**).
3. Subscribes to a Supabase realtime channel and re-fetches on `scores` broadcasts (**keep, enhance**).

You'll add: channel-reconnect detection, a `visibilitychange` listener, a slow 120s safety heartbeat, and an in-flight counter.

### React concepts you must know before Task 3

- **`useState` vs `useRef`**: `useState` triggers re-renders when set. `useRef` does not — it's a mutable container that persists across renders. We use `useState` for `isFetching` (because the UI reads it) and `useRef` for the in-flight counter (because no UI reads it directly and we don't want re-renders on every increment).
- **`useCallback` dependency arrays**: changing the deps of `fetchLeaderboard` invalidates it on every render, which would re-run the `useEffect` unnecessarily. Keep `[poolId]` as the only dep.
- **`useEffect` cleanup**: the function you return from a `useEffect` runs on unmount *and* before the effect re-runs. You must clean up every listener, interval, and subscription to avoid leaks and duplicate handlers.
- **Supabase channel `.subscribe(callback)`**: the callback receives a status string. The statuses we care about are `SUBSCRIBED` (connected / re-connected), `CHANNEL_ERROR`, `TIMED_OUT`, and `CLOSED`. The same channel can go `SUBSCRIBED → CLOSED → SUBSCRIBED` on a network blip — that second `SUBSCRIBED` is the reconnect we want to catch.

---

## File Map

| File | Responsibility | Tests |
|------|---------------|-------|
| `src/components/TrustStatusBar.tsx` | Add `isFetching` prop; treat `isFetching \|\| isRefreshing` identically for freshness label/message | `src/components/__tests__/TrustStatusBar.test.tsx` (add 3 tests) |
| `src/components/LeaderboardHeader.tsx` | Add `freshness` and `isFetching` props; show green checkmark when current, supplement round text with `· Refreshing…` when fetching | no existing tests; none required |
| `src/components/leaderboard.tsx` | Add `isFetching` state + in-flight counter; delete `pollInterval` prop and `DEFAULT_POLL_INTERVAL`; replace 30s polling with event-driven triggers (mount + broadcast + reconnect + visibility + 120s heartbeat) | no existing component tests; covered by manual browser verification |

---

## Task order

Do the tasks **in order**: 1 → 2 → 3. Task 3 depends on the prop signatures introduced by Tasks 1 and 2. Commit after each task so a reviewer can see the progression.

Run `npx tsc --noEmit` after every task. Run the relevant Vitest suite after Tasks 1 and 3. Don't skip the type check — it's the fastest way to catch a wiring mistake.

---

## Task 1: TrustStatusBar — add `isFetching` prop

**Files:**
- Modify: `src/components/TrustStatusBar.tsx`
- Modify: `src/components/__tests__/TrustStatusBar.test.tsx`

**What you're doing:** adding a second "refreshing" signal (`isFetching`) that behaves identically to the existing `isRefreshing` signal. The two exist for different reasons — `isRefreshing` is server-signalled (the API tells us a background refresh is in flight), `isFetching` is client-signalled (we started a fetch from the browser) — but the user-facing state is identical for both.

**Why a new prop instead of reusing `isRefreshing`:** keeping them separate preserves the existing semantic of `isRefreshing` (from the API response) and makes the source of truth for each signal clear to future readers. The cost is one `||` in two places.

- [ ] **Step 1: Add `isFetching` to `GetTrustStatusBarStateInput` interface**

**Locate:** `src/components/TrustStatusBar.tsx` lines 6–13. Search for `interface GetTrustStatusBarStateInput`.

**Before:**
```typescript
interface GetTrustStatusBarStateInput {
  isLocked: boolean
  poolStatus: PoolStatus
  freshness: FreshnessStatus
  refreshedAt: string | null
  lastRefreshError: string | null
  isRefreshing?: boolean
}
```

**After:**
```typescript
interface GetTrustStatusBarStateInput {
  isLocked: boolean
  poolStatus: PoolStatus
  freshness: FreshnessStatus
  refreshedAt: string | null
  lastRefreshError: string | null
  isRefreshing?: boolean
  isFetching?: boolean
}
```

**Why optional (`?`)**: existing callers that don't pass `isFetching` must keep working unchanged. All three values of an optional boolean (`undefined`, `false`, `true`) are handled by the `if (isRefreshing || isFetching)` checks.

- [ ] **Step 2: Update `getFreshnessLabel` to accept and check `isFetching`**

**Locate:** `src/components/TrustStatusBar.tsx` lines 115–137. Search for `function getFreshnessLabel`.

**Before:**
```typescript
function getFreshnessLabel(
  freshness: FreshnessStatus,
  lastRefreshError: string | null,
  isRefreshing?: boolean,
): TrustStatusBarState['freshnessLabel'] {
  if (isRefreshing) {
    return 'Refreshing'
  }

  if (lastRefreshError) {
    return 'Refresh failed'
  }

  if (freshness === 'current') {
    return 'Current'
  }

  if (freshness === 'stale') {
    return 'Stale'
  }

  return 'No data'
}
```

**After:**
```typescript
function getFreshnessLabel(
  freshness: FreshnessStatus,
  lastRefreshError: string | null,
  isRefreshing?: boolean,
  isFetching?: boolean,
): TrustStatusBarState['freshnessLabel'] {
  if (isRefreshing || isFetching) {
    return 'Refreshing'
  }

  if (lastRefreshError) {
    return 'Refresh failed'
  }

  if (freshness === 'current') {
    return 'Current'
  }

  if (freshness === 'stale') {
    return 'Stale'
  }

  return 'No data'
}
```

**Why add as the 4th parameter (not 3rd):** preserves positional compatibility for any future direct caller of the helper that already passes `isRefreshing`.

- [ ] **Step 3: Update `getFreshnessMessage` to accept and check `isFetching`**

**Locate:** `src/components/TrustStatusBar.tsx` lines 51–102. Search for `function getFreshnessMessage`.

**Before:** (just the first block — leave everything below the `if (isRefreshing)` block unchanged)
```typescript
function getFreshnessMessage(
  freshness: FreshnessStatus,
  refreshedAt: string | null,
  lastRefreshError: string | null,
  isRefreshing?: boolean,
): Pick<TrustStatusBarState, 'freshnessMessage' | 'tone' | 'role' | 'ariaLive'> {
  if (isRefreshing) {
    const suffix = refreshedAt ? ` Last updated at ${refreshedAt}.` : ''
    return {
      freshnessMessage: `Refreshing scores...${suffix}`,
      tone: 'info',
      role: 'status',
      ariaLive: 'polite',
    }
  }
  // ... keep everything below this line unchanged
```

**After:**
```typescript
function getFreshnessMessage(
  freshness: FreshnessStatus,
  refreshedAt: string | null,
  lastRefreshError: string | null,
  isRefreshing?: boolean,
  isFetching?: boolean,
): Pick<TrustStatusBarState, 'freshnessMessage' | 'tone' | 'role' | 'ariaLive'> {
  if (isRefreshing || isFetching) {
    const suffix = refreshedAt ? ` Last updated at ${refreshedAt}.` : ''
    return {
      freshnessMessage: `Refreshing scores...${suffix}`,
      tone: 'info',
      role: 'status',
      ariaLive: 'polite',
    }
  }
  // ... everything below this line is unchanged
```

**Do NOT modify** the `if (lastRefreshError)`, `if (freshness === 'current')`, `if (freshness === 'stale')`, or the final fallback branches. Just the function signature and the first `if`.

- [ ] **Step 4: Update `getTrustStatusBarState` to pass `isFetching` to both helpers**

**Locate:** `src/components/TrustStatusBar.tsx` lines 139–165. Search for `export function getTrustStatusBarState`.

**Before:**
```typescript
export function getTrustStatusBarState(
  input: GetTrustStatusBarStateInput,
): TrustStatusBarState {
  const heading = 'Tournament status'
  const lockLabel = input.poolStatus === 'archived' ? 'Archived' : input.isLocked ? 'Locked' : 'Open'
  const lockMessage = getLockMessage(input.isLocked, input.poolStatus)
  const showFreshness = input.poolStatus !== 'open'
  const freshnessState = getFreshnessMessage(
    input.freshness,
    input.refreshedAt,
    input.lastRefreshError,
    input.isRefreshing,
  )

  return {
    heading,
    lockLabel,
    lockMessage,
    freshnessLabel: getFreshnessLabel(input.freshness, input.lastRefreshError, input.isRefreshing),
    freshnessMessage: freshnessState.freshnessMessage,
    showFreshness,
    tone: freshnessState.tone,
    role: freshnessState.role,
    ariaLive: freshnessState.ariaLive,
    icon: input.isLocked ? '\uD83D\uDD12' : '\uD83D\uDD13',
  }
}
```

**After:**
```typescript
export function getTrustStatusBarState(
  input: GetTrustStatusBarStateInput,
): TrustStatusBarState {
  const heading = 'Tournament status'
  const lockLabel = input.poolStatus === 'archived' ? 'Archived' : input.isLocked ? 'Locked' : 'Open'
  const lockMessage = getLockMessage(input.isLocked, input.poolStatus)
  const showFreshness = input.poolStatus !== 'open'
  const freshnessState = getFreshnessMessage(
    input.freshness,
    input.refreshedAt,
    input.lastRefreshError,
    input.isRefreshing,
    input.isFetching,
  )

  return {
    heading,
    lockLabel,
    lockMessage,
    freshnessLabel: getFreshnessLabel(
      input.freshness,
      input.lastRefreshError,
      input.isRefreshing,
      input.isFetching,
    ),
    freshnessMessage: freshnessState.freshnessMessage,
    showFreshness,
    tone: freshnessState.tone,
    role: freshnessState.role,
    ariaLive: freshnessState.ariaLive,
    icon: input.isLocked ? '\uD83D\uDD12' : '\uD83D\uDD13',
  }
}
```

**Note:** the `freshnessLabel:` line was previously one line; it's been expanded to multiple lines to fit the new argument. Either formatting is valid — the multi-line form is easier to diff.

- [ ] **Step 5: Verify `TrustStatusBarProps` picks up the new field automatically**

**Locate:** `src/components/TrustStatusBar.tsx` lines 30–32.

```typescript
interface TrustStatusBarProps extends GetTrustStatusBarStateInput {
  className?: string
}
```

**No code change needed here.** Because `TrustStatusBarProps extends GetTrustStatusBarStateInput`, adding `isFetching?` to the parent in Step 1 automatically adds it to the child. Do not duplicate the field — TypeScript will not error, but it's clutter.

- [ ] **Step 6: Add unit tests for `isFetching`**

**Locate:** `src/components/__tests__/TrustStatusBar.test.tsx`. The existing `isRefreshing` tests live at around lines 180 (`'shows refreshing state when isRefreshing is true'`) and 209 (`'prioritizes isRefreshing over refresh error'`). Add the following three tests **immediately after** the existing `isRefreshing` tests, still inside the `describe('getTrustStatusBarState', ...)` block.

```typescript
  it('shows refreshing state when isFetching is true', () => {
    const result = getTrustStatusBarState({
      isLocked: true,
      poolStatus: 'live',
      freshness: 'stale',
      refreshedAt: '2026-04-11T11:45:00.000Z',
      lastRefreshError: null,
      isFetching: true,
    })

    expect(result.freshnessLabel).toBe('Refreshing')
    expect(result.freshnessMessage).toContain('Refreshing scores...')
    expect(result.tone).toBe('info')
  })

  it('prioritizes isFetching over refresh error', () => {
    const result = getTrustStatusBarState({
      isLocked: true,
      poolStatus: 'live',
      freshness: 'stale',
      refreshedAt: '2026-04-11T11:45:00.000Z',
      lastRefreshError: 'PGATour API timed out',
      isFetching: true,
    })

    expect(result.freshnessLabel).toBe('Refreshing')
    expect(result.freshnessMessage).toContain('Refreshing scores...')
  })

  it('treats isRefreshing and isFetching identically when both true', () => {
    const result = getTrustStatusBarState({
      isLocked: true,
      poolStatus: 'live',
      freshness: 'current',
      refreshedAt: '2026-04-11T11:45:00.000Z',
      lastRefreshError: null,
      isRefreshing: true,
      isFetching: true,
    })

    expect(result.freshnessLabel).toBe('Refreshing')
    expect(result.freshnessMessage).toContain('Refreshing scores...')
  })
```

**Why these three tests:** the first proves the happy path. The second proves the priority rule (error doesn't mask a refresh). The third proves the two signals are symmetric — which matters because if some future refactor accidentally short-circuits one, this test will fail.

- [ ] **Step 7: Run type check and tests**

```bash
npx tsc --noEmit
npm test -- TrustStatusBar
```

**Expected output:**
- `tsc` exits with code 0 and no output.
- Vitest runs the `TrustStatusBar.test.tsx` suite. The existing 13 tests should pass plus your 3 new ones — so look for `16 passed` (or similar) in the summary.

**If `tsc` errors:**
- `Property 'isFetching' does not exist on type 'GetTrustStatusBarStateInput'`: you missed Step 1.
- `Expected 3 arguments, but got 4` (on `getFreshnessLabel`): you missed Step 2's signature change.
- `Expected 4 arguments, but got 5` (on `getFreshnessMessage`): you missed Step 3's signature change.

**If tests fail:**
- `expected 'Refresh failed' to be 'Refreshing'`: you probably put the `isFetching` check below the `lastRefreshError` check instead of above it — re-read Step 2.

- [ ] **Step 8: Commit**

```bash
git add src/components/TrustStatusBar.tsx src/components/__tests__/TrustStatusBar.test.tsx
git commit -m "$(cat <<'EOF'
feat: add isFetching prop to TrustStatusBar

Mirrors the existing isRefreshing semantics — both signals resolve to
the same "Refreshing scores..." UI state. isFetching is intended for
client-triggered fetches; isRefreshing remains the server-signalled
background refresh flag.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: LeaderboardHeader — add freshness indicators

**Files:**
- Modify: `src/components/LeaderboardHeader.tsx`

**What you're doing:** turning a 15-line no-prop-drilling component into a 20-line component that reflects freshness state. No new imports beyond the type import for `FreshnessStatus`.

**Before (full file — this is the entire current contents of `src/components/LeaderboardHeader.tsx`):**

```typescript
export function LeaderboardHeader({ completedRounds }: { completedRounds: number }) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200/80 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
          Live standings
        </p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">Leaderboard</h2>
      </div>
      <p className="text-sm font-medium text-slate-500">
        {completedRounds > 0 ? `Round ${completedRounds}` : 'Waiting for first scores'}
      </p>
    </div>
  )
}
```

**After (full file — replace the entire contents):**

```typescript
import type { FreshnessStatus } from '@/lib/supabase/types'

interface LeaderboardHeaderProps {
  completedRounds: number
  freshness: FreshnessStatus
  isFetching: boolean
}

export function LeaderboardHeader({
  completedRounds,
  freshness,
  isFetching,
}: LeaderboardHeaderProps) {
  const showCheckmark = freshness === 'current' && !isFetching

  return (
    <div className="flex flex-col gap-3 border-b border-slate-200/80 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
          {showCheckmark ? (
            <span aria-hidden="true" className="mr-1">
              {'\u2705'}
            </span>
          ) : null}
          Live standings
        </p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">Leaderboard</h2>
      </div>
      <p className="text-sm font-medium text-slate-500">
        {completedRounds > 0 ? `Round ${completedRounds}` : 'Waiting for first scores'}
        {isFetching ? ' · Refreshing…' : null}
      </p>
    </div>
  )
}
```

- [ ] **Step 1: Replace the file with the "After" block above**

**Why an extracted `showCheckmark` const:** the conditional expression `freshness === 'current' && !isFetching` inline in JSX is readable, but extracting it to a named local makes the intent explicit ("we show a checkmark when data is current AND no fetch is happening"). Small readability win.

**Why `'\u2705'` instead of a raw `✅` character:** match the house style in `TrustStatusBar.tsx:163` (which uses `'\uD83D\uDD12'` and `'\uD83D\uDD13'` for the lock glyphs). Escaped codepoints render identically to literal emoji but are more visible in code review and survive encoding hiccups in tooling.

**Why supplement instead of replace the round text:** the realtime subscription fires frequently during a live round. If `isFetching` replaces the round text, `Round 2` flashes out and back in on every update — annoying and loses information. Appending ` · Refreshing…` keeps context visible.

**Why `· ` (middle dot with spaces):** matches common typographic convention for status separators. Unicode codepoint `U+00B7`; typeable directly in most editors, or you can use `'\u00B7'` if your editor mangles it.

**Why `aria-hidden="true"` on the checkmark:** the checkmark is decorative. The adjacent text "Live standings" already conveys the meaning to a screen reader, and the `TrustStatusBar` below it announces the actual freshness state via `role="status"`/`aria-live`. A duplicated "white check mark" announcement from the emoji would be noise.

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

**Expected:** exits with code 0, no output.

**If it errors:**
- `Cannot find module '@/lib/supabase/types'`: your path alias is misconfigured — check `tsconfig.json` for `"paths"`. Should not happen in this repo; fix by verifying the import path matches `src/components/leaderboard.tsx:14`.
- `Type error: JSX element ... is not assignable`: you probably left a stray tag when editing. Compare your file against the "After" block character-by-character.

**No tests to run yet** — this component has no existing test file. Task 3 will exercise it via the manual browser check. (You could add a render-smoke-test with `renderToStaticMarkup`, but it's optional and not required by this plan.)

- [ ] **Step 3: Commit**

```bash
git add src/components/LeaderboardHeader.tsx
git commit -m "$(cat <<'EOF'
feat: add freshness indicators to LeaderboardHeader

Adds a green checkmark when freshness is 'current' and no fetch is
in flight, and supplements the round text with ' · Refreshing…' during
fetches. Checkmark uses the escaped Unicode codepoint to match the
TrustStatusBar house style.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Leaderboard — event-driven refresh model

**Files:**
- Modify: `src/components/leaderboard.tsx`

**What you're doing:** this is the biggest task. Four distinct concerns:

1. **Delete** the `pollInterval` prop and `DEFAULT_POLL_INTERVAL` constant (dead code after we remove polling).
2. **Add** `isFetching` state and an `inFlightRef` counter.
3. **Guard** `fetchLeaderboard` with the counter so overlapping calls don't mis-clear state.
4. **Replace** the `useEffect` that manages the lifecycle with an event-driven version: mount + realtime broadcast + channel reconnect + `visibilitychange` + 120s safety heartbeat.

Do the steps in order. Steps 1–3 are localized edits; Step 4 is a full replacement of the existing `useEffect`; Steps 5–6 wire new props into the JSX. Do **not** try to do all four at once — commit-review each step mentally.

### Before starting: snapshot of current `src/components/leaderboard.tsx`

You can skip reading the whole file if you follow the line numbers below, but here are the sections you'll touch:

- **Imports** (line 3): `import { useEffect, useState, useCallback, useMemo } from 'react'`
- **`LeaderboardData` interface** (lines 16–28): unchanged.
- **`LeaderboardProps` interface** (lines 30–36): you will delete the `pollInterval` field and its JSDoc comment.
- **`DEFAULT_POLL_INTERVAL` constant** (line 38): delete this whole line.
- **`isObject` helper** (lines 40–42): unchanged.
- **Component function signature** (lines 44–48): you will delete the `pollInterval = DEFAULT_POLL_INTERVAL,` destructure.
- **State declarations** (lines 49–53): you will add `isFetching` and `inFlightRef` here.
- **`fetchLeaderboard` useCallback** (lines 55–87): you will wrap the try/finally with counter increments.
- **`useEffect`** (lines 89–113): you will replace the body (keep the mount fetch, delete the interval, enhance the subscribe, add visibility + heartbeat).
- **JSX `<TrustStatusBar>` call** (lines 166–175): you will add `isFetching={isFetching}`.
- **JSX `<LeaderboardHeader>` call** (line 163): you will add `freshness` and `isFetching` props.

---

- [ ] **Step 1: Delete `pollInterval` prop and `DEFAULT_POLL_INTERVAL` constant**

**1a. In `LeaderboardProps` (lines 30–36):**

**Before:**
```typescript
interface LeaderboardProps {
  poolId: string
  /** Polling interval in milliseconds. Default: 30 seconds */
  pollInterval?: number
  /** Hide the TrustStatusBar in the leaderboard header */
  hideTrustStatusHeader?: boolean
}
```

**After:**
```typescript
interface LeaderboardProps {
  poolId: string
  /** Hide the TrustStatusBar in the leaderboard header */
  hideTrustStatusHeader?: boolean
}
```

**1b. Delete line 38 entirely:**

**Before:**
```typescript
const DEFAULT_POLL_INTERVAL = 30_000
```

**After:** (line removed; no replacement)

**1c. In the component function signature (lines 44–48):**

**Before:**
```typescript
export function Leaderboard({
  poolId,
  pollInterval = DEFAULT_POLL_INTERVAL,
  hideTrustStatusHeader = false,
}: LeaderboardProps) {
```

**After:**
```typescript
export function Leaderboard({
  poolId,
  hideTrustStatusHeader = false,
}: LeaderboardProps) {
```

**Why delete rather than deprecate:** the prop has no callers outside this file (verified via `rg 'pollInterval' src/` — only the definition itself matches). Deprecating would leave dead weight. Fail fast if anyone ever tries to pass it.

- [ ] **Step 2: Update the React import and add `isFetching` state plus `inFlightRef`**

**2a. Update the React import on line 3:**

**Before:**
```typescript
import { useEffect, useState, useCallback, useMemo } from 'react'
```

**After:**
```typescript
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
```

**2b. Add state and ref, immediately after the existing `fetchError` state (currently line 51):**

**Before:**
```typescript
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [selectedGolferId, setSelectedGolferId] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])
```

**After:**
```typescript
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [selectedGolferId, setSelectedGolferId] = useState<string | null>(null)
  const inFlightRef = useRef(0)
  const supabase = useMemo(() => createClient(), [])
```

**Why a ref for the counter, not state:** incrementing the counter three times rapidly would cause three re-renders if it were state, which is wasteful and introduces stale-closure bugs in the async `fetchLeaderboard`. A ref mutates synchronously and doesn't trigger renders. The only value React needs to re-render on is `isFetching` (boolean), and we control when that flips.

**Why initialize to `0`:** it's a counter of in-flight requests. Zero means "no fetch active right now." We increment before starting a fetch and decrement in `finally`, and only clear `isFetching` when the counter hits zero.

- [ ] **Step 3: Guard `fetchLeaderboard` with the in-flight counter**

**Locate:** `fetchLeaderboard` useCallback at lines 55–87 (search for `const fetchLeaderboard = useCallback`).

**Before:**
```typescript
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/leaderboard/${poolId}`)
      const json = await res.json()

      if (json.data) {
        setData(json.data)
        setFetchError(null)
      } else if (json.error) {
        setFetchError(json.error.message || 'Failed to load leaderboard')
      } else {
        // Legacy response format (backwards compat during rollout)
        if (json.entries) {
          setData({
            entries: json.entries,
            completedRounds: json.completedRounds ?? 0,
            refreshedAt: json.updatedAt ?? null,
            freshness: 'unknown',
            poolStatus: 'live',
            lastRefreshError: null,
            golferStatuses: {},
            golferNames: {},
            golferCountries: {},
            golferScores: {},
          })
        }
      }
    } catch {
      setFetchError('Network error loading leaderboard')
    } finally {
      setLoading(false)
    }
  }, [poolId])
```

**After:**
```typescript
  const fetchLeaderboard = useCallback(async () => {
    inFlightRef.current += 1
    setIsFetching(true)
    try {
      const res = await fetch(`/api/leaderboard/${poolId}`)
      const json = await res.json()

      if (json.data) {
        setData(json.data)
        setFetchError(null)
      } else if (json.error) {
        setFetchError(json.error.message || 'Failed to load leaderboard')
      } else {
        // Legacy response format (backwards compat during rollout)
        if (json.entries) {
          setData({
            entries: json.entries,
            completedRounds: json.completedRounds ?? 0,
            refreshedAt: json.updatedAt ?? null,
            freshness: 'unknown',
            poolStatus: 'live',
            lastRefreshError: null,
            golferStatuses: {},
            golferNames: {},
            golferCountries: {},
            golferScores: {},
          })
        }
      }
    } catch {
      setFetchError('Network error loading leaderboard')
    } finally {
      setLoading(false)
      inFlightRef.current -= 1
      if (inFlightRef.current === 0) {
        setIsFetching(false)
      }
    }
  }, [poolId])
```

**What changed:** two lines added at the top of the function body (before `try`), and three lines added in `finally` (after `setLoading(false)`).

**Why `setIsFetching(true)` unconditionally on every call:** React de-duplicates state updates — calling `setIsFetching(true)` when it's already `true` is a no-op.

**Why gate `setIsFetching(false)` on the counter:** if two fetches are in flight (e.g., a broadcast arrives while the mount-triggered fetch is still resolving), the first one to `finally` must not clear `isFetching` before the second one finishes. Decrement unconditionally, but only flip the boolean when the count returns to zero.

**Why not add `inFlightRef` to the useCallback deps:** refs are stable across renders, so they don't need to be in dep arrays. Including a ref in deps would be a lint error (react-hooks/exhaustive-deps) and wouldn't trigger re-runs anyway.

- [ ] **Step 4: Replace the polling `useEffect` with the event-driven version**

**Locate:** the `useEffect` at lines 89–113 (search for `useEffect(() => {`, first occurrence — there's only one in this file).

**Before:**
```typescript
  useEffect(() => {
    fetchLeaderboard()

    // Polling: refetch on interval
    const intervalId = setInterval(fetchLeaderboard, pollInterval)

    // Real-time: supplementary live updates
    const channel = supabase
      .channel('pool_updates')
      .on('broadcast', { event: 'scores' }, (payload: unknown) => {
        if (!isObject(payload) || !isObject(payload.payload)) return

        const p = payload.payload as Record<string, unknown>
        if (!Array.isArray(p.ranked)) return

        // On broadcast, trigger a fresh fetch to get full metadata
        fetchLeaderboard()
      })
      .subscribe()

    return () => {
      clearInterval(intervalId)
      supabase.removeChannel(channel)
    }
  }, [poolId, pollInterval, fetchLeaderboard, supabase])
```

**After:**
```typescript
  useEffect(() => {
    fetchLeaderboard()

    // Track whether we've seen at least one SUBSCRIBED event. The very first
    // SUBSCRIBED is the initial connect (mount already fetched), so we ignore
    // it. Every subsequent SUBSCRIBED indicates a reconnect after a drop.
    let hasSubscribedOnce = false

    const channel = supabase
      .channel('pool_updates')
      .on('broadcast', { event: 'scores' }, (payload: unknown) => {
        if (!isObject(payload) || !isObject(payload.payload)) return

        const p = payload.payload as Record<string, unknown>
        if (!Array.isArray(p.ranked)) return

        // On broadcast, trigger a fresh fetch to get full metadata
        fetchLeaderboard()
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (hasSubscribedOnce) {
            fetchLeaderboard()
          }
          hasSubscribedOnce = true
        }
      })

    // Visibility recovery: re-fetch when the tab becomes visible again
    // (handles laptop sleep, backgrounded tabs, proxy timeouts).
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchLeaderboard()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // Slow safety heartbeat. The server owns staleness via a 15m threshold,
    // so most heartbeats return cached data with no upstream API call. This
    // exists only to guarantee eventual consistency if broadcast, reconnect,
    // and visibility triggers all fail.
    const heartbeatId = setInterval(fetchLeaderboard, 120_000)

    return () => {
      clearInterval(heartbeatId)
      document.removeEventListener('visibilitychange', handleVisibility)
      supabase.removeChannel(channel)
    }
  }, [poolId, fetchLeaderboard, supabase])
```

**Key differences vs. the "Before":**

1. `setInterval(fetchLeaderboard, pollInterval)` → `setInterval(fetchLeaderboard, 120_000)` (the heartbeat). Now a hard-coded 2-minute interval, not a configurable prop.
2. `.subscribe()` → `.subscribe((status) => { ... })`. We observe the channel status to detect reconnects.
3. New `visibilitychange` listener on `document`.
4. New `hasSubscribedOnce` local variable scoped to the effect. Because it's declared inside the effect body, every re-run of the effect gets a fresh `false` — no stale state across `poolId` changes.
5. Cleanup function returns three things now (clearInterval + removeEventListener + removeChannel) instead of two.
6. Dep array drops `pollInterval` — only `[poolId, fetchLeaderboard, supabase]` remain.

**Why the `hasSubscribedOnce` gate:** Supabase's `.subscribe(callback)` fires with `'SUBSCRIBED'` on the very first successful connect. We already fetched on mount (line 1 of the effect), so firing a second fetch here would be a duplicate on every mount. The flag flips to `true` after the first `SUBSCRIBED`, so only subsequent re-subscriptions trigger a fetch.

**Why listen on `document` not `window`:** `visibilitychange` is a document-level event per the Page Visibility API spec. Using `window.addEventListener('visibilitychange', ...)` happens to work in browsers due to event bubbling, but `document` is the correct target.

**Why not debounce the visibility fetch:** `visibilitychange` only fires on actual transitions, not on every interaction. You'd need rapid tab-focus cycling to trigger duplicates, which isn't a real user pattern. The in-flight counter from Step 3 handles the edge case anyway.

**Why 120 seconds for the heartbeat:** the CLAUDE.md staleness threshold is 15 minutes. A 2-minute heartbeat means at worst 7 heartbeats tick before one of them crosses the threshold and triggers an upstream API call — all the others return cached data for free. Sets a low ceiling on staleness (2 minutes + request latency) while keeping costs negligible. Do not make this configurable — a single hard-coded constant is easier to reason about.

**Why not add `inFlightRef` to the effect deps:** same reason as Step 3 — refs are stable.

- [ ] **Step 5: Pass `isFetching` to `<TrustStatusBar>`**

**Locate:** the `<TrustStatusBar>` JSX call at around lines 166–175 (inside the `{showTrustStatusHeader && ...}` block).

**Before:**
```typescript
          <TrustStatusBar
            className="border"
            isLocked={true}
            poolStatus={poolStatus}
            freshness={freshness}
            refreshedAt={refreshedAt}
            lastRefreshError={lastRefreshError}
            isRefreshing={data.isRefreshing}
          />
```

**After:**
```typescript
          <TrustStatusBar
            className="border"
            isLocked={true}
            poolStatus={poolStatus}
            freshness={freshness}
            refreshedAt={refreshedAt}
            lastRefreshError={lastRefreshError}
            isRefreshing={data.isRefreshing}
            isFetching={isFetching}
          />
```

- [ ] **Step 6: Pass `freshness` and `isFetching` to `<LeaderboardHeader>`**

**Locate:** the `<LeaderboardHeader>` JSX call at around line 163.

**Before:**
```typescript
      <LeaderboardHeader completedRounds={completedRounds} />
```

**After:**
```typescript
      <LeaderboardHeader
        completedRounds={completedRounds}
        freshness={freshness}
        isFetching={isFetching}
      />
```

**Note:** `freshness` is already destructured from `data` on line 133 (search for `const { entries, completedRounds, refreshedAt, freshness, poolStatus`), so no new destructure needed. `isFetching` is your new component state.

- [ ] **Step 7: Sweep for stray `pollInterval` references**

```bash
rg 'pollInterval' src/
```

**Expected output:** zero lines of matches from the `src/` tree. (Matches inside `docs/` are OK — those are historical plan documents, not code.)

**If anything matches in `src/`:** you missed something in Step 1. Go fix it.

- [ ] **Step 8: Run type check and tests**

```bash
npx tsc --noEmit
npm test -- --testPathPattern="leaderboard|TrustStatusBar"
```

**Expected:**
- `tsc` exits with code 0 and no output.
- Both `TrustStatusBar.test.tsx` and `leaderboard.test.ts` pass.

**If `tsc` errors:**
- `Property 'pollInterval' does not exist on type 'LeaderboardProps'`: a caller somewhere still passes it. Run `rg 'pollInterval' src/` and fix that caller.
- `Cannot find name 'useRef'`: you forgot to add `useRef` to the React import in Step 2a.
- `'inFlightRef' is declared but its value is never read`: you added the ref but didn't wire it in Step 3.
- `Property 'isFetching' is missing in type ... required in type 'LeaderboardHeaderProps'`: you added the LeaderboardHeader props in Task 2 but forgot Step 6 here.

**If tests fail:** they shouldn't — the existing leaderboard test only covers `shouldRenderLeaderboardTrustStatus`, which this task doesn't touch. If a TrustStatusBar test fails, re-check Task 1 didn't regress.

- [ ] **Step 9: Manual browser verification**

```bash
npm run dev
```

Open the spectator leaderboard page for a live pool. Open DevTools → Network tab, filter to `/api/leaderboard/`.

Run through all of these:

1. **No 30s cadence.** Let the page sit idle for 90 seconds. You should see at most one fetch (from mount), and no fetches on a 30s cycle. After ~120s, one heartbeat fetch should appear.
2. **Fetching UI.** Trigger a score update (DB write, refresh API call, or manual broadcast). The `TrustStatusBar` should switch to `Refreshing scores...` during the fetch, then back to `Scores are current`. The `LeaderboardHeader` should show `Round N · Refreshing…` during the fetch and the green checkmark after.
3. **Tab visibility.** Switch to another tab for ≥30 seconds, then switch back. Exactly one new fetch fires on return.
4. **Channel reconnect.** In DevTools Network tab, toggle "Offline" for 5 seconds, then back to "Online." The Supabase channel will drop and re-subscribe. Exactly one new fetch fires on reconnect.
5. **Overlapping fetches.** If you can trigger two broadcasts in quick succession (<1s apart), verify `Refreshing scores...` stays visible until both fetches complete. (Hard to test manually; the in-flight counter is the defense.)
6. **No console errors.** DevTools Console tab should be clean — no React warnings, no Supabase warnings, no unhandled rejections.

**If any check fails, see the troubleshooting section below** before re-editing.

- [ ] **Step 10: Commit**

```bash
git add src/components/leaderboard.tsx
git commit -m "$(cat <<'EOF'
feat: event-driven leaderboard refresh, remove 30s polling

Replaces fixed-interval polling with mount + realtime broadcast +
channel reconnect + tab visibility triggers, plus a slow 120s safety
heartbeat. Adds isFetching state (guarded by an in-flight counter) and
wires it into TrustStatusBar and LeaderboardHeader.

Deletes the pollInterval prop and DEFAULT_POLL_INTERVAL constant.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Full verification checklist

After all three tasks are committed, run this final pass.

**Automated:**
```bash
npx tsc --noEmit
npm test
npm run lint
```
All three must exit clean.

**Manual (in the browser, dev server running):**

1. Visit the spectator leaderboard for a live pool.
2. DevTools → Network tab, filter to `/api/leaderboard/`.
3. Wait 60+ seconds — **no 30s cadence**. Expect only the mount fetch and a heartbeat at ~120s.
4. Trigger a score update.
5. `TrustStatusBar` shows `Refreshing scores…` during the re-fetch.
6. After the re-fetch, the green checkmark appears next to "Live standings."
7. `LeaderboardHeader` shows `Round N · Refreshing…` during the fetch (round text stays visible, not replaced).
8. `TrustStatusBar` settles on `Scores are current`.
9. Background the tab for 30+ seconds, then return — exactly one fetch fires on visibility change.
10. Toggle DevTools offline/online to drop and reconnect the channel — exactly one fetch fires on reconnect.
11. Two rapid broadcasts in succession do not prematurely clear `isFetching` (in-flight counter guard).
12. Console has no errors or React warnings.

**If anything in the manual checklist fails, see Troubleshooting below.**

---

## Troubleshooting

### "I see two fetches on mount instead of one"

**Cause:** you forgot the `hasSubscribedOnce` gate in Step 4, or initialized it to `true`. The first `SUBSCRIBED` event is the initial connection and must be skipped — mount already fetched.

**Fix:** re-read Step 4's `.subscribe((status) => { ... })` callback. Initial value must be `false`, and the `if (hasSubscribedOnce) fetchLeaderboard()` gate must come *before* the `hasSubscribedOnce = true` flip.

### "`isFetching` flickers off mid-fetch when two broadcasts arrive"

**Cause:** the in-flight counter is not wired correctly. Probably decrementing before the increment runs, or using state instead of a ref.

**Fix:** confirm `inFlightRef.current += 1` and `setIsFetching(true)` are the first two lines of the `try` block (before any `await`), and the `finally` block decrements and gates `setIsFetching(false)` on `inFlightRef.current === 0`.

### "Heartbeat fires every 30s instead of 120s"

**Cause:** you copied the old `setInterval(fetchLeaderboard, pollInterval)` line and only changed one of the two intervals. Or `pollInterval` is being passed from somewhere.

**Fix:** grep the file for `setInterval` — there should be exactly one occurrence, with the literal `120_000`. Grep for `pollInterval` — there should be zero in `src/`.

### "TypeScript complains about `useRef` import"

**Fix:** Step 2a requires adding `useRef` to the existing named import from `react`. Don't create a second import statement.

### "Tests that passed in Task 1 are now failing after Task 3"

**Cause:** you probably edited `TrustStatusBar.tsx` by accident while doing Task 3. Run `git diff src/components/TrustStatusBar.tsx` — it should show the Task 1 diff only. If there are extra changes, revert them.

### "`document is not defined` in tests / build"

**Cause:** the `visibilitychange` listener or `document.visibilityState` access is running on the server side. This shouldn't happen because `leaderboard.tsx` is `'use client'` (see line 1), but if you accidentally removed that directive, SSR will choke.

**Fix:** verify line 1 of `src/components/leaderboard.tsx` is `'use client'`. Do not remove it.

### "I see a channel subscription warning in the console"

**Cause:** either the channel isn't being cleaned up (missing `supabase.removeChannel(channel)` in cleanup) or you have two subscriptions racing because React Strict Mode mounts the effect twice in dev.

**Fix:** Strict Mode double-mounting is expected in dev and harmless if cleanup is correct. If the warning persists, confirm the cleanup function removes *all three* resources: `clearInterval(heartbeatId)`, `removeEventListener`, and `removeChannel`.

---

## What you should NOT change

To keep the scope of this plan tight and the review clean, do **not** touch any of the following while implementing:

- The API route at `src/app/api/leaderboard/[poolId]/route.ts` — it already returns `isRefreshing` and `freshness` correctly.
- `src/lib/scoring-refresh.ts` — already broadcasts on completion.
- Any of the pages that render `<Leaderboard>` (spectator, commissioner, participant picks) unless Step 7's `rg` sweep finds a stray `pollInterval` to remove.
- The `LeaderboardData` interface (lines 16–28) — `isRefreshing?` is already there.
- The `shouldRenderLeaderboardTrustStatus` helper or its tests.
- Any scoring logic, database migrations, or golfer-related code.

If you find yourself editing one of these files, stop and re-read the task description — you're out of scope.
