import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { allowRequest, isSameOrigin } from '@/lib/security'
import { getPublicLaneSignals } from '@/lib/public-data'

export async function GET(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!allowRequest(`public-data:${user.id}`, 20, 60000)) return NextResponse.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 })

  const url = new URL(request.url)
  const origin = url.searchParams.get('origin')?.trim()
  const destination = url.searchParams.get('destination')?.trim()
  if (!origin || !destination) return NextResponse.json({ error: 'origin and destination are required' }, { status: 400 })
  if (origin.length > 120 || destination.length > 120) return NextResponse.json({ error: 'Location names are too long' }, { status: 400 })

  try {
    const signals = await getPublicLaneSignals(origin, destination)
    return NextResponse.json({ signals })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load public data'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
