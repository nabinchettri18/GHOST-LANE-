import Link from 'next/link'
import { ArrowRight, BarChart3, CheckCircle2, Database, Route, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/app-shell'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] text-[#08111f]">
        <header className="sticky top-0 z-50 border-b border-[#dbe2ec] bg-white/95 backdrop-blur-xl">
          <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
            <Link href="/" className="flex items-center gap-3" aria-label="GhostLane home">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1769e0] text-sm font-extrabold text-white">G</span>
              <span className="text-lg font-extrabold tracking-tight">GhostLane</span>
            </Link>
            <nav className="flex items-center gap-1 sm:gap-2" aria-label="Primary navigation">
              <Link href="#how-it-works" className="hidden rounded-xl px-3 py-2.5 text-sm font-semibold text-[#66758a] hover:bg-[#f3f6fa] hover:text-[#08111f] md:inline-flex">How it works</Link>
              <Link href="#security" className="hidden rounded-xl px-3 py-2.5 text-sm font-semibold text-[#66758a] hover:bg-[#f3f6fa] hover:text-[#08111f] md:inline-flex">Security</Link>
              <Link href="/login" className="rounded-xl px-3 py-2.5 text-sm font-bold text-[#526174] hover:bg-[#f3f6fa]">Sign in</Link>
              <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-[#1769e0] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#0f57bd]">Create account <ArrowRight size={15}/></Link>
            </nav>
          </div>
        </header>

        <section className="border-b border-[#dbe2ec] bg-white">
          <div className="mx-auto grid max-w-7xl gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:py-28">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#dbe2ec] bg-[#f8fafc] px-3 py-1.5 text-[11px] font-bold text-[#526174]"><span className="h-1.5 w-1.5 rounded-full bg-[#1769e0]"/> Logistics operations platform</div>
              <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[.96] tracking-[-0.06em] sm:text-7xl">See the capacity your network is leaving behind.</h1>
              <p className="mt-7 max-w-2xl text-base leading-7 text-[#5d6b7d] sm:text-lg">GhostLane brings contracts, shipments, carriers and lane performance into one operational workspace—so procurement teams can see what was planned, what actually moved, and where capacity is being lost.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/signup" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#1769e0] px-5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(23,105,224,0.18)] hover:bg-[#0f57bd]">Create your workspace <ArrowRight size={16}/></Link>
                <Link href="/login" className="inline-flex h-12 items-center justify-center rounded-xl border border-[#cbd6e5] bg-white px-5 text-sm font-bold text-[#526174] hover:bg-[#f5f8fc]">Sign in</Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-[#7a8797]"><span className="inline-flex items-center gap-2"><CheckCircle2 size={14} className="text-[#1769e0]"/> Organization-level access</span><span className="inline-flex items-center gap-2"><CheckCircle2 size={14} className="text-[#1769e0]"/> Data stays in your workspace</span><span className="inline-flex items-center gap-2"><CheckCircle2 size={14} className="text-[#1769e0]"/> No fabricated operational records</span></div>
            </div>

            <div className="rounded-3xl border border-[#dbe2ec] bg-[#f8fafc] p-3 shadow-[0_24px_70px_rgba(8,17,31,0.08)] sm:p-5">
              <div className="overflow-hidden rounded-2xl border border-[#dbe2ec] bg-white">
                <div className="flex items-center justify-between border-b border-[#edf0f5] px-5 py-4"><div><div className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#1769e0]">Network overview</div><div className="mt-1 text-sm font-extrabold">Capacity utilization</div></div><div className="flex items-center gap-2 text-[10px] font-bold text-[#8490a0]"><Database size={13}/> Live workspace</div></div>
                <div className="grid grid-cols-2 gap-3 p-4 sm:p-5"><div className="rounded-xl border border-[#edf0f5] p-4"><div className="text-[11px] font-medium text-[#7b8797]">Contracted</div><div className="mt-2 text-2xl font-black">—</div><div className="mt-1 text-[10px] text-[#9aa4b1]">Connect data to calculate</div></div><div className="rounded-xl border border-[#edf0f5] p-4"><div className="text-[11px] font-medium text-[#7b8797]">Materialized</div><div className="mt-2 text-2xl font-black">—</div><div className="mt-1 text-[10px] text-[#9aa4b1]">Connect data to calculate</div></div></div>
                <div className="mx-4 mb-4 rounded-xl border border-[#edf0f5] p-4 sm:mx-5 sm:mb-5"><div className="flex items-center justify-between text-[11px] font-bold"><span>Lane realization</span><span className="text-[#8490a0]">Awaiting data</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#edf2f7]"><div className="h-full w-1/3 rounded-full bg-[#1769e0]"/></div></div>
                <div className="border-t border-[#edf0f5] bg-[#fafbfd] px-5 py-4 text-[11px] leading-5 text-[#8490a0]">The public site never invents your operational metrics. Once you create a workspace, your dashboard is calculated from the records you connect.</div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-18 sm:px-8 sm:py-24">
          <div className="max-w-2xl"><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#1769e0]">How it works</p><h2 className="mt-3 text-3xl font-black tracking-[-.045em] sm:text-4xl">From disconnected records to one operating picture.</h2><p className="mt-4 text-sm leading-6 text-[#66758a] sm:text-base">Start with the data your team already owns. GhostLane organizes it around lanes and turns activity into measurable operational signals.</p></div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[[Database,'01','Connect data','Bring in contracts, shipments and carrier records through the workspace import flow.'],[Route,'02','Map the network','Group activity by origin, destination, mode and carrier to create a consistent lane view.'],[BarChart3,'03','Measure realization','Compare contracted capacity with materialized activity and surface lanes that need attention.']].map(([Icon,n,title,copy])=>{const I=Icon as typeof Database;return <article key={String(n)} className="relative rounded-2xl border border-[#dbe2ec] bg-white p-6"><div className="flex items-center justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf4ff] text-[#1769e0]"><I size={19}/></div><span className="text-[11px] font-extrabold tracking-[.15em] text-[#a0a9b5]">{n}</span></div><h3 className="mt-6 text-sm font-extrabold">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-[#66758a]">{String(copy)}</p></article>})}
          </div>
        </section>

        <section id="security" className="border-y border-[#dbe2ec] bg-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
            <div><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#1769e0]">Built around controlled access</p><h2 className="mt-3 text-3xl font-black tracking-[-.04em] sm:text-4xl">Your workspace is the boundary.</h2><p className="mt-4 max-w-xl text-sm leading-6 text-[#66758a]">GhostLane separates organizations at the database layer, not just in the interface. Users access operational records through their authenticated workspace membership.</p><Link href="/signup" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#1769e0]">Create a secure workspace <ArrowRight size={15}/></Link></div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-[#dbe2ec] p-5"><ShieldCheck size={19} className="text-[#1769e0]"/><h3 className="mt-4 text-sm font-extrabold">Workspace isolation</h3><p className="mt-2 text-xs leading-5 text-[#66758a]">Operational records are scoped to organization membership and protected by database policies.</p></div><div className="rounded-2xl border border-[#dbe2ec] p-5"><CheckCircle2 size={19} className="text-[#1769e0]"/><h3 className="mt-4 text-sm font-extrabold">Role-aware access</h3><p className="mt-2 text-xs leading-5 text-[#66758a]">Owners, admins, members and viewers can be given different workspace permissions.</p></div></div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 text-center sm:px-8 sm:py-20"><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#1769e0]">Ready to connect your network?</p><h2 className="mx-auto mt-3 max-w-2xl text-3xl font-black tracking-[-.045em] sm:text-4xl">Give your operations team one place to understand capacity.</h2><p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[#66758a]">Create your workspace and connect your first dataset. GhostLane starts with your records, not placeholder numbers.</p><Link href="/signup" className="mt-7 inline-flex h-12 items-center gap-2 rounded-xl bg-[#1769e0] px-5 text-sm font-bold text-white hover:bg-[#0f57bd]">Create account <ArrowRight size={16}/></Link></section>

        <footer className="border-t border-[#dbe2ec] bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-xs text-[#8490a0] sm:flex-row sm:items-center sm:justify-between sm:px-8"><div><span className="font-extrabold text-[#526174]">GhostLane</span><span className="ml-3">Logistics operations platform</span></div><div className="flex gap-5"><Link href="#how-it-works" className="hover:text-[#1769e0]">How it works</Link><Link href="/login" className="hover:text-[#1769e0]">Sign in</Link><Link href="/signup" className="hover:text-[#1769e0]">Create account</Link></div></div></footer>
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
  async function signOut() { 'use server'; const client = await createClient(); await client.auth.signOut() }
  return <AppShell><main className="min-h-screen bg-[#f7f9fc] text-[#08111f]"><header className="sticky top-0 z-40 border-b border-[#dbe2ec] bg-white/95 backdrop-blur-xl"><div className="mx-auto flex h-[72px] max-w-[1480px] items-center justify-end gap-2 px-5 pl-20 sm:px-8 sm:pl-24"><Link href="/data-sources" className="hidden rounded-xl border border-[#cbd6e5] px-3 py-2 text-xs font-bold text-[#526174] hover:bg-[#f5f8fc] sm:inline-flex">Data sources</Link><Link href="/settings" aria-label="Settings" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d5dfeb] text-[#526174]">⚙</Link><div className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-[#08111f] px-3 text-xs font-bold text-white">{(profile?.full_name || email || 'U').slice(0,2).toUpperCase()}</div><form action={signOut}><button aria-label="Sign out" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d5dfeb] text-[#526174]">↪</button></form></div></header><div className="mx-auto max-w-[1480px] px-5 py-8 sm:px-8 sm:py-10"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#1769e0]">Network overview</div><h1 className="text-4xl font-black tracking-[-0.055em] sm:text-6xl">See where capacity disappears.</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-[#66758a] sm:text-base">Your operational network, calculated from data stored in GhostLane.</p></div><Link href="/import" className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#1769e0] px-4 py-2.5 text-xs font-bold text-white">↑ Import data</Link></div>{rows.length===0?<section className="mt-8 rounded-2xl border border-[#dbe2ec] bg-white p-10 text-center sm:p-16"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf4ff] text-[#1769e0]">↑</div><h2 className="mt-5 text-xl font-extrabold">Connect your operational data</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#66758a]">GhostLane has no fabricated records. Import contracts and shipment data to calculate lane realization, ghost capacity and risk from your own data.</p><Link href="/import" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#1769e0] px-4 py-2.5 text-xs font-bold text-white">Import your first dataset <ArrowRight size={14}/></Link></section>:<section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Contracted capacity",contracted.toLocaleString(),'loads'],['Materialized capacity',materialized.toLocaleString(),'loads'],['Ghost capacity',ghost.toLocaleString(),'loads'],['Realization rate',`${realization.toFixed(1)}%`,'network']].map(([l,v,u])=><div key={l} className="rounded-2xl border border-[#dbe2ec] bg-white p-5"><div className="text-xs font-semibold text-[#6b788a]">{l}</div><div className="mt-3 flex items-end justify-between"><div className="text-3xl font-black">{v}</div><div className="pb-1 text-[11px] text-[#8995a4]">{u}</div></div></div>)}</section>}<footer className="mt-10 border-t border-[#dbe2ec] pt-5 text-xs text-[#8490a0]">{profile?.company_name || 'GhostLane workspace'} · {profile?.role || 'Workspace member'}</footer></div></main></AppShell>
}