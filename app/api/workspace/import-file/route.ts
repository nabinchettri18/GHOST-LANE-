import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseOperationalFile } from '@/lib/data/parse-file'
import { validateHeaders, type ImportKind } from '@/lib/data/import'
import { allowRequest, isSameOrigin } from '@/lib/security'

const MAX_BYTES = 10 * 1024 * 1024
const kinds: ImportKind[] = ['lanes', 'contracts', 'shipments', 'carriers']
const allowedExtensions = ['.csv', '.tsv', '.txt', '.json', '.jsonl', '.ndjson', '.xlsx', '.xlsm']

const n = (v: string, field: string, row: number) => {
  if (!v.trim()) return null
  const x = Number(v)
  if (!Number.isFinite(x)) throw new Error(`${field} must be numeric on row ${row}`)
  return x
}

const t = (v: string, field: string, row: number) => {
  const x = v.trim()
  if (!x) throw new Error(`${field} is required on row ${row}`)
  return x.slice(0, 500)
}

async function refreshImportedLaneVolumes(
  db: ReturnType<typeof createAdminClient>,
  organizationId: string,
  laneIds: string[],
  refreshContracted: boolean,
  refreshMaterialized: boolean,
) {
  const ids = [...new Set(laneIds)]
  if (!ids.length) return

  const [{ data: contracts, error: contractError }, { data: shipments, error: shipmentError }] = await Promise.all([
    refreshContracted
      ? db.from('contracts').select('lane_id,contracted_volume').eq('organization_id', organizationId).in('lane_id', ids)
      : Promise.resolve({ data: [], error: null }),
    refreshMaterialized
      ? db.from('shipments').select('lane_id,volume,status').eq('organization_id', organizationId).in('lane_id', ids)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (contractError) throw contractError
  if (shipmentError) throw shipmentError

  const contractedByLane = new Map<string, number>()
  for (const row of contracts ?? []) {
    contractedByLane.set(row.lane_id, (contractedByLane.get(row.lane_id) ?? 0) + Math.max(0, Number(row.contracted_volume ?? 0)))
  }
  const materializedByLane = new Map<string, number>()
  for (const row of shipments ?? []) {
    if (['cancelled', 'canceled', 'rejected', 'void'].includes(String(row.status ?? '').trim().toLowerCase())) continue
    materializedByLane.set(row.lane_id, (materializedByLane.get(row.lane_id) ?? 0) + Math.max(0, Number(row.volume ?? 0)))
  }

  for (const laneId of ids) {
    const patch: Record<string, number> = {}
    if (refreshContracted) patch.contracted_volume = Math.round(contractedByLane.get(laneId) ?? 0)
    if (refreshMaterialized) patch.materialized_volume = Math.round(materializedByLane.get(laneId) ?? 0)
    if (Object.keys(patch).length) {
      const { error } = await db.from('lanes').update(patch).eq('id', laneId).eq('organization_id', organizationId)
      if (error) throw error
    }
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!allowRequest(`import:${user.id}`, 10, 60_000)) return NextResponse.json({ error: 'Too many import attempts. Please wait a minute.' }, { status: 429 })

  const form = await request.formData()
  const kind = String(form.get('kind') || '') as ImportKind
  const file = form.get('file')
  if (!kinds.includes(kind)) return NextResponse.json({ error: 'Invalid dataset type' }, { status: 400 })
  if (!(file instanceof File)) return NextResponse.json({ error: 'A file is required' }, { status: 400 })
  if (!file.size || file.size > MAX_BYTES) return NextResponse.json({ error: file.size ? 'File exceeds the 10 MB limit' : 'File is empty' }, { status: file.size ? 413 : 400 })
  const filename = file.name.toLowerCase()
  if (!allowedExtensions.some(ext => filename.endsWith(ext))) return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 })

  let membership: { organization_id: string; role: string } | null = null
  const { data: ownMembership } = await supabase.from('organization_members').select('organization_id,role').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (ownMembership && ['owner', 'admin'].includes(String(ownMembership.role).toLowerCase())) membership = ownMembership
  if (!membership) {
    const admin = createAdminClient()
    const { data: adminMembership, error } = await admin.from('organization_members').select('organization_id,role').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (error) console.error('workspace membership lookup failed', error)
    if (adminMembership && ['owner', 'admin'].includes(String(adminMembership.role).toLowerCase())) membership = adminMembership
  }
  if (!membership) return NextResponse.json({ error: 'Workspace administrator access is required' }, { status: 403 })

  try {
    const rows = await parseOperationalFile(file)
    if (rows.length < 2) throw new Error('The file must contain a header and at least one data row')
    const validation = validateHeaders(rows[0], kind)
    if (validation.missing.length) throw new Error(`Missing required columns: ${validation.missing.join(', ')}`)
    const headers = validation.normalized
    const index = Object.fromEntries(headers.map((h, i) => [h, i]))
    const value = (r: string[], key: string) => r[index[key]] ?? ''
    const dataRows = rows.slice(1).filter(r => r.some(Boolean))
    if (dataRows.length > 5000) throw new Error('Maximum 5,000 rows per import')

    // After explicit owner/admin authorization, use the server-only client for the import transaction.
    // This avoids RLS policy/function overhead and prevents production gateway timeouts while preserving org scoping.
    const db = createAdminClient()
    const organization_id = membership.organization_id
    const { data: existingLanes, error: lanesError } = await db.from('lanes').select('id,origin,destination').eq('organization_id', organization_id)
    if (lanesError) throw lanesError
    const laneKey = new Map((existingLanes ?? []).map(l => [`${l.origin.trim().toLowerCase()}|${l.destination.trim().toLowerCase()}`, l.id]))

    if (kind === 'lanes') {
      const payload = dataRows.map((r, i) => ({
        organization_id,
        origin: t(value(r, 'origin'), 'origin', i + 2),
        destination: t(value(r, 'destination'), 'destination', i + 2),
        mode: index.mode === undefined || !value(r, 'mode') ? null : value(r, 'mode').trim().slice(0, 100),
        distance_km: n(value(r, 'distance_km'), 'distance_km', i + 2) === null ? null : Math.round(n(value(r, 'distance_km'), 'distance_km', i + 2)!),
        contracted_volume: Math.max(0, Math.round(n(value(r, 'contracted_volume'), 'contracted_volume', i + 2) ?? 0)),
        materialized_volume: Math.max(0, Math.round(n(value(r, 'materialized_volume'), 'materialized_volume', i + 2) ?? 0)),
        carrier: index.carrier === undefined ? null : value(r, 'carrier').trim().slice(0, 500) || null,
        risk_score: index.risk_score === undefined || !value(r, 'risk_score') ? null : Math.min(100, Math.max(0, n(value(r, 'risk_score'), 'risk_score', i + 2)!)),
      }))
      const { error } = await db.from('lanes').insert(payload)
      if (error) throw new Error(error.message)
    } else if (kind === 'carriers') {
      const payload = dataRows.map((r, i) => ({
        organization_id,
        name: t(value(r, 'carrier'), 'carrier', i + 2),
        acceptance_rate: n(value(r, 'acceptance_rate'), 'acceptance_rate', i + 2),
        rejection_rate: n(value(r, 'rejection_rate'), 'rejection_rate', i + 2),
        cancellation_rate: n(value(r, 'cancellation_rate'), 'cancellation_rate', i + 2),
        realization_rate: index.realization_rate === undefined || !value(r, 'realization_rate') ? null : n(value(r, 'realization_rate'), 'realization_rate', i + 2),
      }))
      const { error } = await db.from('carriers').insert(payload)
      if (error) throw new Error(error.message)
    } else {
      const missing = new Map<string, { origin: string; destination: string }>()
      for (const [i, r] of dataRows.entries()) {
        const origin = t(value(r, 'origin'), 'origin', i + 2)
        const destination = t(value(r, 'destination'), 'destination', i + 2)
        const key = `${origin.toLowerCase()}|${destination.toLowerCase()}`
        if (!laneKey.has(key)) missing.set(key, { origin, destination })
      }
      if (missing.size) {
        const { data: created, error } = await db.from('lanes').insert([...missing.values()].map(x => ({ organization_id, origin: x.origin, destination: x.destination, mode: 'road', contracted_volume: 0, materialized_volume: 0 }))).select('id,origin,destination')
        if (error) throw new Error(error.message)
        for (const l of created ?? []) laneKey.set(`${l.origin.trim().toLowerCase()}|${l.destination.trim().toLowerCase()}`, l.id)
      }
      const affectedLaneIds = dataRows.map(r => laneKey.get(`${value(r, 'origin').trim().toLowerCase()}|${value(r, 'destination').trim().toLowerCase()}`)).filter((x): x is string => Boolean(x))

      if (kind === 'contracts') {
        const payload = dataRows.map((r, i) => {
          const lane_id = laneKey.get(`${value(r, 'origin').trim().toLowerCase()}|${value(r, 'destination').trim().toLowerCase()}`)
          if (!lane_id) throw new Error(`Lane could not be resolved on row ${i + 2}`)
          return {
            organization_id,
            contract_id: t(value(r, 'contract_id'), 'contract_id', i + 2),
            lane_id,
            carrier: t(value(r, 'carrier'), 'carrier', i + 2),
            contracted_volume: Math.max(0, Math.round(n(value(r, 'contracted_volume'), 'contracted_volume', i + 2) ?? 0)),
            contract_rate: n(value(r, 'contract_rate'), 'contract_rate', i + 2),
            start_date: value(r, 'start_date').trim() || null,
            end_date: value(r, 'end_date').trim() || null,
          }
        })
        const { error } = await db.from('contracts').insert(payload)
        if (error) throw new Error(error.message)
        await refreshImportedLaneVolumes(db, organization_id, affectedLaneIds, true, false)
      } else {
        const payload = dataRows.map((r, i) => {
          const lane_id = laneKey.get(`${value(r, 'origin').trim().toLowerCase()}|${value(r, 'destination').trim().toLowerCase()}`)
          if (!lane_id) throw new Error(`Lane could not be resolved on row ${i + 2}`)
          return {
            organization_id,
            shipment_id: t(value(r, 'shipment_id'), 'shipment_id', i + 2),
            lane_id,
            carrier: t(value(r, 'carrier'), 'carrier', i + 2),
            shipment_date: value(r, 'shipment_date').trim() || null,
            volume: Math.max(0, Math.round(n(value(r, 'volume'), 'volume', i + 2) ?? 0)),
            status: value(r, 'status').trim() || null,
          }
        })
        const { error } = await db.from('shipments').insert(payload)
        if (error) throw new Error(error.message)
        await refreshImportedLaneVolumes(db, organization_id, affectedLaneIds, false, true)
      }
    }

    return NextResponse.json({ imported: dataRows.length, dataset: kind, fileType: filename.split('.').pop(), warnings: validation.optionalMissing })
  } catch (error) {
    console.error('import failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Import failed' }, { status: 422 })
  }
}
