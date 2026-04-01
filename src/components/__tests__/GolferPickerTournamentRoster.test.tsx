// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { GolferPicker } from '@/components/golfer-picker'

describe('GolferPicker tournament roster contract', () => {
  it('renders and filters the roster golfers passed through props', () => {
    render(
      <GolferPicker
        selectedIds={[]}
        onSelectionChange={() => {}}
        maxSelections={4}
        golfers={[
          { id: '1', name: 'Collin Morikawa', country: 'USA', search_name: 'collin morikawa', is_active: true },
          { id: '2', name: 'Rory McIlroy', country: 'NIR', search_name: 'rory mcilroy', is_active: true },
        ]}
      />, 
    )

    expect(screen.getByText('Collin Morikawa')).toBeInTheDocument()
    expect(screen.getByText('Rory McIlroy')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search golfers'), { target: { value: 'Rory' } })

    expect(screen.getByText('Rory McIlroy')).toBeInTheDocument()
    expect(screen.queryByText('Collin Morikawa')).not.toBeInTheDocument()
  })
})
