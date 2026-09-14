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
  const x = Number(v)
  if (!Number.isFinite(x)) throw new Error(`${field} must be numeric on row ${row}`)
  return x
}

const optionalNumber = (v: string, field: string, row: number) => {
  const x = v.trim()
  return x === '' ? null : n(x, field, row)
}

const optionalText = (v: string) => {
  const x = v.trim()
  return x ? x.slice(0, 500) : null
}

const t = (v: string, field: string, row: number) => {
  const x = v.trim()
  if (!x) throw new Error(`${field} is required on row ${row}`)
  return x.slice(0, 500)
}

type DbClient = Awaited<ReturnType<typeof createClient>>

async function refreshLaneVolumes(
  supabase: DbClient,
  organizationId: string,
  refreshContracted: boolean,
  refreshMaterialized: boolean,
) {
  const [{ data: lanes, error: laneError }, { data: contracts, error: contractError }, { data: shipments, error: shipmentError }] = await Promise.all([
    supabase.from('lanes').select('id').eq('organization_id', organizationId),
    refreshContracted
      ? supabase.from('contracts').select('lane_id,contracted_volume').eq('organization_id', organizationId)
      : Promise.resolve({ data: [], error: null }),
    refreshMaterialized
      ? supabase.from('shipments').select('lane_id,volume,status').eq('organization_id', organizationId)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (laneError) throw laneError
  if (contractError) throw contractError
  if (shipmentError) throw shipmentError

  const contractedByLane = new Map<string, number>()
  for (const row of contracts ?? []) {
    contractedByLane.set(row.lane_id, (contractedByLane.get(row.lane_id) ?? 0) + Math.max(0, Number(row.contracted_volume ?? 0)))
  }

  const materializedByLane = new Map<string, number>()
  for (const row of shipments ?? []) {
    const status = String(row.status ?? '').trim().toLowerCase()
    if (['cancelled', 'canceled', 'rejected', 'void'].includes(status)) continue
    materializedByLane.set(row.lane_id, (materializedByLane.get(row.lane_id) ?? 0) + Math.max(0, Number(row.volume ?? 0)))
  }

  for (const lane of lanes ?? []) {
    const patch: Record<string, number> = {}
    if (refreshContracted) patch.contracted_volume = Math.round(contractedByLane.get(lane.id) ?? 0)
    if (refreshMaterialized) patch.materialized_volume = Math.round(materializedByLane.get(lane.id) ?? 0)
    if (Object.keys(patch).length === 0) continue
    const { error } = await supabase.from('lanes').update(patch).eq('id', lane.id).eq('organization_id', organizationId)
    if (error) throw error
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!allowRequest(`import:${user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many import attempts. Please wait a minute.' }, { status: 429 })
  }

  const form = await request.formData()
  const kind = String(form.get('kind') || '') as ImportKind
  const file = form.get('file')

  if (!kinds.includes(kind)) return NextResponse.json({ error: 'Invalid dataset type' }, { status: 400 })
  if (!(file instanceof File)) return NextResponse.json({ error: 'A file is required' }, { status: 400 })
  if (!file.size || file.size > MAX_BYTES) {
    return NextResponse.json({ error: file.size ? 'File exceeds the 10 MB limit' : 'File is empty' }, { status: file.size ? 413 : 400 })
  }

  const filename = file.name.toLowerCase()
  if (!allowedExtensions.some(ext => filename.endsWith(ext))) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 })
  }

  let membership: { organization_id: string; role: string } | null = null
  const { data: ownMembership } = await supabase
    .from('organization_members')
    .select('organization_id,role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (ownMembership && ['owner', 'admin'].includes(String(ownMembership.role).toLowerCase())) {
    membership = ownMembership
  } else {
    try {
      const admin = createAdminClient()
      const { data: adminMembership, error: membershipError } = await admin
        .from('organization_members')
        .select('organization_id,role')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (membershipError) throw membershipError
      if (adminMembership && ['owner', 'admin'].includes(String(adminMembership.role).toLowerCase())) {
        membership = adminMembership
      }
    } catch (error) {
      console.error('workspace membership lookup failed', error)
    }
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
    const has = (key: string) => index[key] !== undefined
    const dataRows = rows.slice(1).filter(r => r.some(Boolean))
    if (dataRows.length > 5000) throw new Error('Maximum 5,000 rows per import')

    const organization_id = membership.organization_id
    const { data: existingLanes, error: lanesError } = await supabase
      .from('lanes')
      .select('id,origin,destination')
      .eq('organization_id', organization_id)
    if (lanesError) throw lanesError

    const laneKey = new Map(
      (existingLanes ?? []).map(l => [
        `${l.origin.trim().toLowerCase()}|${l.destination.trim().toLowerCase()}`,
        l.id,
      ]),
    )

    if (kind === 'lanes') {
      const payload = dataRows.map((r, i) => ({
        organization_id,
        origin: t(value(r, 'origin'), 'origin', i + 2),
        destination: t(value(r, 'destination'), 'destination', i + 2),
        mode: optionalText(value(r, 'mode')),
        distance_km: optionalNumber(value(r, 'distance_km'), 'distance_km', i + 2),
        contracted_volume: optionalNumber(value(r, 'contracted_volume'), 'contracted_volume', i + 2),
        materialized_volume: optionalNumber(value(r, 'materialized_volume'), 'materialized_volume', i + 2),
        carrier: optionalText(value(r, 'carrier')),
        risk_score: optionalNumber(value(r, 'risk_score'), 'risk_score', i + 2),
      }))
      const { error } = await supabase.from('lanes').insert(payload)
      if (error) throw new Error(error.message)
    } else if (kind === 'carriers') {
      const payload = dataRows.map((r, i) => ({
        organization_id,
        name: t(value(r, 'carrier'), 'carrier', i + 2),
        acceptance_rate: optionalNumber(value(r, 'acceptance_rate'), 'acceptance_rate', i + 2),
        rejection_rate: optionalNumber(value(r, 'rejection_rate'), 'rejection_rate', i + 2),
        cancellation_rate: optionalNumber(value(r, 'cancellation_rate'), 'cancellation_rate', i + 2),
        realization_rate: optionalNumber(value(r, 'realization_rate'), 'realization_rate', i + 2),
      }))
      const { error } = await supabase.from('carriers').insert(payload)
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
        const { data: created, error } = await supabase
          .from('lanes')
          .insert([...missing.values()].map(x => ({
            organization_id,
            origin: x.origin,
            destination: x.destination,
            mode: 'road',
            contracted_volume: 0,
            materialized_volume: 0,
          })))
          .select('id,origin,destination')
        if (error) throw new Error(error.message)
        for (const l of created ?? []) {
          laneKey.set(`${l.origin.trim().toLowerCase()}|${l.destination.trim().toLowerCase()}`, l.id)
        }
      }

      if (kind === 'contracts') {
        const payload = dataRows.map((r, i) => {
          const lane_id = laneKey.get(`${value(r, 'origin').trim().toLowerCase()}|${value(r, 'destination').trim().toLowerCase()}`)
          if (!lane_id) throw new Error(`Lane could not be resolved on row ${i + 2}`)
          return {
            organization_id,
            contract_id: t(value(r, 'contract_id'), 'contract_id', i + 2),
            lane_id,
            carrier: t(value(r, 'carrier'), 'carrier', i + 2),
            contracted_volume: optionalNumber(value(r, 'contracted_volume'), 'contracted_volume', i + 2),
            contract_rate: optionalNumber(value(r, 'contract_rate'), 'contract_rate', i + 2),
            start_date: optionalText(value(r, 'start_date')),
            end_date: optionalText(value(r, 'end_date')),
          }
        })
        const { error } = await supabase.from('contracts').insert(payload)
        if (error) throw new Error(error.message)
        await refreshLaneVolumes(supabase, organization_id, true, false)
      } else {
        const payload = dataRows.map((r, i) => {
          const lane_id = laneKey.get(`${value(r, 'origin').trim().toLowerCase()}|${value(r, 'destination').trim().toLowerCase()}`)
          if (!lane_id) throw new Error(`Lane could not be resolved on row ${i + 2}`)
          return {
            organization_id,
            shipment_id: t(value(r, 'shipment_id'), 'shipment_id', i + 2),
            lane_id,
            carrier: t(value(r, 'carrier'), 'carrier', i + 2),
            shipment_date: optionalText(value(r, 'shipment_date')),
            volume: optionalNumber(value(r, 'volume'), 'volume', i + 2),
            status: optionalText(value(r, 'status')),
          }
        })
        const { error } = await supabase.from('shipments').insert(payload)
        if (error) throw new Error(error.message)
        await refreshLaneVolumes(supabase, organization_id, false, true)
      }
    }

    const optionalMissing = validation.optionalMissing
    return NextResponse.json({
      imported: dataRows.length,
      dataset: kind,
      fileType: filename.split('.').pop(),
      warnings: optionalMissing.length
        ? [`Optional fields not provided: ${optionalMissing.join(', ')}`]
        : [],
    })
  } catch (error) {
    console.error('import failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Import failed' }, { status: 422 })
  }
}
