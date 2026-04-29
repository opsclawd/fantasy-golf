// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ConfirmModal } from '../ConfirmModal'

describe('ConfirmModal', () => {
  it('renders title and body', () => {
    render(
      <ConfirmModal
        title="Delete pool?"
        body="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByText('Delete pool?')).toBeInTheDocument()
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
  })

  it('calls onConfirm when confirm button is clicked', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmModal
        title="Archive pool?"
        body="Archived pools stay read-only."
        confirmLabel="Archive"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('calls onCancel when cancel button is clicked', async () => {
    const onCancel = vi.fn()
    render(
      <ConfirmModal title="Sure?" body="Continue?" confirmLabel="Yes" onConfirm={vi.fn()} onCancel={onCancel} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('requires text match for delete confirmation', async () => {
    render(
      <ConfirmModal
        title="Delete pool?"
        body="Type the pool name to confirm."
        confirmLabel="Delete"
        requireTextMatch={{ text: 'My Pool', label: 'My Pool' }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
  })

  it('confirm button activates after delay when confirmDelaySeconds is set', async () => {
    render(
      <ConfirmModal
        title="Archive pool?"
        body="Are you sure?"
        confirmLabel="Archive"
        confirmDelaySeconds={1}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Archive' })).toBeDisabled()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Archive' })).toBeEnabled(), { timeout: 2000 })
  })
})
