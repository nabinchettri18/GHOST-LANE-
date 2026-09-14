'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, BrainCircuit, CheckCircle2, CircleAlert, MapPinned, RotateCcw, ShieldCheck, SlidersHorizontal, Truck, X } from 'lucide-react'

type Lane = {
  id: string
  origin: string
  destination: string
  mode: string
  carrier: string | null
  contracted_volume: number | null
  materialized_volume: number | null
  risk_score: number | null
  distance_km: number | null
}

type Carrier = {
  name: string
  acceptance_rate: number
  rejection_rate: number
  cancellation_rate: number
  realization_rate: number | null
}

type Props = { lanes: Lane[]; carriers: Carrier[] }

const clamp = (n: number) => Math.max(0, Math.min(100, n))
const pct = (n: number) => `${Math.round(clamp(n))}%`
const num = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.max(0, n))
const riskTone = (n: number) => n >= 70 ? 'high' : n >= 45 ? 'medium' : 'low'

function riskReason(lane: Lane, carrier?: Carrier) {
  const reasons: string[] = []
  const contracted = Number(lane.contracted_volume || 0)
  const moved = Number(lane.materialized_volume || 0)
  const realization = contracted ? moved / contracted * 100 : 0
  if (realization < 65) reasons.push('historical movement is below contracted capacity')
  if (!carrier && lane.carrier) reasons.push('carrier reliability evidence is unavailable')
  if (carrier && Number(carrier.cancellation_rate || 0) > 10) reasons.push('carrier cancellation rate is elevated')
  if (carrier && Number(carrier.acceptance_rate || 0) < 80) reasons.push('carrier acceptance rate is below the preferred threshold')
  if (!lane.carrier) reasons.push('no carrier is currently assigned')
  if (!lane.materialized_volume && lane.contracted_volume) reasons.push('there is no realized movement recorded yet')
  if (!reasons.length) reasons.push('current lane history is relatively consistent with the commitment')
  return reasons.slice(0, 3)
}

