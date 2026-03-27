import { NextResponse } from 'next/server'
import { getTournaments } from '@/lib/slash-golf/client'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined
    const tournaments = await getTournaments(year)
    const data = Array.isArray(tournaments) 
      ? tournaments 
      : (tournaments as any).schedule || []
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch tournaments' }, { status: 500 })
  }
}
