import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from './route'
import { createClient } from '@/lib/supabase/server'
import { getTournamentScores } from '@/lib/slash-golf/client'
import { rankEntries } from '@/lib/scoring'
import { buildRefreshAuditDetails } from '@/lib/audit'
import {
  getActivePool,
  getOpenPoolsPastDeadline,
  updatePoolRefreshMetadata,
  insertAuditEvent,
} from '@/lib/pool-queries'
import {
  getScoresForTournament,
  upsertTournamentScore,
} from '@/lib/scoring-queries'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/slash-golf/client', () => ({
  getTournamentScores: vi.fn(),
}))

vi.mock('@/lib/scoring', () => ({
  rankEntries: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  buildRefreshAuditDetails: vi.fn(),
}))

vi.mock('@/lib/pool-queries', () => ({
  getActivePool: vi.fn(),
  getOpenPoolsPastDeadline: vi.fn(),
  updatePoolStatus: vi.fn(),
  updatePoolRefreshMetadata: vi.fn(),
  insertAuditEvent: vi.fn(),
}))

vi.mock('@/lib/scoring-queries', () => ({
  upsertTournamentScore: vi.fn(),
  getScoresForTournament: vi.fn(),
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
      { golfer_id: 'g1', total_birdies: 1, status: 'active' },
      { golfer_id: 'g2', total_birdies: 0, status: 'active' },
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

    vi.mocked(getOpenPoolsPastDeadline).mockResolvedValue([])
    vi.mocked(getActivePool).mockResolvedValue({
      id: 'pool-1',
      tournament_id: 't-1',
    } as never)
    vi.mocked(getScoresForTournament)
      .mockResolvedValueOnce(existingScores as never)
      .mockResolvedValueOnce(refreshedScores as never)
    vi.mocked(getTournamentScores).mockResolvedValue([
      { golfer_id: 'g1', hole_scores: [-1, 0], thru: 2 },
    ] as never)
    vi.mocked(upsertTournamentScore).mockResolvedValue(undefined as never)
    vi.mocked(updatePoolRefreshMetadata).mockResolvedValue({ error: null })
    vi.mocked(rankEntries).mockReturnValue([])
    vi.mocked(buildRefreshAuditDetails).mockReturnValue({
      completedHoles: 2,
      golferCount: 2,
      changedGolfers: ['g1'],
      newGolfers: [],
      droppedGolfers: [],
      diffs: {},
    })
    vi.mocked(insertAuditEvent).mockResolvedValue({ error: null })

    const request = new Request('http://localhost/api/scoring', {
      method: 'POST',
      headers: { Authorization: 'Bearer secret' },
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(buildRefreshAuditDetails).toHaveBeenCalledWith(
      expect.any(Map),
      refreshedScores,
      2,
      refreshedScores.length
    )
    expect(insertAuditEvent).toHaveBeenCalledWith(expect.anything(), {
      pool_id: 'pool-1',
      user_id: null,
      action: 'scoreRefreshCompleted',
      details: {
        completedHoles: 2,
        golferCount: 2,
        changedGolfers: ['g1'],
        newGolfers: [],
        droppedGolfers: [],
        diffs: {},
        entryCount: entries.length,
      },
    })
  })
})
