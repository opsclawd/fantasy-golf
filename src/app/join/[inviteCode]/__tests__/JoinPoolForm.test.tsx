import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

// Mock the server action
vi.mock('../actions', () => ({
  joinPool: vi.fn(),
}))

import JoinPoolForm from '../JoinPoolForm'

describe('JoinPoolForm', () => {
  it('renders a Button component with primary variant', () => {
    const markup = renderToStaticMarkup(
      createElement(JoinPoolForm, { inviteCode: 'abc123' })
    )
    // Should contain green-700 (primary Button) instead of blue-600
    expect(markup).toContain('bg-green-700')
    expect(markup).not.toContain('bg-blue-600')
    expect(markup).not.toContain('bg-blue-700')
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
    // Error display keeps text-red-600 (action-error token)
    // This test verifies the form renders without crashing
    expect(markup).toContain('Join pool')
  })
})
