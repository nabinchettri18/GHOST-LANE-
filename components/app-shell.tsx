'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BarChart3, CircleAlert, FileText, LayoutDashboard, Map, Menu, PackageSearch, Settings, Truck, X, Database, ClipboardList, ClipboardCheck, Search, Bell, ChevronDown, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const nav=[['Overview','/',LayoutDashboard],['Contract Intelligence','/contract-intelligence',ClipboardCheck],['Lanes','/lanes',Map],['Contracts','/contracts',FileText],['Shipments','/shipments',PackageSearch],['Carriers','/carriers',Truck],['Risk Analysis','/risk',CircleAlert],['Scenarios','/scenarios',BarChart3],['Reports','/reports',ClipboardList],['Data Sources','/data-sources',Database]] as const
const pageNames:Record<string,string>={'/':'Overview','/contract-intelligence':'Contract Intelligence','/lanes':'Lanes','/contracts':'Contracts','/shipments':'Shipments','/carriers':'Carriers','/risk':'Risk Analysis','/scenarios':'Scenarios','/reports':'Reports','/data-sources':'Data Sources','/settings':'Settings'}

export function AppShell({children}:{children:React.ReactNode}){
  const pathname=usePathname();
  const router=useRouter();
  const[open,setOpen]=useState(false);
  const[loggingOut,setLoggingOut]=useState(false);
  const[searchOpen,setSearchOpen]=useState(false);

  useEffect(()=>setOpen(false),[pathname]);
  useEffect(()=>{const f=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);setSearchOpen(false)}};addEventListener('keydown',f);return()=>removeEventListener('keydown',f)},[]);

  const handleLogout=async()=>{
    if(loggingOut)return;
    setLoggingOut(true);
    const supabase=createClient();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  };
  const pageTitle=pageNames[pathname]??'GhostLane';

  return <div className="min-h-screen bg-[#f6f8fb] text-[#08111f]">
    <button aria-label="Toggle navigation" onClick={()=>setOpen(v=>!v)} className="fixed left-5 top-5 z-[80] flex h-10 w-10 items-center justify-center rounded-xl border border-[#d5dfeb] bg-white shadow-sm lg:left-6">{open?<X size={19}/>:<Menu size={19}/>}</button>
    {open&&<button aria-label="Close navigation" onClick={()=>setOpen(false)} className="fixed inset-0 z-50 bg-[#08111f]/10 lg:bg-transparent"/>}
    <aside className={`fixed inset-y-0 left-0 z-[70] flex w-[272px] flex-col border-r border-[#dbe2ec] bg-white shadow-[16px_0_50px_rgba(8,17,31,.07)] transition-transform duration-200 ${open?'translate-x-0':'-translate-x-full'}`}>
      <div className="flex h-[72px] items-center border-b border-[#edf0f5] pl-[72px] pr-5"><Link href="/" className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1769e0] text-sm font-black text-white">G</span><span><span className="block text-[17px] font-black tracking-[-.04em]">GhostLane</span><span className="block text-[8px] font-extrabold uppercase tracking-[.15em] text-[#8a96a6]">Freight intelligence</span></span></Link></div>
      <div className="border-b border-[#edf0f5] p-3"><button className="flex w-full items-center gap-3 rounded-xl border border-[#e2e7ee] bg-[#fafbfd] p-2.5 text-left"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#edf4ff] text-[10px] font-black text-[#1769e0]">GL</div><div className="min-w-0 flex-1"><div className="truncate text-[11px] font-extrabold">Current workspace</div><div className="text-[9px] text-[#8a96a6]">Private operations</div></div><ChevronDown size={13} className="text-[#9aa4b1]"/></button></div>
      <nav className="flex-1 overflow-y-auto px-3 py-4"><div className="mb-2 px-3 text-[9px] font-black uppercase tracking-[.18em] text-[#a0a9b5]">Command center</div>{nav.map(([name,href,Icon])=>{const active=href==='/'?pathname==='/':pathname.startsWith(href);return <Link key={href} href={href} className={`group mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-bold transition ${active?'bg-[#edf4ff] text-[#1769e0]':'text-[#59687b] hover:bg-[#f6f8fb] hover:text-[#08111f]'}`}><Icon size={16} strokeWidth={1.9}/><span className="flex-1">{name}</span>{name==='Contract Intelligence'&&<span className="rounded-md bg-[#08111f] px-1.5 py-0.5 text-[8px] text-white">NEW</span>}</Link>})}<div className="my-4 border-t border-[#edf0f5]"/><div className="mb-2 px-3 text-[9px] font-black uppercase tracking-[.18em] text-[#a0a9b5]">Administration</div><Link href="/settings" className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-bold ${pathname.startsWith('/settings')?'bg-[#edf4ff] text-[#1769e0]':'text-[#59687b] hover:bg-[#f6f8fb]'}`}><Settings size={16}/><span>Settings</span></Link></nav>
      <div className="border-t border-[#edf0f5] p-3 space-y-2"><div className="rounded-xl bg-[#f7f9fc] p-3"><div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#22a06b]"/><span className="text-[10px] font-extrabold">Workspace healthy</span></div><div className="mt-1 text-[9px] text-[#8994a3]">Data access is protected</div></div><button type="button" onClick={handleLogout} disabled={loggingOut} className="flex w-full items-center gap-3 rounded-xl border border-[#e2e7ee] bg-white px-3 py-2.5 text-[12px] font-bold text-[#59687b] transition hover:border-[#cbd5e1] hover:bg-[#f6f8fb] hover:text-[#08111f] disabled:cursor-not-allowed disabled:opacity-60"><LogOut size={16}/><span>{loggingOut?'Signing out…':'Sign out'}</span></button></div>
    </aside>
    <div className="min-h-screen lg:pl-0">
      <header className="sticky top-0 z-40 flex h-[72px] items-center border-b border-[#dfe5ed] bg-white/95 px-5 pl-[84px] backdrop-blur-sm lg:px-8 lg:pl-[312px]">
        <div className="min-w-0 flex-1"><div className="text-[10px] font-bold uppercase tracking-[.16em] text-[#9aa5b3]">GhostLane / Command center</div><h1 className="mt-0.5 truncate text-[18px] font-black tracking-[-.025em]">{pageTitle}</h1></div>
        <div className="ml-4 flex items-center gap-2">
          <div className={`hidden items-center overflow-hidden rounded-xl border border-[#dbe2ec] bg-[#fafbfd] transition-all sm:flex ${searchOpen?'w-[260px]':'w-[42px]'}`}><button aria-label="Search" onClick={()=>setSearchOpen(v=>!v)} className="flex h-10 w-[42px] shrink-0 items-center justify-center text-[#69778a] hover:text-[#08111f]"><Search size={16}/></button>{searchOpen&&<input autoFocus aria-label="Search GhostLane" placeholder="Search lanes, contracts…" className="h-10 min-w-0 flex-1 bg-transparent pr-3 text-[12px] font-medium outline-none placeholder:text-[#9aa5b3]"/>}</div>
          <button aria-label="Notifications" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#dbe2ec] bg-white text-[#69778a] transition hover:border-[#c8d2df] hover:text-[#08111f]"><Bell size={16}/><span className="absolute right-2.5 top-2 h-1.5 w-1.5 rounded-full bg-[#1769e0]"/></button>
          <div className="mx-1 h-7 w-px bg-[#e5e9ef]"/>
          <Link href="/settings" aria-label="Open settings" className="group flex items-center gap-2 rounded-xl border border-transparent px-1.5 py-1.5 transition hover:border-[#dbe2ec] hover:bg-[#fafbfd]"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#08111f] text-[10px] font-black text-white">GL</span><span className="hidden text-left sm:block"><span className="block text-[10px] font-extrabold text-[#08111f]">Workspace</span><span className="block text-[9px] text-[#8a96a6]">Settings</span></span><ChevronDown size={13} className="hidden text-[#9aa4b1] sm:block"/></Link>
        </div>
      </header>
      {children}
    </div>
  </div>
}
