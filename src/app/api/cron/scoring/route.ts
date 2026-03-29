import { NextResponse } from 'next/server'

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!appUrl) {
    return NextResponse.json(
      { error: 'Missing NEXT_PUBLIC_APP_URL environment variable' },
      { status: 500 }
    )
  }

  const targetUrl = new URL('/api/scoring', appUrl).toString()
  const res = await fetch(targetUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` }
  })
  
  if (!res.ok) {
    return NextResponse.json({ error: 'Scoring update failed' }, { status: 500 })
  }
  
  const data = await res.json()
  return NextResponse.json(data)
}
