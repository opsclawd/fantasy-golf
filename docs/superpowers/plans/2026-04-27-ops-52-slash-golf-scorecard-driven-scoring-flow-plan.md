# OPS-52: Slash Golf Scorecard-Driven Scoring Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a clean multi-endpoint adapter layer for Slash Golf `/tournament`, `/leaderboard`, `/scorecard`, and `/stats` endpoints with 5-state status normalization, typed responses, and selective scorecard refresh strategy.

**Architecture:** Extend `src/lib/slash-golf/client.ts` with four named endpoint functions. Add new types to `src/lib/slash-golf/types.ts`. Extend `GolferStatus` in `src/lib/supabase/types.ts` to a 5-state union. Add `upsertTournamentHoles` to `src/lib/scoring-queries.ts`. Document the call strategy separately.

**Tech Stack:** TypeScript, Supabase JS client, Vitest

---

## File Map

| File | Responsibility |
|------|----------------|
| `src/lib/slash-golf/types.ts` | Slash Golf API types only |
| `src/lib/slash-golf/client.ts` | Endpoint fetch functions |
| `src/lib/supabase/types.ts` | Database types |
| `src/lib/scoring-queries.ts` | DB persistence for hole data |
| `docs/superpowers/specs/ops-52-call-strategy.md` | Call strategy doc |

---

## Task 1: Add Types to `src/lib/slash-golf/types.ts`

**Files:**
- Modify: `src/lib/slash-golf/types.ts`

- [ ] **Step 1: Read the existing types file**

```bash
cat src/lib/slash-golf/types.ts
```

- [ ] **Step 2: Add new types after the existing `RapidApiPlayer` interface**

Append the following to `src/lib/slash-golf/types.ts`:

```ts
export type SlashGolferStatus = 'active' | 'withdrawn' | 'cut' | 'dq' | 'complete'

export interface SlashTournamentMeta {
  tournId: string
  name: string
  year: string
  status: string
  currentRound: number | null
  courses: Array<{ courseId: string; courseName: string }>
  format: string | null
  date: string | null
}

export interface SlashLeaderboard {
  tournId: string
  year: string
  status: string
  roundId: number
  roundStatus: string
  timestamp: string
  leaderboardRows: SlashGolferRow[]
}

export interface SlashGolferRow {
  playerId: string
  lastName: string
  firstName: string
  isAmateur: boolean
  status: SlashGolferStatus
  currentRound: number
  total: string | { $numberInt: string }
  currentRoundScore: string | { $numberInt: string }
  position: string | null
  totalStrokesFromCompletedRounds: string | null
  rounds: SlashRound[]
  thru: string | null
  startingHole: number | null
  currentHole: number | null
  courseId: string | null
  teeTime: string | null
  teeTimeTimestamp: string | null
}

export interface SlashRound {
  roundId: number
  courseId: string
  courseName: string
  strokes: number | { $numberInt: string }
  scoreToPar: number | { $numberInt: string }
}

export interface SlashHole {
  holeId: number
  par: number
  strokes: number
  scoreToPar: number
}

export interface SlashScorecard {
  tournId: string
  playerId: string
  year: string
  status: SlashGolferStatus
  currentRound: number
  holes: SlashHole[]
}

export interface SlashStats {
  tournId: string
  playerId: string
  worldRank: number | null
  projectedOWGR: number | null
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit src/lib/slash-golf/types.ts
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/slash-golf/types.ts
git commit -m "OPS-52: add Slash Golf API types — SlashTournamentMeta, SlashLeaderboard, SlashScorecard, SlashGolferStatus

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 2: Extend `GolferStatus` in `src/lib/supabase/types.ts`

**Files:**
- Modify: `src/lib/supabase/types.ts:5`

- [ ] **Step 1: Read the existing `GolferStatus` line**

```bash
sed -n '5p' src/lib/supabase/types.ts
```

Expected: `export type GolferStatus = 'active' | 'withdrawn' | 'cut'`

- [ ] **Step 2: Update `GolferStatus` to 5-state union**

Modify line 5 of `src/lib/supabase/types.ts`:

```ts
export type GolferStatus = 'active' | 'withdrawn' | 'cut' | 'dq' | 'complete'
```

- [ ] **Step 3: Run TypeScript check on the types file**

```bash
npx tsc --noEmit src/lib/supabase/types.ts
```

Expected: No errors.

- [ ] **Step 4: Run affected tests**

```bash
npx vitest run src/lib/__tests__/slash-golf-client.test.ts
```

Expected: PASS (existing tests unaffected — `GolferStatus` is not used in client test mocks).

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/types.ts
git commit -m "OPS-52: extend GolferStatus to 5-state union (adds dq, complete)

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 3: Add `getTournamentMeta` and `getLeaderboard` to `client.ts`

**Files:**
- Modify: `src/lib/slash-golf/client.ts`

- [ ] **Step 1: Write the failing test for `getTournamentMeta` and `getLeaderboard`**

Add to `src/lib/__tests__/slash-golf-client.test.ts`:

```ts
it('getTournamentMeta returns normalized tournament metadata', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({
      orgId: '1',
      year: '2026',
      tournId: '014',
      name: 'The Masters',
      status: 'In Progress',
      currentRound: 2,
      courses: [{ courseId: '014', courseName: 'Augusta National Golf Club' }],
      format: 'stroke',
      date: '2026-04-10',
    }),
  }))

  const meta = await getTournamentMeta('014', 2026)
  expect(meta).toMatchObject({
    tournId: '014',
    name: 'The Masters',
    year: '2026',
    status: 'In Progress',
    currentRound: 2,
    courses: [{ courseId: '014', courseName: 'Augusta National Golf Club' }],
  })
})

