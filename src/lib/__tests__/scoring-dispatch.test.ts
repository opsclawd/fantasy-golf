import { describe, expect, it } from 'vitest'

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('scoring dispatcher migration', () => {
  it('schedules an hourly dispatcher that posts to the cron endpoint', () => {
    const migration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260401110000_add_hourly_scoring_dispatcher.sql'),
      'utf8',
    )

    expect(migration).toContain("cron.schedule(")
    expect(migration).toContain("'0 * * * *'")
    expect(migration).toContain("'/api/cron/scoring'")
    expect(migration).toContain("'app_url'")
    expect(migration).toContain("'cron_secret'")
  })
})
