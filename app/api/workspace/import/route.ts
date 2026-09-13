import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseCsv, validateHeaders, type ImportKind } from '@/lib/data/import'

const MAX_BYTES = 10 * 1024 * 1024
const allowedKinds: ImportKind[] = ['lanes', 'contracts', 'shipments', 'carriers']

function num(value: string, field: string, row: number) {
  const n = Number(value)
  if (!Number.isFinite(n)) throw new Error(`${field} must be numeric on row ${row}`)
  return n
}

function text(value: string, field: string, row: number) {
  const v = value.trim()
  if (!v) throw new Error(`${field} is required on row ${row}`)
  return v.slice(0, 500)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await request.formData()
  const kind = String(form.get('kind') || '') as ImportKind
  const file = form.get('file')
  if (!allowedKinds.includes(kind)) return NextResponse.json({ error: 'Invalid dataset type' }, { status: 400 })
  if (!(file instanceof File)) return NextResponse.json({ error: 'CSV file is required' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File exceeds the 10 MB limit' }, { status: 413 })
  if (file.size === 0) return NextResponse.json({ error: 'File is empty' }, { status: 400 })
  if (!file.name.toLowerCase().endsWith('.csv')) return NextResponse.json({ error: 'Only CSV files are accepted' }, { status: 415 })

  const { data: membership } = await supabase.from('organization_members').select('organization_id, role').eq('user_id', user.id).in('role', ['owner', 'admin']).order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Workspace administrator access is required' }, { status: 403 })

  const rows = parseCsv(await file.text())
  if (rows.length < 2) return NextResponse.json({ error: 'CSV must contain a header and at least one data row' }, { status: 400 })
  const validation = validateHeaders(rows[0], kind)
  if (validation.missing.length) return NextResponse.json({ error: `Missing required columns: ${validation.missing.join(', ')}` }, { status: 422 })

  const headers = validation.normalized
  const index = Object.fromEntries(headers.map((h, i) => [h, i]))
  const value = (r: string[], key: string) => r[index[key]] ?? ''
  const organization_id = membership.organization_id
  const dataRows = rows.slice(1).filter(r => r.some(Boolean))
  if (dataRows.length > 5000) return NextResponse.json({ error: 'Maximum 5,000 rows per import' }, { status: 413 })

  try {
    if (kind === 'lanes') {
      const payload = dataRows.map((r, i) => ({ organization_id, origin: text(value(r, 'origin'), 'origin', i + 2), destination: text(value(r, 'destination'), 'destination', i + 2), mode: text(value(r, 'mode'), 'mode', i + 2), distance_km: index.distance_km === undefined || !value(r, 'distance_km') ? null : Math.round(num(value(r, 'distance_km'), 'distance_km', i + 2)), contracted_volume: Math.max(0, Math.round(num(value(r, 'contracted_volume'), 'contracted_volume', i + 2))), materialized_volume: Math.max(0, Math.round(num(value(r, 'materialized_volume'), 'materialized_volume', i + 2))), carrier: index.carrier === undefined ? null : value(r, 'carrier').trim().slice(0, 500) || null, risk_score: index.risk_score === undefined || !value(r, 'risk_score') ? null : Math.min(100, Math.max(0, num(value(r, 'risk_score'), 'risk_score', i + 2))) }))
      const { error } = await supabase.from('lanes').insert(payload)
      if (error) throw new Error(error.message)
    }

    if (kind === 'carriers') {
      const payload = dataRows.map((r, i) => ({ organization_id, name: text(value(r, 'carrier'), 'carrier', i + 2), acceptance_rate: num(value(r, 'acceptance_rate'), 'acceptance_rate', i + 2), rejection_rate: num(value(r, 'rejection_rate'), 'rejection_rate', i + 2), cancellation_rate: num(value(r, 'cancellation_rate'), 'cancellation_rate', i + 2), realization_rate: index.realization_rate === undefined || !value(r, 'realization_rate') ? null : num(value(r, 'realization_rate'), 'realization_rate', i + 2) }))
      const { error } = await supabase.from('carriers').insert(payload)
      if (error) throw new Error(error.message)
    }

    const { data: lanes } = await supabase.from('lanes').select('id, origin, destination').eq('organization_id', organization_id)
    const laneKey = new Map((lanes ?? []).map(l => [`${l.origin.trim().toLowerCase()}|${l.destination.trim().toLowerCase()}`, l.id]))

    if (kind === 'contracts' || kind === 'shipments') {
      const missingKeys = new Map<string, { origin: string; destination: string }>()
      for (const [i, r] of dataRows.entries()) {
        const origin = text(value(r, 'origin'), 'origin', i + 2), destination = text(value(r, 'destination'), 'destination', i + 2)
        const key = `${origin.toLowerCase()}|${destination.toLowerCase()}`
        if (!laneKey.has(key)) missingKeys.set(key, { origin, destination })
      }
      if (missingKeys.size) {
        const { data: created, error } = await supabase.from('lanes').insert([...missingKeys.values()].map(x => ({ organization_id, origin: x.origin, destination: x.destination, mode: 'road', contracted_volume: 0, materialized_volume: 0 }))).select('id, origin, destination')
        if (error) throw new Error(error.message)
        for (const l of created ?? []) laneKey.set(`${l.origin.trim().toLowerCase()}|${l.destination.trim().toLowerCase()}`, l.id)
      }
    }

    if (kind === 'contracts') {
      const payload = dataRows.map((r, i) => { const lane_id = laneKey.get(`${value(r, 'origin').trim().toLowerCase()}|${value(r, 'destination').trim().toLowerCase()}`); if (!lane_id) throw new Error(`Lane could not be resolved on row ${i + 2}`); return { organization_id, contract_id: text(value(r, 'contract_id'), 'contract_id', i + 2), lane_id, carrier: text(value(r, 'carrier'), 'carrier', i + 2), contracted_volume: Math.max(0, Math.round(num(value(r, 'contracted_volume'), 'contracted_volume', i + 2))), contract_rate: Math.max(0, num(value(r, 'contract_rate'), 'contract_rate', i + 2)), start_date: text(value(r, 'start_date'), 'start_date', i + 2), end_date: text(value(r, 'end_date'), 'end_date', i + 2) } })
      const { error } = await supabase.from('contracts').insert(payload)
      if (error) throw new Error(error.message)
    }

    if (kind === 'shipments') {
      const payload = dataRows.map((r, i) => { const lane_id = laneKey.get(`${value(r, 'origin').trim().toLowerCase()}|${value(r, 'destination').trim().toLowerCase()}`); if (!lane_id) throw new Error(`Lane could not be resolved on row ${i + 2}`); return { organization_id, shipment_id: text(value(r, 'shipment_id'), 'shipment_id', i + 2), lane_id, carrier: text(value(r, 'carrier'), 'carrier', i + 2), shipment_date: text(value(r, 'shipment_date'), 'shipment_date', i + 2), volume: Math.max(0, Math.round(num(value(r, 'volume'), 'volume', i + 2))), status: text(value(r, 'status'), 'status', i + 2) } })
      const { error } = await supabase.from('shipments').insert(payload)
      if (error) throw new Error(error.message)
    }

    return NextResponse.json({ imported: dataRows.length, dataset: kind })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Import failed' }, { status: 422 })
  }
}
