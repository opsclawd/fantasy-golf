import { describe, expect, it } from 'vitest'

import { getTrustStatusBarState } from '../TrustStatusBar'

describe('getTrustStatusBarState', () => {
  it('returns locked + live messaging with current freshness details', () => {
    const result = getTrustStatusBarState({
      isLocked: true,
      poolStatus: 'live',
      freshness: 'current',
      refreshedAt: '2026-03-29T12:00:00.000Z',
      lastRefreshError: null,
    })

    expect(result).toEqual({
      heading: 'Picks are locked',
      lockMessage: 'The tournament is live. No changes allowed.',
      freshnessMessage: 'Scores are current. Last updated at 2026-03-29T12:00:00.000Z.',
      tone: 'info',
      role: 'status',
      ariaLive: 'polite',
      icon: '\uD83D\uDD12',
    })
  })

  it('returns open messaging with stale freshness warning', () => {
    const result = getTrustStatusBarState({
      isLocked: false,
      poolStatus: 'open',
      freshness: 'stale',
      refreshedAt: null,
      lastRefreshError: null,
    })

    expect(result).toEqual({
      heading: 'Picks are open',
      lockMessage: 'You can edit picks until the deadline.',
      freshnessMessage: 'Scores may be delayed. Data is stale.',
      tone: 'warning',
      role: 'status',
      ariaLive: 'polite',
      icon: '\uD83D\uDD13',
    })
  })

  it('returns unknown freshness fallback messaging', () => {
    const result = getTrustStatusBarState({
      isLocked: false,
      poolStatus: 'open',
      freshness: 'unknown',
      refreshedAt: null,
      lastRefreshError: null,
    })

    expect(result).toEqual({
      heading: 'Picks are open',
      lockMessage: 'You can edit picks until the deadline.',
      freshnessMessage: 'No scoring data is available yet.',
      tone: 'warning',
      role: 'status',
      ariaLive: 'polite',
      icon: '\uD83D\uDD13',
    })
  })

  it('prioritizes refresh errors over freshness status', () => {
    const result = getTrustStatusBarState({
      isLocked: false,
      poolStatus: 'open',
      freshness: 'current',
      refreshedAt: '2026-03-29T12:00:00.000Z',
      lastRefreshError: 'PGATour API timed out',
    })

    expect(result).toEqual({
      heading: 'Picks are open',
      lockMessage: 'You can edit picks until the deadline.',
      freshnessMessage: 'Last refresh error: PGATour API timed out.',
      tone: 'error',
      role: 'alert',
      ariaLive: 'assertive',
      icon: '\uD83D\uDD13',
    })
  })

  it('uses deadline-passed lock text when pool is locked while open', () => {
    const result = getTrustStatusBarState({
      isLocked: true,
      poolStatus: 'open',
      freshness: 'unknown',
      refreshedAt: null,
      lastRefreshError: null,
    })

    expect(result.lockMessage).toBe('The picks deadline has passed.')
  })
})
