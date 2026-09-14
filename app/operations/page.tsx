import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/app-shell'
import { LiveOperations } from '@/components/live-operations'

export default async function OperationsPage(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
 const [{data:shipments},{data:lanes},{data:events},{data:help}]=await Promise.all([
  supabase.from('shipments').select('shipment_id,lane_id,carrier,shipment_date,volume,status,live_lat,live_lng,current_eta,current_route,last_event_at,help_status,vehicle_capacity,vehicle_id,risk_score').order('shipment_date',{ascending:false}).limit(500),
  supabase.from('lanes').select('id,origin,destination,mode,distance_km,risk_score').limit(500),
  supabase.from('shipment_events').select('id,shipment_id,event_type,severity,message,created_at').order('created_at',{ascending:false}).limit(500),
  supabase.from('shipment_help_requests').select('id,shipment_id,status,reason,latitude,longitude,relief_shipment_id,created_at').order('created_at',{ascending:false}).limit(200)
 ])
 return <AppShell><div><div className="flex justify-end border-b border-[#edf0f5] bg-white px-4 py-3 sm:px-6 lg:px-8"><Link href="/operations/optimizer" className="inline-flex items-center gap-2 rounded-xl bg-[#08111f] px-4 py-2.5 text-[10px] font-black text-white">NVIDIA cuOpt Route Optimizer</Link></div><LiveOperations shipments={(shipments??[]) as any} lanes={(lanes??[]) as any} events={(events??[]) as any} help={(help??[]) as any}/></div></AppShell>
}
