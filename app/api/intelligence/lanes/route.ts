import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { allowRequest, isSameOrigin } from '@/lib/security'

type Lane = { id:string; origin:string; destination:string; mode:string; contracted_volume:number|null; materialized_volume:number|null; risk_score:number|null }
type Contract = { lane_id:string; carrier:string; contracted_volume:number|null; start_date:string; end_date:string }
type Shipment = { lane_id:string; carrier:string; shipment_date:string; volume:number|null; status:string|null }

const n=(v:unknown)=>Math.max(0,Number(v)||0)
const norm=(v:unknown)=>String(v??'').trim().toLowerCase()

function score(contracted:number,moved:number,shipments:Shipment[],contracts:Contract[]){
  const realization=contracted>0?Math.min(100,moved/contracted*100):0
  const ghostRate=100-realization
  const cancelled=shipments.length?shipments.filter(s=>['cancelled','rejected'].includes(norm(s.status))).length/shipments.length*100:0
  const carriers=new Set(contracts.map(c=>norm(c.carrier)).filter(Boolean)).size
  const carrierPenalty=carriers<=1&&shipments.length>=5?10:0
  return Math.round(Math.min(100,Math.max(0,ghostRate*.65+cancelled*.2+carrierPenalty)))
}

export async function POST(request:Request){
  if(!isSameOrigin(request))return NextResponse.json({error:'Cross-origin request rejected'},{status:403})
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser()
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401})
  if(!allowRequest(`lane-intelligence:${user.id}`,5,60000))return NextResponse.json({error:'Too many analysis requests. Please wait a minute.'},{status:429})
  const {data:membership}=await supabase.from('organization_members').select('organization_id').eq('user_id',user.id).limit(1).maybeSingle()
  if(!membership)return NextResponse.json({error:'No workspace membership found'},{status:403})
  const org=membership.organization_id
  const [{data:lanes,error:le},{data:contracts,error:ce},{data:shipments,error:se}]=await Promise.all([
    supabase.from('lanes').select('id,origin,destination,mode,contracted_volume,materialized_volume,risk_score').eq('organization_id',org).limit(5000),
    supabase.from('contracts').select('lane_id,carrier,contracted_volume,start_date,end_date').eq('organization_id',org).limit(10000),
    supabase.from('shipments').select('lane_id,carrier,shipment_date,volume,status').eq('organization_id',org).limit(20000),
  ])
  if(le||ce||se)return NextResponse.json({error:le?.message||ce?.message||se?.message||'Unable to load workspace data'},{status:500})
  const allLanes=(lanes??[]) as Lane[], allContracts=(contracts??[]) as Contract[], allShipments=(shipments??[]) as Shipment[]
  const results=allLanes.map(lane=>{
    const cs=allContracts.filter(c=>c.lane_id===lane.id), ss=allShipments.filter(s=>s.lane_id===lane.id)
    const contracted=Math.max(n(lane.contracted_volume),cs.reduce((x,c)=>x+n(c.contracted_volume),0))
    const moved=ss.filter(s=>!['cancelled','rejected'].includes(norm(s.status))).reduce((x,s)=>x+n(s.volume),0)
    const realization=contracted?moved/contracted*100:0
    const risk=score(contracted,moved,ss,cs)
    const carrierVolumes=new Map<string,number>(); ss.forEach(s=>carrierVolumes.set(norm(s.carrier),(carrierVolumes.get(norm(s.carrier))||0)+n(s.volume)))
    const top=[...carrierVolumes.entries()].sort((a,b)=>b[1]-a[1])[0]
    return {id:lane.id,lane:`${lane.origin} → ${lane.destination}`,origin:lane.origin,destination:lane.destination,mode:lane.mode||'road',contractedVolume:Math.round(contracted),materializedVolume:Math.round(moved),ghostVolume:Math.max(0,Math.round(contracted-moved)),realization:Number(realization.toFixed(1)),risk,band:risk>=70?'High':risk>=40?'Medium':'Low',shipments:ss.length,contracts:cs.length,carriers:carrierVolumes.size,topCarrier:top?.[0]||null,topCarrierShare:top&&moved?Number((top[1]/moved*100).toFixed(1)):0}
  })
  for(const r of results){const {error}=await supabase.from('lanes').update({materialized_volume:r.materializedVolume,risk_score:r.risk}).eq('id',r.id).eq('organization_id',org);if(error)return NextResponse.json({error:error.message},{status:500})}
  const highRisk=results.filter(r=>r.risk>=70).length
  return NextResponse.json({generatedAt:new Date().toISOString(),laneCount:results.length,highRisk,totals:{contracted:results.reduce((s,r)=>s+r.contractedVolume,0),materialized:results.reduce((s,r)=>s+r.materializedVolume,0),ghost:results.reduce((s,r)=>s+r.ghostVolume,0)},lanes:results})
}
