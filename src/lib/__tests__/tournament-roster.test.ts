import { describe, expect, it } from 'vitest'

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
