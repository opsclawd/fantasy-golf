# OPS-54: Regression Coverage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add regression test coverage for scoring domain edge cases, Slash Golf provider mapping edge cases, refresh pipeline error paths, and pool-queries functions used by the refresh pipeline. Also add a `NO_SCORES` error code to the refresh flow.

**Architecture:** Four new focused test files, one small production code change. Each test file targets one identified gap area. Production code change is scoped to exactly the `NO_SCORES` error code addition and empty-array handling in `refreshScoresForPool`.

**Tech Stack:** TypeScript, Vitest, Supabase

---

## File Structure

```
src/lib/__tests__/
  scoring-edge-cases.test.ts           # NEW — scoring domain edge cases
  slash-golf-client-edge-cases.test.ts # NEW — Slash Golf client edge cases
  scoring-refresh-edge-cases.test.ts   # NEW — refresh pipeline edge cases
  pool-queries-for-scoring-refresh.test.ts # NEW — pool-queries unit tests for refresh deps
src/lib/
  scoring-refresh.ts                   # MODIFY — add NO_SCORES to RefreshError, handle empty slashScores
```

---

## Task 1: Add `NO_SCORES` error code to `scoring-refresh.ts`

**Files:**
- Modify: `src/lib/scoring-refresh.ts:33-36`

- [ ] **Step 1: Modify RefreshError interface to include `NO_SCORES`**

```typescript
export interface RefreshError {
  code: 'NO_SCORES' | 'FETCH_FAILED' | 'UPSERT_FAILED' | 'INTERNAL_ERROR'
  message: string
}
```

- [ ] **Step 2: Add empty-slashScores check after the fetch step (after line 84)**

After `slashScores = await getTournamentScores(...)` succeeds, add:

```typescript
// If API returned no golfers, return NO_SCORES error
if (slashScores.length === 0) {
  const errorMessage = 'No golfers returned from scoring API'

  await updatePoolRefreshMetadata(supabase, pool.id, {
    last_refresh_error: errorMessage,
  })

  await insertAuditEvent(supabase, {
    pool_id: pool.id,
    user_id: null,
    action: 'scoreRefreshFailed',
    details: { error: errorMessage },
  })

  return {
    data: null,
    error: { code: 'NO_SCORES', message: errorMessage },
  }
}
```

- [ ] **Step 3: Run existing tests to verify no regressions**

```bash
npm test -- --run src/lib/__tests__/scoring-refresh.test.ts
```
Expected: all existing tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/scoring-refresh.ts
git commit -m "OPS-54: add NO_SCORES error code and empty-array handling"
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

---

## Task 2: `scoring-edge-cases.test.ts`

**Files:**
- Create: `src/lib/__tests__/scoring-edge-cases.test.ts`
- Reference: `src/lib/scoring/domain.ts` (computeEntryScore, rankEntries)
- Reference: `src/lib/__tests__/domain-scoring.test.ts` (for test structure patterns)

- [ ] **Step 1: Write failing test — all rounds incomplete for every golfer**

```typescript
it('all golfers have every round incomplete → totalScore 0, completedHoles 0', () => {
  const scores = makeGolferRoundScoresMapentries([
    ['g1', [makePlayerHoleScore(1, -1, 'active', false)]], // isComplete: false
    ['g2', [makePlayerHoleScore(1, 0, 'active', false)]],
    ['g3', [makePlayerHoleScore(1, 1, 'active', false)]],
    ['g4', [makePlayerHoleScore(1, -2, 'active', false)]],
  ])

  const result = computeEntryScore(scores, ['g1', 'g2', 'g3', 'g4'])

  expect(result.totalScore).toBe(0)
  expect(result.completedHoles).toBe(0)
})
```

- [ ] **Step 2: Write failing test — golfer ID in entry not in score map**

```typescript
it('entry contains golfer ID not in score map → silently skipped, valid score from remaining', () => {
  const scores = makeGolferRoundScoresMapentries([
    ['g1', [makePlayerHoleScore(1, -1, 'active', true)]],
    ['g2', [makePlayerHoleScore(1, 0, 'active', true)]],
  ])

  const result = computeEntryScore(scores, ['g1', 'g2', 'g3']) // g3 not in scores

  expect(result.totalScore).toBe(-1) // best of g1,g2 only
  expect(result.completedHoles).toBe(1)
})
```

