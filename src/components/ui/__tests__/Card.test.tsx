import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'

import { Card } from '../Card'

describe('Card', () => {
  it('renders children inside a div', () => {
    const markup = renderToStaticMarkup(createElement(Card, null, 'Hello world'))
    expect(markup).toContain('Hello world')
    expect(markup).toMatch(/^<div/)
  })

  it('applies panelClasses base styles by default', () => {
    const markup = renderToStaticMarkup(createElement(Card, null, 'Content'))
    expect(markup).toContain('rounded-3xl')
    expect(markup).toContain('border-white/60')
    expect(markup).toContain('bg-white/90')
    expect(markup).toContain('backdrop-blur')
  })

  it('applies accent left border when accent="left"', () => {
    const markup = renderToStaticMarkup(createElement(Card, { accent: 'left' }, 'Card content'))
    expect(markup).toContain('border-l-4')
    expect(markup).toContain('border-l-green-700')
  })

  it('does not apply accent classes when accent is undefined', () => {
    const markup = renderToStaticMarkup(createElement(Card, null, 'No accent'))
    expect(markup).not.toContain('border-l-4')
    expect(markup).not.toContain('border-l-green-700')
  })

  it('does not apply accent classes when accent="none"', () => {
    const markup = renderToStaticMarkup(createElement(Card, { accent: 'none' }, 'No accent'))
    expect(markup).not.toContain('border-l-4')
    expect(markup).not.toContain('border-l-green-700')
  })

  it('merges additional className prop', () => {
    const markup = renderToStaticMarkup(
      createElement(Card, { className: 'mt-4 p-6' }, 'Extra classes'),
    )
    expect(markup).toContain('mt-4')
    expect(markup).toContain('p-6')
    expect(markup).toContain('rounded-3xl')
  })

  it('passes through HTML div attributes', () => {
    const markup = renderToStaticMarkup(
      createElement(Card, { id: 'test-card', 'aria-label': 'Test card' }, 'Attrs'),
    )
    expect(markup).toContain('id="test-card"')
    expect(markup).toContain('aria-label="Test card"')
  })
})