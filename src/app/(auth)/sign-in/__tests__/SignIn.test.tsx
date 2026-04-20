import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockUseSearchParams(),
}))

const mockUseSearchParams = vi.fn()

import SignIn from '../page'

describe('SignIn page', () => {
  it('renders Card container with green left-border accent', () => {
    const markup = renderToStaticMarkup(createElement(SignIn))
    expect(markup).toContain('border-l-4 border-l-green-700')
  })

  it('renders section heading with green/sand styling', () => {
    const markup = renderToStaticMarkup(createElement(SignIn))
    expect(markup).toContain('uppercase')
  })

  it('renders email and password inputs', () => {
    const markup = renderToStaticMarkup(createElement(SignIn))
    expect(markup).toContain('email')
    expect(markup).toContain('password')
  })

  it('renders primary Button for submit with green-700', () => {
    const markup = renderToStaticMarkup(createElement(SignIn))
    expect(markup).toContain('bg-green-700')
  })

  it('renders footer link to sign-up', () => {
    const markup = renderToStaticMarkup(createElement(SignIn))
    expect(markup).toContain('/sign-up')
  })
})