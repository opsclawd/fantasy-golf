import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { LockBanner } from '../LockBanner'

describe('LockBanner', () => {
  it('renders the normalized lock instant for open pools', () => {
    const markup = renderToStaticMarkup(
      <LockBanner
        isLocked={false}
        deadline="2026-04-02T00:00:00"
        timezone="America/Denver"
        poolStatus="open"
      />,
    )

    expect(markup).toContain('Deadline:')
    expect(markup).toContain('Thu, Apr 2, 12:00 a.m. MDT')
    expect(markup).not.toContain('Wed, Apr 1, 6:00 p.m. MDT')
  })
})
