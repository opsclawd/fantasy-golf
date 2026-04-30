import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from './route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTournamentScores } from '@/lib/slash-golf/client'
import { rankEntries, deriveCompletedRounds } from '@/lib/scoring/domain'
import { buildRefreshAuditDetails } from '@/lib/audit'
import {
  getActivePool,
  getOpenPoolsPastDeadline,
  getPoolsByTournament,
  getEntriesForPool,
  updatePoolRefreshMetadata,
  insertAuditEvent,
  acquireRefreshLock,
  releaseRefreshLock,
} from '@/lib/pool-queries'
import {
  getScoresForTournament,
  upsertTournamentScore,
  getTournamentScoreRounds,
} from '@/lib/scoring-queries'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

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
  getActivePool: vi.fn(),
  getOpenPoolsPastDeadline: vi.fn(),
  getPoolsByTournament: vi.fn(),
  getEntriesForPool: vi.fn(),
  updatePoolStatus: vi.fn(),
  updatePoolRefreshMetadata: vi.fn(),
  updatePoolRefreshTelemetry: vi.fn(),
  insertAuditEvent: vi.fn(),
  acquireRefreshLock: vi.fn(),
  releaseRefreshLock: vi.fn(),
}))

vi.mock('@/lib/scoring-queries', () => ({
  upsertTournamentScore: vi.fn(),
  getScoresForTournament: vi.fn(),
  getTournamentScoreRounds: vi.fn(),
}))

const originalEnv = { ...process.env }

