// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ArchivePoolButton } from '@/app/(app)/commissioner/pools/[poolId]/ArchivePoolButton'
import { DeletePoolButton } from '@/app/(app)/commissioner/pools/[poolId]/DeletePoolButton'
import { ReopenPoolButton } from '@/app/(app)/commissioner/pools/[poolId]/ReopenPoolButton'

vi.mock('react-dom', () => ({
  useFormState: vi.fn(() => [null, vi.fn()]),
  useFormStatus: vi.fn(() => ({ pending: false })),
}))

vi.mock('@/components/ConfirmModal', () => ({
  ConfirmModal: vi.fn(({ children }) => <div data-testid="confirm-modal">{children}</div>),
}))

vi.mock('@/app/(app)/commissioner/pools/[poolId]/actions', () => ({
  archivePool: vi.fn(),
  deletePool: vi.fn(),
  reopenPool: vi.fn(),
}))

describe('ArchivePoolButton', () => {
  it('renders archive button', () => {
    render(<ArchivePoolButton poolId="test-pool" />)
    expect(screen.getByRole('button', { name: 'Archive Pool' })).toBeInTheDocument()
  })
})

describe('DeletePoolButton', () => {
  it('renders delete button', () => {
    render(<DeletePoolButton poolId="test-pool" poolName="My Pool" />)
    expect(screen.getByRole('button', { name: 'Delete Pool' })).toBeInTheDocument()
  })
})

describe('ReopenPoolButton', () => {
  it('renders reopen button', () => {
    render(<ReopenPoolButton poolId="test-pool" />)
    expect(screen.getByRole('button', { name: 'Reopen Pool' })).toBeInTheDocument()
  })
})