it('getLeaderboard returns normalized leaderboard with round status', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({
      orgId: '1',
      year: '2026',
      tournId: '014',
      status: 'In Progress',
      roundId: 2,
      roundStatus: 'In Progress',
      timestamp: '2026-04-10T15:23:33.217000',
      leaderboardRows: [
        { playerId: '22405', lastName: 'Rose', firstName: 'Justin', isAmateur: false, status: 'active' },
      ],
    }),
  }))

  const board = await getLeaderboard('014', 2026)
  expect(board.tournId).toBe('014')
  expect(board.roundStatus).toBe('In Progress')
  expect(board.leaderboardRows).toHaveLength(1)
  expect(board.leaderboardRows[0].status).toBe('active')
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/__tests__/slash-golf-client.test.ts 2>&1 | grep -E "(FAIL|getTournamentMeta|getLeaderboard)"
```

Expected: FAIL — `getTournamentMeta is not defined` or `getLeaderboard is not defined`.

- [ ] **Step 3: Add `getTournamentMeta` and `getLeaderboard` to client.ts**

Add before the closing of `client.ts`. Use the same BASE_URL and header pattern as existing functions:

```ts
export async function getTournamentMeta(tournamentId: string, year?: number): Promise<SlashTournamentMeta> {
  const params = new URLSearchParams({ orgId: '1', tournId: tournamentId, ...(year && { year: year.toString() }) })
  const res = await fetch(`${BASE_URL}/tournament?${params}`, {
    headers: { 'X-RapidAPI-Key': process.env.SLASH_GOLF_API_KEY ?? '' },
    next: { revalidate: 3600 }
  })
  if (!res.ok) throw new Error('Failed to fetch tournament metadata')
  const raw = await res.json()
  return {
    tournId: typeof raw.tournId === 'string' ? raw.tournId : '',
    name: typeof raw.name === 'string' ? raw.name : '',
    year: typeof raw.year === 'string' ? raw.year : (year?.toString() ?? ''),
    status: typeof raw.status === 'string' ? raw.status : '',
    currentRound: parseMongoNumber(raw.currentRound) ?? null,
    courses: Array.isArray(raw.courses) ? raw.courses.map((c: Record<string, unknown>) => ({
      courseId: typeof c.courseId === 'string' ? c.courseId : '',
      courseName: typeof c.courseName === 'string' ? c.courseName : '',
    })) : [],
    format: typeof raw.format === 'string' ? raw.format : null,
    date: typeof raw.date === 'string' ? raw.date : null,
  }
}

