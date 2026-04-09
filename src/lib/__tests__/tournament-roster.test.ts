import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { getTournamentRosterGolfers } from '@/lib/tournament-roster/queries'

describe('tournament roster queries', () => {
  it('shares one tournament roster across multiple pools with the same tournament_id', () => {
    const rosterRows = [
      { id: '50525', name: 'Collin Morikawa', country: 'USA', search_name: 'collin morikawa', is_active: true },
    ]
    const calls: string[] = []
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => {
              calls.push('tournament-1')
              return { data: rosterRows, error: null }
            },
          }),
        }),
      }),
    } as never

    return Promise.all([
      getTournamentRosterGolfers(supabase, 'tournament-1'),
      getTournamentRosterGolfers(supabase, 'tournament-1'),
    ]).then(([firstRoster, secondRoster]) => {
      expect(firstRoster).toEqual(rosterRows)
      expect(secondRoster).toEqual(rosterRows)
      expect(calls).toEqual(['tournament-1', 'tournament-1'])
    })
  })

  it('allows tournament roster entries to exist before a pool references them', () => {
    const prePoolRoster = [{ id: '90001', name: 'Future Golfer', country: 'USA', search_name: 'future golfer', is_active: true }]
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({ data: prePoolRoster, error: null }),
          }),
        }),
      }),
    } as never

    return expect(getTournamentRosterGolfers(supabase, 'future-tournament')).resolves.toEqual(prePoolRoster)
  })
})

describe('tournament_golfers RLS migration', () => {
  it('enables public reads and commissioner-only writes', () => {
    const migration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260408110000_add_tournament_golfers_rls.sql'),
      'utf8'
    )

    expect(migration).toContain('alter table public.tournament_golfers enable row level security')
    expect(migration).toContain('grant select on table public.tournament_golfers to anon, authenticated')
    expect(migration).toContain('grant insert, update, delete on table public.tournament_golfers to authenticated')
    expect(migration).toContain('Public tournament golfers are readable')
    expect(migration).toContain('for select')
    expect(migration).toContain('Commissioners can manage tournament golfers')
    expect(migration).toContain('for all')
    expect(migration).toContain('p.tournament_id = tournament_golfers.tournament_id')
    expect(migration).toContain('p.commissioner_id = auth.uid()')
  })
})
