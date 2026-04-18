import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'

import { Card } from '../Card'

describe('Card', () => {
  it('renders a div element with children', () => {
    const markup = renderToStaticMarkup(createElement(Card, null, 'Card content'))
    expect(markup).toContain('Card content')
    expect(markup).toMatch(/^<div/)
  })

  it('applies panelClasses by default', () => {
    const markup = renderToStaticMarkup(createElement(Card, null, 'Panel'))
    expect(markup).toContain('rounded-3xl')
    expect(markup).toContain('bg-white/90')
    expect(markup).toContain('backdrop-blur')
  })

  it('applies border-l-4 border-l-green-700 when accent is left', () => {
    const markup = renderToStaticMarkup(createElement(Card, { accent: 'left' }, 'Accent'))
    expect(markup).toContain('border-l-4')
    expect(markup).toContain('border-l-green-700')
  })

  it('does not apply accent classes when accent is none', () => {
    const markup = renderToStaticMarkup(createElement(Card, { accent: 'none' }, 'No accent'))
    expect(markup).not.toContain('border-l-4')
    expect(markup).not.toContain('border-l-green-700')
  })

  it('does not apply accent classes when accent is undefined', () => {
    const markup = renderToStaticMarkup(createElement(Card, null, 'Default'))
    expect(markup).not.toContain('border-l-4')
    expect(markup).not.toContain('border-l-green-700')
  })

  it('merges additional className prop', () => {
    const markup = renderToStaticMarkup(
      createElement(Card, { className: 'p-5 hover:bg-green-50/90' }, 'Extra classes'),
    )
    expect(markup).toContain('p-5')
    expect(markup).toContain('hover:bg-green-50/90')
    expect(markup).toContain('rounded-3xl')
  })

  it('passes through HTML div attributes', () => {
    const markup = renderToStaticMarkup(
      createElement(Card, { role: 'group', 'aria-label': 'Pool card' }, 'Attrs'),
    )
    expect(markup).toContain('role="group"')
    expect(markup).toContain('aria-label="Pool card"')
  })
})
