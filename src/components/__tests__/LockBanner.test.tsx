import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { LockBanner } from '../LockBanner'

describe('LockBanner', () => {
  it('renders the normalized lock instant for open pools', () => {
    const props: any = {
      isLocked: false,
      deadline: '2026-04-09T00:00:00+00:00',
      poolStatus: 'open',
      timezone: 'America/New_York',
    }

    const markup = renderToStaticMarkup(
      <LockBanner {...props} />,
    )

    expect(markup).toContain('Deadline:')
    expect(markup).toContain('Apr 9')
    expect(markup).toContain('EDT')
    expect(markup).not.toContain('Apr 8')
  })

  it('renders archived lock message', () => {
    const props: any = {
      isLocked: true,
      deadline: '2026-04-09T00:00:00+00:00',
      poolStatus: 'archived',
      timezone: 'America/New_York',
    }

    const markup = renderToStaticMarkup(
      <LockBanner {...props} />,
    )

    expect(markup).toContain('This pool is archived. Picks are read-only.')
  })
})
