import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { allowRequest, isSameOrigin } from '@/lib/security'
import { OptimizationAdapter } from '@/lib/integrations/optimizationAdapter'

type OptimizeBody = {
  distanceKm: number
  durationMin: number
  vehicleCapacity?: number
  demand?: number
  origin?: string
  destination?: string
  carrier?: string
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized. Authentication is required to run route optimization.' }, { status: 401 })

  if (!allowRequest(`route-opt:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please wait a minute.' }, { status: 429 })
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'Active organization workspace membership is required.' }, { status: 403 })
  }

  const body = await req.json().catch(() => null) as OptimizeBody | null
  if (!body || !Number.isFinite(body.distanceKm) || !Number.isFinite(body.durationMin)) {
    return NextResponse.json({ error: 'distanceKm and durationMin are required' }, { status: 400 })
  }

  try {
    const response = await OptimizationAdapter.optimize({
      organizationId: membership.organization_id,
      origin: { name: body.origin || 'Origin' },
      destination: { name: body.destination || 'Destination' },
      distanceKm: body.distanceKm,
      durationMin: body.durationMin,
      demand: body.demand || 1,
      vehicleCapacity: body.vehicleCapacity,
      carrier: body.carrier,
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error('Route optimization error:', error)
    return NextResponse.json({ error: 'Optimization service temporarily unavailable' }, { status: 502 })
  }
}
