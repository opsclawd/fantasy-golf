import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const cssPath = resolve(__dirname, '../globals.css')
const css = readFileSync(cssPath, 'utf-8')

describe('globals.css custom properties', () => {
  const requiredVars = [
    '--color-primary-900',
    '--color-primary-700',
    '--color-primary-100',
    '--color-surface-warm',
    '--color-surface-base',
    '--color-action-warning',
    '--color-action-error',
    '--color-neutral-900',
    '--color-neutral-600',
    '--color-neutral-200',
    '--ring-brand',
    '--fg-shell',
  ]

  it.each(requiredVars)('defines %s', (varName) => {
    const pattern = new RegExp(`^\\s*${varName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}:`, 'm')
    expect(css).toMatch(pattern)
  })

  it('updates --ring-brand to green-700 RGB value', () => {
    expect(css).toContain('--ring-brand: 21 128 61')
  })

  it('updates --fg-shell to stone-900 RGB value', () => {
    expect(css).toContain('--fg-shell: 28 25 23')
  })
})
