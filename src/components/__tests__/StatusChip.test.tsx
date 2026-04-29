import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StatusChip } from '../StatusChip'

describe('StatusChip with deadline', () => {
  it('renders deadline when status is open and deadline is provided', () => {
    const html = renderToStaticMarkup(
      <StatusChip status="open" deadline="2026-04-30T00:00:00Z" timezone="America/New_York" />
    )
    expect(html).toContain('Apr 30')
  })

  it('does not render deadline when status is live', () => {
    const html = renderToStaticMarkup(
      <StatusChip status="live" deadline="2026-04-30T00:00:00Z" timezone="America/New_York" />
    )
    expect(html).not.toContain('Deadline')
  })

  it('does not render deadline when status is complete', () => {
    const html = renderToStaticMarkup(
      <StatusChip status="complete" deadline="2026-04-30T00:00:00Z" timezone="America/New_York" />
    )
    expect(html).not.toContain('Deadline')
  })
})