// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { mockUseFormState } = vi.hoisted(() => ({
  mockUseFormState: vi.fn(),
}))

vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>()

  return {
    ...actual,
    useFormState: mockUseFormState,
  }
})

vi.mock('@/app/(app)/commissioner/pools/[poolId]/actions', () => ({
  refreshGolferCatalogAction: vi.fn(),
  addMissingGolferAction: vi.fn(),
}))

import { GolferCatalogPanel } from '@/components/GolferCatalogPanel'

describe('GolferCatalogPanel', () => {
  it('shows quota usage and commissioner maintenance actions', () => {
    mockUseFormState.mockReset()
    mockUseFormState.mockReturnValue([null, '/mock-action'])

    render(
      <GolferCatalogPanel
        poolId="pool-1"
        usage={{ usedCalls: 18, remainingCalls: 232, status: 'ok' }}
        latestRun={null}
      />,
    )

    expect(screen.getByText('Golfer catalog')).toBeInTheDocument()
    expect(screen.getByText('18 of 250 calls used. 232 remaining this month.')).toBeInTheDocument()
    expect(screen.getByText('No catalog sync has run yet.')).toBeInTheDocument()
    const refreshMonthlyButton = screen.getByRole('button', { name: 'Refresh monthly catalog' })
    const addMissingGolferButton = screen.getByRole('button', { name: 'Add missing golfer' })

    expect(refreshMonthlyButton).toBeInTheDocument()
    expect(refreshMonthlyButton).toHaveAttribute('name', 'runType')
    expect(refreshMonthlyButton).toHaveAttribute('value', 'monthly_baseline')
    expect(screen.getByRole('button', { name: 'Refresh tournament field' })).toHaveAttribute('value', 'pre_tournament')
    expect(screen.getByLabelText('First name')).toHaveAttribute('name', 'firstName')
    expect(screen.getByLabelText('Last name')).toHaveAttribute('name', 'lastName')
    expect(document.querySelectorAll('input[type="hidden"][name="poolId"][value="pool-1"]')).toHaveLength(2)
    expect(addMissingGolferButton).toBeInTheDocument()
    expect(screen.queryByText('Protect search performance for players while commissioners control catalog maintenance.')).not.toBeInTheDocument()
    expect(screen.queryByText('Use manual adds for missing golfers without changing the participant search source.')).not.toBeInTheDocument()
  })

  it('shows the warning tone when quota is nearly exhausted', () => {
    mockUseFormState.mockReset()
    mockUseFormState.mockReturnValue([null, '/mock-action'])

    render(
      <GolferCatalogPanel
        poolId="pool-1"
        usage={{ usedCalls: 220, remainingCalls: 30, status: 'warning' }}
        latestRun={{ created_at: '2026-03-31T00:00:00.000Z', status: 'success' }}
      />,
    )

    expect(screen.getByText('220 of 250 calls used. 30 remaining this month.')).toBeInTheDocument()
    expect(screen.getByText(/Last sync success/i)).toBeInTheDocument()
    expect(screen.getByTestId('catalog-usage-status')).toHaveTextContent('Warning: monthly quota is nearly exhausted.')
  })

  it('shows the blocked tone when the monthly quota is exhausted for bulk syncs', () => {
    mockUseFormState.mockReset()
    mockUseFormState.mockReturnValue([null, '/mock-action'])

    render(
      <GolferCatalogPanel
        poolId="pool-1"
        usage={{ usedCalls: 250, remainingCalls: 0, status: 'blocked' }}
        latestRun={{ created_at: '2026-03-31T00:00:00.000Z', status: 'blocked' }}
      />,
    )

    expect(screen.getByText('250 of 250 calls used. 0 remaining this month.')).toBeInTheDocument()
    expect(screen.getByTestId('catalog-usage-status')).toHaveTextContent(
      'Blocked: bulk syncs are disabled until the monthly quota resets.',
    )
    expect(screen.getByRole('button', { name: 'Refresh monthly catalog' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Refresh tournament field' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add missing golfer' })).toBeEnabled()
  })
})
