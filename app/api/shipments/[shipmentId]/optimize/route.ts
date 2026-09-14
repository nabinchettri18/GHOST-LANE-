import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { allowRequest, isSameOrigin } from '@/lib/security'
import { OptimizationAdapter } from '@/lib/integrations/optimizationAdapter'

export async function POST(request: Request, { params }: { params: Promise<{ shipmentId: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!allowRequest(`optimize:${user.id}`, 15, 60_000)) {
    return NextResponse.json({ error: 'Too many optimization requests. Please wait a minute.' }, { status: 429 })
  }

  const { shipmentId } = await params
  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'No workspace membership found' }, { status: 403 })

  const orgId = membership.organization_id
  const db = createAdminClient()

  const { data: shipment, error: sErr } = await db
    .from('shipments')
    .select('shipment_id, lane_id, carrier, volume, vehicle_capacity, vehicle_id, lanes(origin, destination, distance_km)')
    .eq('organization_id', orgId)
    .eq('shipment_id', shipmentId)
    .maybeSingle()

  if (sErr || !shipment) {
    return NextResponse.json({ error: 'Shipment not found' }, { status: 404 })
  }

  const lane = Array.isArray(shipment.lanes) ? shipment.lanes[0] : shipment.lanes
  const originName = lane?.origin || 'Origin'
  const destName = lane?.destination || 'Destination'
  const distanceKm = Number(lane?.distance_km) || 350
  const durationMin = Math.round((distanceKm / 50) * 60)

  const optResponse = await OptimizationAdapter.optimize({
    shipmentId: shipment.shipment_id,
    organizationId: orgId,
    origin: { name: originName },
    destination: { name: destName },
    distanceKm,
    durationMin,
    demand: Number(shipment.volume) || 50,
    vehicleCapacity: Number(shipment.vehicle_capacity) || 80,
    vehicleId: shipment.vehicle_id || undefined,
    carrier: shipment.carrier || undefined,
  })

  // Safely persist run to optimization_runs & results if database tables exist
  try {
    const { data: run } = await db.from('optimization_runs').insert({
      organization_id: orgId,
      shipment_id: shipmentId,
      status: 'completed',
      provider: optResponse.provider,
      created_by: user.id,
    }).select('id').maybeSingle()

    if (run?.id) {
      optResponse.runId = run.id
      const resultsToInsert = optResponse.alternatives.map(alt => ({
        optimization_run_id: run.id,
        rank: alt.rank,
        carrier: alt.carrier,
        route_summary: alt.routeSummary,
        estimated_cost: alt.estimatedCost,
        estimated_duration_min: alt.estimatedDurationMin,
        estimated_distance_km: alt.estimatedDistanceKm,
        tradeoffs: alt.tradeoffs,
        explanation: alt.explanation,
        status: 'recommended',
      }))
      await db.from('optimization_results').insert(resultsToInsert)
    }
  } catch (dbErr) {
    console.warn('Could not persist optimization log to db:', dbErr)
  }

  return NextResponse.json(optResponse)
}
