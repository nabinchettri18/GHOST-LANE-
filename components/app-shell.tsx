'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BarChart3, CircleAlert, FileText, LayoutDashboard, Map, Menu, PackageSearch, Settings, Truck, X, Database, ClipboardList, ClipboardCheck } from 'lucide-react'

const nav = [
  ['Overview', '/', LayoutDashboard],
  ['Contract Intelligence', '/contract-intelligence', ClipboardCheck],
  ['Lanes', '/lanes', Map],
  ['Contracts', '/contracts', FileText],
  ['Shipments', '/shipments', PackageSearch],
  ['Carriers', '/carriers', Truck],
  ['Risk Analysis', '/risk', CircleAlert],
  ['Scenarios', '/scenarios', BarChart3],
  ['Reports', '/reports', ClipboardList],
  ['Data Sources', '/data-sources', Database],
  ['Settings', '/settings', Settings],
] as const

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [pathname])
  useEffect(() => { const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false); window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [])
  return <div className="min-h-screen bg-[#f7f9fc]">
    <button type="button" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} onClick={() => setOpen(v => !v)} className="fixed left-5 top-5 z-[70] flex h-11 w-11 items-center justify-center rounded-xl border border-[#d5dfeb] bg-white text-[#08111f] shadow-[0_4px_18px_rgba(8,17,31,0.07)] transition hover:border-[#1769e0] hover:text-[#1769e0] focus:outline-none focus:ring-4 focus:ring-[#1769e0]/10">{open ? <X size={20} strokeWidth={2}/> : <Menu size={21} strokeWidth={2}/>}</button>
    {open && <button aria-label="Close navigation overlay" onClick={() => setOpen(false)} className="fixed inset-0 z-50 bg-[#08111f]/15 backdrop-blur-[1px] lg:bg-transparent lg:backdrop-blur-0"/>}
    <aside className={`fixed inset-y-0 left-0 z-[60] flex w-[280px] flex-col border-r border-[#dbe2ec] bg-white shadow-[18px_0_50px_rgba(8,17,31,0.08)] transition-transform duration-200 ease-out ${open ? 'translate-x-0' : '-translate-x-full'}`} aria-hidden={!open}>
      <div className="flex h-[72px] items-center border-b border-[#edf0f5] px-6 pl-[76px]"><Link href="/" className="flex items-center gap-3" tabIndex={open ? 0 : -1}><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1769e0] text-sm font-extrabold text-white">G</div><div><div className="text-[18px] font-extrabold tracking-[-0.045em]">GhostLane</div><div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#7b8797]">Procurement intelligence</div></div></Link></div>
      <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Main navigation"><div className="px-3 pb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#9aa5b4]">Workspace</div><div className="space-y-1">{nav.map(([name, href, Icon]) => { const active = href === '/' ? pathname === '/' : pathname.startsWith(href); return <Link key={href} href={href} tabIndex={open ? 0 : -1} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? 'bg-[#edf4ff] text-[#1769e0]' : 'text-[#526174] hover:bg-[#f5f8fc] hover:text-[#08111f]'}`}><Icon size={17} strokeWidth={1.9}/><span>{name}</span></Link> })}</div></nav>
      <div className="border-t border-[#edf0f5] p-4"><div className="rounded-xl bg-[#f7f9fc] px-3 py-3 text-xs"><div className="font-bold text-[#08111f]">Private workspace</div><div className="mt-1 text-[#7b8797]">Your connected operational data</div></div></div>
    </aside>
    <div className="min-h-screen">{children}</div>
  </div>
}
