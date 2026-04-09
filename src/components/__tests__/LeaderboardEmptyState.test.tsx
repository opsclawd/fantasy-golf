// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LeaderboardEmptyState } from '../LeaderboardEmptyState'

describe('LeaderboardEmptyState', () => {
  it('describes a live leaderboard with entries as waiting for first scores', () => {
    render(
      <LeaderboardEmptyState
        poolStatus="live"
        hasEntries={true}
        lastRefreshError={null}
      />,
    )

    expect(screen.getByText('Waiting for scores')).toBeInTheDocument()
    expect(
      screen.getByText(
        'The tournament is live but no scoring data has been received yet. Standings will appear once the first scores come in.',
      ),
    ).toBeInTheDocument()
  })

  it('describes a live leaderboard with no entries as needing pool setup', () => {
    render(
      <LeaderboardEmptyState
        poolStatus="live"
        hasEntries={false}
        lastRefreshError={null}
      />,
    )

    expect(screen.getByText('No entries in this pool')).toBeInTheDocument()
    expect(
      screen.getByText('This pool has no entries. Standings cannot be calculated without participants.'),
    ).toBeInTheDocument()
  })

  it('describes an archived pool with entries as read-only frozen', () => {
    render(
      <LeaderboardEmptyState
        poolStatus="archived"
        hasEntries={true}
        lastRefreshError={null}
      />,
    )

    expect(screen.getByText('Archived pool')).toBeInTheDocument()
    expect(
      screen.getByText('This pool is archived and read-only. The leaderboard is frozen.'),
    ).toBeInTheDocument()
  })

  it('describes an archived pool with no entries', () => {
    render(
      <LeaderboardEmptyState
        poolStatus="archived"
        hasEntries={false}
        lastRefreshError={null}
      />,
    )

    expect(screen.getByText('Archived pool')).toBeInTheDocument()
    expect(
      screen.getByText('This pool is archived and read-only. There are no entries to show yet.'),
    ).toBeInTheDocument()
  })
})