export async function getLeaderboard(tournamentId: string, year?: number): Promise<SlashLeaderboard> {
  const params = new URLSearchParams({ orgId: '1', tournId: tournamentId, ...(year && { year: year.toString() }) })
  const res = await fetch(`${BASE_URL}/leaderboard?${params}`, {
    headers: { 'X-RapidAPI-Key': process.env.SLASH_GOLF_API_KEY ?? '' },
    cache: 'no-store'
  })
  if (!res.ok) throw new Error('Failed to fetch leaderboard')
  const raw = await res.json()
  const rows = Array.isArray(raw.leaderboardRows) ? raw.leaderboardRows : []
  return {
    tournId: typeof raw.tournId === 'string' ? raw.tournId : '',
    year: typeof raw.year === 'string' ? raw.year : (year?.toString() ?? ''),
    status: typeof raw.status === 'string' ? raw.status : '',
    roundId: parseMongoNumber(raw.roundId) ?? 0,
    roundStatus: typeof raw.roundStatus === 'string' ? raw.roundStatus : '',
    timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : '',
    leaderboardRows: rows.map((row: Record<string, unknown>) => ({
      playerId: typeof row.playerId === 'string' ? row.playerId : '',
      lastName: typeof row.lastName === 'string' ? row.lastName : '',
      firstName: typeof row.firstName === 'string' ? row.firstName : '',
      isAmateur: typeof row.isAmateur === 'boolean' ? row.isAmateur : false,
      status: normalizeSlashStatus(row.status),
      currentRound: parseMongoNumber(row.currentRound) ?? 1,
      total: typeof row.total === 'string' ? row.total : (typeof row.total === 'object' ? row.total : '0'),
      currentRoundScore: typeof row.currentRoundScore === 'string' ? row.currentRoundScore : (typeof row.currentRoundScore === 'object' ? row.currentRoundScore : '0'),
      position: typeof row.position === 'string' ? row.position : null,
      totalStrokesFromCompletedRounds: typeof row.totalStrokesFromCompletedRounds === 'string' ? row.totalStrokesFromCompletedRounds : null,
      rounds: Array.isArray(row.rounds) ? row.rounds : [],
      thru: typeof row.thru === 'string' ? row.thru : null,
      startingHole: parseMongoNumber(row.startingHole),
      currentHole: parseMongoNumber(row.currentHole),
      courseId: typeof row.courseId === 'string' ? row.courseId : null,
      teeTime: typeof row.teeTime === 'string' ? row.teeTime : null,
      teeTimeTimestamp: typeof row.teeTimeTimestamp === 'string' ? row.teeTimeTimestamp : null,
    })),
  }
}
```

Add `normalizeSlashStatus` to the helper section of `client.ts` (after the existing `normalizeGolferStatus`):

```ts
function normalizeSlashStatus(value: unknown): SlashGolferStatus {
  if (typeof value !== 'string') return 'active'
  const s = value.trim().toLowerCase()
  if (s === 'withdrawn' || s === 'wd') return 'withdrawn'
  if (s === 'cut' || s === 'cu') return 'cut'
  if (s === 'dq') return 'dq'
  if (s === 'complete' || s === 'finished' || s === 'f') return 'complete'
  return 'active'
}
```

Add the import for `SlashTournamentMeta` and other new types at the top of `client.ts`:

```ts
import type { Tournament, GolferScore, GolferScoreRound, SlashTournamentMeta, SlashLeaderboard, SlashGolferStatus } from './types'
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/slash-golf-client.test.ts 2>&1 | tail -20
```

Expected: PASS for the two new tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/slash-golf/client.ts src/lib/__tests__/slash-golf-client.test.ts
git commit -m "OPS-52: add getTournamentMeta and getLeaderboard endpoint functions

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 4: Add `getScorecard` and `getStats` to `client.ts`

**Files:**
- Modify: `src/lib/slash-golf/client.ts`

- [ ] **Step 1: Write the failing test for `getScorecard`**

Add to `src/lib/__tests__/slash-golf-client.test.ts`:

```ts
it('getScorecard returns per-hole scorecard for a golfer', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({
      tournId: '014',
      playerId: '22405',
      year: '2026',
      status: 'active',
      currentRound: 2,
      holes: [
        { holeId: 1, par: 4, strokes: 4, scoreToPar: 0 },
        { holeId: 2, par: 5, strokes: 4, scoreToPar: -1 },
      ],
    }),
  }))

  const scorecard = await getScorecard('014', '22405', 2026)
  expect(scorecard.tournId).toBe('014')
  expect(scorecard.playerId).toBe('22405')
  expect(scorecard.holes).toHaveLength(2)
  expect(scorecard.holes[0]).toMatchObject({ holeId: 1, par: 4, scoreToPar: 0 })
  expect(scorecard.holes[1]).toMatchObject({ holeId: 2, par: 5, scoreToPar: -1 })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/__tests__/slash-golf-client.test.ts 2>&1 | grep -E "(FAIL|getScorecard)"
