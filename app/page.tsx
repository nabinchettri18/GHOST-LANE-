import Link from 'next/link'
import { ArrowRight, BarChart3, ShieldCheck, Route, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/app-shell'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] text-[#08111f]">
        <header className="border-b border-[#dbe2ec] bg-white">
          <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
            <Link href="/" className="flex items-center gap-3" aria-label="GhostLane home">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1769e0] text-sm font-extrabold text-white">G</span>
              <span className="text-lg font-extrabold tracking-tight">GhostLane</span>
            </Link>
            <nav className="flex items-center gap-2">
              <Link href="/login" className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#526174] hover:bg-[#f3f6fa]">Sign in</Link>
              <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-[#1769e0] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0f57bd]">Create account <ArrowRight size={15}/></Link>
            </nav>
          </div>
        </header>

        <section className="border-b border-[#dbe2ec] bg-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:py-28">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#1769e0]">Logistics operations intelligence</p>
              <h1 className="mt-5 max-w-3xl text-5xl font-black leading-[.98] tracking-[-0.055em] sm:text-7xl">Find the capacity your network is not using.</h1>
              <p className="mt-7 max-w-2xl text-base leading-7 text-[#5d6b7d] sm:text-lg">GhostLane brings contracted capacity, shipment activity and lane performance into one operational workspace so teams can see where planned capacity fails to materialize.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/signup" className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#1769e0] px-5 text-sm font-bold text-white hover:bg-[#0f57bd]">Create your workspace <ArrowRight size={16}/></Link>
                <Link href="/login" className="inline-flex h-12 items-center rounded-xl border border-[#cbd6e5] bg-white px-5 text-sm font-bold text-[#526174] hover:bg-[#f5f8fc]">Sign in</Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-[#7a8797]"><span className="inline-flex items-center gap-2"><CheckCircle2 size={14}/> Workspace-level access control</span><span className="inline-flex items-center gap-2"><CheckCircle2 size={14}/> Your data stays in your workspace</span></div>
            </div>
            <div className="rounded-3xl border border-[#dbe2ec] bg-[#f8fafc] p-4 shadow-[0_20px_60px_rgba(8,17,31,0.06)] sm:p-6">
              <div className="rounded-2xl border border-[#dbe2ec] bg-white p-5">
                <div className="flex items-center justify-between border-b border-[#edf0f5] pb-4"><div><div className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#1769e0]">Network overview</div><div className="mt-1 text-sm font-extrabold">Capacity utilization</div></div><div className="h-9 w-9 rounded-lg bg-[#edf4ff]"/></div>
                <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl border border-[#edf0f5] p-4"><div className="text-[11px] text-[#7b8797]">Contracted</div><div className="mt-2 text-2xl font-black">—</div></div><div className="rounded-xl border border-[#edf0f5] p-4"><div className="text-[11px] text-[#7b8797]">Materialized</div><div className="mt-2 text-2xl font-black">—</div></div></div>
                <div className="mt-3 rounded-xl border border-[#edf0f5] p-4"><div className="flex items-center justify-between text-[11px] font-bold"><span>Lane realization</span><span className="text-[#1769e0]">Awaiting data</span></div><div className="mt-3 h-2 rounded-full bg-[#edf2f7]"><div className="h-2 w-1/3 rounded-full bg-[#1769e0]"/></div></div>
                <p className="mt-4 text-[11px] leading-5 text-[#8490a0]">This preview contains no operational records. Your workspace is populated only after you connect your data.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="max-w-2xl"><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#1769e0]">Built for operations teams</p><h2 className="mt-3 text-3xl font-black tracking-[-.04em] sm:text-4xl">One workspace for the operational questions that matter.</h2></div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[[Route,'Lane visibility','See contracted and materialized volume together and identify lanes that consistently under-deliver.'],[BarChart3,'Performance analysis','Turn connected records into realization, ghost-capacity and risk metrics without maintaining separate spreadsheets.'],[ShieldCheck,'Controlled access','Keep operational data isolated by organization with authenticated access and database-level policies.']].map(([Icon,title,copy])=>{const I=Icon as typeof Route;return <article key={String(title)} className="rounded-2xl border border-[#dbe2ec] bg-white p-6"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf4ff] text-[#1769e0]"><I size={19}/></div><h3 className="mt-5 text-sm font-extrabold">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-[#66758a]">{String(copy)}</p></article>})}
          </div>
        </section>
        <footer className="border-t border-[#dbe2ec] bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-xs text-[#8490a0] sm:flex-row sm:items-center sm:justify-between sm:px-8"><span>GhostLane</span><div className="flex gap-5"><Link href="/login" className="hover:text-[#1769e0]">Sign in</Link><Link href="/signup" className="hover:text-[#1769e0]">Create account</Link></div></div></footer>
      </main>
    )
  }

  return <AuthenticatedHome userId={user.id} email={user.email} />
}

