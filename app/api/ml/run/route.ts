import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GhostRiskForest, ghostLabel, type GhostObservation } from '@/lib/ml/ghost-risk'

type ContractRow = { id: string; contract_id?: string; lane_id: string; carrier: string; contracted_volume: number; start_date: string; end_date: string }
type ShipmentRow = { id: string; lane_id: string; carrier: string; shipment_date: string; volume: number; status?: string }

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase()
const daysBefore = (a: string, b: string) => new Date(a).getTime() < new Date(b).getTime()

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).limit(1).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'No workspace membership found' }, { status: 403 })

  const [{ data: contracts, error: contractsError }, { data: shipments, error: shipmentsError }, { data: lanes }] = await Promise.all([
    supabase.from('contracts').select('id,contract_id,lane_id,carrier,contracted_volume,start_date,end_date').eq('organization_id', membership.organization_id).order('start_date', { ascending: true }).limit(5000),
    supabase.from('shipments').select('id,lane_id,carrier,shipment_date,volume,status').eq('organization_id', membership.organization_id).order('shipment_date', { ascending: true }).limit(20000),
    supabase.from('lanes').select('id,origin,destination,mode').eq('organization_id', membership.organization_id).limit(5000),
  ])
  if (contractsError) return NextResponse.json({ error: contractsError.message }, { status: 500 })
  if (shipmentsError) return NextResponse.json({ error: shipmentsError.message }, { status: 500 })

  const allContracts = (contracts ?? []) as ContractRow[]
  const allShipments = (shipments ?? []) as ShipmentRow[]
  if (allContracts.length < 12) return NextResponse.json({ error: `ML training needs at least 12 contracts with outcomes. Found ${allContracts.length}.` }, { status: 422 })

  const laneMap = new Map((lanes ?? []).map((l: any) => [l.id, l]))
  const priorByKey = new Map<string, { contracts: number; shipments: number; realized: number; contracted: number }>()
  const observations: GhostObservation[] = []
  const predictionRows: any[] = []
  const now = Date.now()

  for (const c of allContracts) {
    const start = new Date(c.start_date).getTime()
    const end = new Date(c.end_date).getTime()
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue
    const key = `${c.lane_id}|${norm(c.carrier)}`
    const prior = priorByKey.get(key) ?? { contracts: 0, shipments: 0, realized: 0, contracted: 0 }
    const priorRealization = prior.contracted > 0 ? (prior.realized / prior.contracted) * 100 : 50
    const priorGhostRate = prior.contracted > 0 ? (1 - prior.realized / prior.contracted) * 100 : 50
    const materialized = allShipments.filter(s => s.lane_id === c.lane_id && norm(s.carrier) === norm(c.carrier) && new Date(s.shipment_date).getTime() >= start && new Date(s.shipment_date).getTime() <= end && norm(s.status) !== 'cancelled').reduce((sum, s) => sum + Math.max(0, Number(s.volume) || 0), 0)
    const shipmentCount = allShipments.filter(s => s.lane_id === c.lane_id && norm(s.carrier) === norm(c.carrier) && new Date(s.shipment_date).getTime() < start).length
    const mode = norm(laneMap.get(c.lane_id)?.mode) || 'road'
    const base: GhostObservation = { contractedVolume: Number(c.contracted_volume) || 0, priorRealization, priorGhostRate, priorContractCount: prior.contracts, priorShipmentCount: Math.max(prior.shipments, shipmentCount), contractMonth: new Date(c.start_date).getUTCMonth() + 1, modeRoad: mode === 'road' ? 1 : 0 }
    const label = end < now ? ghostLabel(Number(c.contracted_volume) || 0, materialized) : null
    if (label !== null) observations.push({ ...base, label })
    predictionRows.push({ c, base, materialized, label })
    if (end < now) {
      priorByKey.set(key, { contracts: prior.contracts + 1, shipments: prior.shipments + shipmentCount, realized: prior.realized + materialized, contracted: prior.contracted + (Number(c.contracted_volume) || 0) })
    }
  }

  if (observations.length < 12) return NextResponse.json({ error: `At least 12 completed contract outcomes are required to train GhostLane. Found ${observations.length}.`, completedContracts: observations.length }, { status: 422 })

  const model = new GhostRiskForest().fit(observations)
  const evaluation = model.evaluate(observations)
  const predictions = predictionRows.map(row => {
    const p = model.predict(row.base)
    const lane = laneMap.get(row.c.lane_id)
    return { contractId: row.c.contract_id ?? row.c.id, lane: lane ? `${lane.origin} → ${lane.destination}` : row.c.lane_id, carrier: row.c.carrier, risk: p.risk, probability: p.probability, band: p.band, confidence: p.confidence, historicalMaterialized: row.materialized, historicalLabel: row.label }
  })

  return NextResponse.json({ model: 'GhostLane Random Forest', version: '0.1', trainedAt: new Date().toISOString(), trainingSamples: observations.length, features: model.featureNames, evaluation, predictions, note: 'Predictions are learned from completed contract outcomes in the authenticated workspace. No synthetic operational records are inserted.' })
}
