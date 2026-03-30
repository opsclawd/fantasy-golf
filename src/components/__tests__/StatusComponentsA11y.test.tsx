import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { FreshnessChip } from '@/components/FreshnessChip'
import { StatusChip } from '@/components/StatusChip'

import { PickProgress } from '../PickProgress'
import { SubmissionConfirmation } from '../SubmissionConfirmation'

describe('status component accessibility attributes', () => {
  it('renders FreshnessChip with polite live region and accessible label', () => {
    const markup = renderToStaticMarkup(
      createElement(FreshnessChip, { status: 'current', refreshedAt: null }),
    )

    expect(markup).toContain('role="status"')
    expect(markup).toContain('aria-live="polite"')
    expect(markup).toContain('aria-label="Data is current"')
  })

  it('renders StatusChip with explicit pool-status aria-label', () => {
    const markup = renderToStaticMarkup(
      createElement(StatusChip, { status: 'live' }),
    )

    expect(markup).toContain('role="status"')
    expect(markup).toContain('aria-label="Pool status: Live"')
  })

  it('renders an unmistakable confirmation heading and picks list', () => {
    const markup = renderToStaticMarkup(
      createElement(SubmissionConfirmation, {
        golferNames: { a: 'Scottie Scheffler', b: 'Rory McIlroy' },
        golferIds: ['a', 'b'],
        isLocked: false,
        poolName: 'Players Championship Pool',
      }),
    )

    expect(markup).toContain('role="status"')
    expect(markup).toContain('Entry locked in')
    expect(markup).toContain('Scottie Scheffler')
    expect(markup).toContain('Rory McIlroy')
  })

  it('renders PickProgress with ready-to-submit copy and completed progress value', () => {
    const markup = renderToStaticMarkup(
      createElement(PickProgress, { current: 4, required: 4 }),
    )

    expect(markup).toContain('All 4 golfers selected - ready-to-submit')
    expect(markup).toContain('role="progressbar"')
    expect(markup).toContain('aria-valuenow="4"')
    expect(markup).toContain('aria-valuemax="4"')
  })
})
