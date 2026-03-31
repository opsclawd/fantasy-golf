// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { GolferDetailSheet } from '../GolferDetailSheet'
import type { Golfer, TournamentScore } from '@/lib/supabase/types'

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: vi.fn(),
  })
})

function createScore(status: TournamentScore['status']): TournamentScore {
  return {
    golfer_id: 'g1',
    tournament_id: 't1',
    total_birdies: 1,
    status,
    hole_1: -1,
    hole_2: 0,
    hole_3: null,
    hole_4: null,
    hole_5: null,
    hole_6: null,
    hole_7: null,
    hole_8: null,
    hole_9: null,
    hole_10: null,
    hole_11: null,
    hole_12: null,
    hole_13: null,
    hole_14: null,
    hole_15: null,
    hole_16: null,
    hole_17: null,
    hole_18: null,
  }
}

function createGolfer(): Golfer {
  return {
    id: 'g1',
    name: 'Scottie Scheffler',
    country: 'USA',
    search_name: 'scottie scheffler',
    world_rank: 1,
    is_active: true,
    source: 'legacy',
    external_player_id: null,
    last_synced_at: null,
  }
}

describe('GolferDetailSheet', () => {
  it('renders a polished empty state when scoring data is missing', () => {
    render(
      <GolferDetailSheet
        golfer={createGolfer()}
        score={null}
        onClose={() => {}}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Scoring details coming soon' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('We have not received hole-by-hole scoring data for this golfer yet.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Check back after the next leaderboard refresh to see round progress and scoring context.'),
    ).toBeInTheDocument()
  })

  it.each([
    ['withdrawn', 'Withdrawn', 'border-amber-200/80 bg-amber-50 text-amber-800'],
    ['cut', 'Cut', 'border-amber-200/80 bg-amber-50 text-amber-800'],
  ] as const)('uses caution styling for %s scoring states', (status, label, expectedClasses) => {
    render(
      <GolferDetailSheet
        golfer={createGolfer()}
        score={createScore(status)}
        onClose={() => {}}
      />,
    )

    expect(screen.getByText(label)).toHaveClass(expectedClasses)
  })

  it('uses neutral styling when the scoring feed is still pending', () => {
    render(
      <GolferDetailSheet
        golfer={createGolfer()}
        score={null}
        onClose={() => {}}
      />,
    )

    expect(screen.getByText('Awaiting scoring feed')).toHaveClass(
      'border-slate-200 bg-slate-100 text-slate-700',
    )
  })
})
