// @vitest-environment jsdom

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FreshnessChip } from '../FreshnessChip'

describe('FreshnessChip', () => {
  it('renders current status with correct label', () => {
    render(<FreshnessChip status="current" />)
    expect(screen.getByText('Current')).toBeInTheDocument()
  })

  it('renders stale status with correct label', () => {
    render(<FreshnessChip status="stale" />)
    expect(screen.getByText('Stale')).toBeInTheDocument()
  })

  it('renders unknown status with correct label', () => {
    render(<FreshnessChip status="unknown" />)
    expect(screen.getByText('No data yet')).toBeInTheDocument()
  })

  it('has role="status"', () => {
    render(<FreshnessChip status="current" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('displays refreshed time when provided and status is not unknown', () => {
    render(<FreshnessChip status="current" refreshedAt="2026-04-20T10:00:00Z" />)
    expect(screen.getByText(/Updated/)).toBeInTheDocument()
  })

  it('does not display refreshed time when status is unknown', () => {
    render(<FreshnessChip status="unknown" refreshedAt="2026-04-20T10:00:00Z" />)
    expect(screen.queryByText(/Updated/)).not.toBeInTheDocument()
  })
})
