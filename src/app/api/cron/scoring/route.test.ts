import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET } from './route'

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('GET /api/cron/scoring', () => {
  it('returns 500 when app URL env is missing', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    process.env.CRON_SECRET = 'secret'

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toContain('NEXT_PUBLIC_APP_URL')
  })

  it('posts to /api/scoring using URL-safe construction and cron header', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com/app/'
    process.env.CRON_SECRET = 'secret'

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET()
    const body = await response.json()

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/api/scoring', {
      method: 'POST',
      headers: { Authorization: 'Bearer secret' },
    })
    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true })
  })
})
