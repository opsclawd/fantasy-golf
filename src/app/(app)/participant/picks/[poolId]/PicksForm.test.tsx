import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-dom', async () => ({
  useFormState: () => [null, () => undefined],
  useFormStatus: () => ({ pending: false }),
}))

vi.mock('@/components/golfer-picker', () => ({
  GolferPicker: () => <div>Mock golfer picker</div>,
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}))

vi.mock('./actions', () => ({
  submitPicks: vi.fn(),
}))

import { PicksForm } from './PicksForm'

describe('PicksForm', () => {
  it('shows the edit flow context when existing picks are already saved', () => {
    const markup = renderToStaticMarkup(
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
        isLocked={false}
      />,
    )

    expect(markup).toContain('Edit Your Picks')
    expect(markup).toContain('3 of 3 golfers selected')
    expect(markup).toContain('Scottie Scheffler')
    expect(markup).toContain('Rory McIlroy')
    expect(markup).toContain('Nelly Korda')
    expect(markup).toContain('Update Picks')
    expect(markup).not.toContain('Submit Picks')
  })
})
