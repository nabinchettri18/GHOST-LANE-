import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { allowRequest, isSameOrigin } from '@/lib/security'

async function workspace(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  if (!allowRequest(`shipment:${user.id}`, 60, 60_000)) throw new Error('RATE_LIMIT')
  const { data: membership } = await supabase.from('organization_members').select('organization_id,role').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!membership || !['owner','admin','member'].includes(String(membership.role).toLowerCase())) return null
  return { user, organizationId: membership.organization_id }
}

export async function GET(request: Request, { params }: { params: Promise<{ shipmentId: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 })
  try {
    const ctx = await workspace(request); if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { shipmentId } = await params
    const db = createAdminClient()
    const { data, error } = await db.from('shipments').select('shipment_id,lane_id,carrier,shipment_date,volume,status,expected_cost,actual_cost,expected_transit_hours,actual_transit_hours,eta_date,delivered_at,exception_type,risk_score,notes,lanes(origin,destination,mode,distance_km)').eq('organization_id', ctx.organizationId).eq('shipment_id', shipmentId).maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Shipment not found' }, { status: 404 })
    return NextResponse.json({ shipment: data })
  } catch (error) { return NextResponse.json({ error: error instanceof Error && error.message !== 'RATE_LIMIT' ? error.message : 'Request failed' }, { status: error instanceof Error && error.message === 'RATE_LIMIT' ? 429 : 500 }) }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ shipmentId: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 })
  try {
    const ctx = await workspace(request); if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { shipmentId } = await params
    const body = await request.json()
    const allowed = ['status','actual_cost','actual_transit_hours','eta_date','delivered_at','exception_type','risk_score','notes'] as const
    const patch: Record<string, unknown> = {}
    for (const key of allowed) if (Object.prototype.hasOwnProperty.call(body, key)) patch[key] = body[key]
    if (typeof patch.status === 'string' && patch.status.length > 100) return NextResponse.json({ error: 'Invalid status' }, { status: 422 })
    if (patch.risk_score !== undefined) { const score = Number(patch.risk_score); if (!Number.isFinite(score) || score < 0 || score > 100) return NextResponse.json({ error: 'Risk score must be between 0 and 100' }, { status: 422 }); patch.risk_score = score }
    if (patch.status === 'delivered' && patch.delivered_at === undefined) patch.delivered_at = new Date().toISOString()
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'No supported fields supplied' }, { status: 400 })
    const db = createAdminClient()
    const { data, error } = await db.from('shipments').update(patch).eq('organization_id', ctx.organizationId).eq('shipment_id', shipmentId).select('shipment_id,status,actual_cost,actual_transit_hours,eta_date,delivered_at,exception_type,risk_score,notes').maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Shipment not found' }, { status: 404 })
    return NextResponse.json({ shipment: data })
  } catch (error) { return NextResponse.json({ error: error instanceof Error && error.message !== 'RATE_LIMIT' ? error.message : 'Update failed' }, { status: error instanceof Error && error.message === 'RATE_LIMIT' ? 429 : 500 }) }
}