```

Expected: FAIL — `getScorecard is not defined`.

- [ ] **Step 3: Add `getScorecard` to client.ts**

Add after the existing `getTournamentMeta` function:

```ts
export async function getScorecard(tournamentId: string, golferId: string, year?: number): Promise<SlashScorecard> {
  const params = new URLSearchParams({ orgId: '1', tournId: tournamentId, playerId: golferId, ...(year && { year: year.toString() }) })
  const res = await fetch(`${BASE_URL}/scorecard?${params}`, {
    headers: { 'X-RapidAPI-Key': process.env.SLASH_GOLF_API_KEY ?? '' },
    cache: 'no-store'
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('[slash-golf] scorecard fetch failed', { status: res.status, golferId, body })
    throw new Error('Failed to fetch scorecard')
  }
  const raw = await res.json()
  const holes = Array.isArray(raw.holes) ? raw.holes.map((h: Record<string, unknown>) => ({
    holeId: parseMongoNumber(h.holeId) ?? 0,
    par: parseMongoNumber(h.par) ?? 0,
    strokes: parseMongoNumber(h.strokes) ?? 0,
    scoreToPar: parseMongoNumber(h.scoreToPar) ?? 0,
  })).filter((h: SlashHole) => h.holeId > 0) : []

  return {
    tournId: typeof raw.tournId === 'string' ? raw.tournId : tournamentId,
    playerId: typeof raw.playerId === 'string' ? raw.playerId : golferId,
    year: typeof raw.year === 'string' ? raw.year : (year?.toString() ?? ''),
    status: normalizeSlashStatus(raw.status),
    currentRound: parseMongoNumber(raw.currentRound) ?? 1,
    holes,
  }
}
```

- [ ] **Step 4: Write a failing test for `getStats`**

Add to `src/lib/__tests__/slash-golf-client.test.ts`:

```ts
it('getStats returns player ranking stats', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({
      tournId: '014',
      playerId: '22405',
      worldRank: 12,
      projectedOWGR: 8.5,
    }),
  }))

  const stats = await getStats('014', '22405', 2026)
  expect(stats.playerId).toBe('22405')
  expect(stats.worldRank).toBe(12)
})
```

- [ ] **Step 5: Run test to verify it fails**

```bash
npx vitest run src/lib/__tests__/slash-golf-client.test.ts 2>&1 | grep -E "(FAIL|getStats)"
```

Expected: FAIL — `getStats is not defined`.

- [ ] **Step 6: Add `getStats` to client.ts**

```ts
export async function getStats(tournamentId: string, golferId: string, year?: number): Promise<SlashStats> {
  const params = new URLSearchParams({ orgId: '1', tournId: tournamentId, playerId: golferId, ...(year && { year: year.toString() }) })
  const res = await fetch(`${BASE_URL}/stats?${params}`, {
    headers: { 'X-RapidAPI-Key': process.env.SLASH_GOLF_API_KEY ?? '' },
    cache: 'no-store'
  })
  if (!res.ok) throw new Error('Failed to fetch stats')
  const raw = await res.json()
  return {
    tournId: typeof raw.tournId === 'string' ? raw.tournId : tournamentId,
    playerId: typeof raw.playerId === 'string' ? raw.playerId : golferId,
    worldRank: typeof raw.worldRank === 'number' ? raw.worldRank : null,
    projectedOWGR: typeof raw.projectedOWGR === 'number' ? raw.projectedOWGR : null,
  }
}
```

Update the import line at the top of `client.ts` to include the new types:

```ts
import type { Tournament, GolferScore, GolferScoreRound, SlashTournamentMeta, SlashLeaderboard, SlashGolferStatus, SlashScorecard, SlashHole, SlashStats } from './types'
```

- [ ] **Step 7: Run all slash-golf tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/slash-golf-client.test.ts 2>&1 | tail -10
```

Expected: All PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/slash-golf/client.ts src/lib/__tests__/slash-golf-client.test.ts
git commit -m "OPS-52: add getScorecard and getStats endpoint functions

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 5: Add `upsertTournamentHoles` to `scoring-queries.ts`

**Files:**
- Modify: `src/lib/scoring-queries.ts`

- [ ] **Step 1: Write a failing test for `upsertTournamentHoles`**

Add to `src/lib/__tests__/scoring-queries.test.ts`:

```ts
it('upsertTournamentHoles persists hole records', async () => {
  const mockSupabase = { ... }
  vi.mocked(supabaseFrom).mockReturnValue(mockSupabase as never)
  mockSupabase.from.mockReturnValue({
    upsert: vi.fn().mockReturnValue({ error: null }),
  } as never)

  const holes: TournamentHole[] = [
    { golfer_id: 'g1', tournament_id: 't1', round_id: 1, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
    { golfer_id: 'g1', tournament_id: 't1', round_id: 1, hole_id: 2, strokes: 5, par: 4, score_to_par: 1 },
  ]
  const result = await upsertTournamentHoles(mockSupabase as never, holes)
  expect(result.error).toBeNull()
})
```

