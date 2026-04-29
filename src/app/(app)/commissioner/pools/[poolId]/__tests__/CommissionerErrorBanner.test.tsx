// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CommissionerErrorBanner } from '../CommissionerErrorBanner'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('./actions', () => ({
  refreshPoolScoresAction: vi.fn(),
}))

describe('CommissionerErrorBanner', () => {
  it('renders error message', () => {
    render(<CommissionerErrorBanner lastRefreshError="Score refresh failed: network error" poolId="pool-123" />)
    expect(screen.getByText(/Score refresh failed: network error/)).toBeInTheDocument()
  })

  it('does not render when lastRefreshError is null', () => {
    const { container } = render(<CommissionerErrorBanner lastRefreshError={null} poolId="pool-123" />)
    expect(container).toBeEmptyDOMElement()
  })
})