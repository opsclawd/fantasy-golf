import { describe, expect, it } from 'vitest'

import { shouldRenderLeaderboardTrustStatus } from '../leaderboard-trust-status'

describe('shouldRenderLeaderboardTrustStatus', () => {
  it('renders trust status in leaderboard header for live pools by default', () => {
    expect(shouldRenderLeaderboardTrustStatus('live', false)).toBe(true)
  })

  it('renders trust status in leaderboard header for complete pools by default', () => {
    expect(shouldRenderLeaderboardTrustStatus('complete', false)).toBe(true)
  })

  it('does not render trust status in leaderboard header when hidden explicitly', () => {
    expect(shouldRenderLeaderboardTrustStatus('live', true)).toBe(false)
    expect(shouldRenderLeaderboardTrustStatus('complete', true)).toBe(false)
  })

  it('does not render trust status in leaderboard header for open pools', () => {
    expect(shouldRenderLeaderboardTrustStatus('open', false)).toBe(false)
  })
})
