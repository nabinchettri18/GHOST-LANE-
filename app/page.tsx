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
  // Keep the public homepage renderable even if a preview deployment is missing
  // Supabase variables. Authenticated data loads only when Supabase is configured.
  const hasSupabaseConfig = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  )
  if (!hasSupabaseConfig) return <LandingPage />

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <LandingPage />

  const db = createAdminClient()
  const { data: memberships, error: membershipError } = await db
    .from('organization_members')
    .select('organization_id,role,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (membershipError || !memberships?.length) {
    return <AppShell><GhostLaneWorkspace view="overview" lanes={[]} shipments={[]} contracts={[]} carriers={[]} /></AppShell>
  }

  const candidates = await Promise.all(memberships.map(async (membership) => {
    const org = membership.organization_id
    const [lanes, shipments, contracts, carriers] = await Promise.all([
      db.from('lanes').select('id', { count: 'exact', head: true }).eq('organization_id', org),
      db.from('shipments').select('shipment_id', { count: 'exact', head: true }).eq('organization_id', org),
      db.from('contracts').select('contract_id', { count: 'exact', head: true }).eq('organization_id', org),
      db.from('carriers').select('name', { count: 'exact', head: true }).eq('organization_id', org),
    ])
    return { membership, score: (lanes.count ?? 0) + (shipments.count ?? 0) + (contracts.count ?? 0) + (carriers.count ?? 0) }
  }))
  const active = candidates.sort((a, b) => b.score - a.score || new Date(a.membership.created_at).getTime() - new Date(b.membership.created_at).getTime())[0]
  const organizationId = active.membership.organization_id

  const params = await searchParams
  const view = params.view || 'overview'
  const needsLanes = ['overview', 'lanes', 'forecasts', 'risk', 'recommendations', 'carriers', 'contracts', 'shipments', 'exceptions', 'spend', 'ghost-cost', 'savings', 'copilot'].includes(view)
  const needsShipments = ['overview', 'shipments', 'exceptions', 'copilot'].includes(view)
  const needsContracts = view === 'contracts'
  const needsCarriers = view === 'carriers'

  const [lanesResult, shipmentsResult, contractsResult, carriersResult, profileResult] = await Promise.all([
    needsLanes ? db.from('lanes').select(laneSelect).eq('organization_id', organizationId).order('risk_score', { ascending: false }).limit(view === 'overview' ? 200 : 500) : Promise.resolve({ data: [], error: null }),
    needsShipments ? db.from('shipments').select(shipmentSelect).eq('organization_id', organizationId).order('shipment_date', { ascending: false }).limit(view === 'overview' ? 100 : 500) : Promise.resolve({ data: [], error: null }),
    needsContracts ? db.from('contracts').select(contractSelect).eq('organization_id', organizationId).order('start_date', { ascending: false }).limit(500) : Promise.resolve({ data: [], error: null }),
    needsCarriers ? db.from('carriers').select(carrierSelect).eq('organization_id', organizationId).order('name').limit(250) : Promise.resolve({ data: [], error: null }),
    db.from('profiles').select('full_name,company_name,role').eq('id', user.id).maybeSingle(),
  ])

  return <AppShell><GhostLaneWorkspace view={view} lanes={(lanesResult.data ?? []) as any} shipments={(shipmentsResult.data ?? []) as any} contracts={(contractsResult.data ?? []) as any} carriers={(carriersResult.data ?? []) as any} company={profileResult.data?.company_name || undefined} /></AppShell>
}
