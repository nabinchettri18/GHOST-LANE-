'use client'

import { useState } from 'react'
import { CloudRain, Gauge, Loader2, MapPin, Route, Wind } from 'lucide-react'

type Signals = {
  distanceKm: number
  weatherRisk: 'Low' | 'Medium' | 'High'
  originWeather: { temperatureC:number|null; precipitationMm:number|null; precipitationProbability:number|null; windKph:number|null; visibilityM:number|null }
  destinationWeather: { temperatureC:number|null; precipitationMm:number|null; precipitationProbability:number|null; windKph:number|null; visibilityM:number|null }
  origin: { name:string; country?:string }
  destination: { name:string; country?:string }
}

export function PublicLaneSignals() {
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [signals, setSignals] = useState<Signals | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    if (!origin.trim() || !destination.trim()) return
    setLoading(true); setError('')
    try {
      const response = await fetch(`/api/public-data/lane?origin=${encodeURIComponent(origin.trim())}&destination=${encodeURIComponent(destination.trim())}`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Unable to load public signals')
      setSignals(body.signals)
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load public signals') }
    finally { setLoading(false) }
  }

  const weather = (label: string, w: Signals['originWeather']) => (
    <div className="rounded-xl border border-[#edf0f5] p-4">
      <div className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#8490a0]">{label}</div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div><span className="text-[#8490a0]">Temp</span><div className="mt-1 font-black">{w.temperatureC ?? '—'}°C</div></div>
        <div><span className="text-[#8490a0]">Rain</span><div className="mt-1 font-black">{w.precipitationMm ?? '—'} mm</div></div>
        <div><span className="text-[#8490a0]">Rain chance</span><div className="mt-1 font-black">{w.precipitationProbability ?? '—'}%</div></div>
        <div><span className="text-[#8490a0]">Wind</span><div className="mt-1 font-black">{w.windKph ?? '—'} km/h</div></div>
      </div>
    </div>
  )

  return <section className="mt-5 rounded-2xl border border-[#dbe2ec] bg-white p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><div className="flex items-center gap-2 text-xs font-bold"><Route size={15} className="text-[#1769e0]"/> Public lane signals</div><p className="mt-1 text-xs text-[#8490a0]">Add a real lane to enrich it with public weather and distance context. No demo lane is preloaded.</p></div>
      <div className="flex flex-wrap gap-2 text-[10px] font-bold text-[#526174]"><span className="rounded-full bg-[#f3f7fc] px-2.5 py-1">Open-Meteo</span><span className="rounded-full bg-[#f3f7fc] px-2.5 py-1">Global</span><span className="rounded-full bg-[#f3f7fc] px-2.5 py-1">Cached 15 min</span></div>
    </div>
    <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
      <label className="text-[10px] font-bold uppercase tracking-[.1em] text-[#8490a0]">Origin<input placeholder="e.g. Ludhiana, India" value={origin} onChange={e=>setOrigin(e.target.value)} className="mt-2 h-10 w-full rounded-xl border border-[#dbe2ec] px-3 text-sm font-semibold normal-case tracking-normal outline-none focus:border-[#1769e0]"/></label>
      <label className="text-[10px] font-bold uppercase tracking-[.1em] text-[#8490a0]">Destination<input placeholder="e.g. Delhi, India" value={destination} onChange={e=>setDestination(e.target.value)} className="mt-2 h-10 w-full rounded-xl border border-[#dbe2ec] px-3 text-sm font-semibold normal-case tracking-normal outline-none focus:border-[#1769e0]"/></label>
      <button onClick={run} disabled={loading || !origin.trim() || !destination.trim()} className="h-10 rounded-xl bg-[#08111f] px-5 text-xs font-bold text-white disabled:opacity-50">{loading ? <Loader2 className="animate-spin" size={15}/> : 'Analyze lane'}</button>
    </div>
    {error && <div className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div>}
    {signals && <div className="mt-5">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl bg-[#f7f9fc] p-4"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.1em] text-[#8490a0]"><MapPin size={13}/> Distance</div><div className="mt-2 text-xl font-black">{signals.distanceKm.toLocaleString()} km</div></div>
        <div className="rounded-xl bg-[#f7f9fc] p-4"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.1em] text-[#8490a0]"><Gauge size={13}/> Weather risk</div><div className="mt-2 text-xl font-black">{signals.weatherRisk}</div></div>
        <div className="rounded-xl bg-[#f7f9fc] p-4"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.1em] text-[#8490a0]"><CloudRain size={13}/> Rain signal</div><div className="mt-2 text-xl font-black">{Math.max(signals.originWeather.precipitationProbability ?? 0, signals.destinationWeather.precipitationProbability ?? 0)}%</div></div>
        <div className="rounded-xl bg-[#f7f9fc] p-4"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.1em] text-[#8490a0]"><Wind size={13}/> Max wind</div><div className="mt-2 text-xl font-black">{Math.max(signals.originWeather.windKph ?? 0, signals.destinationWeather.windKph ?? 0)} km/h</div></div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">{weather(signals.origin.name, signals.originWeather)}{weather(signals.destination.name, signals.destinationWeather)}</div>
      <p className="mt-3 text-[10px] text-[#8490a0]">Public context is advisory. Contractual or regulated decisions should use authorized government/commercial feeds supplied by the operator.</p>
    </div>}
  </section>
}
