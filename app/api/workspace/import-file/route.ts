import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseOperationalFile } from '@/lib/data/parse-file'
import { validateHeaders, type ImportKind } from '@/lib/data/import'

const MAX_BYTES = 100 * 1024 * 1024
const kinds: ImportKind[] = ['lanes', 'contracts', 'shipments', 'carriers']
const n = (v: string, field: string, row: number) => { const x = Number(v); if (!Number.isFinite(x)) throw new Error(`${field} must be numeric on row ${row}`); return x }
const t = (v: string, field: string, row: number) => { const x = v.trim(); if (!x) throw new Error(`${field} is required on row ${row}`); return x.slice(0,500) }

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const form = await request.formData()
  const kind = String(form.get('kind') || '') as ImportKind
  const file = form.get('file')
  if (!kinds.includes(kind)) return NextResponse.json({ error: 'Invalid dataset type' }, { status: 400 })
  if (!(file instanceof File)) return NextResponse.json({ error: 'A file is required' }, { status: 400 })
  if (!file.size || file.size > MAX_BYTES) return NextResponse.json({ error: file.size ? 'File exceeds the 100 MB limit' : 'File is empty' }, { status: file.size ? 413 : 400 })
  const { data: membership } = await supabase.from('organization_members').select('organization_id,role').eq('user_id', user.id).in('role',['owner','admin']).order('created_at',{ascending:true}).limit(1).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Workspace administrator access is required' }, { status: 403 })
  try {
    const rows = await parseOperationalFile(file)
    if (rows.length < 2) throw new Error('The file must contain a header and at least one data row')
    const validation = validateHeaders(rows[0], kind)
    if (validation.missing.length) throw new Error(`Missing required columns: ${validation.missing.join(', ')}`)
    const headers = validation.normalized, index = Object.fromEntries(headers.map((h,i)=>[h,i]))
    const value = (r:string[], key:string) => r[index[key]] ?? ''
    const dataRows = rows.slice(1).filter(r=>r.some(Boolean))
    if (dataRows.length > 5000) throw new Error('Maximum 5,000 rows per import')
    const organization_id = membership.organization_id

    const { data: existingLanes } = await supabase.from('lanes').select('id,origin,destination').eq('organization_id',organization_id)
    const laneKey = new Map((existingLanes??[]).map(l=>[`${l.origin.trim().toLowerCase()}|${l.destination.trim().toLowerCase()}`,l.id]))
    if (kind === 'lanes') {
      const payload = dataRows.map((r,i)=>({organization_id,origin:t(value(r,'origin'),'origin',i+2),destination:t(value(r,'destination'),'destination',i+2),mode:t(value(r,'mode'),'mode',i+2),distance_km:index.distance_km===undefined||!value(r,'distance_km')?null:Math.round(n(value(r,'distance_km'),'distance_km',i+2)),contracted_volume:Math.max(0,Math.round(n(value(r,'contracted_volume'),'contracted_volume',i+2))),materialized_volume:Math.max(0,Math.round(n(value(r,'materialized_volume'),'materialized_volume',i+2))),carrier:index.carrier===undefined?null:value(r,'carrier').trim().slice(0,500)||null,risk_score:index.risk_score===undefined||!value(r,'risk_score')?null:Math.min(100,Math.max(0,n(value(r,'risk_score'),'risk_score',i+2)))}))
      const {error}=await supabase.from('lanes').insert(payload); if(error) throw new Error(error.message)
    } else if (kind === 'carriers') {
      const payload=dataRows.map((r,i)=>({organization_id,name:t(value(r,'carrier'),'carrier',i+2),acceptance_rate:n(value(r,'acceptance_rate'),'acceptance_rate',i+2),rejection_rate:n(value(r,'rejection_rate'),'rejection_rate',i+2),cancellation_rate:n(value(r,'cancellation_rate'),'cancellation_rate',i+2),realization_rate:index.realization_rate===undefined||!value(r,'realization_rate')?null:n(value(r,'realization_rate'),'realization_rate',i+2)}))
      const {error}=await supabase.from('carriers').insert(payload); if(error) throw new Error(error.message)
    } else {
      const missing=new Map<string,{origin:string;destination:string}>()
      for(const [i,r] of dataRows.entries()){const origin=t(value(r,'origin'),'origin',i+2),destination=t(value(r,'destination'),'destination',i+2),key=`${origin.toLowerCase()}|${destination.toLowerCase()}`;if(!laneKey.has(key))missing.set(key,{origin,destination})}
      if(missing.size){const {data:created,error}=await supabase.from('lanes').insert([...missing.values()].map(x=>({organization_id,origin:x.origin,destination:x.destination,mode:'road',contracted_volume:0,materialized_volume:0}))).select('id,origin,destination');if(error)throw new Error(error.message);for(const l of created??[])laneKey.set(`${l.origin.trim().toLowerCase()}|${l.destination.trim().toLowerCase()}`,l.id)}
      if(kind==='contracts'){
        const payload=dataRows.map((r,i)=>{const lane_id=laneKey.get(`${value(r,'origin').trim().toLowerCase()}|${value(r,'destination').trim().toLowerCase()}`);if(!lane_id)throw new Error(`Lane could not be resolved on row ${i+2}`);return {organization_id,contract_id:t(value(r,'contract_id'),'contract_id',i+2),lane_id,carrier:t(value(r,'carrier'),'carrier',i+2),contracted_volume:Math.max(0,Math.round(n(value(r,'contracted_volume'),'contracted_volume',i+2))),contract_rate:Math.max(0,n(value(r,'contract_rate'),'contract_rate',i+2)),start_date:t(value(r,'start_date'),'start_date',i+2),end_date:t(value(r,'end_date'),'end_date',i+2)}})
        const {error}=await supabase.from('contracts').insert(payload);if(error)throw new Error(error.message)
      } else {
        const payload=dataRows.map((r,i)=>{const lane_id=laneKey.get(`${value(r,'origin').trim().toLowerCase()}|${value(r,'destination').trim().toLowerCase()}`);if(!lane_id)throw new Error(`Lane could not be resolved on row ${i+2}`);return {organization_id,shipment_id:t(value(r,'shipment_id'),'shipment_id',i+2),lane_id,carrier:t(value(r,'carrier'),'carrier',i+2),shipment_date:t(value(r,'shipment_date'),'shipment_date',i+2),volume:Math.max(0,Math.round(n(value(r,'volume'),'volume',i+2))),status:t(value(r,'status'),'status',i+2)}})
        const {error}=await supabase.from('shipments').insert(payload);if(error)throw new Error(error.message)
      }
    }
    return NextResponse.json({imported:dataRows.length,dataset:kind,fileType:file.name.split('.').pop()?.toLowerCase()})
  } catch (error) { return NextResponse.json({error:error instanceof Error?error.message:'Import failed'},{status:422}) }
}
