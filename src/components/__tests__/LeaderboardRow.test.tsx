import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect, vi } from 'vitest'
import { LeaderboardRow } from '../LeaderboardRow'
import type { RankedEntry } from '../LeaderboardRow'

const baseEntry: RankedEntry = {
  id: 'entry-1',
  golfer_ids: ['g1', 'g2', 'g3', 'g4'],
  totalScore: -10,
  totalBirdies: 4,
  rank: 1,
  user_id: 'user-abc-123',
}

describe('LeaderboardRow', () => {
  it('renders rank badge', () => {
    const markup = renderToStaticMarkup(
      createElement(LeaderboardRow, {
        entry: baseEntry,
        isTied: false,
        golferNames: { g1: 'A. golfer', g2: 'B. golfer', g3: 'C. golfer', g4: 'D. golfer' },
        withdrawnGolferIds: new Set(),
        onSelectGolfer: vi.fn(),
        rowIndex: 0,
      })
    )
    expect(markup).toContain('>1<')
  })

  it('renders tie prefix for tied entries', () => {
    const markup = renderToStaticMarkup(
      createElement(LeaderboardRow, {
        entry: baseEntry,
        isTied: true,
        golferNames: { g1: 'A. golfer', g2: 'B. golfer', g3: 'C. golfer', g4: 'D. golfer' },
        withdrawnGolferIds: new Set(),
        onSelectGolfer: vi.fn(),
        rowIndex: 0,
      })
    )
    expect(markup).toContain('>T1<')
  })

  it('does not render TieExplanationBadge when not tied', () => {
    const markup = renderToStaticMarkup(
      createElement(LeaderboardRow, {
        entry: baseEntry,
        isTied: false,
        golferNames: { g1: 'A. golfer', g2: 'B. golfer', g3: 'C. golfer', g4: 'D. golfer' },
        withdrawnGolferIds: new Set(),
        onSelectGolfer: vi.fn(),
        rowIndex: 0,
      })
    )
    expect(markup).not.toContain('Tied with')
  })
})