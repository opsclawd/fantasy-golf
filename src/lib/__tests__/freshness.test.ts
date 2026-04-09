import { describe, it, expect } from 'vitest'
import { classifyFreshness, DEFAULT_STALE_THRESHOLD_MS } from '../freshness'

describe('classifyFreshness', () => {
  it('returns "unknown" when refreshedAt is null', () => {
    expect(classifyFreshness(null)).toBe('unknown')
  })

  it('returns "unknown" when refreshedAt is an invalid date string', () => {
    expect(classifyFreshness('not-a-date')).toBe('unknown')
  })

  it('returns "current" when refreshedAt is within the threshold', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    expect(classifyFreshness(fiveMinutesAgo)).toBe('current')
  })

  it('returns "stale" when refreshedAt is beyond the threshold', () => {
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString()
    expect(classifyFreshness(twentyMinutesAgo)).toBe('stale')
  })

  it('uses custom threshold when provided', () => {
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString()
    // Default threshold (15 min) → current; custom 2 min → stale
    expect(classifyFreshness(threeMinutesAgo)).toBe('current')
    expect(classifyFreshness(threeMinutesAgo, 2 * 60 * 1000)).toBe('stale')
  })

  it('returns "stale" at exact threshold boundary', () => {
    const exactlyAtThreshold = new Date(Date.now() - DEFAULT_STALE_THRESHOLD_MS).toISOString()
    expect(classifyFreshness(exactlyAtThreshold)).toBe('stale')
  })

  it('accepts explicit now parameter for deterministic testing', () => {
    const now = new Date('2026-04-10T12:00:00Z')
    const fiveMinBefore = '2026-04-10T11:55:00Z'
    const twentyMinBefore = '2026-04-10T11:40:00Z'

    expect(classifyFreshness(fiveMinBefore, DEFAULT_STALE_THRESHOLD_MS, now)).toBe('current')
    expect(classifyFreshness(twentyMinBefore, DEFAULT_STALE_THRESHOLD_MS, now)).toBe('stale')
  })
})
