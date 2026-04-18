// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { GolferPicker } from '@/components/golfer-picker'

const mockGolfers = [
  { id: '1', name: 'Scottie Scheffler', country: 'USA', search_name: 'scottie scheffler', is_active: true },
  { id: '2', name: 'Rory McIlroy', country: 'NIR', search_name: 'rory mcilroy', is_active: true },
]

describe('GolferPicker token migration', () => {
  it('uses green tokens for selected state (not sky)', () => {
    render(
      <GolferPicker
        selectedIds={['1']}
        onSelectionChange={() => {}}
        maxSelections={4}
        golfers={mockGolfers}
      />,
    )

    const scottieButton = screen.getByRole('option', { name: /Remove Scottie Scheffler/i })
    expect(scottieButton.className).toContain('bg-green-50')
    expect(scottieButton.className).toContain('border-l-4')
    expect(scottieButton.className).toContain('border-l-green-700')
  })

  it('uses stone tokens for unselected state and filter bar (not slate/gray)', () => {
    render(
      <GolferPicker
        selectedIds={[]}
        onSelectionChange={() => {}}
        maxSelections={4}
        golfers={mockGolfers}
      />,
    )

    const searchInput = screen.getByLabelText('Search golfers')
    expect(searchInput.className).toContain('border-stone-200')

    const countrySelect = screen.getByLabelText('Country')
    expect(countrySelect.className).toContain('border-stone-200')
  })

  it('uses green focus ring (not sky)', () => {
    render(
      <GolferPicker
        selectedIds={[]}
        onSelectionChange={() => {}}
        maxSelections={4}
        golfers={mockGolfers}
      />,
    )

    const golferButton = screen.getByRole('option', { name: /Select Scottie Scheffler/i })
    expect(golferButton.className).toContain('focus:ring-green-500')
  })

  it('uses stone-600 for "Select" pill in unselected state', () => {
    render(
      <GolferPicker
        selectedIds={[]}
        onSelectionChange={() => {}}
        maxSelections={4}
        golfers={mockGolfers}
      />,
    )

    const selectPills = screen.getAllByText('Select')
    expect(selectPills[0].className).toContain('bg-stone-100')
    expect(selectPills[0].className).toContain('text-stone-600')
  })
})
