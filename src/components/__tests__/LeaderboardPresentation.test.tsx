import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { LeaderboardRow } from '../LeaderboardRow'

describe('LeaderboardRow', () => {
  it('renders rank, entry name, score, and birdies in a scan-friendly hierarchy', () => {
    const markup = renderToStaticMarkup(
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

    expect(markup).toContain('>1<')
    expect(markup).toContain('user-1234')
    expect(markup).toContain('Scottie Scheffler')
    expect(markup).toContain('>-12<')
    expect(markup).toContain('>14<')
  })
})
