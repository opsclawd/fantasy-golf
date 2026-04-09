import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PoolStatusSection } from '@/app/(app)/commissioner/pools/[poolId]/PoolStatusSection'

describe('PoolStatusSection', () => {
  it('renders Archived as its own status label', () => {
    const pool: any = {
      deadline: '2026-04-09T00:00:00+00:00',
      timezone: 'America/New_York',
      status: 'archived',
    }

    const markup = renderToStaticMarkup(
      <PoolStatusSection pool={pool} memberCount={10} entryCount={8} isLocked={true} pendingCount={2} />,
    )

    expect(markup).toContain('Archived')
  })

  it('renders metrics as command-center cards with clear labels', () => {
    const pool: any = {
      deadline: '2026-04-09T00:00:00+00:00',
      timezone: 'America/New_York',
    }

    const markup = renderToStaticMarkup(
      <PoolStatusSection pool={pool} memberCount={10} entryCount={8} isLocked={false} pendingCount={2} />,
    )

    expect(markup).toContain('Players joined')
    expect(markup).toContain('Entries submitted')
    expect(markup).toContain('Awaiting picks')
    expect(markup).toContain('Apr 9')
    expect(markup).toContain('EDT')
  })
})
