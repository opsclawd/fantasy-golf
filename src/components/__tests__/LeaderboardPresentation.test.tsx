// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LeaderboardRow } from '../LeaderboardRow'

describe('LeaderboardRow', () => {
  it('renders rank, entry name, score, and birdies in a scan-friendly hierarchy', () => {
    render(
      <table>
        <tbody>
          <LeaderboardRow
            entry={{
              id: 'e1',
              user_id: 'user-12345678',
              golfer_ids: ['g1'],
              totalScore: -12,
              totalBirdies: 14,
              rank: 1,
            }}
            isTied={false}
            golferNames={{ g1: 'Scottie Scheffler' }}
            withdrawnGolferIds={new Set<string>()}
            onSelectGolfer={() => {}}
          />
        </tbody>
      </table>,
    )

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('user-1234')).toBeInTheDocument()
    expect(screen.getByText('Scottie Scheffler')).toBeInTheDocument()
    expect(screen.getByText('14')).toBeInTheDocument()
  })
})
