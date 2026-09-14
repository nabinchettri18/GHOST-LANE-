import { AppShell } from '@/components/app-shell'
import { MLRiskPanel } from '@/components/ml-risk-panel'
import { createClient } from '@/lib/supabase/server'
import { laneMetrics, type LaneRecord } from '@/lib/data/analytics'
import Link from 'next/link'

export default async function Risk() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('lanes').select('id, origin, destination, mode, contracted_volume, materialized_volume, carrier, risk_score').order('risk_score', { ascending: false }).limit(200)
  const lanes = (data ?? []) as LaneRecord[]
  const scored = lanes.map(lane => ({ lane, ...laneMetrics(lane) })).sort((a,b) => b.risk - a.risk)
  return <AppShell><main className="min-h-screen bg-[#f7f9fc] px-5 py-8 text-[#08111f] sm:px-8 sm:py-10"><div className="mx-auto max-w-[1480px]"><div className="flex flex-col gap-4 border-b border-[#dbe2ec] pb-7 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#1769e0]">Analysis</p><h1 className="mt-2 text-3xl font-black tracking-[-.04em]">Lane risk</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#66758a]">Separate current lane exposure from the supervised model. Historical lane metrics stay visible as evidence; ML predictions are trained only from completed contract outcomes in this workspace.</p></div><Link href="/import" className="rounded-xl bg-[#1769e0] px-4 py-2.5 text-xs font-bold text-white">Update data</Link></div>

<section className="mt-7 overflow-hidden rounded-2xl border border-[#dbe2ec] bg-white"><div className="grid grid-cols-2 border-b border-[#edf0f5] md:grid-cols-4"><div className="p-5"><div className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8490a0]">Lanes assessed</div><div className="mt-2 text-2xl font-black">{lanes.length}</div></div><div className="p-5"><div className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8490a0]">High risk</div><div className="mt-2 text-2xl font-black">{scored.filter(x=>x.risk>=70).length}</div></div><div className="p-5"><div className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8490a0]">Average risk</div><div className="mt-2 text-2xl font-black">{scored.length ? (scored.reduce((s,x)=>s+x.risk,0)/scored.length).toFixed(0) : '0'}</div></div><div className="p-5"><div className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8490a0]">Data basis</div><div className="mt-2 text-sm font-black">Connected records</div></div></div>{scored.length ? <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-xs"><thead className="bg-[#fafbfd] text-[10px] uppercase tracking-[.12em] text-[#8490a0]"><tr><th className="px-5 py-3">Lane</th><th className="px-5 py-3">Mode</th><th className="px-5 py-3">Realization</th><th className="px-5 py-3">Ghost capacity</th><th className="px-5 py-3">Risk</th><th className="px-5 py-3">Signal</th></tr></thead><tbody>{scored.map(x=><tr key={x.lane.id} className="border-t border-[#edf0f5]"><td className="px-5 py-4 font-bold">{x.lane.origin} → {x.lane.destination}</td><td className="px-5 py-4">{x.lane.mode}</td><td className="px-5 py-4">{x.realization.toFixed(1)}%</td><td className="px-5 py-4">{x.ghost.toLocaleString()}</td><td className="px-5 py-4 font-bold">{x.risk.toFixed(0)}</td><td className="px-5 py-4 text-[#66758a]">{x.risk>=70?'Requires review':x.risk>=40?'Watch':'Stable'}</td></tr>)}</tbody></table></div> : <div className="px-5 py-20 text-center text-sm text-[#66758a]">Import lane or contract/shipment data to calculate risk.</div>}</section>

<MLRiskPanel />
</div></main></AppShell>
}
