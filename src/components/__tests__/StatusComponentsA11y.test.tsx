import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { FreshnessChip } from '@/components/FreshnessChip'
import { StatusChip } from '@/components/StatusChip'

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
})
