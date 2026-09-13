import Link from 'next/link'
import { ArrowRight, BarChart3, CircleAlert, FileText, LayoutDashboard, LogOut, Map, PackageSearch, Settings, Truck, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

const nav = [
  ['Overview', '/', LayoutDashboard],
  ['Lanes', '/lanes', Map],
  ['Contracts', '/contracts', FileText],
  ['Shipments', '/shipments', PackageSearch],
  ['Carriers', '/carriers', Truck],
  ['Risk Analysis', '/risk', CircleAlert],
  ['Scenarios', '/scenarios', BarChart3],
] as const

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: lanes }, { data: profile }] = await Promise.all([
    supabase.from('lanes').select('id, origin, destination, mode, distance_km, contracted_volume, materialized_volume, carrier, risk_score').order('risk_score', { ascending: false }).limit(50),
    supabase.from('profiles').select('full_name, company_name, role').eq('id', user.id).maybeSingle(),
  ])

  const rows = lanes ?? []
  const contracted = rows.reduce((sum, lane) => sum + (lane.contracted_volume ?? 0), 0)
  const materialized = rows.reduce((sum, lane) => sum + (lane.materialized_volume ?? 0), 0)
  const ghost = Math.max(contracted - materialized, 0)
  const realization = contracted ? (materialized / contracted) * 100 : 0
  const highRisk = rows.filter((lane) => Number(lane.risk_score ?? 0) >= 70).length

  async function signOut() {
    'use server'
    const client = await createClient()
    await client.auth.signOut()
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-[#08111f]">
      <header className="sticky top-0 z-40 border-b border-[#dbe2ec] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1480px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1769e0] text-sm font-extrabold text-white">G</div>
              <div><div className="text-[18px] font-extrabold tracking-[-0.045em]">GhostLane</div><div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#7b8797]">Procurement intelligence</div></div>
            </Link>
            <nav className="hidden items-center gap-6 lg:flex">
              {nav.slice(0, 4).map(([name, href]) => <Link key={href} href={href} className="text-sm font-semibold text-[#526174] hover:text-[#1769e0]">{name}</Link>)}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/data-sources" className="hidden rounded-xl border border-[#cbd6e5] px-3 py-2 text-xs font-bold text-[#526174] hover:bg-[#f5f8fc] sm:inline-flex">Data sources</Link>
            <Link href="/settings" aria-label="Settings" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d5dfeb] text-[#526174] hover:bg-[#f4f8ff]"><Settings size={17}/></Link>
            <div className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-[#08111f] px-3 text-xs font-bold text-white">{(profile?.full_name || user.email || 'U').slice(0,2).toUpperCase()}</div>
            <form action={signOut}><button aria-label="Sign out" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d5dfeb] text-[#526174] hover:bg-[#fff4f4] hover:text-[#b13b3b]"><LogOut size={17}/></button></form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1480px] px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#1769e0]">Network overview</div>
            <h1 className="text-4xl font-black tracking-[-0.055em] sm:text-6xl">See where capacity disappears.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#66758a] sm:text-base">Your operational network, calculated from data stored in GhostLane.</p>
          </div>
          <Link href="/import" className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#1769e0] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#0f57bd]"><Upload size={15}/>Import data</Link>
        </div>

        {rows.length === 0 ? (
          <section className="mt-8 rounded-2xl border border-[#dbe2ec] bg-white p-10 text-center sm:p-16">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf4ff] text-[#1769e0]"><Upload size={21}/></div>
            <h2 className="mt-5 text-xl font-extrabold tracking-tight">Connect your operational data</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#66758a]">GhostLane has no fabricated records. Import contracts and shipment data to calculate lane realization, ghost capacity and risk from your own data.</p>
            <Link href="/import" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#1769e0] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#0f57bd]">Import your first dataset <ArrowRight size={14}/></Link>
          </section>
        ) : (
          <>
            <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[["Contracted capacity", contracted.toLocaleString(), 'loads'], ["Materialized capacity", materialized.toLocaleString(), 'loads'], ["Ghost capacity", ghost.toLocaleString(), 'loads'], ["Realization rate", `${realization.toFixed(1)}%`, 'network']].map(([label,value,unit]) => <div key={label} className="rounded-2xl border border-[#dbe2ec] bg-white p-5"><div className="text-xs font-semibold text-[#6b788a]">{label}</div><div className="mt-3 flex items-end justify-between"><div className="text-3xl font-black tracking-[-0.04em]">{value}</div><div className="pb-1 text-[11px] text-[#8995a4]">{unit}</div></div></div>)}
            </section>

            <section className="mt-7 grid gap-6 xl:grid-cols-[1.4fr_.6fr]">
              <div className="rounded-2xl border border-[#dbe2ec] bg-white p-6">
                <div className="flex items-start justify-between"><div><h2 className="text-sm font-extrabold">Lane performance</h2><p className="mt-1 text-xs text-[#7c8797]">Highest-risk lanes from your stored records</p></div><Link href="/lanes" className="text-xs font-bold text-[#1769e0]">View all</Link></div>
                <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-xs"><thead className="border-b border-[#e5eaf1] text-[10px] uppercase tracking-[.12em] text-[#8490a0]"><tr><th className="pb-3">Lane</th><th className="pb-3">Mode</th><th className="pb-3">Contracted</th><th className="pb-3">Actual</th><th className="pb-3">Realization</th><th className="pb-3">Risk</th></tr></thead><tbody>{rows.slice(0,8).map((lane) => { const r = lane.contracted_volume ? (lane.materialized_volume / lane.contracted_volume) * 100 : 0; const risk = Number(lane.risk_score ?? 0); return <tr key={lane.id} className="border-b border-[#eef1f5]"><td className="py-3 font-bold">{lane.origin} → {lane.destination}</td><td className="py-3 text-[#66758a]">{lane.mode}</td><td className="py-3">{lane.contracted_volume ?? 0}</td><td className="py-3">{lane.materialized_volume ?? 0}</td><td className="py-3 font-bold">{r.toFixed(1)}%</td><td className="py-3"><span className={risk >= 70 ? 'font-bold text-[#b13b3b]' : risk >= 40 ? 'font-bold text-[#9a6817]' : 'font-bold text-[#187650]'}>{risk.toFixed(0)}</span></td></tr>})}</tbody></table></div>
              </div>
              <div className="rounded-2xl border border-[#dbe2ec] bg-white p-6"><h2 className="text-sm font-extrabold">Network status</h2><div className="mt-6 space-y-5"><div><div className="flex justify-between text-xs font-bold"><span>Tracked lanes</span><span>{rows.length}</span></div><div className="mt-2 h-2 rounded-full bg-[#eef2f7]"><div className="h-2 rounded-full bg-[#1769e0]" style={{width:'100%'}}/></div></div><div><div className="flex justify-between text-xs font-bold"><span>High-risk lanes</span><span>{highRisk}</span></div><div className="mt-2 h-2 rounded-full bg-[#eef2f7]"><div className="h-2 rounded-full bg-[#c24141]" style={{width:`${rows.length ? Math.min(100, highRisk / rows.length * 100) : 0}%`}}/></div></div></div><Link href="/risk" className="mt-8 inline-flex items-center gap-2 text-xs font-bold text-[#1769e0]">Open risk analysis <ArrowRight size={14}/></Link></div>
            </section>
          </>
        )}

        <footer className="mt-10 border-t border-[#dbe2ec] pt-5 text-xs text-[#8490a0]">{profile?.company_name || 'GhostLane workspace'} · {profile?.role || 'Workspace member'} · Data is sourced from your connected workspace.</footer>
      </div>
    </main>
  )
}