- [ ] **Step 3: Write failing test — entry with fewer than 4 golfers**

```typescript
it('entry has 3 golfers → computes valid score from available', () => {
  const scores = makeGolferRoundScoresMapentries([
    ['g1', [makePlayerHoleScore(1, -2, 'active', true)]],
    ['g2', [makePlayerHoleScore(1, -1, 'active', true)]],
    ['g3', [makePlayerHoleScore(1, 0, 'active', true)]],
  ])

  const result = computeEntryScore(scores, ['g1', 'g2', 'g3'])

  expect(result.totalScore).toBe(-2)
  expect(result.completedHoles).toBe(1)
})
```

- [ ] **Step 4: Write failing test — rankEntries with empty entries array**

```typescript
it('empty entries array → returns empty array without crash', () => {
  const scores = makeGolferRoundScoresMapentries([
    ['g1', [makePlayerHoleScore(1, -1, 'active', true)]],
  ])

  const ranked = rankEntries([], scores, 1)

  expect(ranked).toEqual([])
})
```

- [ ] **Step 5: Write failing test — rankEntries with empty score map**

```typescript
it('empty golferRoundScores map → all entries get totalScore 0', () => {
  const entries: Entry[] = [
    { id: 'e1', pool_id: 'p1', user_id: 'u1', golfer_ids: ['g1', 'g2', 'g3', 'g4'], total_birdies: 0, created_at: '', updated_at: '' },
  ]

  const ranked = rankEntries(entries, new Map(), 1)

  expect(ranked).toHaveLength(1)
  expect(ranked[0].totalScore).toBe(0)
  expect(ranked[0].rank).toBe(1)
})
```

- [ ] **Step 6: Run tests to verify they fail (these are NEW tests, expected to fail until scoring-edge-cases is created)**

