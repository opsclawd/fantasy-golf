import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'

import { Button } from '../Button'

describe('Button', () => {
  it('renders a button element', () => {
    const markup = renderToStaticMarkup(createElement(Button, null, 'Click me'))
    expect(markup).toContain('Click me')
    expect(markup).toMatch(/^<button/)
  })

  it('applies primary variant classes by default', () => {
    const markup = renderToStaticMarkup(createElement(Button, null, 'Go'))
    expect(markup).toContain('bg-green-700')
    expect(markup).toContain('text-white')
    expect(markup).toContain('focus-visible:ring-green-500')
  })

  it('applies secondary variant classes', () => {
    const markup = renderToStaticMarkup(createElement(Button, { variant: 'secondary' }, 'Cancel'))
    expect(markup).toContain('bg-white')
    expect(markup).toContain('text-stone-700')
    expect(markup).toContain('border-stone-300')
    expect(markup).toContain('focus-visible:ring-green-500')
  })

  it('applies danger variant classes', () => {
    const markup = renderToStaticMarkup(createElement(Button, { variant: 'danger' }, 'Delete'))
    expect(markup).toContain('bg-red-600')
    expect(markup).toContain('text-white')
    expect(markup).toContain('focus-visible:ring-red-500')
  })

  it('applies ghost variant classes', () => {
    const markup = renderToStaticMarkup(createElement(Button, { variant: 'ghost' }, 'Skip'))
    expect(markup).toContain('bg-transparent')
    expect(markup).toContain('text-stone-600')
    expect(markup).toContain('focus-visible:ring-green-500')
  })

  it('applies md size classes by default', () => {
    const markup = renderToStaticMarkup(createElement(Button, null, 'Medium'))
    expect(markup).toContain('px-4')
    expect(markup).toContain('py-2.5')
  })

  it('applies sm size classes', () => {
    const markup = renderToStaticMarkup(createElement(Button, { size: 'sm' }, 'Small'))
    expect(markup).toContain('px-3')
    expect(markup).toContain('py-1.5')
  })

  it('applies lg size classes', () => {
    const markup = renderToStaticMarkup(createElement(Button, { size: 'lg' }, 'Large'))
    expect(markup).toContain('px-6')
    expect(markup).toContain('py-3')
  })

  it('passes through HTML button attributes', () => {
    const markup = renderToStaticMarkup(
      createElement(Button, { type: 'submit', disabled: true, 'aria-label': 'Submit form' }, 'Submit'),
    )
    expect(markup).toContain('type="submit"')
    expect(markup).toContain('disabled')
    expect(markup).toContain('aria-label="Submit form"')
    expect(markup).toContain('disabled:opacity-50')
  })

  it('applies focus-visible ring classes', () => {
    const markup = renderToStaticMarkup(createElement(Button, null, 'Focus'))
    expect(markup).toContain('focus-visible:ring-2')
    expect(markup).toContain('focus-visible:ring-offset-2')
  })

  it('applies hover state classes for primary variant', () => {
    const markup = renderToStaticMarkup(createElement(Button, { variant: 'primary' }, 'Hover'))
    expect(markup).toContain('hover:bg-green-900')
  })

  it('applies hover state classes for secondary variant', () => {
    const markup = renderToStaticMarkup(createElement(Button, { variant: 'secondary' }, 'Hover'))
    expect(markup).toContain('hover:bg-stone-50')
  })

  it('applies rounded class for consistent shape', () => {
    const markup = renderToStaticMarkup(createElement(Button, null, 'Rounded'))
    expect(markup).toContain('rounded-lg')
  })

  it('merges additional className prop', () => {
    const markup = renderToStaticMarkup(
      createElement(Button, { className: 'mt-4' }, 'Extra'),
    )
    expect(markup).toContain('mt-4')
    expect(markup).toContain('bg-green-700')
  })
})