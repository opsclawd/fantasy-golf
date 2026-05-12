import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-dom', () => ({
  useFormState: vi.fn(() => [null, vi.fn()]),
  useFormStatus: vi.fn(() => ({ pending: false })),
}))

vi.mock('../actions', () => ({
  joinPool: vi.fn(),
}))

import JoinPoolForm from '../JoinPoolForm'

describe('JoinPoolForm', () => {
  it('renders a Button component with primary variant', () => {
    const markup = renderToStaticMarkup(
      createElement(JoinPoolForm, { inviteCode: 'abc123' })
    )
    expect(markup).toContain('w-full')
  })

  it('renders the submit button with w-full class', () => {
    const markup = renderToStaticMarkup(
      createElement(JoinPoolForm, { inviteCode: 'abc123' })
    )
    expect(markup).toContain('w-full')
  })

  it('renders error text in red-600 when error is present', () => {
    const markup = renderToStaticMarkup(
      createElement(JoinPoolForm, { inviteCode: 'abc123' })
    )
    expect(markup).toContain('Join pool')
  })
})
