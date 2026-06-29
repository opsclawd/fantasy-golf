import { describe, it, expect, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { GET } from '../../app/api/leaderboard/[poolId]/route'
import { createClient } from '../supabase/server'
import { getTournamentHolesForGolfers } from '../scoring-queries'

vi.mock('../supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('../scoring-queries', () => ({
  getTournamentHolesForGolfers: vi.fn(),
}))

// Mock fetch for background refresh trigger
global.fetch = vi.fn().mockResolvedValue({} as any)

describe('Regression: Scoring Readiness', () => {
  it('README.md does not describe round-based scoring', () => {
    const readme = fs.readFileSync(path.resolve(__dirname, '../../../README.md'), 'utf-8')
    expect(readme).not.toContain('round-by-round scoring')
    expect(readme).toContain('hole-by-hole scoring')
    expect(readme).toContain('lowest score among 4 golfers per hole')
  })

  it('docs/rules-spec.md defines scoring per hole', () => {
    const spec = fs.readFileSync(path.resolve(__dirname, '../../../docs/rules-spec.md'), 'utf-8')
    expect(spec).toContain('lowest `scoreToPar` among selected golfers with a valid score for that hole')
    expect(spec).not.toMatch(/Entry round score = min\(scoreToPar of active golfers\)/)
  })

  it('.gitignore still contains .env and .env.local', () => {
    const gitignore = fs.readFileSync(path.resolve(__dirname, '../../../.gitignore'), 'utf-8')
    expect(gitignore).toContain('.env\n')
    expect(gitignore).toContain('.env.local\n')
  })

  it('leaderboard GET uses tournament_holes and handles missing data safely', async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation((table) => {
        if (table === 'pools') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'pool-1', tournament_id: 't-1', status: 'live', refreshed_at: new Date().toISOString() },
              error: null,
            }),
          }
        }
        if (table === 'entries') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'e-1', golfer_ids: ['g-1'] }],
              error: null,
            }),
          }
        }
        if (table === 'tournament_scores') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [{ golfer_id: 'g-1', total_score: -1 }],
              error: null,
            }),
          }
        }
        if (table === 'tournament_roster') {
            return {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({
                    data: [{ id: 'g-1', name: 'Golfer 1' }],
                    error: null,
                }),
            }
        }
        return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [], error: null })
        }
      }),
    }

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)
    vi.mocked(getTournamentHolesForGolfers).mockResolvedValue(new Map()) // Empty holes

    const request = new Request('http://localhost/api/leaderboard/pool-1')
    const response = await GET(request, { params: Promise.resolve({ poolId: 'pool-1' }) })
    const body = await response.json()

    expect(getTournamentHolesForGolfers).toHaveBeenCalled()
    expect(body.data.isDegraded).toBe(true)
    expect(body.data.lastRefreshError).toBe('Hole-by-hole scoring data missing')
  })

  it('package.json has typecheck command', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf-8'))
    expect(pkg.scripts.typecheck).toBe('tsc --noEmit')
  })
})
