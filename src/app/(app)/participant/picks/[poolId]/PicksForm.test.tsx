// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { golfersById, formAction } = vi.hoisted(() => ({
  golfersById: {
    g1: 'Scottie Scheffler',
    g2: 'Rory McIlroy',
    g3: 'Nelly Korda',
    g4: 'Lydia Ko',
  },
  formAction: vi.fn(),
}))

vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>()

  return {
    ...actual,
    useFormState: () => [null, formAction],
    useFormStatus: () => ({ pending: false }),
  }
})

vi.mock('@/components/golfer-picker', () => ({
  GolferPicker: ({
    selectedIds,
    onSelectionChange,
  }: {
    selectedIds: string[]
    onSelectionChange: (ids: string[]) => void
  }) => (
    <div>
      <p>Selected in picker: {selectedIds.join(', ')}</p>
      <button type="button" onClick={() => onSelectionChange(['g1', 'g2', 'g4'])}>
        Replace final golfer
      </button>
    </div>
  ),
}))

vi.mock('./actions', () => ({
  submitPicks: vi.fn(),
}))

import { PicksForm } from './PicksForm'

describe('PicksForm', () => {
  it('renders the edit flow and updates the saved picks summary in the client', async () => {
    const { container } = render(
      <PicksForm
        poolId="pool-1"
        poolName="Spring Major Pool"
        picksPerEntry={3}
        existingGolferIds={['g1', 'g2', 'g3']}
        existingGolferNames={{
          g1: 'Scottie Scheffler',
          g2: 'Rory McIlroy',
          g3: 'Nelly Korda',
        }}
        rosterGolferNames={{
          g1: 'Scottie Scheffler',
          g2: 'Rory McIlroy',
          g3: 'Nelly Korda',
          g4: 'Lydia Ko',
        }}
        isLocked={false}
        rosterGolfers={[]}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Edit Your Picks' })).toBeInTheDocument()

    const summary = screen.getByRole('region', { name: 'Current entry summary' })
    expect(within(summary).getByText('3 of 3 golfers selected')).toBeInTheDocument()
    expect(within(summary).getByText('Scottie Scheffler')).toBeInTheDocument()
    expect(within(summary).getByText('Rory McIlroy')).toBeInTheDocument()
    expect(within(summary).getByText('Nelly Korda')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Update Picks' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Submit Picks' })).not.toBeInTheDocument()

    const golferIdsInput = container.querySelector('input[name="golferIds"]') as HTMLInputElement
    expect(golferIdsInput.value).toBe(JSON.stringify(['g1', 'g2', 'g3']))

    fireEvent.click(screen.getByRole('button', { name: 'Replace final golfer' }))

    await waitFor(() => {
      expect(within(summary).getByText('Lydia Ko')).toBeInTheDocument()
    })

    expect(within(summary).queryByText('Nelly Korda')).not.toBeInTheDocument()
    expect(within(summary).queryByText('Loading pick...')).not.toBeInTheDocument()
    expect(golferIdsInput.value).toBe(JSON.stringify(['g1', 'g2', 'g4']))
  })
})
