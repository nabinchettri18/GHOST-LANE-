import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/app-shell'
import { DriverNavigation } from '@/components/driver-navigation'

export default async function NavigationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const [{ data: shipments }, { data: lanes }] = await Promise.all([
    supabase.from('shipments').select('shipment_id,lane_id,carrier,shipment_date,volume,status').order('shipment_date',{ascending:false}).limit(500),
    supabase.from('lanes').select('id,origin,destination,mode,carrier,distance_km,risk_score').limit(500),
  ])
  return <AppShell><DriverNavigation shipments={(shipments??[]) as any} lanes={(lanes??[]) as any}/></AppShell>
}
