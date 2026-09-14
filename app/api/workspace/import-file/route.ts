import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseOperationalFile } from '@/lib/data/parse-file'
import { validateHeaders, type ImportKind } from '@/lib/data/import'
import { allowRequest, isSameOrigin } from '@/lib/security'

const MAX_BYTES = 10 * 1024 * 1024
const MAX_ROWS = 5000
const kinds: ImportKind[] = ['lanes', 'contracts', 'shipments', 'carriers']
const allowedExtensions = ['.csv', '.tsv', '.txt', '.json', '.jsonl', '.ndjson', '.xlsx', '.xlsm']
const rejectedStatuses = new Set(['cancelled', 'canceled', 'rejected', 'void'])
const text = (v: string) => v.trim()
const required = (v: string, field: string, row: number) => { const value = text(v); if (!value) throw new Error(`${field} is required on row ${row}`); return value.slice(0, 500) }
const numberOrNull = (v: string, field: string, row: number) => { const value = text(v); if (!value) return null; const parsed = Number(value.replace(/,/g, '')); if (!Number.isFinite(parsed)) throw new Error(`${field} must be numeric on row ${row}`); return parsed }
const bounded = (v: string, field: string, row: number) => { const n = numberOrNull(v, field, row); return n == null ? null : Math.min(100, Math.max(0, n)) }
const laneKey = (origin: string, destination: string) => `${text(origin).toLowerCase()}|${text(destination).toLowerCase()}`