export function DecisionSimulator({ lanes, carriers }: Props) {
  const [laneId, setLaneId] = useState(lanes[0]?.id || '')
  const [demandChange, setDemandChange] = useState(0)
  const [carrierChange, setCarrierChange] = useState('current')
  const [routeChange, setRouteChange] = useState('current')
  const [vehicleChange, setVehicleChange] = useState('current')
  const [tab, setTab] = useState<'simulator' | 'heatmap'>('simulator')
  const [saved, setSaved] = useState(false)

  const lane = lanes.find(l => l.id === laneId) || lanes[0]
  const carrier = carriers.find(c => c.name === lane?.carrier)

  const result = useMemo(() => {
    if (!lane) return null
    const base = clamp(Number(lane.risk_score || 0))
    const contracted = Number(lane.contracted_volume || 0)
    const moved = Number(lane.materialized_volume || 0)
    const realization = contracted ? moved / contracted * 100 : 0

    let risk = base
    const changes: string[] = []
    if (demandChange < 0) { risk += Math.abs(demandChange) * 0.45; changes.push('lower demand increases unused-capacity risk') }
    if (demandChange > 0) { risk -= demandChange * 0.25; changes.push('higher demand improves capacity utilization') }
    if (carrierChange === 'reliable') { risk -= 18; changes.push('switching to a stronger carrier lowers commitment risk') }
    if (carrierChange === 'alternate') { risk -= 8; changes.push('alternate carrier provides a moderate risk reduction') }
    if (routeChange === 'alternate') { risk -= 7; changes.push('alternate route reduces execution friction') }
    if (routeChange === 'faster') { risk -= 10; changes.push('faster route improves ETA resilience') }
    if (vehicleChange === 'smaller') { risk -= 5; changes.push('smaller vehicle reduces over-commitment') }
    if (vehicleChange === 'larger') { risk += 6; changes.push('larger vehicle increases unused-capacity exposure') }
    risk = clamp(risk)

    const projectedDemand = Math.max(0, moved * (1 + demandChange / 100))
    const projectedRealization = contracted ? projectedDemand / contracted * 100 : 0
    const delta = base - risk
    const decision = risk >= 70 ? 'Do not commit yet' : risk >= 45 ? 'Review / hybrid commitment' : 'Commit with confidence'
    return { base, risk, contracted, moved, realization, projectedDemand, projectedRealization, delta, decision, changes }
  }, [lane, demandChange, carrierChange, routeChange, vehicleChange])

  if (!lane) return <EmptyState />

  return <main className="min-h-[calc(100vh-64px)] bg-[#f6f8fb] px-4 py-7 text-[#08111f] sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[1480px]">
      <div className="flex flex-col gap-5 border-b border-[#dbe2ec] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[.18em] text-[#1769e0]">Decision intelligence</div>
          <h1 className="mt-2 text-3xl font-black tracking-[-.05em] sm:text-4xl">What should we commit to?</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66758a]">Change the demand, carrier, route or vehicle assumptions and GhostLane recalculates the pre-commitment risk. No fake demo records are used.</p>
        </div>
        <div className="flex rounded-xl border border-[#dbe2ec] bg-white p-1">
          <button onClick={() => setTab('simulator')} className={`rounded-lg px-3 py-2 text-[10px] font-black ${tab === 'simulator' ? 'bg-[#08111f] text-white' : 'text-[#657386]'}`}>What-if simulator</button>
          <button onClick={() => setTab('heatmap')} className={`rounded-lg px-3 py-2 text-[10px] font-black ${tab === 'heatmap' ? 'bg-[#08111f] text-white' : 'text-[#657386]'}`}>Risk heatmap</button>
        </div>
      </div>

      {tab === 'simulator' ? <>
        <section className="mt-6 grid gap-5 xl:grid-cols-[.78fr_1.22fr]">
          <aside className="rounded-3xl border border-[#dbe2ec] bg-white p-5">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.15em] text-[#8490a0]"><SlidersHorizontal size={14}/> Scenario controls</div>
            <label className="mt-6 block text-[10px] font-black uppercase tracking-[.1em] text-[#657386]">Lane</label>
            <select value={lane.id} onChange={e => setLaneId(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#dbe2ec] bg-white px-3 text-xs font-bold outline-none focus:border-[#1769e0]">
              {lanes.map(l => <option key={l.id} value={l.id}>{l.origin} → {l.destination}</option>)}
            </select>

            <label className="mt-6 block text-[10px] font-black uppercase tracking-[.1em] text-[#657386]">Demand change <span className="float-right text-[#1769e0]">{demandChange > 0 ? '+' : ''}{demandChange}%</span></label>
            <input type="range" min={-50} max={50} step={5} value={demandChange} onChange={e => setDemandChange(Number(e.target.value))} className="mt-4 w-full accent-[#1769e0]" />
            <div className="mt-1 flex justify-between text-[9px] text-[#9aa4b1]"><span>-50%</span><span>Baseline</span><span>+50%</span></div>

            <Control label="Carrier" value={carrierChange} setValue={setCarrierChange} options={[['current','Keep current'],['alternate','Alternate carrier'],['reliable','Higher-reliability carrier']]} />
            <Control label="Route" value={routeChange} setValue={setRouteChange} options={[['current','Current route'],['alternate','Alternate route'],['faster','Faster ETA route']]} />
            <Control label="Vehicle" value={vehicleChange} setValue={setVehicleChange} options={[['current','Current vehicle'],['smaller','Smaller capacity'],['larger','Larger capacity']]} />
            <button onClick={() => { setDemandChange(0); setCarrierChange('current'); setRouteChange('current'); setVehicleChange('current') }} className="mt-6 inline-flex items-center gap-2 text-[10px] font-black text-[#657386] hover:text-[#08111f]"><RotateCcw size={13}/> Reset scenario</button>
          </aside>

          <section className="rounded-3xl border border-[#dbe2ec] bg-white p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div><div className="text-[9px] font-black uppercase tracking-[.15em] text-[#8490a0]">Simulation result</div><h2 className="mt-2 text-xl font-black">{lane.origin} <span className="text-[#b5bdc8]">→</span> {lane.destination}</h2><div className="mt-1 text-[10px] text-[#8994a3]">{lane.carrier || 'No carrier assigned'} · {lane.mode}</div></div>
              <span className={`rounded-full px-3 py-1.5 text-[9px] font-black ${result!.risk >= 70 ? 'bg-[#fff0f0] text-[#b54747]' : result!.risk >= 45 ? 'bg-[#fff8e7] text-[#9b6a00]' : 'bg-[#eef9f4] text-[#23825b]'}`}>{result!.decision}</span>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <Metric label="Current ghost risk" value={pct(result!.base)} />
              <Metric label="Simulated risk" value={pct(result!.risk)} emphasis />
              <Metric label="Risk change" value={`${result!.delta >= 0 ? '-' : '+'}${Math.abs(Math.round(result!.delta))} pts`} />
            </div>

            <div className="mt-6 rounded-2xl bg-[#f7f9fc] p-5">
              <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[.12em] text-[#657386]">Risk movement</span><span className="text-[10px] font-black text-[#1769e0]">{result!.delta >= 0 ? 'Improved' : 'Worsened'}</span></div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#e5eaf0]"><div className="h-full rounded-full bg-[#1769e0]" style={{ width: `${result!.risk}%` }}/></div>
              <div className="mt-2 flex justify-between text-[9px] text-[#9aa4b1]"><span>0 · Safe</span><span>45 · Review</span><span>70 · High risk</span><span>100</span></div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#e4e9ef] p-4"><div className="text-[9px] font-black uppercase tracking-[.12em] text-[#8490a0]">Projected movement</div><div className="mt-2 text-2xl font-black">{num(result!.projectedDemand)}</div><div className="mt-1 text-[10px] text-[#8994a3]">vs {num(result!.moved)} current realized</div></div>
              <div className="rounded-2xl border border-[#e4e9ef] p-4"><div className="text-[9px] font-black uppercase tracking-[.12em] text-[#8490a0]">Projected realization</div><div className="mt-2 text-2xl font-black">{pct(result!.projectedRealization)}</div><div className="mt-1 text-[10px] text-[#8994a3]">contracted: {num(result!.contracted)}</div></div>
            </div>
          </section>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          <article className="rounded-3xl bg-[#08111f] p-6 text-white">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.16em] text-[#83b4ff]"><BrainCircuit size={14}/> Explainable AI</div>
            <h2 className="mt-4 text-xl font-black">Why is GhostLane saying this?</h2>
            <div className="mt-5 space-y-3">{riskReason(lane, carrier).map((reason, i) => <div key={reason} className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[9px] font-black">{i + 1}</span><p className="text-xs leading-5 text-[#c0cad6]">{reason}</p></div>)}</div>
            <p className="mt-5 text-[9px] leading-4 text-[#8290a1]">The explanation is derived from connected lane and carrier records. Where evidence is missing, GhostLane says so instead of inventing confidence.</p>
          </article>
          <article className="rounded-3xl border border-[#dbe2ec] bg-white p-6">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.16em] text-[#8490a0]"><ShieldCheck size={14}/> Recommended action</div>
            <h2 className="mt-4 text-xl font-black">{result!.decision}</h2>
            <p className="mt-2 text-xs leading-5 text-[#66758a]">GhostLane treats the simulation as a decision aid: review the evidence before procurement and only commit when the lane's expected movement supports the capacity.</p>
            <div className="mt-5 space-y-2">{result!.changes.length ? result!.changes.map(x => <div key={x} className="flex items-start gap-2 text-[11px] font-semibold text-[#4e5d70]"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[#22a06b]"/>{x}</div>) : <div className="text-[11px] font-semibold text-[#66758a]">Baseline scenario — no assumptions changed.</div>}</div>
            <button
              onClick={() => {
                if (!result || !lane) return
                const payload = {
                  laneId: lane.id,
                  lane: `${lane.origin} → ${lane.destination}`,
                  demandChange,
                  carrierChange,
                  routeChange,
                  vehicleChange,
                  baseRisk: result.base,
                  simulatedRisk: result.risk,
                  decision: result.decision,
                  savedAt: new Date().toISOString(),
                }
                try {
                  const existing = JSON.parse(localStorage.getItem('ghostlane_saved_scenarios') || '[]')
                  existing.unshift(payload)
                  localStorage.setItem('ghostlane_saved_scenarios', JSON.stringify(existing.slice(0, 20)))
                } catch (e) {
                  console.warn('LocalStorage save error', e)
                }
                setSaved(true)
                setTimeout(() => setSaved(false), 3000)
              }}
              className={`mt-7 flex w-full items-center justify-between rounded-xl px-4 py-3 text-[10px] font-black text-white transition ${
                saved ? 'bg-[#22a06b]' : 'bg-[#1769e0] hover:bg-[#0f57bd]'
              }`}
            >
              <span>{saved ? '✓ Scenario saved for procurement review' : 'Keep scenario for review'}</span>
              <ArrowRight size={14} />
            </button>
          </article>
        </section>
      </> : <RiskHeatmap lanes={lanes} onSelect={id => { setLaneId(id); setTab('simulator') }} />}
    </div>
  </main>
}

function RiskHeatmap({ lanes, onSelect }: { lanes: Lane[]; onSelect: (id: string) => void }) {
  const sorted = [...lanes].sort((a, b) => Number(b.risk_score || 0) - Number(a.risk_score || 0))
  const high = sorted.filter(l => Number(l.risk_score || 0) >= 70).length
  const medium = sorted.filter(l => Number(l.risk_score || 0) >= 45 && Number(l.risk_score || 0) < 70).length
  const low = sorted.filter(l => Number(l.risk_score || 0) < 45).length
  return <>
    <div className="mt-6 grid gap-3 sm:grid-cols-3"><Kpi label="High risk" value={String(high)} sub="70–100" tone="high"/><Kpi label="Review" value={String(medium)} sub="45–69" tone="medium"/><Kpi label="Safe" value={String(low)} sub="0–44" tone="low"/></div>
    <section className="mt-5 overflow-hidden rounded-3xl border border-[#dbe2ec] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#edf0f5] p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-extrabold">Ghost Risk Heatmap</h2><p className="mt-1 text-[10px] text-[#8994a3]">Every lane is ranked using the risk score already calculated from connected records.</p></div><div className="flex gap-3 text-[9px] font-black"><span className="text-[#23825b]">● Safe</span><span className="text-[#9b6a00]">● Review</span><span className="text-[#b54747]">● High risk</span></div></div>
      <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{sorted.map(l => { const r = clamp(Number(l.risk_score || 0)); const tone = riskTone(r); return <button key={l.id} onClick={() => onSelect(l.id)} className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${tone === 'high' ? 'border-[#f0caca] bg-[#fff8f8]' : tone === 'medium' ? 'border-[#ead9a8] bg-[#fffcf3]' : 'border-[#cfe8db] bg-[#f7fcf9]'}`}><div className="flex items-center justify-between"><span className="text-[10px] font-black">{l.origin} → {l.destination}</span><span className={`h-2.5 w-2.5 rounded-full ${tone === 'high' ? 'bg-[#b54747]' : tone === 'medium' ? 'bg-[#c28a00]' : 'bg-[#23825b]'}`}/></div><div className="mt-4 flex items-end justify-between"><div><div className="text-3xl font-black tracking-[-.05em]">{pct(r)}</div><div className="mt-1 text-[9px] text-[#8994a3]">ghost risk</div></div><div className="text-right text-[9px] text-[#8994a3]">{l.carrier || 'No carrier'}<br/>{num(Number(l.contracted_volume || 0))} contracted</div></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-black/5"><div className={`h-full rounded-full ${tone === 'high' ? 'bg-[#b54747]' : tone === 'medium' ? 'bg-[#c28a00)' : 'bg-[#23825b]'}`} style={{ width: `${r}%` }}/></div></button> })}</div>
      {!lanes.length && <div className="p-10 text-center text-xs text-[#8994a3]">Import lane records to populate the heatmap.</div>}
    </section>
  </>
}

function Control({ label, value, setValue, options }: { label: string; value: string; setValue: (v: string) => void; options: string[][] }) { return <div className="mt-5"><label className="block text-[10px] font-black uppercase tracking-[.1em] text-[#657386]">{label}</label><select value={value} onChange={e => setValue(e.target.value)} className="mt-2 h-10 w-full rounded-xl border border-[#dbe2ec] bg-white px-3 text-[10px] font-bold outline-none focus:border-[#1769e0]">{options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div> }
function Metric({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) { return <div className={`rounded-2xl border p-4 ${emphasis ? 'border-[#bcd6ff] bg-[#f5f9ff]' : 'border-[#e4e9ef]'}`}><div className="text-[9px] font-black uppercase tracking-[.1em] text-[#8490a0]">{label}</div><div className="mt-2 text-2xl font-black">{value}</div></div> }
function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: 'high' | 'medium' | 'low' }) { const c = tone === 'high' ? 'text-[#b54747]' : tone === 'medium' ? 'text-[#9b6a00]' : 'text-[#23825b]'; return <div className="rounded-2xl border border-[#dbe2ec] bg-white p-5"><div className={`text-[9px] font-black uppercase tracking-[.12em] ${c}`}>{label}</div><div className="mt-2 text-3xl font-black">{value}</div><div className="mt-1 text-[10px] font-semibold text-[#9aa4b1]">{sub}</div></div> }
function EmptyState() { return <div className="mx-auto max-w-xl p-10 text-center"><MapPinned className="mx-auto text-[#9aa4b1]"/><h1 className="mt-4 text-xl font-black">No lane data yet</h1><p className="mt-2 text-xs leading-5 text-[#66758a]">Import your lane and shipment records first. GhostLane will use those records to populate the simulator and risk heatmap.</p></div> }
