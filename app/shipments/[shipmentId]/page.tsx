import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, CircleAlert, CheckCircle2, Clock3, Truck, IndianRupee } from 'lucide-react'

export default async function ShipmentDetailPage({ params }: { params: Promise<{ shipmentId: string }> }) {
  const { shipmentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()
  const { data: membership } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).order('created_at',{ascending:true}).limit(1).maybeSingle()
  if (!membership) notFound()
  const { data: shipment } = await supabase.from('shipments').select('shipment_id,lane_id,carrier,shipment_date,volume,status,expected_cost,actual_cost,expected_transit_hours,actual_transit_hours,eta_date,delivered_at,exception_type,risk_score,notes,lanes(origin,destination,mode,distance_km)').eq('organization_id',membership.organization_id).eq('shipment_id',shipmentId).maybeSingle()
  if (!shipment) notFound()
  const lane = Array.isArray(shipment.lanes) ? shipment.lanes[0] : shipment.lanes
  const risk = Number(shipment.risk_score ?? 0)
  const costDelta = shipment.expected_cost != null && shipment.actual_cost != null ? Number(shipment.actual_cost) - Number(shipment.expected_cost) : null
  const transitDelta = shipment.expected_transit_hours != null && shipment.actual_transit_hours != null ? Number(shipment.actual_transit_hours) - Number(shipment.expected_transit_hours) : null
  const status = String(shipment.status || 'unknown')
  const delivered = ['delivered','completed'].includes(status.toLowerCase())
  return <main className="min-h-screen bg-[#f6f8fb] px-5 py-8 text-[#08111f] sm:px-8">
    <div className="mx-auto max-w-[1180px]">
      <Link href="/?view=shipments" className="inline-flex items-center gap-2 text-xs font-bold text-[#1769e0]"><ArrowLeft size={14}/>Back to shipments</Link>
      <header className="mt-5 flex flex-col gap-5 border-b border-[#dbe2ec] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#1769e0]">Shipment execution</p><h1 className="mt-2 text-3xl font-black tracking-[-.05em]">{shipment.shipment_id}</h1><p className="mt-2 text-sm text-[#66758a]">{lane?.origin || 'Unknown'} → {lane?.destination || 'Unknown'} · {shipment.carrier || 'Carrier not assigned'}</p></div>
        <div className={`inline-flex items-center gap-2 self-start rounded-full px-3 py-2 text-[10px] font-black ${delivered?'bg-[#eef9f4] text-[#23825b]':risk>=70?'bg-[#fff0f0] text-[#b54747]':risk>=45?'bg-[#fff8e7] text-[#9b6a00]':'bg-[#edf4ff] text-[#1769e0]'}`}>
          {delivered?<CheckCircle2 size={14}/>:risk>=70?<CircleAlert size={14}/>:<Clock3 size={14}/>} {status.replace(/_/g,' ')}{shipment.risk_score != null ? ` · ${Math.round(risk)}% risk` : ''}
        </div>
      </header>
      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card icon={<Truck size={16}/>} label="Carrier" value={shipment.carrier || 'Unassigned'} />
        <Card icon={<IndianRupee size={16}/>} label="Actual cost" value={shipment.actual_cost == null ? '—' : `₹${Number(shipment.actual_cost).toLocaleString('en-IN')}`} />
        <Card icon={<Clock3 size={16}/>} label="Actual transit" value={shipment.actual_transit_hours == null ? '—' : `${Number(shipment.actual_transit_hours)}h`} />
        <Card icon={<CircleAlert size={16}/>} label="Exception" value={shipment.exception_type || 'None recorded'} />
      </section>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-3xl border border-[#dbe2ec] bg-white p-6">
          <h2 className="text-sm font-extrabold">Execution timeline</h2>
          <div className="mt-6 space-y-5">
            <Timeline title="Shipment created" detail={shipment.shipment_date || 'Date not provided'} active />
            <Timeline title="In transit" detail={shipment.eta_date ? `ETA ${shipment.eta_date}` : 'ETA not provided'} active={!delivered} />
            <Timeline title="Delivered" detail={shipment.delivered_at ? new Date(shipment.delivered_at).toLocaleString('en-IN') : 'Awaiting delivery'} active={delivered} />
          </div>
        </section>
        <aside className="rounded-3xl bg-[#08111f] p-6 text-white">
          <div className="text-[9px] font-black uppercase tracking-[.16em] text-[#83b4ff]">Post-shipment intelligence</div>
          <h2 className="mt-4 text-xl font-black">What did this shipment teach the lane?</h2>
          <div className="mt-6 space-y-3 text-xs">
            <Metric label="Cost variance" value={costDelta == null ? 'Insufficient data' : `${costDelta >= 0 ? '+' : ''}₹${Math.round(costDelta).toLocaleString('en-IN')}`} />
            <Metric label="Transit variance" value={transitDelta == null ? 'Insufficient data' : `${transitDelta >= 0 ? '+' : ''}${Number(transitDelta).toFixed(1)}h`} />
            <Metric label="Lane" value={`${lane?.origin || '—'} → ${lane?.destination || '—'}`} />
          </div>
          <p className="mt-6 border-t border-white/10 pt-5 text-[11px] leading-5 text-[#aab5c3]">Completed shipment outcomes should feed back into lane performance so future procurement decisions use actual execution evidence.</p>
        </aside>
      </div>
      {shipment.notes && <section className="mt-5 rounded-2xl border border-[#dbe2ec] bg-white p-6"><h2 className="text-sm font-extrabold">Notes</h2><p className="mt-3 text-xs leading-6 text-[#66758a]">{shipment.notes}</p></section>}
    </div>
  </main>
}
function Card({icon,label,value}:{icon:React.ReactNode;label:string;value:string}){return <div className="rounded-2xl border border-[#dbe2ec] bg-white p-5"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.12em] text-[#8490a0]">{icon}{label}</div><div className="mt-3 truncate text-lg font-black">{value}</div></div>}
function Timeline({title,detail,active}:{title:string;detail:string;active:boolean}){return <div className="flex gap-3"><div className={`mt-1 h-3 w-3 shrink-0 rounded-full ${active?'bg-[#1769e0]':'bg-[#dbe2ec]'}`}/><div><div className="text-xs font-extrabold">{title}</div><div className="mt-1 text-[11px] text-[#8994a3]">{detail}</div></div></div>}
function Metric({label,value}:{label:string;value:string}){return <div className="flex items-center justify-between border-b border-white/10 pb-3"><span className="text-[#8290a1]">{label}</span><strong>{value}</strong></div>}
