"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  ChevronRight,
  CircleAlert,
  FileText,
  LayoutDashboard,
  Map,
  Menu,
  PackageSearch,
  Search,
  Settings,
  Truck,
  Upload,
  Users,
  X,
} from "lucide-react";

const lanes = [
  { lane: "Ludhiana → Nagpur", carrier: "Carrier 01", contracted: 100, materialized: 58, realization: 58, ghost: 42, risk: "High" },
  { lane: "Delhi → Mumbai", carrier: "Carrier 02", contracted: 250, materialized: 221, realization: 88.4, ghost: 11.6, risk: "Low" },
  { lane: "Chandigarh → Delhi", carrier: "Carrier 03", contracted: 180, materialized: 161, realization: 89.4, ghost: 10.6, risk: "Low" },
  { lane: "Ahmedabad → Mumbai", carrier: "Carrier 04", contracted: 220, materialized: 168, realization: 76.4, ghost: 23.6, risk: "Medium" },
  { lane: "Bengaluru → Chennai", carrier: "Carrier 06", contracted: 190, materialized: 132, realization: 69.5, ghost: 30.5, risk: "Medium" },
];

const nav = [
  ["Overview", LayoutDashboard],
  ["Lanes", Map],
  ["Contracts", FileText],
  ["Shipments", PackageSearch],
  ["Carriers", Truck],
  ["Risk Analysis", CircleAlert],
  ["Scenarios", BarChart3],
];

function Risk({ level }: { level: string }) {
  const styles = level === "High" ? "bg-[#fff0f0] text-[#b13b3b]" : level === "Medium" ? "bg-[#fff7e8] text-[#9a6817]" : "bg-[#edf9f3] text-[#187650]";
  return <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold ${styles}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{level}</span>;
}

