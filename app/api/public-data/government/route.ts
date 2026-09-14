import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { allowRequest, isSameOrigin } from '@/lib/security'
import { getGovernmentAirQuality } from '@/app/lib/government-data'

export async function GET(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!allowRequest(`government-data:${user.id}`, 20, 60000)) return NextResponse.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 })

  const url = new URL(request.url)
  const state = url.searchParams.get('state')?.trim()
  const city = url.searchParams.get('city')?.trim()
  if (!state || !city) return NextResponse.json({ error: 'state and city are required' }, { status: 400 })
  if (state.length > 80 || city.length > 120) return NextResponse.json({ error: 'Location is too long' }, { status: 400 })

  try {
    const airQuality = await getGovernmentAirQuality(state, city)
    return NextResponse.json({ provider: 'data.gov.in', airQuality })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load government data'
    const status = message.includes('not configured') ? 503 : 502
    return NextResponse.json({ error: message }, { status })
  }
}
