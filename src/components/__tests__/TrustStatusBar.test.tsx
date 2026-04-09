import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { getTrustStatusBarState, TrustStatusBar } from '../TrustStatusBar'

describe('getTrustStatusBarState', () => {
  it('returns the shared heading copy for live pools', () => {
    const result = getTrustStatusBarState({
      isLocked: true,
      poolStatus: 'live',
      freshness: 'current',
      refreshedAt: '2026-03-29T12:00:00.000Z',
      lastRefreshError: null,
    })

    expect(result.heading).toBe('Tournament status')
    expect(result.lockLabel).toBe('Locked')
    expect(result.freshnessLabel).toBe('Current')
  })

  it('sets showFreshness to false for open pools', () => {
    const result = getTrustStatusBarState({
      isLocked: false,
      poolStatus: 'open',
      freshness: 'current',
      refreshedAt: '2026-03-29T12:00:00.000Z',
      lastRefreshError: null,
    })

    expect(result.showFreshness).toBe(false)
  })

  it('sets showFreshness to true for live pools', () => {
    const result = getTrustStatusBarState({
      isLocked: true,
      poolStatus: 'live',
      freshness: 'current',
      refreshedAt: '2026-03-29T12:00:00.000Z',
      lastRefreshError: null,
    })

    expect(result.showFreshness).toBe(true)
  })

  it('sets showFreshness to true for complete pools', () => {
    const result = getTrustStatusBarState({
      isLocked: true,
      poolStatus: 'complete',
      freshness: 'current',
      refreshedAt: '2026-03-29T12:00:00.000Z',
      lastRefreshError: null,
    })

    expect(result.showFreshness).toBe(true)
  })

  it('returns locked + live messaging with current freshness details', () => {
    const result = getTrustStatusBarState({
      isLocked: true,
      poolStatus: 'live',
      freshness: 'current',
      refreshedAt: '2026-03-29T12:00:00.000Z',
      lastRefreshError: null,
    })

    expect(result).toEqual({
      heading: 'Tournament status',
      lockLabel: 'Locked',
      lockMessage: 'The tournament is live. No changes allowed.',
      freshnessLabel: 'Current',
      freshnessMessage: 'Scores are current. Last updated at 2026-03-29T12:00:00.000Z.',
      tone: 'info',
      role: 'status',
      ariaLive: 'polite',
      icon: '\uD83D\uDD12',
      showFreshness: true,
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
      heading: 'Tournament status',
      lockLabel: 'Open',
      lockMessage: 'You can edit picks until the deadline.',
      freshnessLabel: 'Stale',
      freshnessMessage: 'Scores may be delayed. Data is stale.',
      tone: 'warning',
      role: 'status',
      ariaLive: 'polite',
      icon: '\uD83D\uDD13',
      showFreshness: false,
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
      heading: 'Tournament status',
      lockLabel: 'Open',
      lockMessage: 'You can edit picks until the deadline.',
      freshnessLabel: 'No data',
      freshnessMessage: 'No scoring data is available yet.',
      tone: 'warning',
      role: 'status',
      ariaLive: 'polite',
      icon: '\uD83D\uDD13',
      showFreshness: false,
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
      heading: 'Tournament status',
      lockLabel: 'Open',
      lockMessage: 'You can edit picks until the deadline.',
      freshnessLabel: 'Refresh failed',
      freshnessMessage: 'Last refresh error: PGATour API timed out.',
      tone: 'error',
      role: 'alert',
      ariaLive: 'assertive',
      icon: '\uD83D\uDD13',
      showFreshness: false,
    })
  })

  it('renders a non-contradictory freshness label when a live pool has a refresh error', () => {
    const markup = renderToStaticMarkup(
      createElement(TrustStatusBar, {
        isLocked: true,
        poolStatus: 'live',
        freshness: 'current',
        refreshedAt: '2026-03-29T12:00:00.000Z',
        lastRefreshError: 'PGATour API timed out',
      }),
    )

    expect(markup).toContain('Freshness: Refresh failed')
    expect(markup).toContain('Last refresh error: PGATour API timed out.')
    expect(markup).not.toContain('Freshness: Current')
    expect(markup).toContain('role="alert"')
    expect(markup).toContain('aria-live="assertive"')
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

  it('shows refreshing state when isRefreshing is true', () => {
    const result = getTrustStatusBarState({
      isLocked: true,
      poolStatus: 'live',
      freshness: 'stale',
      refreshedAt: '2026-04-08T11:45:00.000Z',
      lastRefreshError: null,
      isRefreshing: true,
    })

    expect(result.freshnessLabel).toBe('Refreshing')
    expect(result.freshnessMessage).toContain('Refreshing scores...')
    expect(result.tone).toBe('info')
  })

  it('returns archived lock messaging', () => {
    const result = getTrustStatusBarState({
      isLocked: true,
      poolStatus: 'archived',
      freshness: 'current',
      refreshedAt: '2026-03-29T12:00:00.000Z',
      lastRefreshError: null,
    })

    expect(result.lockLabel).toBe('Archived')
    expect(result.lockMessage).toBe('This pool is archived. No changes allowed.')
    expect(result.showFreshness).toBe(true)
  })

  it('prioritizes isRefreshing over refresh error', () => {
    const result = getTrustStatusBarState({
      isLocked: true,
      poolStatus: 'live',
      freshness: 'stale',
      refreshedAt: '2026-04-08T11:45:00.000Z',
      lastRefreshError: 'PGATour API timed out',
      isRefreshing: true,
    })

    expect(result.freshnessLabel).toBe('Refreshing')
    expect(result.freshnessMessage).toContain('Refreshing scores...')
  })
})
