import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/app-shell'
import { CuOptWorkbench } from '@/components/cuopt-workbench'

export default async function OperationsOptimizerPage(){
 const supabase=await createClient()
 const {data:{user}}=await supabase.auth.getUser()
 if(!user)redirect('/login')
 const {data:lanes}=await supabase.from('lanes').select('id,origin,destination,mode,carrier,distance_km').order('created_at',{ascending:false}).limit(500)
 return <AppShell><main className="min-h-[calc(100vh-64px)] bg-[#f6f8fb] px-4 py-7 sm:px-6 lg:px-8"><div className="mx-auto max-w-[1200px]"><CuOptWorkbench lanes={(lanes??[]) as any}/></div></main></AppShell>
}