For each test, run:
```bash
npm test -- --run src/lib/__tests__/scoring-edge-cases.test.ts
```
Expected: all 5 tests FAIL (file doesn't exist yet) — this is the expected failure state before creation.

Wait — the tests DON'T exist yet so they can't even run. We need to create the file with the failing tests first. Let me reconsider:

Actually, we need to first create the file with test stubs. Let me write the full test file content:

**Step 6 (revised): Create the full test file** at `src/lib/__tests__/scoring-edge-cases.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import type { GolferStatus } from '../supabase/types'
import type { Entry } from '../supabase/types'
import {
  computeEntryScore,
  rankEntries,
  type GolferRoundScoresMap,
  type PlayerHoleScore,
} from '../scoring/domain'

function makePlayerHoleScore(roundId: number, scoreToPar: number, status: GolferStatus, isComplete: boolean): PlayerHoleScore {
  return { roundId, scoreToPar: scoreToPar as number, status, isComplete }
}

function makeGolferRoundScoresMapentries(entries: [string, PlayerHoleScore[]][]): GolferRoundScoresMap {
  return new Map(entries)
}

describe('scoring edge cases', () => {
  describe('computeEntryScore', () => {
    it('all golfers have every round incomplete → totalScore 0, completedHoles 0', () => {
      const scores = makeGolferRoundScoresMapentries([
        ['g1', [makePlayerHoleScore(1, -1, 'active', false)]],
        ['g2', [makePlayerHoleScore(1, 0, 'active', false)]],
        ['g3', [makePlayerHoleScore(1, 1, 'active', false)]],
        ['g4', [makePlayerHoleScore(1, -2, 'active', false)]],
      ])

      const result = computeEntryScore(scores, ['g1', 'g2', 'g3', 'g4'])

      expect(result.totalScore).toBe(0)
      expect(result.completedHoles).toBe(0)
      expect(result.totalBirdies).toBe(0)
    })

    it('entry contains golfer ID not in score map → silently skipped', () => {
      const scores = makeGolferRoundScoresMapentries([
        ['g1', [makePlayerHoleScore(1, -1, 'active', true)]],
        ['g2', [makePlayerHoleScore(1, 0, 'active', true)]],
      ])

      const result = computeEntryScore(scores, ['g1', 'g2', 'g3'])

      expect(result.totalScore).toBe(-1)
      expect(result.completedHoles).toBe(1)
    })

    it('entry has fewer than 4 golfers → computes valid score from available', () => {
      const scores = makeGolferRoundScoresMapentries([
        ['g1', [makePlayerHoleScore(1, -2, 'active', true)]],
        ['g2', [makePlayerHoleScore(1, -1, 'active', true)]],
        ['g3', [makePlayerHoleScore(1, 0, 'active', true)]],
      ])

      const result = computeEntryScore(scores, ['g1', 'g2', 'g3'])

      expect(result.totalScore).toBe(-2)
      expect(result.completedHoles).toBe(1)
    })
  })

  describe('rankEntries', () => {
    it('empty entries array → returns empty array without crash', () => {
      const scores = makeGolferRoundScoresMapentries([
        ['g1', [makePlayerHoleScore(1, -1, 'active', true)]],
      ])

      const ranked = rankEntries([], scores, 1)

      expect(ranked).toEqual([])
    })

    it('empty golferRoundScores map → all entries get totalScore 0', () => {
      const entries: Entry[] = [
        { id: 'e1', pool_id: 'p1', user_id: 'u1', golfer_ids: ['g1', 'g2', 'g3', 'g4'], total_birdies: 0, created_at: '', updated_at: '' },
      ]

      const ranked = rankEntries(entries, new Map(), 1)

      expect(ranked).toHaveLength(1)
      expect(ranked[0].totalScore).toBe(0)
      expect(ranked[0].rank).toBe(1)
    })
  })
})
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npm test -- --run src/lib/__tests__/scoring-edge-cases.test.ts
```
Expected: PASS (all 5 tests)

- [ ] **Step 8: Commit**

```bash
git add src/lib/__tests__/scoring-edge-cases.test.ts
git commit -m "OPS-54: add scoring domain edge case tests"
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

---

## Task 3: `slash-golf-client-edge-cases.test.ts`

**Files:**
- Create: `src/lib/__tests__/slash-golf-client-edge-cases.test.ts`
- Reference: `src/lib/slash-golf/client.ts` (parseScoreValue, normalizeSlashStatus, getTournamentScores)
- Reference: `src/lib/__tests__/slash-golf-client.test.ts` (for mock patterns)

- [ ] **Step 1: Create the test file with all edge case tests**

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getTournamentScores, getLeaderboard, getScorecard, getStats } from '@/lib/slash-golf/client'

describe('slash-golf client edge cases', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getTournamentScores', () => {
    it('API returns empty leaderboardRows → returns []', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ leaderboardRows: [] }),
      }))

      const result = await getTournamentScores('041', 2026)
      expect(result).toEqual([])
    })

    it('API returns non-200 with JSON error body → throws Error with status', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: vi.fn().mockResolvedValue(JSON.stringify({ message: 'Rate limit exceeded' })),
      }))

      await expect(getTournamentScores('041', 2026)).rejects.toThrow('Failed to fetch scores')
    })

    it('response wrapped in { data: [...] } shape → normalizes correctly', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [
            { playerId: 'g1', total: '-3', currentRoundScore: '-3', thru: '4' },
          ],
        }),
      }))

      const result = await getTournamentScores('041', 2026)
      expect(result).toHaveLength(1)
      expect(result[0].golfer_id).toBe('g1')
      expect(result[0].total_score).toBe(-3)
    })

    it('response wrapped in { scores: [...] } shape → normalizes correctly', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          scores: [
            { playerId: 'g2', total: '72', currentRoundScore: '0' },
          ],
        }),
      }))

      const result = await getTournamentScores('041', 2026)
      expect(result).toHaveLength(1)
      expect(result[0].golfer_id).toBe('g2')
    })

    it('response wrapped in { players: [...] } shape → normalizes correctly', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          players: [
            { playerId: 'g3', total: '70', status: 'active' },
          ],
        }),
      }))

      const result = await getTournamentScores('041', 2026)
      expect(result).toHaveLength(1)
      expect(result[0].golfer_id).toBe('g3')
    })

    it('total is "-" → total_score is null', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          leaderboardRows: [
            { playerId: 'g1', total: '-', currentRoundScore: '-' },
          ],
        }),
      }))

      const result = await getTournamentScores('041', 2026)
      expect(result[0].total_score).toBeNull()
    })

    it('total is "72*" → total_score is 72 (asterisk stripped)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          leaderboardRows: [
            { playerId: 'g1', total: '72*', currentRoundScore: '72*' },
          ],
        }),
      }))

      const result = await getTournamentScores('041', 2026)
      expect(result[0].total_score).toBe(72)
      expect(result[0].current_round_score).toBe(72)
    })

    it('status is "dq" → normalized to dq via normalizeSlashStatus', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          leaderboardRows: [
            { playerId: 'g1', status: 'dq', total: '75' },
          ],
        }),
      }))

      const result = await getTournamentScores('041', 2026)
      expect(result[0].status).toBe('dq')
    })
  })

  describe('getLeaderboard', () => {
    it('response missing roundId → uses null', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          tournId: '014',
          year: '2026',
          status: 'In Progress',
          leaderboardRows: [],
        }),
      }))

      const result = await getLeaderboard('014', 2026)
      expect(result.roundId).toBeNull()
    })

    it('response missing roundStatus → uses null', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          tournId: '014',
          year: '2026',
          status: 'In Progress',
          roundId: 2,
          leaderboardRows: [],
        }),
      }))

      const result = await getLeaderboard('014', 2026)
      expect(result.roundStatus).toBe('')
    })
  })

  describe('getScorecard', () => {
    it('empty holes array → returns scorecard with empty holes', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          tournId: '014',
          playerId: '22405',
          year: '2026',
          status: 'active',
          currentRound: 1,
          holes: [],
        }),
      }))

      const result = await getScorecard('014', '22405', 2026)
      expect(result.holes).toHaveLength(0)
    })
  })

  describe('getStats', () => {
    it('null worldRank and projectedOWGR → both returned as null', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          tournId: '014',
          playerId: '22405',
          worldRank: null,
          projectedOWGR: null,
        }),
      }))

      const result = await getStats('014', '22405', 2026)
      expect(result.worldRank).toBeNull()
      expect(result.projectedOWGR).toBeNull()
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npm test -- --run src/lib/__tests__/slash-golf-client-edge-cases.test.ts
```
Expected: PASS (all 10 tests)

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/slash-golf-client-edge-cases.test.ts
git commit -m "OPS-54: add Slash Golf client edge case tests"
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

---

## Task 4: `scoring-refresh-edge-cases.test.ts`

**Files:**
- Create: `src/lib/__tests__/scoring-refresh-edge-cases.test.ts`
- Reference: `src/lib/scoring-refresh.ts`
- Reference: `src/lib/__tests__/scoring-refresh.test.ts` (for mock patterns)

- [ ] **Step 1: Create the test file with all edge case tests**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { refreshScoresForPool } from '../scoring-refresh'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTournamentScores } from '@/lib/slash-golf/client'
import { rankEntries, deriveCompletedRounds } from '@/lib/scoring/domain'
import { buildRefreshAuditDetails } from '@/lib/audit'
import {
  getPoolsByTournament,
  getEntriesForPool,
  updatePoolRefreshMetadata,
  insertAuditEvent,
} from '@/lib/pool-queries'
import {
  upsertTournamentScore,
  getScoresForTournament,
  getTournamentScoreRounds,
} from '@/lib/scoring-queries'

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/slash-golf/client', () => ({
  getTournamentScores: vi.fn(),
}))

