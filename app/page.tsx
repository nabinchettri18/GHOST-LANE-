import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppShell } from '@/components/app-shell'
import { LandingPage } from '@/components/landing-page'
import { GhostLaneWorkspace } from '@/components/ghostlane-workspace'

const laneSelect = 'id,origin,destination,mode,distance_km,contracted_volume,materialized_volume,carrier,risk_score'
const shipmentSelect = 'shipment_id,lane_id,carrier,shipment_date,volume,status'
const contractSelect = 'contract_id,lane_id,carrier,contracted_volume,contract_rate,start_date,end_date'
const carrierSelect = 'name,acceptance_rate,rejection_rate,cancellation_rate,realization_rate'

export default async function Home() {
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
    return <AppShell><Suspense fallback={<div className="min-h-screen bg-[#f6f8fb]" />}><GhostLaneWorkspace lanes={[]} shipments={[]} contracts={[]} carriers={[]} /></Suspense></AppShell>
  }

  const memberships = membershipResult.data
  const preferred = profileResult.data?.default_organization_id
  const active = (preferred && memberships.find(m => m.organization_id === preferred)) || memberships[0]
  const organizationId = active.organization_id

  const [lanesResult, shipmentsResult, contractsResult, carriersResult] = await Promise.all([
    db.from('lanes').select(laneSelect).eq('organization_id', organizationId).order('risk_score', { ascending: false }).limit(250),
    db.from('shipments').select(shipmentSelect).eq('organization_id', organizationId).order('shipment_date', { ascending: false }).limit(250),
    db.from('contracts').select(contractSelect).eq('organization_id', organizationId).order('contracted_volume', { ascending: false }).limit(100),
    db.from('carriers').select(carrierSelect).or(`organization_id.eq.${organizationId},organization_id.is.null,organization_id.eq.f44ec0f4-759c-4b6b-b912-807cf8499cb8`).order('name').limit(100),
  ])

  return (
    <AppShell>
      <Suspense fallback={<div className="min-h-screen bg-[#f6f8fb]" />}>
        <GhostLaneWorkspace
          lanes={(lanesResult.data ?? []) as any}
          shipments={(shipmentsResult.data ?? []) as any}
          contracts={(contractsResult.data ?? []) as any}
          carriers={(carriersResult.data ?? []) as any}
          company={profileResult.data?.company_name || undefined}
        />
      </Suspense>
    </AppShell>
  )
}