async function refreshLaneVolumes(db: ReturnType<typeof createAdminClient>, org: string, ids: string[], contracts: boolean, shipments: boolean) {
  const unique = [...new Set(ids)]
  if (!unique.length) return
  const [contractResult, shipmentResult] = await Promise.all([
    contracts ? db.from('contracts').select('lane_id,contracted_volume').eq('organization_id', org).in('lane_id', unique) : Promise.resolve({ data: [], error: null }),
    shipments ? db.from('shipments').select('lane_id,volume,status').eq('organization_id', org).in('lane_id', unique) : Promise.resolve({ data: [], error: null }),
  ])
  if (contractResult.error) throw contractResult.error
  if (shipmentResult.error) throw shipmentResult.error
  const contracted = new Map<string, number>(), moved = new Map<string, number>()
  for (const row of contractResult.data ?? []) contracted.set(row.lane_id, (contracted.get(row.lane_id) ?? 0) + Math.max(0, Number(row.contracted_volume ?? 0)))
  for (const row of shipmentResult.data ?? []) { if (rejectedStatuses.has(text(String(row.status ?? '')).toLowerCase())) continue; moved.set(row.lane_id, (moved.get(row.lane_id) ?? 0) + Math.max(0, Number(row.volume ?? 0))) }
  for (const id of unique) {
    const patch: Record<string, number> = {}
    if (contracts) patch.contracted_volume = Math.round(contracted.get(id) ?? 0)
    if (shipments) patch.materialized_volume = Math.round(moved.get(id) ?? 0)
    if (Object.keys(patch).length) { const { error } = await db.from('lanes').update(patch).eq('id', id).eq('organization_id', org); if (error) throw error }
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 })
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!allowRequest(`import:${user.id}`, 10, 60_000)) return NextResponse.json({ error: 'Too many import attempts. Please wait a minute.' }, { status: 429 })
  const form = await request.formData(); const kind = String(form.get('kind') || '') as ImportKind; const file = form.get('file')
  if (!kinds.includes(kind)) return NextResponse.json({ error: 'Invalid dataset type' }, { status: 400 })
  if (!(file instanceof File)) return NextResponse.json({ error: 'A file is required' }, { status: 400 })
  if (!file.size) return NextResponse.json({ error: 'File is empty' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File exceeds the 10 MB limit' }, { status: 413 })
  const filename = file.name.toLowerCase(); if (!allowedExtensions.some(ext => filename.endsWith(ext))) return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 })
  try {
    const db = createAdminClient()
    const { data: membership, error: membershipError } = await db.from('organization_members').select('organization_id,role').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (membershipError) throw new Error(`Workspace membership could not be verified: ${membershipError.message}`)
    if (!membership?.organization_id) return NextResponse.json({ error: 'No workspace membership found for this account. Create or join a workspace first.' }, { status: 403 })
    const rows = await parseOperationalFile(file)
    if (rows.length < 2) throw new Error('The file must contain a header and at least one data row')
    if (rows.length - 1 > MAX_ROWS) throw new Error('Maximum 5,000 data rows per import')
    const validation = validateHeaders(rows[0], kind); if (validation.missing.length) throw new Error(`Missing required columns: ${validation.missing.join(', ')}`)
    const headers = validation.normalized, index = Object.fromEntries(headers.map((header, i) => [header, i])), value = (row: string[], key: string) => row[index[key]] ?? ''
    const dataRows = rows.slice(1).filter(row => row.some(Boolean)); if (!dataRows.length) throw new Error('No data rows were found after the header')
    const organizationId = membership.organization_id
    const { data: existingLanes, error: laneError } = await db.from('lanes').select('id,origin,destination').eq('organization_id', organizationId); if (laneError) throw laneError
    const laneMap = new Map((existingLanes ?? []).map(lane => [laneKey(lane.origin, lane.destination), lane.id])); const warnings = [...validation.optionalMissing]
    let inserted = 0, skipped = 0; const affectedLanes: string[] = []

    if (kind === 'lanes') {
      const existingKeys = new Set(laneMap.keys())
      const payload = dataRows.map((row, i) => { const origin = required(value(row, 'origin'), 'origin', i + 2), destination = required(value(row, 'destination'), 'destination', i + 2), key = laneKey(origin, destination); if (existingKeys.has(key)) return null; existingKeys.add(key); const distance = numberOrNull(value(row, 'distance_km'), 'distance_km', i + 2); return { organization_id: organizationId, origin, destination, mode: text(value(row, 'mode')).slice(0, 100) || null, distance_km: distance == null ? null : Math.max(0, Math.round(distance)), contracted_volume: Math.max(0, Math.round(numberOrNull(value(row, 'contracted_volume'), 'contracted_volume', i + 2) ?? 0)), materialized_volume: Math.max(0, Math.round(numberOrNull(value(row, 'materialized_volume'), 'materialized_volume', i + 2) ?? 0)), carrier: text(value(row, 'carrier')).slice(0, 500) || null, risk_score: bounded(value(row, 'risk_score'), 'risk_score', i + 2) } }).filter((row): row is NonNullable<typeof row> => row !== null)
      if (payload.length) { const { error } = await db.from('lanes').insert(payload); if (error) throw new Error(`Lane import failed: ${error.message}`); inserted = payload.length }
      skipped = dataRows.length - inserted
    } else {
      const missing = new Map<string, { origin: string; destination: string }>()
      for (const [i, row] of dataRows.entries()) { const origin = required(value(row, 'origin'), 'origin', i + 2), destination = required(value(row, 'destination'), 'destination', i + 2), key = laneKey(origin, destination); if (!laneMap.has(key)) missing.set(key, { origin, destination }) }
      if (missing.size) { const { data: created, error } = await db.from('lanes').insert([...missing.values()].map(lane => ({ organization_id: organizationId, ...lane, mode: 'road', contracted_volume: 0, materialized_volume: 0 }))).select('id,origin,destination'); if (error) throw new Error(`Lane creation failed: ${error.message}`); for (const lane of created ?? []) laneMap.set(laneKey(lane.origin, lane.destination), lane.id) }
      if (kind === 'contracts') {
        const ids = dataRows.map((row, i) => required(value(row, 'contract_id'), 'contract_id', i + 2)); const { data: existing } = await db.from('contracts').select('contract_id').eq('organization_id', organizationId).in('contract_id', ids); const existingIds = new Set((existing ?? []).map(row => row.contract_id))
        const payload = dataRows.map((row, i) => { const contractId = ids[i]; if (existingIds.has(contractId)) return null; const laneId = laneMap.get(laneKey(value(row, 'origin'), value(row, 'destination'))); if (!laneId) throw new Error(`Lane could not be resolved on row ${i + 2}`); return { organization_id: organizationId, contract_id: contractId, lane_id: laneId, carrier: required(value(row, 'carrier'), 'carrier', i + 2), contracted_volume: Math.max(0, Math.round(numberOrNull(value(row, 'contracted_volume'), 'contracted_volume', i + 2) ?? 0)), contract_rate: numberOrNull(value(row, 'contract_rate'), 'contract_rate', i + 2), start_date: text(value(row, 'start_date')) || null, end_date: text(value(row, 'end_date')) || null } }).filter((row): row is NonNullable<typeof row> => row !== null)
        if (payload.length) { const { error } = await db.from('contracts').insert(payload); if (error) throw new Error(`Contract import failed: ${error.message}`) }
        inserted = payload.length; skipped = dataRows.length - inserted; for (const row of dataRows) { const id = laneMap.get(laneKey(value(row, 'origin'), value(row, 'destination'))); if (id) affectedLanes.push(id) }; await refreshLaneVolumes(db, organizationId, affectedLanes, true, false)
      } else {
        const ids = dataRows.map((row, i) => required(value(row, 'shipment_id'), 'shipment_id', i + 2)); const { data: existing } = await db.from('shipments').select('shipment_id').eq('organization_id', organizationId).in('shipment_id', ids); const existingIds = new Set((existing ?? []).map(row => row.shipment_id))
        const payload = dataRows.map((row, i) => {
          const shipmentId = ids[i]; if (existingIds.has(shipmentId)) return null; const laneId = laneMap.get(laneKey(value(row, 'origin'), value(row, 'destination'))); if (!laneId) throw new Error(`Lane could not be resolved on row ${i + 2}`)
          const status = text(value(row, 'status')).toLowerCase() || null, suppliedGhost = bounded(value(row, 'ghost_lane_score'), 'ghost_lane_score', i + 2), risk = bounded(value(row, 'risk_score'), 'risk_score', i + 2), expectedCost = numberOrNull(value(row, 'expected_cost'), 'expected_cost', i + 2), actualCost = numberOrNull(value(row, 'actual_cost'), 'actual_cost', i + 2), expectedTransit = numberOrNull(value(row, 'expected_transit_hours'), 'expected_transit_hours', i + 2), actualTransit = numberOrNull(value(row, 'actual_transit_hours'), 'actual_transit_hours', i + 2)
          const costVariance = expectedCost && expectedCost > 0 && actualCost != null ? Math.max(0, (actualCost - expectedCost) / expectedCost * 100) : 0, transitVariance = expectedTransit && expectedTransit > 0 && actualTransit != null ? Math.max(0, (actualTransit - expectedTransit) / expectedTransit * 100) : 0, exceptionSignal = text(value(row, 'exception_type')) ? 20 : 0
          const computedGhost = Math.min(100, Math.round(Math.min(40, costVariance * 1.2) + Math.min(30, transitVariance) + exceptionSignal + Math.min(10, Number(risk ?? 0) * 0.1))), ghostScore = suppliedGhost ?? computedGhost, ghostStatus = text(value(row, 'ghost_lane_status')) || (ghostScore >= 70 ? 'ghost_lane' : ghostScore >= 45 ? 'watch' : 'clear'), ghostReason = text(value(row, 'ghost_lane_reason')) || (ghostScore >= 70 ? 'High operational variance detected' : ghostScore >= 45 ? 'Lane shows early variance signals' : 'No material ghost-lane signal'), confidence = bounded(value(row, 'ghost_lane_confidence'), 'ghost_lane_confidence', i + 2) ?? Math.min(99, Math.round(55 + (expectedCost != null ? 10 : 0) + (actualCost != null ? 10 : 0) + (expectedTransit != null ? 8 : 0) + (actualTransit != null ? 8 : 0)))
          return { organization_id: organizationId, shipment_id: shipmentId, lane_id: laneId, carrier: required(value(row, 'carrier'), 'carrier', i + 2), shipment_date: text(value(row, 'shipment_date')) || null, volume: Math.max(0, Math.round(numberOrNull(value(row, 'volume'), 'volume', i + 2) ?? 0)), status, expected_cost: expectedCost, actual_cost: actualCost, expected_transit_hours: expectedTransit, actual_transit_hours: actualTransit, eta_date: text(value(row, 'eta_date')) || null, delivered_at: text(value(row, 'delivered_at')) || null, exception_type: text(value(row, 'exception_type')).slice(0, 200) || null, risk_score: risk, notes: text(value(row, 'notes')).slice(0, 2000) || null, ghost_lane_score: ghostScore, ghost_lane_status: ghostStatus, ghost_lane_reason: ghostReason.slice(0, 500), ghost_lane_confidence: confidence }
        }).filter((row): row is NonNullable<typeof row> => row !== null)
        if (payload.length) { const { error } = await db.from('shipments').insert(payload); if (error) throw new Error(`Shipment import failed: ${error.message}`) }
        inserted = payload.length; skipped = dataRows.length - inserted; for (const row of dataRows) { const id = laneMap.get(laneKey(value(row, 'origin'), value(row, 'destination'))); if (id) affectedLanes.push(id) }; await refreshLaneVolumes(db, organizationId, affectedLanes, false, true)
      }
    }
    return NextResponse.json({ imported: inserted, skipped, dataset: kind, fileType: filename.split('.').pop(), warnings, message: skipped ? `${inserted} imported, ${skipped} duplicate rows skipped.` : `${inserted} records imported successfully.` })
  } catch (error) { console.error('import failed', error); return NextResponse.json({ error: error instanceof Error ? error.message : 'Import failed' }, { status: 422 }) }
}
