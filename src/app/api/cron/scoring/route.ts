import { NextResponse } from 'next/server'

export async function GET() {
  const res = await fetch(process.env.NEXT_PUBLIC_APP_URL + '/api/scoring', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` }
  })
  
  const data = await res.json()
  return NextResponse.json(data)
}