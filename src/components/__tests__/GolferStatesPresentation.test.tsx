// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { GolferDetailSheet } from '../GolferDetailSheet'

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: vi.fn(),
  })
})

describe('GolferDetailSheet', () => {
  it('renders a polished empty state when scoring data is missing', () => {
    render(
      <GolferDetailSheet
        golfer={{
          id: 'g1',
          name: 'Scottie Scheffler',
          country: 'USA',
        }}
        score={null}
        onClose={() => {}}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Scoring details coming soon' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('We have not received hole-by-hole scoring data for this golfer yet.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Check back after the next leaderboard refresh to see round progress and scoring context.'),
    ).toBeInTheDocument()
  })
})
