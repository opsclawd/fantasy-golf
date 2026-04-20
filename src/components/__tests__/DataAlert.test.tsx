// @vitest-environment jsdom

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DataAlert } from '../DataAlert'

describe('DataAlert', () => {
  it('renders error variant with correct text', () => {
    render(<DataAlert variant="error" title="Error title" message="Error message" />)
    expect(screen.getByText('Error title')).toBeInTheDocument()
    expect(screen.getByText('Error message')).toBeInTheDocument()
  })

  it('renders warning variant with correct text', () => {
    render(<DataAlert variant="warning" title="Warning title" message="Warning message" />)
    expect(screen.getByText('Warning title')).toBeInTheDocument()
    expect(screen.getByText('Warning message')).toBeInTheDocument()
  })

  it('renders info variant with correct text', () => {
    render(<DataAlert variant="info" title="Info title" message="Info message" />)
    expect(screen.getByText('Info title')).toBeInTheDocument()
    expect(screen.getByText('Info message')).toBeInTheDocument()
  })

  it('error variant has role="alert"', () => {
    render(<DataAlert variant="error" title="Error" />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('warning variant has role="status"', () => {
    render(<DataAlert variant="warning" title="Warning" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('info variant has role="status"', () => {
    render(<DataAlert variant="info" title="Info" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('does not render message when not provided', () => {
    const { container } = render(<DataAlert variant="error" title="Error" />)
    expect(container.querySelector('span:last-child')).toHaveTextContent('Error')
  })
})
