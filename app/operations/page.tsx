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
 return <AppShell><LiveOperations shipments={(shipments??[]) as any} lanes={(lanes??[]) as any} events={(events??[]) as any} help={(help??[]) as any}/></AppShell>
}
