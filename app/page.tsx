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
  const hasSupabaseConfig = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY))
  if (!hasSupabaseConfig) return <LandingPage />

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <LandingPage />

  const hasServiceKey = Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
  const db = hasServiceKey ? createAdminClient() : supabase
  const [membershipResult, profileResult] = await Promise.all([
    db.from('organization_members').select('organization_id,role,created_at').eq('user_id', user.id).order('created_at', { ascending: true }),
    db.from('profiles').select('full_name,company_name,role,default_organization_id').eq('id', user.id).maybeSingle(),
  ])

  if (membershipResult.error || !membershipResult.data?.length) {
    return <AppShell><GhostLaneWorkspace view="overview" lanes={[]} shipments={[]} contracts={[]} carriers={[]} /></AppShell>
  }

  const memberships = membershipResult.data
  const preferred = profileResult.data?.default_organization_id
  const active = (preferred && memberships.find(m => m.organization_id === preferred)) || memberships[0]
  const organizationId = active.organization_id
  const params = await searchParams
  const view = params.view || 'overview'

  const [lanesResult, shipmentsResult, contractsResult, carriersResult] = await Promise.all([
    db.from('lanes').select(laneSelect).eq('organization_id', organizationId).order('risk_score', { ascending: false }).limit(500),
    db.from('shipments').select(shipmentSelect).eq('organization_id', organizationId).order('shipment_date', { ascending: false }).limit(500),
    db.from('contracts').select(contractSelect).eq('organization_id', organizationId).order('contracted_volume', { ascending: false }).limit(250),
    db.from('carriers').select(carrierSelect).eq('organization_id', organizationId).order('name').limit(150),
  ])

  let carriers = (carriersResult.data ?? []) as any
  if (!carriers.length) {
    const { data: globalCarriers } = await db.from('carriers').select(carrierSelect).order('name').limit(150)
    carriers = globalCarriers ?? []
  }

  return <AppShell><GhostLaneWorkspace view={view} lanes={(lanesResult.data ?? []) as any} shipments={(shipmentsResult.data ?? []) as any} contracts={(contractsResult.data ?? []) as any} carriers={carriers} company={profileResult.data?.company_name || undefined} /></AppShell>
}
