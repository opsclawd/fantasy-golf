// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LeaderboardEmptyState } from '../LeaderboardEmptyState'

describe('LeaderboardEmptyState', () => {
  it('keeps the live empty state focused on scoring pending instead of an unreachable failure branch', () => {
    render(
      <LeaderboardEmptyState
        poolStatus="live"
        hasEntries={true}
        hasScores={true}
        lastRefreshError={null}
      />,
    )

    expect(screen.getByText('Waiting for scores')).toBeInTheDocument()
    expect(screen.queryByText('Standings unavailable')).not.toBeInTheDocument()
  })
})
