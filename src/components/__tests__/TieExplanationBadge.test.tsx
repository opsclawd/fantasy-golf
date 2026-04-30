import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TieExplanationBadge } from '../TieExplanationBadge'

describe('TieExplanationBadge', () => {
  it('renders when isTied is true', () => {
    const html = renderToStaticMarkup(
      <TieExplanationBadge isTied={true} entryName="My Entry" totalBirdies={7} />
    )
    expect(html).toContain('Tied')
    expect(html).toContain('7')
  })

  it('does not render when isTied is false', () => {
    const html = renderToStaticMarkup(
      <TieExplanationBadge isTied={false} entryName="My Entry" totalBirdies={7} />
    )
    expect(html).toEqual('')
  })

  it('renders with correct birdie count', () => {
    const html = renderToStaticMarkup(
      <TieExplanationBadge isTied={true} entryName="My Entry" totalBirdies={12} />
    )
    expect(html).toContain('12')
  })

  it('renders entry name in badge', () => {
    const html = renderToStaticMarkup(
      <TieExplanationBadge isTied={true} entryName="Dream Team" totalBirdies={5} />
    )
    expect(html).toContain('Dream Team')
  })
})