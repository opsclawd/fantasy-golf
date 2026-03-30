import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SelectionSummaryCard } from '../SelectionSummaryCard'

describe('SelectionSummaryCard', () => {
  it('renders a compact review of selection progress and chosen golfers', () => {
    const markup = renderToStaticMarkup(
      <SelectionSummaryCard
        selectedCount={3}
        requiredCount={6}
        selectedGolferNames={['Scottie Scheffler', 'Rory McIlroy', 'Nelly Korda']}
      />,
    )

    expect(markup).toContain('3 of 6 golfers selected')
    expect(markup).toContain('Scottie Scheffler')
    expect(markup).toContain('Rory McIlroy')
    expect(markup).toContain('Nelly Korda')
  })
})
