import { AppShell } from '@/components/app-shell'
import { ContractIntelligence } from '@/components/contract-intelligence'
import { createClient } from '@/lib/supabase/server'

export default async function ContractIntelligencePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('lanes').select('id, origin, destination, mode, carrier, contracted_volume, materialized_volume').order('created_at', { ascending: false }).limit(500)
  const lanes = (data ?? []) as Array<{ id:string; origin:string; destination:string; mode:string; carrier:string|null; contracted_volume:number|null; materialized_volume:number|null }>
  return <AppShell><main className="min-h-screen bg-[#f7f9fc] px-5 py-8 text-[#08111f] sm:px-8 sm:py-10"><div className="mx-auto max-w-[1480px]"><div className="border-b border-[#dbe2ec] pb-7"><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#1769e0]">Pre-contract</p><h1 className="mt-2 text-3xl font-black tracking-[-.04em] sm:text-4xl">Contract intelligence</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[#66758a]">Review a proposed commitment against the historical lane evidence already available in your workspace. GhostLane does not guarantee an outcome; it gives procurement a transparent benchmark before commitment.</p></div><ContractIntelligence lanes={lanes}/></div></main></AppShell>
}
