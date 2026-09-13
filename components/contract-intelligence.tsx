'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, BarChart3, FileText, ShieldCheck } from 'lucide-react'

type Lane = {
  id: string
  origin: string
  destination: string
  mode: string
  carrier: string | null
  contracted_volume: number | null
  materialized_volume: number | null
}

export function ContractIntelligence({ lanes }: { lanes: Lane[] }) {
  const [laneId, setLaneId] = useState(lanes[0]?.id ?? '')
  const [carrier, setCarrier] = useState('')
  const [volume, setVolume] = useState('100')

  const lane = lanes.find(item => item.id === laneId)
  const carrierOptions = useMemo(() => Array.from(new Set(lanes.map(l => l.carrier).filter(Boolean) as string[])).sort(), [lanes])

  const analysis = useMemo(() => {
    if (!lane) return null
    const exact = lanes.filter(l => l.id === lane.id)
    const carrierLane = carrier ? lanes.filter(l => l.origin === lane.origin && l.destination === lane.destination && l.carrier === carrier) : []
    const source = carrierLane.length ? carrierLane : exact
    const contracted = source.reduce((sum, l) => sum + Number(l.contracted_volume ?? 0), 0)
    const materialized = source.reduce((sum, l) => sum + Number(l.materialized_volume ?? 0), 0)
    const realization = contracted > 0 ? Math.min(100, (materialized / contracted) * 100) : 0
    const proposed = Math.max(0, Number(volume) || 0)
    const expected = proposed * realization / 100
    const gap = Math.max(0, proposed - expected)
    const confidence = source.length >= 20 ? 'Strong' : source.length >= 5 ? 'Moderate' : source.length ? 'Limited' : 'Insufficient'
    return { realization, expected, gap, observations: source.length, confidence, hasHistory: contracted > 0 }
  }, [lane, lanes, carrier, volume])

  return (
    <div className="mt-7 grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
      <section className="rounded-2xl border border-[#dbe2ec] bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf4ff] text-[#1769e0]"><FileText size={18}/></div><h2 className="mt-5 text-lg font-black tracking-[-.025em]">Review a proposed contract</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#66758a]">Compare a proposed commitment with the historical realization already recorded in this workspace.</p></div>
          <ShieldCheck size={18} className="text-[#8490a0]"/>
        </div>
        {lanes.length ? <div className="mt-7 space-y-5">
          <label className="block"><span className="text-[11px] font-bold uppercase tracking-[.12em] text-[#8490a0]">Lane</span><select value={laneId} onChange={e=>setLaneId(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#cbd6e5] bg-white px-3 text-sm font-semibold outline-none focus:border-[#1769e0]">{lanes.map(l=><option key={l.id} value={l.id}>{l.origin} → {l.destination} · {l.mode}</option>)}</select></label>
          <label className="block"><span className="text-[11px] font-bold uppercase tracking-[.12em] text-[#8490a0]">Carrier (optional)</span><select value={carrier} onChange={e=>setCarrier(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#cbd6e5] bg-white px-3 text-sm font-semibold outline-none focus:border-[#1769e0]"><option value="">Use lane history</option>{carrierOptions.map(name=><option key={name} value={name}>{name}</option>)}</select></label>
          <label className="block"><span className="text-[11px] font-bold uppercase tracking-[.12em] text-[#8490a0]">Proposed annual volume</span><input value={volume} onChange={e=>setVolume(e.target.value.replace(/[^0-9]/g,''))} inputMode="numeric" className="mt-2 h-11 w-full rounded-xl border border-[#cbd6e5] bg-white px-3 text-sm font-semibold outline-none focus:border-[#1769e0]" /></label>
        </div> : <div className="mt-7 rounded-xl border border-dashed border-[#cbd6e5] p-8 text-center text-sm text-[#66758a]">Connect lane history before reviewing a proposal.</div>}
      </section>

      <section className="rounded-2xl border border-[#dbe2ec] bg-[#08111f] p-6 text-white">
        <div className="flex items-center justify-between"><div><div className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#8fb8ff]">Historical benchmark</div><h2 className="mt-2 text-lg font-black">Contract evidence</h2></div><BarChart3 size={19} className="text-[#8fb8ff]"/></div>
        {analysis ? analysis.hasHistory ? <div className="mt-7 space-y-5">
          <div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-white/10 bg-white/5 p-4"><div className="text-[10px] uppercase tracking-[.12em] text-white/50">Historical realization</div><div className="mt-2 text-3xl font-black">{analysis.realization.toFixed(1)}%</div></div><div className="rounded-xl border border-white/10 bg-white/5 p-4"><div className="text-[10px] uppercase tracking-[.12em] text-white/50">Observations</div><div className="mt-2 text-3xl font-black">{analysis.observations}</div></div></div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4"><div className="flex items-center justify-between text-xs"><span className="text-white/60">Proposed volume</span><strong>{Number(volume || 0).toLocaleString()}</strong></div><div className="mt-3 flex items-center justify-between text-xs"><span className="text-white/60">Historical expected realization</span><strong>{Math.round(analysis.expected).toLocaleString()}</strong></div><div className="mt-3 flex items-center justify-between text-xs"><span className="text-white/60">Historical gap benchmark</span><strong>{Math.round(analysis.gap).toLocaleString()}</strong></div></div>
          <div className="border-t border-white/10 pt-5"><div className="text-[10px] uppercase tracking-[.12em] text-white/40">Evidence coverage</div><div className="mt-2 text-sm font-bold">{analysis.confidence} historical coverage</div><p className="mt-2 text-xs leading-5 text-white/55">This is a historical benchmark, not a guaranteed outcome. More observations and broader history improve the basis for review.</p></div>
        </div> : <div className="mt-10 text-sm text-white/60">Not enough realized volume is available for this lane yet.</div> : <div className="mt-10 text-sm text-white/60">Select a lane to review its historical evidence.</div>}
        <div className="mt-6 flex items-center gap-2 text-xs font-bold text-[#8fb8ff]">Use evidence to structure the contract review <ArrowRight size={13}/></div>
      </section>
    </div>
  )
}