async function AuthenticatedHome({ userId, email }: { userId: string; email?: string }) {
  const supabase = await createClient()
  const [{ data: lanes }, { data: profile }] = await Promise.all([
    supabase.from('lanes').select('id, origin, destination, mode, distance_km, contracted_volume, materialized_volume, carrier, risk_score').order('risk_score', { ascending: false }).limit(50),
    supabase.from('profiles').select('full_name, company_name, role').eq('id', userId).maybeSingle(),
  ])
  const rows = lanes ?? []
  const contracted = rows.reduce((sum, lane) => sum + (lane.contracted_volume ?? 0), 0)
  const materialized = rows.reduce((sum, lane) => sum + (lane.materialized_volume ?? 0), 0)
  const ghost = Math.max(contracted - materialized, 0)
  const realization = contracted ? (materialized / contracted) * 100 : 0
  const highRisk = rows.filter((lane) => Number(lane.risk_score ?? 0) >= 70).length
  async function signOut() { 'use server'; const client = await createClient(); await client.auth.signOut() }
  return <AppShell><main className="min-h-screen bg-[#f7f9fc] text-[#08111f]"><header className="sticky top-0 z-40 border-b border-[#dbe2ec] bg-white/95 backdrop-blur-xl"><div className="mx-auto flex h-[72px] max-w-[1480px] items-center justify-end gap-2 px-5 pl-20 sm:px-8 sm:pl-24"><Link href="/data-sources" className="hidden rounded-xl border border-[#cbd6e5] px-3 py-2 text-xs font-bold text-[#526174] hover:bg-[#f5f8fc] sm:inline-flex">Data sources</Link><Link href="/settings" aria-label="Settings" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d5dfeb] text-[#526174]"><span>⚙</span></Link><div className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-[#08111f] px-3 text-xs font-bold text-white">{(profile?.full_name || email || 'U').slice(0,2).toUpperCase()}</div><form action={signOut}><button aria-label="Sign out" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d5dfeb] text-[#526174]">↪</button></form></div></header><div className="mx-auto max-w-[1480px] px-5 py-8 sm:px-8 sm:py-10"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#1769e0]">Network overview</div><h1 className="text-4xl font-black tracking-[-0.055em] sm:text-6xl">See where capacity disappears.</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-[#66758a] sm:text-base">Your operational network, calculated from data stored in GhostLane.</p></div><Link href="/import" className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#1769e0] px-4 py-2.5 text-xs font-bold text-white"><span>↑</span>Import data</Link></div>{rows.length===0?<section className="mt-8 rounded-2xl border border-[#dbe2ec] bg-white p-10 text-center sm:p-16"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf4ff] text-[#1769e0]">↑</div><h2 className="mt-5 text-xl font-extrabold">Connect your operational data</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#66758a]">GhostLane has no fabricated records. Import contracts and shipment data to calculate lane realization, ghost capacity and risk from your own data.</p><Link href="/import" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#1769e0] px-4 py-2.5 text-xs font-bold text-white">Import your first dataset <ArrowRight size={14}/></Link></section>:<section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Contracted capacity",contracted.toLocaleString(),'loads'],['Materialized capacity',materialized.toLocaleString(),'loads'],['Ghost capacity',ghost.toLocaleString(),'loads'],['Realization rate',`${realization.toFixed(1)}%`,'network']].map(([l,v,u])=><div key={l} className="rounded-2xl border border-[#dbe2ec] bg-white p-5"><div className="text-xs font-semibold text-[#6b788a]">{l}</div><div className="mt-3 flex items-end justify-between"><div className="text-3xl font-black">{v}</div><div className="pb-1 text-[11px] text-[#8995a4]">{u}</div></div></div>)}</section>}<footer className="mt-10 border-t border-[#dbe2ec] pt-5 text-xs text-[#8490a0]">{profile?.company_name || 'GhostLane workspace'} · {profile?.role || 'Workspace member'}</footer></div></main></AppShell>
}