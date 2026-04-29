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

describe('LockBanner token migration', () => {
  it('uses stone tokens for locked state (not slate)', () => {
    const props: any = {
      isLocked: true,
      deadline: '2026-04-09T00:00:00+00:00',
      poolStatus: 'complete',
      timezone: 'America/New_York',
    }
    const markup = renderToStaticMarkup(<LockBanner {...props} />)

    expect(markup).toContain('border-stone-200')
    expect(markup).toContain('bg-stone-100')
    expect(markup).not.toContain('slate-')
    expect(markup).not.toContain('emerald-')
  })

  it('uses green tokens for open state (not emerald)', () => {
    const props: any = {
      isLocked: false,
      deadline: '2026-04-09T00:00:00+00:00',
      poolStatus: 'open',
      timezone: 'America/New_York',
    }
    const markup = renderToStaticMarkup(<LockBanner {...props} />)

    expect(markup).toContain('border-green-200')
    expect(markup).toContain('bg-green-100')
    expect(markup).toContain('text-green-950')
    expect(markup).not.toContain('emerald-')
    expect(markup).not.toContain('slate-')
  })
})

describe('LockBanner warning tone near deadline', () => {
  it('renders with warning tone when pool is open and deadline is within 24 hours', () => {
    const html = renderToStaticMarkup(
      <LockBanner isLocked={false} deadline="2026-04-30T00:00:00+00:00" poolStatus="open" timezone="America/New_York" />
    )
    expect(html).toContain('border-amber')
    expect(html).toContain('bg-amber')
  })

  it('renders with info tone when pool is open and deadline is more than 24 hours away', () => {
    const html = renderToStaticMarkup(
      <LockBanner isLocked={false} deadline="2026-05-01T00:00:00+00:00" poolStatus="open" timezone="America/New_York" />
    )
    expect(html).toContain('border-green')
    expect(html).toContain('bg-green')
  })

  it('shows secondary line with timezone when within 24 hours', () => {
    const html = renderToStaticMarkup(
      <LockBanner isLocked={false} deadline="2026-04-30T00:00:00+00:00" poolStatus="open" timezone="America/New_York" />
    )
    expect(html).toContain('America/New_York')
  })
})
