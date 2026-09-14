import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clamp(n: number, min = 0, max = 100) { return Math.max(min, Math.min(max, n)) }

function riskLevel(score: number) {
  if (score >= 81) return 'critical'
  if (score >= 61) return 'at_risk'
  if (score >= 31) return 'watch'
  return 'healthy'
}

function recommendation(score: number) {
  if (score >= 81) return 'Reduce contract exposure and shift uncovered demand to hybrid or spot procurement.'
  if (score >= 61) return 'Review the commitment and consider a hybrid procurement strategy.'
  if (score >= 31) return 'Keep the lane under review and validate the next demand forecast.'
  return 'Maintain current coverage and continue monitoring.'
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: 'Supabase service configuration is missing' }, { status: 500 })

  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const since = new Date(Date.now() - 28 * 86400000).toISOString()
  const priorSince = new Date(Date.now() - 56 * 86400000).toISOString()

  const [{ data: lanes, error: laneError }, { data: shipments, error: shipmentError }, { data: contracts, error: contractError }] = await Promise.all([
    supabase.from('lanes').select('id,contracted_volume'),
    supabase.from('shipments').select('shipment_id,lane_id,shipment_date,volume,status').gte('shipment_date', priorSince),
    supabase.from('contracts').select('contract_id,lane_id,contracted_volume,start_date,end_date').order('start_date', { ascending: false }),
  ])

  if (laneError || shipmentError || contractError) {
    return NextResponse.json({ error: laneError?.message || shipmentError?.message || contractError?.message }, { status: 500 })
  }

  const rows = shipments || []
  const today = Date.now()
  let analyzed = 0
  let warnings = 0

  for (const lane of lanes || []) {
    const laneRows = rows.filter((s: any) => s.lane_id === lane.id)
    const recent = laneRows.filter((s: any) => new Date(s.shipment_date).getTime() >= today - 28 * 86400000)
    const prior = laneRows.filter((s: any) => new Date(s.shipment_date).getTime() < today - 28 * 86400000)
    const actual = recent.reduce((sum: number, s: any) => sum + Number(s.volume || 0), 0)
    const priorActual = prior.reduce((sum: number, s: any) => sum + Number(s.volume || 0), 0)

    const activeContract = (contracts || []).find((c: any) => c.lane_id === lane.id && (!c.end_date || new Date(c.end_date).getTime() >= today))
    const contractVolume = Number(activeContract?.contracted_volume ?? lane.contracted_volume ?? 0)
    const expected = contractVolume > 0 ? contractVolume : 0
    const realization = expected > 0 ? actual / expected : null
    const trend = priorActual > 0 ? (actual - priorActual) / priorActual : null

    // Early-warning score: under-realization is the strongest signal; declining demand and execution friction add risk.
    const underUtilization = realization == null ? 0 : clamp((0.9 - realization) * 100 / 0.9)
    const decline = trend == null ? 0 : clamp(-trend * 100 / 50)
    const cancellations = recent.filter((s: any) => /cancel|reject/i.test(String(s.status || ''))).length
    const executionFriction = recent.length > 0 ? clamp((cancellations / recent.length) * 100) : 0
    const score = Math.round(clamp(underUtilization * 0.65 + decline * 0.25 + executionFriction * 0.10))
    const level = riskLevel(score)
    const confidence = laneRows.length >= 20 ? 'high' : laneRows.length >= 8 ? 'medium' : 'low'
    const drivers: string[] = []
    if (realization != null && realization < 0.7) drivers.push(`Recent realization is ${Math.round(realization * 100)}%`)
    if (trend != null && trend < -0.1) drivers.push(`Recent volume trend is down ${Math.round(Math.abs(trend) * 100)}%`)
    if (cancellations > 0) drivers.push(`${cancellations} recent shipment cancellation/rejection event${cancellations > 1 ? 's' : ''}`)
    if (drivers.length === 0) drivers.push('No strong early-warning signal detected')

    const warning = score >= 61
      ? `This lane is showing early signs of becoming underutilized. Ghost probability is ${score}%.`
      : null

    const { data: previous } = await supabase
      .from('ghostlane_daily_analysis')
      .select('ghost_probability')
      .eq('lane_id', lane.id)
      .order('analyzed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    await supabase.from('ghostlane_daily_analysis').insert({
      lane_id: lane.id,
      observation_days: Math.min(56, laneRows.length ? 56 : 0),
      actual_volume: actual,
      expected_volume: expected,
      realization_rate: realization,
      trend_change: trend,
      ghost_probability: score,
      risk_level: level,
      confidence,
      warning,
      recommendation: recommendation(score),
      drivers,
    })

    await supabase.from('lanes').update({ risk_score: score }).eq('id', lane.id)

    const previousScore = Number(previous?.ghost_probability ?? 0)
    if (score >= 61 && (previous == null || score - previousScore >= 10)) {
      await supabase.from('ghostlane_alerts').insert({
        lane_id: lane.id,
        severity: level,
        title: `Ghost risk increased to ${score}%`,
        message: warning,
        ghost_probability: score,
        previous_probability: previous?.ghost_probability ?? null,
        recommendation: recommendation(score),
      })
      warnings++
    }
    analyzed++
  }

  return NextResponse.json({ ok: true, analyzed, warnings, analyzed_at: new Date().toISOString() })
}

export async function GET(request: Request) { return POST(request) }
