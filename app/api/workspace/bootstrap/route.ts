import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: existing } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (existing) {
    await supabase.from('profiles').update({ default_organization_id: existing.organization_id }).eq('id', user.id)
    return NextResponse.json({ organizationId: existing.organization_id, role: existing.role })
  }

  const name = String(user.user_metadata?.company_name || user.user_metadata?.full_name || 'My Workspace').trim().slice(0, 120) || 'My Workspace'
  const { data: organization, error: orgError } = await supabase
    .from('organizations').insert({ name, created_by: user.id }).select('id').single()

  if (orgError || !organization) return NextResponse.json({ error: 'Unable to create workspace' }, { status: 500 })

  const { error: memberError } = await supabase
    .from('organization_members').insert({ organization_id: organization.id, user_id: user.id, role: 'owner' })

  if (memberError) {
    await supabase.from('organizations').delete().eq('id', organization.id)
    return NextResponse.json({ error: 'Unable to initialize workspace' }, { status: 500 })
  }

  await supabase.from('profiles').update({ default_organization_id: organization.id }).eq('id', user.id)
  return NextResponse.json({ organizationId: organization.id, role: 'owner' })
}
