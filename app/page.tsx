import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

  const db = createAdminClient()
  const { data: membership, error: membershipError } = await db
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (membershipError || !membership?.organization_id) {
    return (
      <AppShell>
        <GhostLaneWorkspace view="overview" lanes={[]} shipments={[]} contracts={[]} carriers={[]} />
      </AppShell>
    )
  }

  const organizationId = membership.organization_id
  const params = await searchParams
  const view = params.view || 'overview'

  const needsLanes = ['overview', 'lanes', 'forecasts', 'risk', 'recommendations', 'carriers', 'contracts', 'shipments', 'exceptions', 'spend', 'ghost-cost', 'savings', 'copilot'].includes(view)
  const needsShipments = ['overview', 'shipments', 'exceptions', 'copilot'].includes(view)
  const needsContracts = view === 'contracts'
  const needsCarriers = view === 'carriers'

  const [lanesResult, shipmentsResult, contractsResult, carriersResult, profileResult] = await Promise.all([
    needsLanes
      ? db.from('lanes').select(laneSelect).eq('organization_id', organizationId).order('risk_score', { ascending: false }).limit(view === 'overview' ? 200 : 500)
      : Promise.resolve({ data: [] as any[], error: null }),
    needsShipments
      ? db.from('shipments').select(shipmentSelect).eq('organization_id', organizationId).order('shipment_date', { ascending: false }).limit(view === 'overview' ? 100 : 500)
      : Promise.resolve({ data: [] as any[], error: null }),
    needsContracts
      ? db.from('contracts').select(contractSelect).eq('organization_id', organizationId).order('start_date', { ascending: false }).limit(500)
      : Promise.resolve({ data: [] as any[], error: null }),
    needsCarriers
      ? db.from('carriers').select(carrierSelect).eq('organization_id', organizationId).order('name').limit(250)
      : Promise.resolve({ data: [] as any[], error: null }),
    db.from('profiles').select('full_name,company_name,role').eq('id', user.id).maybeSingle(),
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