Note: You may need to create a mock `TournamentHole` type import or define it inline for the test.

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/__tests__/scoring-queries.test.ts 2>&1 | grep -E "(FAIL|upsertTournamentHoles)"
```

Expected: FAIL — `upsertTournamentHoles is not defined`.

- [ ] **Step 3: Add `TournamentHole` type to `src/lib/scoring-queries.ts`** (at top of file, after imports)

```ts
export interface TournamentHole {
  golfer_id: string
  tournament_id: string
  round_id: number
  hole_id: number
  strokes: number
  par: number
  score_to_par: number
  updated_at?: string
}
```

- [ ] **Step 4: Add `upsertTournamentHoles` function to `src/lib/scoring-queries.ts`**

Add after `getTournamentScoreRounds`:

```ts
export async function upsertTournamentHoles(
  supabase: SupabaseClient,
  holes: TournamentHole[]
): Promise<{ error: string | null }> {
  if (holes.length === 0) return { error: null }
  const records = holes.map(h => ({
    golfer_id: h.golfer_id,
    tournament_id: h.tournament_id,
    round_id: h.round_id,
    hole_id: h.hole_id,
    strokes: h.strokes,
    par: h.par,
    score_to_par: h.score_to_par,
    updated_at: h.updated_at ?? new Date().toISOString(),
  }))
  const { error } = await supabase
    .from('tournament_holes')
    .upsert(records, { onConflict: 'golfer_id,tournament_id,round_id,hole_id' })
  if (error) return { error: error.message }
  return { error: null }
}
```

Note: The actual `tournament_holes` table will be created by OPS-50 implementation. This function signature is defined now so it is available when OPS-52 implementation begins using it. The function will error at runtime until the table exists (expected behavior).

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit src/lib/scoring-queries.ts
```

Expected: No errors (assuming `tournament_holes` table is referenced by name only — no runtime check).

- [ ] **Step 6: Commit**

```bash
git add src/lib/scoring-queries.ts src/lib/__tests__/scoring-queries.test.ts
git commit -m "OPS-52: add TournamentHole type and upsertTournamentHoles to scoring-queries

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 6: Write Call Strategy Document

**Files:**
- Create: `docs/superpowers/specs/ops-52-call-strategy.md`

- [ ] **Step 1: Create the strategy document**

```bash
cat > docs/superpowers/specs/ops-52-call-strategy.md << 'STRATDOC'
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
STRATDOC
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/ops-52-call-strategy.md
git commit -m "OPS-52: add call strategy documentation for Slash Golf multi-endpoint integration

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 7: Capture Fixture Payloads

**Files:**
- Create: `fixtures/slash-golf/` (directory)

- [ ] **Step 1: Create fixture directory and stub files**

Note: Real fixtures require live API calls. Create stub files that document the expected shape:

```bash
mkdir -p fixtures/slash-golf
cat > fixtures/slash-golf/tournament-STUB.json << 'EOF'
{
  // fixture: Slash Golf /tournament response
  // tournamentId: <fill in from live API>
  // captured: <date>
  // note: Capture real response from GET /tournament?orgId=1&tournId=<id>
  "orgId": "1",
  "year": "2026",
  "tournId": "014",
  "name": "The Masters",
  "status": "In Progress",
  "currentRound": 2,
  "courses": [
    { "courseId": "014", "courseName": "Augusta National Golf Club" }
  ],
  "format": "stroke",
  "date": "2026-04-10"
}
EOF
```

Create similar stub files for `leaderboard-STUB.json`, `scorecard-STUB.json`, `stats-STUB.json`.

- [ ] **Step 2: Commit**

```bash
git add fixtures/slash-golf/
git commit -m "OPS-52: add fixture stub files for Slash Golf endpoints

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Spec Coverage Checklist

| Spec Requirement | Task |
|-------------------|------|
| 4 typed endpoint functions (getTournamentMeta, getLeaderboard, getScorecard, getStats) | Tasks 3, 4 |
| Status normalization handles complete/dq/wd + existing | Tasks 3, 4 |
| GolferStatus extended to dq \| complete | Task 2 |
| upsertTournamentHoles function in scoring-queries | Task 5 |
| Real fixture capture plan | Task 7 |
| Call strategy doc | Task 6 |
| No leaderboard aggregates as sole source of truth | Architecture decision documented in call strategy doc |

---

## Verification Commands

```bash
# TypeScript check
npx tsc --noEmit src/lib/slash-golf/types.ts src/lib/slash-golf/client.ts src/lib/scoring-queries.ts

# All tests
npx vitest run src/lib/__tests__/slash-golf-client.test.ts src/lib/__tests__/scoring-queries.test.ts

# ESLint
npx eslint src/lib/slash-golf/ --max-warnings 0
```
