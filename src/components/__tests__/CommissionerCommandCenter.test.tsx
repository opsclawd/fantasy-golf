import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PoolStatusSection } from '@/app/(app)/commissioner/pools/[poolId]/PoolStatusSection'

describe('PoolStatusSection', () => {
  it('renders metrics as command-center cards with clear labels', () => {
    const markup = renderToStaticMarkup(
      <PoolStatusSection
        pool={{ deadline: '2026-03-29T12:00:00.000Z' } as never}
        memberCount={10}
        entryCount={8}
        isLocked={false}
        pendingCount={2}
      />,
    )

    expect(markup).toContain('Players joined')
    expect(markup).toContain('Entries submitted')
    expect(markup).toContain('Awaiting picks')
  })
})
