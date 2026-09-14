import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/app-shell'
import { LandingPage } from '@/components/landing-page'
import { GhostLaneWorkspace } from '@/components/ghostlane-workspace'

type SearchParams=Promise<{view?:string;search?:string}>
export default async function Home({searchParams}:{searchParams:SearchParams}) {
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return <LandingPage/>
 const [{data:lanes},{data:shipments},{data:contracts},{data:carriers},{data:profile}]=await Promise.all([
  supabase.from('lanes').select('id,origin,destination,mode,distance_km,contracted_volume,materialized_volume,carrier,risk_score').order('risk_score',{ascending:false}).limit(1000),
  supabase.from('shipments').select('shipment_id,lane_id,carrier,shipment_date,volume,status').order('shipment_date',{ascending:false}).limit(1000),
  supabase.from('contracts').select('contract_id,lane_id,carrier,contracted_volume,contract_rate,start_date,end_date').order('start_date',{ascending:false}).limit(1000),
  supabase.from('carriers').select('name,acceptance_rate,rejection_rate,cancellation_rate,realization_rate').order('name').limit(500),
  supabase.from('profiles').select('full_name,company_name,role').eq('id',user.id).maybeSingle(),
 ])
 const params=await searchParams
 return <AppShell><GhostLaneWorkspace view={params.view} lanes={(lanes??[]) as any} shipments={(shipments??[]) as any} contracts={(contracts??[]) as any} carriers={(carriers??[]) as any} company={profile?.company_name||undefined}/></AppShell>
}
