'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, CheckCircle2, ExternalLink, Loader2, MapPinned, Navigation, PackageCheck, ShieldAlert, Truck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Shipment = { shipment_id:string; lane_id:string; carrier:string; shipment_date:string; volume:number; status:string }
type Lane = { id:string; origin:string; destination:string; mode:string; carrier:string|null; distance_km:number|null; risk_score:number|null }

const num=(n:number)=>new Intl.NumberFormat('en-IN',{maximumFractionDigits:0}).format(Math.max(0,n))
const pct=(n:number)=>`${Math.round(Math.max(0,Math.min(100,n)))}%`
const eta=(distance:number|null, mode:string)=>{const km=Math.max(0,Number(distance||0)); const speed=mode.toLowerCase().includes('road')?48:mode.toLowerCase().includes('rail')?55:35; return km?`${Math.max(1,Math.round(km/speed))}h estimated`: 'ETA unavailable'}

export function DriverNavigation({ shipments: initialShipments, lanes }:{ shipments:Shipment[]; lanes:Lane[] }) {
  const db = createClient()
  const [shipments, setShipments] = useState(initialShipments)
  const [shipmentId, setShipmentId] = useState(initialShipments[0]?.shipment_id||'')
  const [updating, setUpdating] = useState(false)
  const [toast, setToast] = useState('')

  const shipment = shipments.find(s=>s.shipment_id===shipmentId)||shipments[0]
  const lane = lanes.find(l=>l.id===shipment?.lane_id)
  const mapUrl = useMemo(()=>lane?`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(lane.origin)}&destination=${encodeURIComponent(lane.destination)}`:'',[lane])

  if(!shipment||!lane) return <main className="min-h-[calc(100vh-64px)] bg-[#f6f8fb] px-5 py-10 text-[#08111f]"><div className="mx-auto max-w-xl rounded-3xl border border-[#dbe2ec] bg-white p-10 text-center"><MapPinned className="mx-auto text-[#1769e0]" size={30}/><h1 className="mt-4 text-xl font-black">Navigation needs shipment + lane records</h1><p className="mt-2 text-xs leading-5 text-[#66758a]">Import actual shipment and lane data first. GhostLane will not invent a route when the source records are missing.</p><Link href="/import" className="mt-6 inline-flex rounded-xl bg-[#1769e0] px-4 py-2.5 text-xs font-bold text-white">Import data</Link></div></main>
  const risk=Number(lane.risk_score||0)

  const updateStatus = async (nextStatus: string) => {
    if (!shipment) return
    setUpdating(true)
    const now = new Date().toISOString()
    const { error } = await db.from('shipments').update({ status: nextStatus, last_event_at: now }).eq('shipment_id', shipment.shipment_id)
    if (!error) {
      await db.from('shipment_events').insert({
        shipment_id: shipment.shipment_id,
        event_type: nextStatus === 'in_transit' ? 'journey_started' : 'delivery_completed',
        severity: 'info',
        message: nextStatus === 'in_transit' ? 'Driver started journey. Status updated to in transit.' : 'Shipment delivered successfully by driver.',
      })
      setShipments(prev => prev.map(s => s.shipment_id === shipment.shipment_id ? { ...s, status: nextStatus } : s))
      setToast(`Shipment ${shipment.shipment_id} marked ${nextStatus.replace('_', ' ')}`)
      setTimeout(() => setToast(''), 3000)
    } else {
      setToast(error.message)
      setTimeout(() => setToast(''), 3500)
    }
    setUpdating(false)
  }

  const isDelivered = (shipment.status || '').toLowerCase() === 'delivered'
  const isInTransit = (shipment.status || '').toLowerCase() === 'in_transit' || (shipment.status || '').toLowerCase() === 'in transit'

  return <main className="min-h-[calc(100vh-64px)] bg-[#f6f8fb] px-4 py-7 text-[#08111f] sm:px-6 lg:px-8"><div className="mx-auto max-w-[1480px]">
    <div className="flex flex-col gap-4 border-b border-[#dbe2ec] pb-6 sm:flex-row sm:items-end sm:justify-between"><div><Link href="/" className="inline-flex items-center gap-2 text-[10px] font-black text-[#1769e0]"><ArrowLeft size={13}/>Command center</Link><div className="mt-4 text-[9px] font-black uppercase tracking-[.18em] text-[#1769e0]">Shipment execution</div><h1 className="mt-2 text-3xl font-black tracking-[-.05em]">Driver navigation</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#66758a]">Turn an approved shipment into a navigation handoff. Routing is delegated to the map provider; GhostLane supplies the operational context and risk signal.</p></div><a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1769e0] px-4 py-3 text-[11px] font-black text-white hover:bg-[#0f57bd] transition"><Navigation size={15}/>Open directions<ExternalLink size={12}/></a></div>
    <section className="mt-6 grid gap-5 xl:grid-cols-[.72fr_1.28fr]">
      <aside className="rounded-3xl border border-[#dbe2ec] bg-white p-5"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.15em] text-[#8490a0]"><PackageCheck size={14}/> Shipment</div><select value={shipment.shipment_id} onChange={e=>setShipmentId(e.target.value)} className="mt-5 h-11 w-full rounded-xl border border-[#dbe2ec] bg-white px-3 text-xs font-bold outline-none focus:border-[#1769e0]">{shipments.map(s=><option key={s.shipment_id} value={s.shipment_id}>{s.shipment_id}</option>)}</select>
        <div className="mt-5 space-y-3 text-xs">
          <div><span className="text-[#8994a3]">Carrier</span><div className="mt-1 font-extrabold">{shipment.carrier}</div></div>
          <div><span className="text-[#8994a3]">Volume</span><div className="mt-1 font-extrabold">{num(Number(shipment.volume))} units</div></div>
          <div><span className="text-[#8994a3]">Status</span><div className="mt-1 font-extrabold capitalize">{shipment.status||'Recorded'}</div></div>
        </div>
        <div className="mt-6 border-t border-[#edf0f5] pt-5">
          <label className="text-[9px] font-black uppercase tracking-[.12em] text-[#8490a0]">Driver Actions</label>
          <div className="mt-3 space-y-2">
            {!isInTransit && !isDelivered && (
              <button
                disabled={updating}
                onClick={() => updateStatus('in_transit')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1769e0] py-2.5 text-[11px] font-black text-white transition hover:bg-[#0f57bd] disabled:opacity-50"
              >
                {updating ? <Loader2 size={13} className="animate-spin" /> : <Navigation size={13} />} Start Journey (In Transit)
              </button>
            )}
            {isInTransit && (
              <button
                disabled={updating}
                onClick={() => updateStatus('delivered')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#22a06b] py-2.5 text-[11px] font-black text-white transition hover:bg-[#1a8256] disabled:opacity-50"
              >
                {updating ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Mark Delivered
              </button>
            )}
            {isDelivered && (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-[#eef9f4] py-2.5 text-[11px] font-black text-[#23825b]">
                <Check size={14} /> Completed & Delivered
              </div>
            )}
          </div>
        </div>
      </aside>
      <section className="rounded-3xl border border-[#dbe2ec] bg-white p-6"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.15em] text-[#8490a0]"><Truck size={14}/> Route handoff</div><span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${risk>=70?'bg-[#fff0f0] text-[#b54747]':risk>=45?'bg-[#fff8e7] text-[#9b6a00]':'bg-[#eef9f4] text-[#23825b]'}`}>{pct(risk)} ghost risk</span></div><div className="mt-7 flex items-center gap-4"><div className="min-w-0 flex-1"><div className="text-lg font-black">{lane.origin}</div><div className="mt-1 text-[10px] text-[#8994a3]">Origin</div></div><div className="h-px flex-1 bg-[#dbe2ec]"/><MapPinned size={20} className="text-[#1769e0]"/><div className="h-px flex-1 bg-[#dbe2ec]"/><div className="min-w-0 flex-1 text-right"><div className="text-lg font-black">{lane.destination}</div><div className="mt-1 text-[10px] text-[#8994a3]">Destination</div></div></div><div className="mt-7 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-[#f7f9fc] p-4"><div className="text-[9px] font-black uppercase tracking-[.1em] text-[#8490a0]">Distance</div><div className="mt-2 text-xl font-black">{lane.distance_km?`${num(Number(lane.distance_km))} km`:'Unavailable'}</div></div><div className="rounded-2xl bg-[#f7f9fc] p-4"><div className="text-[9px] font-black uppercase tracking-[.1em] text-[#8490a0]">Planning ETA</div><div className="mt-2 text-xl font-black">{eta(lane.distance_km,lane.mode)}</div></div><div className="rounded-2xl bg-[#f7f9fc] p-4"><div className="text-[9px] font-black uppercase tracking-[.1em] text-[#8490a0]">Mode</div><div className="mt-2 text-xl font-black capitalize">{lane.mode}</div></div></div></section>
    </section>
    <section className="mt-5 rounded-3xl bg-[#08111f] p-6 text-white"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.15em] text-[#83b4ff]"><ShieldAlert size={14}/> Execution warning</div><h2 className="mt-4 text-xl font-black">{risk>=70?'Review before dispatch':risk>=45?'Dispatch with monitoring':'Ready for execution'}</h2><p className="mt-2 max-w-3xl text-xs leading-5 text-[#aab5c3]">{risk>=70?'This lane is high risk. Confirm the carrier and shipment commitment before dispatching.':risk>=45?'The lane is in the review band. Keep the shipment visible to the operations team during execution.':'No high-risk signal is present in the connected lane record.'}</p></section>
    {toast && (
      <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-[#08111f] px-4 py-3 text-xs font-bold text-white shadow-2xl">
        <Check size={14} className="text-[#22a06b]" /> {toast}
      </div>
    )}
  </div></main>
}
