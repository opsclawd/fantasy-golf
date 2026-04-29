// @vitest-environment jsdom

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ErrorStateBanner } from '../ErrorStateBanner'

describe('ErrorStateBanner', () => {
  it('renders error message', () => {
    render(<ErrorStateBanner message="Score refresh failed: network error" onRetry={vi.fn()} />)
    expect(screen.getByText('Score refresh failed: network error')).toBeInTheDocument()
  })

  it('renders "Score refresh failed" heading', () => {
    render(<ErrorStateBanner message="Score refresh failed: network error" onRetry={vi.fn()} />)
    expect(screen.getByText('Score refresh failed')).toBeInTheDocument()
  })

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn()
    render(<ErrorStateBanner message="Failed" onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('does not render when message is null', () => {
    const { container } = render(<ErrorStateBanner message={null} onRetry={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('does not render when message is empty string', () => {
    const { container } = render(<ErrorStateBanner message="" onRetry={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})