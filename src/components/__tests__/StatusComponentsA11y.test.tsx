import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const freshnessChipPath = resolve(process.cwd(), 'src/components/FreshnessChip.tsx')
const statusChipPath = resolve(process.cwd(), 'src/components/StatusChip.tsx')

describe('status component accessibility attributes', () => {
  it('adds polite live region to FreshnessChip outer span', () => {
    const source = readFileSync(freshnessChipPath, 'utf8')

    expect(source).toContain("aria-live=\"polite\"")
  })

  it('adds explicit aria-label to StatusChip', () => {
    const source = readFileSync(statusChipPath, 'utf8')

    expect(source).toContain("aria-label={`Pool status: ${config.label}`}")
  })
})