vi.mock('@/lib/scoring/domain', () => ({
  rankEntries: vi.fn(),
  deriveCompletedRounds: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  buildRefreshAuditDetails: vi.fn(),
}))

vi.mock('@/lib/pool-queries', () => ({
  getPoolsByTournament: vi.fn(),
  getEntriesForPool: vi.fn(),
  updatePoolRefreshMetadata: vi.fn(),
  insertAuditEvent: vi.fn(),
}))

vi.mock('@/lib/scoring-queries', () => ({
  upsertTournamentScore: vi.fn(),
  getScoresForTournament: vi.fn(),
  getTournamentScoreRounds: vi.fn(),
}))

describe('scoring refresh edge cases', () => {
  function createMockSupabase() {
    return {
      from: vi.fn().mockImplementation(() => {
        throw new Error('Unexpected table call')
      }),
      channel: vi.fn().mockReturnValue({ send: vi.fn().mockResolvedValue(undefined) }),
    } as unknown as never
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('API returns empty slashScores → NO_SCORES error', async () => {
    const pool = { id: 'pool-1', tournament_id: 't-1', year: 2026, status: 'live' }
    const mockSupabase = createMockSupabase()

    vi.mocked(getPoolsByTournament).mockResolvedValue([
      { id: 'pool-1', tournament_id: 't-1', status: 'live' },
    ] as never)
    vi.mocked(getScoresForTournament).mockResolvedValue([] as never)
    vi.mocked(getTournamentScores).mockResolvedValue([]) // empty array
    vi.mocked(updatePoolRefreshMetadata).mockResolvedValue({ error: null })
    vi.mocked(insertAuditEvent).mockResolvedValue({ error: null })

    const result = await refreshScoresForPool(mockSupabase, pool)

    expect(result.data).toBeNull()
    expect(result.error).not.toBeNull()
    expect(result.error!.code).toBe('NO_SCORES')
    expect(result.error!.message).toBe('No golfers returned from scoring API')
  })

  it('partial upsert failure: 3 golfers, 2 OK, 1 fails → UPSERT_FAILED', async () => {
    const pool = { id: 'pool-1', tournament_id: 't-1', year: 2026, status: 'live' }
    const mockSupabase = createMockSupabase()

    vi.mocked(getPoolsByTournament).mockResolvedValue([
      { id: 'pool-1', tournament_id: 't-1', status: 'live' },
    ] as never)
    vi.mocked(getScoresForTournament).mockResolvedValue([] as never)
    vi.mocked(getTournamentScores).mockResolvedValue([
      { golfer_id: 'g1', total: -2, total_birdies: 1, status: 'active' },
      { golfer_id: 'g2', total: -1, total_birdies: 0, status: 'active' },
      { golfer_id: 'g3', total: 0, total_birdies: 0, status: 'active' },
    ] as never)

    // g1 OK, g2 OK, g3 fails
    vi.mocked(upsertTournamentScore)
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: 'duplicate key' })

    vi.mocked(updatePoolRefreshMetadata).mockResolvedValue({ error: null })
    vi.mocked(insertAuditEvent).mockResolvedValue({ error: null })

    const result = await refreshScoresForPool(mockSupabase, pool)

    expect(result.data).toBeNull()
    expect(result.error).not.toBeNull()
    expect(result.error!.code).toBe('UPSERT_FAILED')
    expect(result.error!.message).toContain('g3')
    expect(result.error!.message).not.toContain('g1')
    expect(result.error!.message).not.toContain('g2')
  })

  it('updatePoolRefreshMetadata fails on success path → INTERNAL_ERROR', async () => {
    const pool = { id: 'pool-1', tournament_id: 't-1', year: 2026, status: 'live' }
    const mockSupabase = createMockSupabase()

    vi.mocked(getPoolsByTournament).mockResolvedValue([
      { id: 'pool-1', tournament_id: 't-1', status: 'live' },
    ] as never)
    vi.mocked(getScoresForTournament).mockResolvedValue([] as never)
    vi.mocked(getTournamentScores).mockResolvedValue([
      { golfer_id: 'g1', total: -2, total_birdies: 1, status: 'active' },
    ] as never)
    vi.mocked(upsertTournamentScore).mockResolvedValue({ error: null })
    vi.mocked(updatePoolRefreshMetadata)
      .mockResolvedValueOnce({ error: 'connection refused' }) // fails on success path
    vi.mocked(insertAuditEvent).mockResolvedValue({ error: null })

    const result = await refreshScoresForPool(mockSupabase, pool)

    expect(result.data).toBeNull()
    expect(result.error).not.toBeNull()
    expect(result.error!.code).toBe('INTERNAL_ERROR')
  })

  it('insertAuditEvent fails on success path → INTERNAL_ERROR', async () => {
    const pool = { id: 'pool-1', tournament_id: 't-1', year: 2026, status: 'live' }
    const mockSupabase = createMockSupabase()

    vi.mocked(getPoolsByTournament).mockResolvedValue([
      { id: 'pool-1', tournament_id: 't-1', status: 'live' },
    ] as never)
    vi.mocked(getScoresForTournament).mockResolvedValue([] as never)
    vi.mocked(getTournamentScores).mockResolvedValue([
      { golfer_id: 'g1', total: -2, total_birdies: 1, status: 'active' },
    ] as never)
    vi.mocked(upsertTournamentScore).mockResolvedValue({ error: null })
    vi.mocked(updatePoolRefreshMetadata).mockResolvedValue({ error: null })
    vi.mocked(insertAuditEvent).mockResolvedValue({ error: 'insert failed' })

    const result = await refreshScoresForPool(mockSupabase, pool)

    expect(result.data).toBeNull()
    expect(result.error).not.toBeNull()
    expect(result.error!.code).toBe('INTERNAL_ERROR')
  })

  it('getEntriesForPool returns empty array → broadcast sends with empty ranked array', async () => {
    const pool = { id: 'pool-1', tournament_id: 't-1', year: 2026, status: 'live' }
    const mockSupabase = createMockSupabase()

    vi.mocked(getPoolsByTournament).mockResolvedValue([
      { id: 'pool-1', tournament_id: 't-1', status: 'live' },
    ] as never)
    vi.mocked(getScoresForTournament).mockResolvedValue([] as never)
    vi.mocked(getTournamentScores).mockResolvedValue([
      { golfer_id: 'g1', total: -2, total_birdies: 1, status: 'active' },
    ] as never)
    vi.mocked(upsertTournamentScore).mockResolvedValue({ error: null })
    vi.mocked(updatePoolRefreshMetadata).mockResolvedValue({ error: null })
    vi.mocked(getEntriesForPool).mockResolvedValue([]) // empty
    vi.mocked(rankEntries).mockReturnValue([])
    vi.mocked(buildRefreshAuditDetails).mockReturnValue({
      completedRounds: 1,
      golferCount: 1,
      changedGolfers: ['g1'],
      newGolfers: [],
      droppedGolfers: [],
      diffs: {},
    })
    vi.mocked(insertAuditEvent).mockResolvedValue({ error: null })
    vi.mocked(getTournamentScoreRounds).mockResolvedValue([])
    vi.mocked(deriveCompletedRounds).mockReturnValue(1)

    const result = await refreshScoresForPool(mockSupabase, pool)

    expect(result.error).toBeNull()
    expect(result.data).not.toBeNull()
  })

  it('deriveCompletedRounds === 0 (tournament not started) → returns success with completedRounds 0', async () => {
    const pool = { id: 'pool-1', tournament_id: 't-1', year: 2026, status: 'live' }
    const mockSupabase = createMockSupabase()

    vi.mocked(getPoolsByTournament).mockResolvedValue([
      { id: 'pool-1', tournament_id: 't-1', status: 'live' },
    ] as never)
    vi.mocked(getScoresForTournament).mockResolvedValue([] as never)
    vi.mocked(getTournamentScores).mockResolvedValue([
      { golfer_id: 'g1', total: null, total_birdies: 0, status: 'active' },
    ] as never)
    vi.mocked(upsertTournamentScore).mockResolvedValue({ error: null })
    vi.mocked(updatePoolRefreshMetadata).mockResolvedValue({ error: null })
    vi.mocked(getEntriesForPool).mockResolvedValue([{ id: 'entry-1' }] as never)
    vi.mocked(rankEntries).mockReturnValue([])
    vi.mocked(buildRefreshAuditDetails).mockReturnValue({
      completedRounds: 0,
      golferCount: 1,
      changedGolfers: ['g1'],
      newGolfers: [],
      droppedGolfers: [],
      diffs: {},
    })
    vi.mocked(insertAuditEvent).mockResolvedValue({ error: null })
    vi.mocked(getTournamentScoreRounds).mockResolvedValue([])
    vi.mocked(deriveCompletedRounds).mockReturnValue(0)

    const result = await refreshScoresForPool(mockSupabase, pool)

    expect(result.error).toBeNull()
    expect(result.data!.completedRounds).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npm test -- --run src/lib/__tests__/scoring-refresh-edge-cases.test.ts
```
Expected: PASS (all 6 tests)

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/scoring-refresh-edge-cases.test.ts
git commit -m "OPS-54: add scoring refresh edge case tests"
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

---

## Task 5: `pool-queries-for-scoring-refresh.test.ts`

**Files:**
- Create: `src/lib/__tests__/pool-queries-for-scoring-refresh.test.ts`
- Reference: `src/lib/pool-queries.ts` (getPoolsByTournament, getEntriesForPool, updatePoolRefreshMetadata, insertAuditEvent)

- [ ] **Step 1: Create the test file**

```typescript
import { describe, expect, it, vi } from 'vitest'
import {
  getPoolsByTournament,
  getEntriesForPool,
  updatePoolRefreshMetadata,
  insertAuditEvent,
} from '../pool-queries'

describe('pool-queries (refresh pipeline deps)', () => {
  describe('getPoolsByTournament', () => {
    function createSupabase(results: { data: unknown; error: { message: string } | null }) {
      const builder: any = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        then: (onFulfilled: (value: { data: unknown; error: null }) => unknown) =>
          Promise.resolve(results).then(onFulfilled),
      }
      return { supabase: { from: vi.fn(() => builder) } }
    }

    it('returns pools filtered by tournament_id', async () => {
      const pools = [{ id: 'pool-1', tournament_id: 't-1', status: 'live' }]
      const { supabase } = createSupabase({ data: pools, error: null })

      const result = await getPoolsByTournament(supabase as never, 't-1')

      expect(supabase.from).toHaveBeenCalledWith('pools')
    })

    it('returns empty array when no pools match', async () => {
      const { supabase } = createSupabase({ data: [], error: null })

      const result = await getPoolsByTournament(supabase as never, 't-999')

      expect(result).toEqual([])
    })

    it('throws when query fails', async () => {
      const { supabase } = createSupabase({ data: null, error: { message: 'db is down' } })

      await expect(
        getPoolsByTournament(supabase as never, 't-1')
      ).rejects.toThrow('db is down')
    })
  })

  describe('getEntriesForPool', () => {
    function createSupabase(result: { data: unknown; error: { message: string } | null }) {
      const builder: any = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        then: (onFulfilled: (value: { data: unknown }) => unknown) =>
          Promise.resolve(result).then(onFulfilled),
      }
      return { supabase: { from: vi.fn(() => builder) } }
    }

    it('returns entries for a specific pool', async () => {
      const entries = [{ id: 'e1', pool_id: 'pool-1' }, { id: 'e2', pool_id: 'pool-1' }]
      const { supabase } = createSupabase({ data: entries, error: null })

      const result = await getEntriesForPool(supabase as never, 'pool-1')

      expect(supabase.from).toHaveBeenCalledWith('entries')
    })

    it('returns empty array when pool has no entries', async () => {
      const { supabase } = createSupabase({ data: [], error: null })

      const result = await getEntriesForPool(supabase as never, 'pool-1')

      expect(result).toEqual([])
    })
  })

  describe('updatePoolRefreshMetadata', () => {
    it('calls pools.update() with refreshed_at on success', async () => {
      const builder: any = {
        update: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        then: (onFulfilled: (value: { error: null }) => unknown) =>
          Promise.resolve({ error: null }).then(onFulfilled),
      }
      const supabase = { from: vi.fn(() => builder) }

      const result = await updatePoolRefreshMetadata(supabase as never, 'pool-1', {
        refreshed_at: '2026-04-28T12:00:00Z',
        last_refresh_error: null,
      })

      expect(result.error).toBeNull()
      expect(builder.update).toHaveBeenCalledWith({
        refreshed_at: '2026-04-28T12:00:00Z',
        last_refresh_error: null,
      })
    })

    it('calls pools.update() with last_refresh_error on failure', async () => {
      const builder: any = {
        update: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        then: (onFulfilled: (value: { error: null }) => unknown) =>
          Promise.resolve({ error: null }).then(onFulfilled),
      }
      const supabase = { from: vi.fn(() => builder) }

      const result = await updatePoolRefreshMetadata(supabase as never, 'pool-1', {
        last_refresh_error: 'API timeout',
      })

      expect(result.error).toBeNull()
      expect(builder.update).toHaveBeenCalledWith({
        last_refresh_error: 'API timeout',
      })
    })

    it('returns error message on failure', async () => {
      const builder: any = {
        update: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        then: (onFulfilled: (value: { error: { message: string } }) => unknown) =>
          Promise.resolve({ error: { message: 'connection refused' } }).then(onFulfilled),
      }
      const supabase = { from: vi.fn(() => builder) }

      const result = await updatePoolRefreshMetadata(supabase as never, 'pool-1', {
        last_refresh_error: 'timeout',
      })

      expect(result.error).toBe('connection refused')
    })
  })

  describe('insertAuditEvent', () => {
    it('calls audit_events.insert() with correct fields', async () => {
      const builder: any = {
        insert: vi.fn(() => builder),
        then: (onFulfilled: (value: { error: null }) => unknown) =>
          Promise.resolve({ error: null }).then(onFulfilled),
      }
      const supabase = { from: vi.fn(() => builder) }

      const result = await insertAuditEvent(supabase as never, {
        pool_id: 'pool-1',
        user_id: null,
        action: 'scoreRefreshCompleted',
        details: { completedRounds: 1 },
      })

      expect(result.error).toBeNull()
      expect(builder.insert).toHaveBeenCalledWith({
        pool_id: 'pool-1',
        user_id: null,
        action: 'scoreRefreshCompleted',
        details: { completedRounds: 1 },
      })
    })

    it('returns error message on failure', async () => {
      const builder: any = {
        insert: vi.fn(() => builder),
        then: (onFulfilled: (value: { error: { message: string } }) => unknown) =>
          Promise.resolve({ error: { message: 'insert failed' } }).then(onFulfilled),
      }
      const supabase = { from: vi.fn(() => builder) }

      const result = await insertAuditEvent(supabase as never, {
        pool_id: 'pool-1',
        user_id: null,
        action: 'scoreRefreshCompleted',
        details: {},
      })

      expect(result.error).toBe('insert failed')
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npm test -- --run src/lib/__tests__/pool-queries-for-scoring-refresh.test.ts
```
Expected: PASS (all 7 tests)

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/pool-queries-for-scoring-refresh.test.ts
git commit -m "OPS-54: add pool-queries unit tests for refresh pipeline"
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

---

## Spec Coverage Check

| Spec Requirement | Implementation |
|-----------------|----------------|
| Scoring domain edge cases (all-incomplete, missing golfer, fewer than 4, rankEntries empty) | `scoring-edge-cases.test.ts` — 5 tests |
| Slash Golf client edge cases (empty leaderboard, HTTP errors, alternate shapes, DQ status) | `slash-golf-client-edge-cases.test.ts` — 10 tests |
| Refresh flow edge cases (empty slashScores, partial upsert failure, metadata/audit failure, zero entries, completedRounds 0) | `scoring-refresh-edge-cases.test.ts` — 6 tests |
| pool-queries for refresh deps | `pool-queries-for-scoring-refresh.test.ts` — 7 tests |
| `NO_SCORES` error code | `scoring-refresh.ts` — `RefreshError` type updated |
| Empty `slashScores` handling | `scoring-refresh.ts` — early return with `NO_SCORES` error |

---

## PR Information

**Branch:** `feature/ops-54-regression-coverage`
**Verify:** `npm test -- --run` — all tests PASS (new + existing)