export default function Home() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = lanes.filter((l) => l.lane.toLowerCase().includes(query.toLowerCase()) || l.carrier.toLowerCase().includes(query.toLowerCase()));
  const contracted = lanes.reduce((s, l) => s + l.contracted, 0);
  const materialized = lanes.reduce((s, l) => s + l.materialized, 0);
  const ghost = contracted - materialized;
  const realization = (materialized / contracted) * 100;

  return (
    <main className="min-h-screen bg-white text-[#08111f]">
      <header className="sticky top-0 z-40 border-b border-[#dbe2ec] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1480px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <button aria-label="Open navigation" onClick={() => setOpen(!open)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d5dfeb] md:hidden">
              {open ? <X size={19} /> : <Menu size={19} />}
            </button>
            <div>
              <div className="text-[18px] font-extrabold tracking-[-0.045em]">GhostLane</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7b8797]">Procurement intelligence</div>
            </div>
          </div>

          <nav className="hidden items-center gap-7 md:flex">
            {nav.slice(0, 4).map(([name]) => <Link key={name as string} href="#" className="text-sm font-semibold text-[#526174] hover:text-[#1769e0]">{name as string}</Link>)}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-xl border border-[#d5dfeb] bg-[#f7f9fc] px-3 py-2 md:flex">
              <Search size={16} className="text-[#8490a0]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search lanes or carriers" className="w-44 bg-transparent text-xs font-medium outline-none placeholder:text-[#9aa5b4]" />
            </div>
            <button aria-label="Notifications" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#d5dfeb] text-[#526174] hover:bg-[#f4f8ff]"><Bell size={17} /></button>
            <button aria-label="Settings" className="hidden h-10 w-10 items-center justify-center rounded-xl border border-[#d5dfeb] text-[#526174] hover:bg-[#f4f8ff] sm:flex"><Settings size={17} /></button>
            <div className="hidden h-10 w-10 items-center justify-center rounded-xl bg-[#08111f] text-xs font-bold text-white sm:flex">NC</div>
          </div>
        </div>
        {open && <div className="border-t border-[#dbe2ec] bg-white px-5 py-4 md:hidden"><nav className="flex flex-col gap-1">{nav.map(([name, Icon]) => <Link key={name as string} href="#" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-[#526174] hover:bg-[#f4f8ff] hover:text-[#1769e0]"><Icon size={17} />{name as string}</Link>)}</nav></div>}
      </header>

      <div className="mx-auto max-w-[1480px] px-5 py-8 sm:px-8 sm:py-10">
        <section className="animate-rise">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#1769e0]">Network overview</div>
              <h1 className="text-[clamp(2.5rem,5vw,4.4rem)] font-black leading-[.94] tracking-[-0.06em]">See where capacity<br className="hidden sm:block" /> disappears.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-[#66758a] sm:text-base">Contracted freight capacity versus actual movement across your network. Identify under-realized lanes before the next procurement cycle.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-[#cbd6e5] bg-white px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#526174]">Prototype dataset</span>
              <Link href="#" className="inline-flex items-center gap-2 rounded-xl bg-[#1769e0] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#0f57bd]"><Upload size={15} />Import data</Link>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Contracted capacity", contracted.toLocaleString(), "loads"],
            ["Materialized capacity", materialized.toLocaleString(), "loads"],
            ["Ghost capacity", ghost.toLocaleString(), "loads"],
            ["Realization rate", `${realization.toFixed(1)}%`, "network average"],
          ].map(([label, value, unit]) => (
            <div key={label} className="rounded-2xl border border-[#dbe2ec] bg-white p-5 shadow-[0_12px_32px_rgba(8,17,31,.035)]">
              <div className="text-xs font-semibold text-[#6b788a]">{label}</div>
              <div className="mt-3 flex items-end justify-between gap-4"><div className="text-3xl font-black tracking-[-0.04em]">{value}</div><div className="pb-1 text-[11px] font-semibold text-[#8995a4]">{unit}</div></div>
            </div>
          ))}
        </section>

        <section className="mt-7 grid gap-6 xl:grid-cols-[1.45fr_.85fr]">
          <div className="overflow-hidden rounded-2xl border border-[#dbe2ec] bg-white">
            <div className="flex items-center justify-between border-b border-[#dbe2ec] px-5 py-4">
              <div><div className="text-sm font-extrabold">Network</div><div className="mt-0.5 text-xs text-[#7c8797]">Indian freight corridors</div></div>
              <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7b8797]"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#1c8a5a]" />Healthy</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#b7791f]" />Watch</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#c24141]" />High risk</span></div>
            </div>
            <div className="relative min-h-[360px] overflow-hidden bg-[#f7faff] p-6 sm:min-h-[430px]">
              <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(#e8eef6_1px,transparent_1px),linear-gradient(90deg,#e8eef6_1px,transparent_1px)] [background-size:36px_36px]" />
              <div className="absolute left-[15%] top-[25%] h-2 w-2 rounded-full bg-[#1c8a5a] shadow-[0_0_0_4px_rgba(28,138,90,.10)]" />
              <div className="absolute left-[26%] top-[42%] h-2 w-2 rounded-full bg-[#c24141] shadow-[0_0_0_4px_rgba(194,65,65,.10)]" />
              <div className="absolute left-[48%] top-[48%] h-2 w-2 rounded-full bg-[#b7791f] shadow-[0_0_0_4px_rgba(183,121,31,.10)]" />
              <div className="absolute left-[69%] top-[58%] h-2 w-2 rounded-full bg-[#1c8a5a] shadow-[0_0_0_4px_rgba(28,138,90,.10)]" />
              <div className="absolute left-[80%] top-[72%] h-2 w-2 rounded-full bg-[#1c8a5a] shadow-[0_0_0_4px_rgba(28,138,90,.10)]" />
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 900 420" preserveAspectRatio="none" aria-hidden="true">
                <path d="M135 105 C205 128 195 168 255 178 S410 194 438 206 S585 258 618 286 S720 320 735 330" fill="none" stroke="#d2dbe8" strokeWidth="2" />
                <path d="M230 176 C350 165 430 178 560 258" fill="none" stroke="#c24141" strokeWidth="3" strokeDasharray="6 6" />
                <path d="M434 206 C520 180 635 210 735 330" fill="none" stroke="#1c8a5a" strokeWidth="3" />
              </svg>
              <div className="absolute bottom-5 left-5 rounded-xl border border-[#dbe2ec] bg-white/95 px-3 py-2 text-[11px] font-semibold text-[#526174] shadow-sm">Network visualization · prototype</div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#dbe2ec] bg-white">
            <div className="border-b border-[#dbe2ec] px-5 py-4"><div className="text-sm font-extrabold">Risk profile</div><div className="mt-0.5 text-xs text-[#7c8797]">Current lane distribution</div></div>
            <div className="space-y-5 p-5">
              {[{label:"Low", count:2, width:"64%", color:"bg-[#1c8a5a]"},{label:"Medium", count:2, width:"46%", color:"bg-[#b7791f]"},{label:"High", count:1, width:"28%", color:"bg-[#c24141]"}].map((r) => <div key={r.label}><div className="flex items-center justify-between text-xs font-bold"><span>{r.label}</span><span className="text-[#7c8797]">{r.count} lanes</span></div><div className="mt-2 h-2 rounded-full bg-[#eef2f7]"><div className={`h-2 rounded-full ${r.color}`} style={{width:r.width}} /></div></div>)}
              <div className="mt-7 border-t border-[#e1e7ef] pt-5"><div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7b8797]">Priority lane</div><div className="mt-3 flex items-start justify-between gap-4"><div><div className="text-lg font-extrabold">Ludhiana → Nagpur</div><div className="mt-1 text-xs text-[#7c8797]">42% ghost capacity</div></div><Risk level="High" /></div><Link href="#" className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-[#1769e0]">Open lane analysis <ArrowRight size={14}/></Link></div>
            </div>
          </div>
        </section>

        <section className="mt-7 overflow-hidden rounded-2xl border border-[#dbe2ec] bg-white">
          <div className="flex flex-col gap-3 border-b border-[#dbe2ec] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-extrabold">Lane performance</div><div className="mt-0.5 text-xs text-[#7c8797]">Contracted versus realized movement</div></div><div className="flex items-center gap-2"><div className="flex items-center gap-2 rounded-xl border border-[#d5dfeb] bg-[#f7f9fc] px-3 py-2 md:hidden"><Search size={14} className="text-[#8490a0]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="w-28 bg-transparent text-xs outline-none" /></div><button className="rounded-xl border border-[#cbd6e5] px-3 py-2 text-xs font-bold text-[#526174]">Filter</button></div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[780px] border-collapse text-left"><thead><tr className="border-b border-[#e5eaf1] bg-[#fbfcfe] text-[10px] font-black uppercase tracking-[0.12em] text-[#8490a0]"><th className="px-5 py-3.5">Lane</th><th className="px-4 py-3.5">Carrier</th><th className="px-4 py-3.5">Contracted</th><th className="px-4 py-3.5">Actual</th><th className="px-4 py-3.5">Realization</th><th className="px-4 py-3.5">Ghost</th><th className="px-4 py-3.5">Risk</th><th className="px-5 py-3.5">View</th></tr></thead><tbody>{filtered.map((l) => <tr key={l.lane} className="border-b border-[#edf1f5] last:border-b-0 hover:bg-[#fbfcfe]"><td className="px-5 py-4 text-sm font-bold">{l.lane}</td><td className="px-4 py-4 text-sm text-[#59677a]">{l.carrier}</td><td className="px-4 py-4 text-sm font-semibold">{l.contracted}</td><td className="px-4 py-4 text-sm font-semibold">{l.materialized}</td><td className="px-4 py-4 text-sm font-semibold">{l.realization.toFixed(1)}%</td><td className="px-4 py-4 text-sm font-semibold">{l.ghost.toFixed(1)}%</td><td className="px-4 py-4"><Risk level={l.risk} /></td><td className="px-5 py-4"><Link href="#" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#d5dfeb] text-[#526174] hover:border-[#1769e0] hover:text-[#1769e0]" aria-label={`Open ${l.lane}`}><ChevronRight size={15}/></Link></td></tr>)}</tbody></table></div>
        </section>

        <section className="mt-7 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-2xl border border-[#dbe2ec] bg-[#08111f] p-6 text-white sm:p-7"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#75b1ff]">Investigation</div><h2 className="mt-3 max-w-xl text-3xl font-black leading-tight tracking-[-0.04em] sm:text-4xl">Turn an at-risk lane into a procurement decision.</h2><p className="mt-4 max-w-xl text-sm leading-6 text-[#aebbd0]">Open any lane to review contract utilization, carrier performance, historical realization and a modeled risk assessment.</p><div className="mt-6 flex flex-wrap gap-3"><Link href="#" className="inline-flex items-center gap-2 rounded-xl bg-[#1769e0] px-4 py-3 text-xs font-bold text-white">Open investigations <ArrowRight size={15}/></Link><Link href="#" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-xs font-bold text-white hover:bg-white/5">Run scenario</Link></div></div>
          <div className="rounded-2xl border border-[#dbe2ec] bg-[#f7faff] p-6 sm:p-7"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#1769e0]">Data sources</div><div className="mt-4 space-y-3">{[["Contract uploads","User data"],["Shipment records","User data"],["Public datasets","Reference"],["ULIP / FASTag","Planned integration"]].map(([a,b]) => <div key={a} className="flex items-center justify-between border-b border-[#dfe6ef] pb-3 last:border-b-0"><span className="text-sm font-semibold">{a}</span><span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#7b8797]">{b}</span></div>)}</div></div>
        </section>
      </div>

      <footer className="border-t border-[#dbe2ec] bg-white px-5 py-8 sm:px-8"><div className="mx-auto flex max-w-[1480px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black tracking-tight">GhostLane</p><p className="mt-1 text-xs text-[#7a8798]">Procurement intelligence for freight capacity.</p></div><div className="text-[11px] font-semibold text-[#8994a3]">Prototype dataset · Demo environment</div></div></footer>
    </main>
  );
}
