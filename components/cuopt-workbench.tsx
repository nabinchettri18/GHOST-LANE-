'use client'

import { useEffect, useMemo, useState } from 'react'
import { BrainCircuit, CheckCircle2, Loader2, Route, Truck } from 'lucide-react'

type Lane={id:string;origin:string;destination:string;mode:string;carrier:string|null;distance_km:number|null}
type RouteData={distanceKm:number;durationMin:number}

export function CuOptWorkbench({lanes}:{lanes:Lane[]}){
 const [laneId,setLaneId]=useState(lanes[0]?.id||'')
 const [route,setRoute]=useState<RouteData|null>(null)
 const [routeLoading,setRouteLoading]=useState(false)
 const [message,setMessage]=useState('')
 const [loading,setLoading]=useState(false)
 const lane=useMemo(()=>lanes.find(l=>l.id===laneId),[lanes,laneId])

 useEffect(()=>{
  let cancelled=false
  const load=async()=>{
   if(!lane){setRoute(null);return}
   setRouteLoading(true);setMessage('')
   try{
    const res=await fetch(`/api/maps/route?origin=${encodeURIComponent(lane.origin)}&destination=${encodeURIComponent(lane.destination)}`)
    const data=await res.json()
    if(!res.ok)throw new Error(data.error||'Route unavailable')
    if(!cancelled)setRoute({distanceKm:Number(data.distanceKm),durationMin:Number(data.durationMin)})
   }catch(e){if(!cancelled){setRoute(null);setMessage(e instanceof Error?e.message:'Route unavailable')}}
   finally{if(!cancelled)setRouteLoading(false)}
  }
  void load()
  return()=>{cancelled=true}
 },[lane?.id,lane?.origin,lane?.destination])

 const optimize=async()=>{
  if(!route)return
  setLoading(true);setMessage('')
  try{
   const res=await fetch('/api/maps/optimize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({distanceKm:route.distanceKm,durationMin:route.durationMin})})
   const data=await res.json()
   if(!res.ok)throw new Error(data.message||data.error||'NVIDIA optimization unavailable')
   setMessage('NVIDIA cuOpt optimization completed successfully.')
  }catch(e){setMessage(e instanceof Error?e.message:'Optimization unavailable')}
  finally{setLoading(false)}
 }

 if(!lanes.length)return <div className="rounded-3xl border border-dashed border-[#dbe2ec] bg-white p-10 text-center"><Truck className="mx-auto text-[#1769e0]" size={30}/><h2 className="mt-4 text-lg font-black">Import lane data first</h2><p className="mt-2 text-xs text-[#66758a]">GhostLane will only optimize routes from your connected lane records.</p></div>

 return <section className="rounded-3xl border border-[#dbe2ec] bg-white p-6 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.16em] text-[#1769e0]"><BrainCircuit size={14}/> NVIDIA cuOpt</div><h1 className="mt-2 text-2xl font-black tracking-[-.04em]">Route optimization</h1><p className="mt-2 max-w-2xl text-xs leading-5 text-[#66758a]">Select a real GhostLane lane. GhostLane calculates the road route first, then sends the route metrics to NVIDIA cuOpt for optimization.</p></div><span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5fbf7] px-3 py-1.5 text-[9px] font-black text-[#39765a]"><CheckCircle2 size={12}/>API connected</span></div>
  <div className="mt-7 grid gap-4 lg:grid-cols-[1fr_auto]"><div><label className="text-[9px] font-black uppercase tracking-[.12em] text-[#8490a0]">Lane</label><select value={laneId} onChange={e=>setLaneId(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#dbe2ec] bg-white px-3 text-xs font-bold outline-none focus:border-[#1769e0]">{lanes.map(l=><option key={l.id} value={l.id}>{l.origin} → {l.destination}{l.carrier?` · ${l.carrier}`:''}</option>)}</select></div><div className="flex items-end"><button onClick={optimize} disabled={!route||routeLoading||loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#08111f] px-5 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{loading?<Loader2 size={13} className="animate-spin"/>:<BrainCircuit size={13}/>} {loading?'Optimizing…':'Optimize with NVIDIA cuOpt'}</button></div></div>
  <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-[#f7f9fc] p-4"><div className="text-[9px] font-black uppercase tracking-[.1em] text-[#8490a0]">Provider route</div><div className="mt-2 text-lg font-black">{routeLoading?'Calculating…':route?`${route.distanceKm.toFixed(1)} km`:'Unavailable'}</div></div><div className="rounded-2xl bg-[#f7f9fc] p-4"><div className="text-[9px] font-black uppercase tracking-[.1em] text-[#8490a0]">Travel time</div><div className="mt-2 text-lg font-black">{route?`${Math.round(route.durationMin)} min`:'—'}</div></div><div className="rounded-2xl bg-[#f7f9fc] p-4"><div className="text-[9px] font-black uppercase tracking-[.1em] text-[#8490a0]">Lane mode</div><div className="mt-2 text-lg font-black">{lane?.mode||'—'}</div></div></div>
  {message&&<div className={`mt-4 flex items-center gap-2 rounded-2xl p-4 text-[10px] font-black ${message.includes('completed')?'bg-[#eef9f4] text-[#23825b]':'bg-[#fff0f0] text-[#b54747]'}`}>{message.includes('completed')&&<CheckCircle2 size={14}/>} {message}</div>}
 </section>
}
