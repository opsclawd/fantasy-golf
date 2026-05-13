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
    const now = new Date()
    const warningDeadline = new Date(now.getTime() + 36 * 60 * 60 * 1000)
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const parts = formatter.formatToParts(warningDeadline)
    const year = parts.find(p => p.type === 'year')!.value
    const month = parts.find(p => p.type === 'month')!.value
    const day = parts.find(p => p.type === 'day')!.value
    const deadline = `${year}-${month}-${day}T00:00:00+00:00`
    const html = renderToStaticMarkup(
      <LockBanner isLocked={false} deadline={deadline} poolStatus="open" timezone="America/New_York" />
    )
    expect(html).toContain('border-amber')
    expect(html).toContain('bg-amber')
  })

  it('renders with info tone when pool is open and deadline is more than 24 hours away', () => {
    const now = new Date()
    const safeDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1000)
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const parts = formatter.formatToParts(safeDeadline)
    const year = parts.find(p => p.type === 'year')!.value
    const month = parts.find(p => p.type === 'month')!.value
    const day = parts.find(p => p.type === 'day')!.value
    const deadline = `${year}-${month}-${day}T00:00:00+00:00`
    const html = renderToStaticMarkup(
      <LockBanner isLocked={false} deadline={deadline} poolStatus="open" timezone="America/New_York" />
    )
    expect(html).toContain('border-green')
    expect(html).toContain('bg-green')
  })

  it('shows secondary line with timezone when within 24 hours', () => {
    const now = new Date()
    const safeDeadline = new Date(now.getTime() + 12 * 60 * 60 * 1000)
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    })
    const parts = formatter.formatToParts(safeDeadline)
    const year = parts.find(p => p.type === 'year')!.value
    const month = parts.find(p => p.type === 'month')!.value
    const day = parts.find(p => p.type === 'day')!.value
    const hour = parts.find(p => p.type === 'hour')!.value
    const deadline = `${year}-${month}-${day}T${hour}:00:00+00:00`
    const html = renderToStaticMarkup(
      <LockBanner isLocked={false} deadline={deadline} poolStatus="open" timezone="America/New_York" />
    )
    expect(html).toMatch(/EDT|EST/)
  })
})
