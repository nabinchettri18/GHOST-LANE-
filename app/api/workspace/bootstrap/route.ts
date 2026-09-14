import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { allowRequest, isSameOrigin } from '@/lib/security'

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 })
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!allowRequest(`bootstrap:${user.id}`, 3, 60_000)) return NextResponse.json({ error: 'Too many workspace initialization attempts' }, { status: 429 })

  try {
    const admin = createAdminClient()
    const { data: existing, error: membershipError } = await admin
      .from('organization_members').select('organization_id, role').eq('user_id', user.id)
      .order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (membershipError) throw membershipError

    if (existing) {
      const { error } = await admin.from('profiles').upsert({
        id: user.id,
        full_name: user.user_metadata?.full_name ?? null,
        company_name: user.user_metadata?.company_name ?? null,
        default_organization_id: existing.organization_id,
      })
      if (error) throw error
      return NextResponse.json({ organizationId: existing.organization_id, role: existing.role })
    }

    const name = String(user.user_metadata?.company_name || user.user_metadata?.full_name || 'My Workspace').trim().slice(0, 120) || 'My Workspace'
    const { data: organization, error: orgError } = await admin
      .from('organizations').insert({ name, created_by: user.id }).select('id').single()
    if (orgError || !organization) throw orgError || new Error('Unable to create workspace')

    const { error: memberError } = await admin.from('organization_members').insert({
      organization_id: organization.id, user_id: user.id, role: 'owner',
    })
    if (memberError) {
      await admin.from('organizations').delete().eq('id', organization.id)
      throw memberError
    }

    const { error: profileError } = await admin.from('profiles').upsert({
      id: user.id,
      full_name: user.user_metadata?.full_name ?? null,
      company_name: user.user_metadata?.company_name ?? null,
      default_organization_id: organization.id,
    })
    if (profileError) throw profileError

    return NextResponse.json({ organizationId: organization.id, role: 'owner' })
  } catch (error) {
    console.error('workspace bootstrap failed', error)
    return NextResponse.json({ error: 'Unable to initialize your GhostLane workspace' }, { status: 500 })
  }
}
