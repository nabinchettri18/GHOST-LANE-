import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/app-shell'
import { LandingPage } from '@/components/landing-page'
import { GhostLaneWorkspace } from '@/components/ghostlane-workspace'

type SearchParams = Promise<{ view?: string; search?: string }>

const laneSelect = 'id,origin,destination,mode,distance_km,contracted_volume,materialized_volume,carrier,risk_score'
const shipmentSelect = 'shipment_id,lane_id,carrier,shipment_date,volume,status'
const contractSelect = 'contract_id,lane_id,carrier,contracted_volume,contract_rate,start_date,end_date'
const carrierSelect = 'name,acceptance_rate,rejection_rate,cancellation_rate,realization_rate'

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <LandingPage />

  const params = await searchParams
  const view = params.view || 'overview'

  // Avoid fetching the entire workspace for every navigation click. Each view only
  // loads the records it actually renders, which keeps RSC payloads and DB work small.
  const needsLanes = ['overview', 'lanes', 'forecasts', 'risk', 'recommendations', 'carriers', 'contracts', 'shipments', 'exceptions', 'spend', 'ghost-cost', 'savings', 'copilot'].includes(view)
  const needsShipments = ['overview', 'shipments', 'exceptions', 'copilot'].includes(view)
  const needsContracts = view === 'contracts'
  const needsCarriers = view === 'carriers'

  const [lanesResult, shipmentsResult, contractsResult, carriersResult, profileResult] = await Promise.all([
    needsLanes
      ? supabase.from('lanes').select(laneSelect).order('risk_score', { ascending: false }).limit(view === 'overview' ? 200 : 500)
      : Promise.resolve({ data: [] as any[] }),
    needsShipments
      ? supabase.from('shipments').select(shipmentSelect).order('shipment_date', { ascending: false }).limit(view === 'overview' ? 100 : 500)
      : Promise.resolve({ data: [] as any[] }),
    needsContracts
      ? supabase.from('contracts').select(contractSelect).order('start_date', { ascending: false }).limit(500)
      : Promise.resolve({ data: [] as any[] }),
    needsCarriers
      ? supabase.from('carriers').select(carrierSelect).order('name').limit(250)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('profiles').select('full_name,company_name,role').eq('id', user.id).maybeSingle(),
  ])

  return (
    <AppShell>
      <GhostLaneWorkspace
        view={view}
        lanes={(lanesResult.data ?? []) as any}
        shipments={(shipmentsResult.data ?? []) as any}
        contracts={(contractsResult.data ?? []) as any}
        carriers={(carriersResult.data ?? []) as any}
        company={profileResult.data?.company_name || undefined}
      />
    </AppShell>
  )
}
