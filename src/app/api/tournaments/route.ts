import { NextResponse } from 'next/server'
import { getTournaments } from '@/lib/slash-golf/client'

export async function GET() {
  try {
    const tournaments = await getTournaments()
    return NextResponse.json(tournaments)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch tournaments' }, { status: 500 })
  }
}