describe('POST /api/scoring', () => {
  beforeEach(() => {
    process.env = { ...originalEnv, CRON_SECRET: 'secret' }
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('uses golfer dataset size for audit details and preserves entryCount compatibility', async () => {
    const entries = [{ id: 'entry-1', pool_id: 'pool-1' }]
    const existingScores: Array<Record<string, unknown>> = []
    const refreshedScores: Array<Record<string, unknown>> = [
      { golfer_id: 'g1', round_id: 1, round_score: -1, total_score: -2, total_birdies: 1, status: 'active' },
      { golfer_id: 'g2', round_id: 1, round_score: 0, total_score: -1, total_birdies: 0, status: 'active' },
    ]

    const send = vi.fn().mockResolvedValue(undefined)
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'entries') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ data: entries }),
            }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
      channel: vi.fn().mockReturnValue({ send }),
    } as never)
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'entries') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ data: entries }),
            }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
      channel: vi.fn().mockReturnValue({ send }),
    } as never)

    vi.mocked(getOpenPoolsPastDeadline).mockResolvedValue([])
    vi.mocked(getActivePool).mockResolvedValue({
      id: 'pool-1',
      tournament_id: 't-1',
      year: 2026,
      status: 'live',
    } as never)
    vi.mocked(acquireRefreshLock).mockResolvedValue({ acquired: true, lockId: 'lock-1' })
    vi.mocked(releaseRefreshLock).mockResolvedValue({ error: null })
    vi.mocked(getPoolsByTournament).mockResolvedValue([
      { id: 'pool-1', tournament_id: 't-1', status: 'live' },
    ] as never)
    vi.mocked(getEntriesForPool).mockResolvedValue(entries as never)
    vi.mocked(getScoresForTournament)
      .mockResolvedValueOnce(existingScores as never)
      .mockResolvedValueOnce(refreshedScores as never)
    vi.mocked(getTournamentScores).mockResolvedValue([
      { golfer_id: 'g1', round_id: 1, round_score: -1, total_score: -2, total_birdies: 1, status: 'active', current_round: 1 },
    ] as never)
    vi.mocked(upsertTournamentScore).mockResolvedValue({ error: null })
    vi.mocked(updatePoolRefreshMetadata).mockResolvedValue({ error: null })
    vi.mocked(rankEntries).mockReturnValue([])
    vi.mocked(buildRefreshAuditDetails).mockReturnValue({
      completedRounds: 2,
      golferCount: 2,
      changedGolfers: ['g1'],
      newGolfers: [],
      droppedGolfers: [],
      diffs: {},
    })
    vi.mocked(insertAuditEvent).mockResolvedValue({ error: null })
    vi.mocked(getTournamentScoreRounds).mockResolvedValue([])
    vi.mocked(deriveCompletedRounds).mockReturnValue(1)

    const request = new Request('http://localhost/api/scoring', {
      method: 'POST',
      headers: { Authorization: 'Bearer secret' },
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(createAdminClient).toHaveBeenCalledTimes(1)
    expect(buildRefreshAuditDetails).toHaveBeenCalledWith(
      expect.any(Map),
      refreshedScores,
      1,
      refreshedScores.length
    )
    expect(getTournamentScores).toHaveBeenCalledWith('t-1', 2026)
    expect(insertAuditEvent).toHaveBeenCalledWith(expect.anything(), {
      pool_id: 'pool-1',
      user_id: null,
      action: 'scoreRefreshCompleted',
        details: {
          completedRounds: 2,
           golferCount: 2,
           changedGolfers: ['g1'],
           newGolfers: [],
        droppedGolfers: [],
        diffs: {},
        entryCount: entries.length,
      },
    })
  })

  it('fans out scoring metadata to every live pool on the same tournament', async () => {
    const entriesPool1 = [{ id: 'entry-1', pool_id: 'pool-1' }]
    const entriesPool2 = [{ id: 'entry-2', pool_id: 'pool-2' }]

    vi.mocked(createClient).mockResolvedValue({
      channel: vi.fn().mockReturnValue({ send: vi.fn() }),
      from: vi.fn(),
    } as never)
    vi.mocked(createAdminClient).mockReturnValue({
      channel: vi.fn().mockReturnValue({ send: vi.fn() }),
      from: vi.fn(),
    } as never)

    vi.mocked(getOpenPoolsPastDeadline).mockResolvedValue([])
    vi.mocked(getActivePool).mockResolvedValue({
      id: 'pool-1',
      tournament_id: 't-1',
      year: 2026,
      status: 'live',
    } as never)
    vi.mocked(acquireRefreshLock).mockResolvedValue({ acquired: true, lockId: 'lock-1' })
    vi.mocked(releaseRefreshLock).mockResolvedValue({ error: null })
    vi.mocked(getPoolsByTournament).mockResolvedValue([
      { id: 'pool-1', tournament_id: 't-1', status: 'live' },
      { id: 'pool-2', tournament_id: 't-1', status: 'live' },
    ] as never)
    vi.mocked(getEntriesForPool)
      .mockResolvedValueOnce(entriesPool1 as never)
      .mockResolvedValueOnce(entriesPool2 as never)
    vi.mocked(getScoresForTournament)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
    vi.mocked(getTournamentScores).mockResolvedValue([
      { golfer_id: 'g1', round_id: 1, round_score: -1, total_score: -2, total_birdies: 1, status: 'active' },
    ] as never)
    vi.mocked(upsertTournamentScore).mockResolvedValue({ error: null })
    vi.mocked(updatePoolRefreshMetadata).mockResolvedValue({ error: null })
    vi.mocked(rankEntries).mockReturnValue([])
    vi.mocked(buildRefreshAuditDetails).mockReturnValue({
      completedRounds: 2,
      golferCount: 1,
      changedGolfers: ['g1'],
      newGolfers: [],
      droppedGolfers: [],
      diffs: {},
    })
    vi.mocked(insertAuditEvent).mockResolvedValue({ error: null })
    vi.mocked(getTournamentScoreRounds).mockResolvedValue([])
    vi.mocked(deriveCompletedRounds).mockReturnValue(1)

    const request = new Request('http://localhost/api/scoring', {
      method: 'POST',
      headers: { Authorization: 'Bearer secret' },
    })

    await POST(request)

    expect(getTournamentScores).toHaveBeenCalledWith('t-1', 2026)
    expect(getEntriesForPool).toHaveBeenCalledWith(expect.anything(), 'pool-1')
    expect(getEntriesForPool).toHaveBeenCalledWith(expect.anything(), 'pool-2')
    expect(updatePoolRefreshMetadata).toHaveBeenCalledWith(expect.anything(), 'pool-1', {
      refreshed_at: expect.any(String),
      last_refresh_error: null,
    })
    expect(updatePoolRefreshMetadata).toHaveBeenCalledWith(expect.anything(), 'pool-2', {
      refreshed_at: expect.any(String),
      last_refresh_error: null,
    })
    expect(insertAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ pool_id: 'pool-1' }))
    expect(insertAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ pool_id: 'pool-2' }))
  })

  it('fails refresh when any score upsert fails and records failure audit metadata', async () => {
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'entries') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ data: [] }),
            }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
      channel: vi.fn().mockReturnValue({ send: vi.fn() }),
    } as never)
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'entries') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ data: [] }),
            }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
      channel: vi.fn().mockReturnValue({ send: vi.fn() }),
    } as never)

    vi.mocked(getOpenPoolsPastDeadline).mockResolvedValue([])
    vi.mocked(getActivePool).mockResolvedValue({
      id: 'pool-1',
      tournament_id: 't-1',
    } as never)
    vi.mocked(acquireRefreshLock).mockResolvedValue({ acquired: true, lockId: 'lock-1' })
    vi.mocked(releaseRefreshLock).mockResolvedValue({ error: null })
    vi.mocked(getScoresForTournament).mockResolvedValue([] as never)
    vi.mocked(getTournamentScores).mockResolvedValue([
      { golfer_id: 'g1', hole_scores: [0, -1], thru: 2 },
      { golfer_id: 'g2', hole_scores: [1, 0], thru: 2 },
    ] as never)
    vi.mocked(upsertTournamentScore)
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: 'duplicate key value violates constraint' })
    vi.mocked(updatePoolRefreshMetadata).mockResolvedValue({ error: null })
    vi.mocked(insertAuditEvent).mockResolvedValue({ error: null })

    const request = new Request('http://localhost/api/scoring', {
      method: 'POST',
      headers: { Authorization: 'Bearer secret' },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toEqual({
      code: 'UPSERT_FAILED',
      message: 'Failed to persist one or more golfer scores',
    })
    expect(updatePoolRefreshMetadata).toHaveBeenCalledWith(expect.anything(), 'pool-1', {
      last_refresh_error: expect.stringContaining('g2'),
    })
    expect(insertAuditEvent).toHaveBeenCalledWith(expect.anything(), {
      pool_id: 'pool-1',
      user_id: null,
      action: 'scoreRefreshFailed',
      details: {
        error: expect.stringContaining('g2'),
        failures: [
          {
            golfer_id: 'g2',
            error: 'duplicate key value violates constraint',
          },
        ],
      },
    })
    expect(insertAuditEvent).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'scoreRefreshCompleted' })
    )
  })
})
