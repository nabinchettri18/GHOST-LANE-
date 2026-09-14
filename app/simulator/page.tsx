import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/app-shell'
import { DecisionSimulator } from '@/components/decision-simulator'

export default async function SimulatorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: lanes }, { data: carriers }] = await Promise.all([
    supabase.from('lanes').select('id,origin,destination,mode,carrier,contracted_volume,materialized_volume,risk_score,distance_km').order('risk_score', { ascending: false }).limit(1000),
    supabase.from('carriers').select('name,acceptance_rate,rejection_rate,cancellation_rate,realization_rate').order('name').limit(500),
  ])

  return <AppShell><DecisionSimulator lanes={(lanes ?? []) as any} carriers={(carriers ?? []) as any} /></AppShell>
}
