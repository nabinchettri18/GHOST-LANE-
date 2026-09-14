import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { allowRequest, isSameOrigin } from '@/lib/security'

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 })

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 })

  if (!allowRequest(`bootstrap:${user.id}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many workspace initialization attempts' }, { status: 429 })
  }

  const name = String(user.user_metadata?.company_name || user.user_metadata?.full_name || 'My Workspace').trim().slice(0, 120) || 'My Workspace'

  // 1. First, check if an organization membership already exists for this user
  try {
    const { data: existingMember } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (existingMember?.organization_id) {
      await supabase.from('profiles').upsert({
        id: user.id,
        full_name: user.user_metadata?.full_name ?? null,
        company_name: user.user_metadata?.company_name ?? null,
        default_organization_id: existingMember.organization_id,
      })
      return NextResponse.json({ organizationId: existingMember.organization_id, role: existingMember.role })
    }
  } catch (e) {
    console.warn('Existing membership lookup fallback:', e)
  }

  // 2. Check if a service role key is available
  const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)
  const db = hasServiceKey ? createAdminClient() : supabase

  try {
    // Create new organization
    const { data: organization, error: orgError } = await db
      .from('organizations')
      .insert({ name, created_by: user.id })
      .select('id')
      .single()

    if (orgError || !organization) {
      const msg = orgError?.message || 'Failed to create organization record.'
      console.error('Org creation error:', orgError)
      return NextResponse.json({
        error: `Database setup required: ${msg}. If this is an RLS policy issue, please add SUPABASE_SERVICE_ROLE_KEY to your .env file.`
      }, { status: 500 })
    }

    // Insert organization member as owner
    const { error: memberError } = await db
      .from('organization_members')
      .insert({
        organization_id: organization.id,
        user_id: user.id,
        role: 'owner',
      })

    if (memberError) {
      console.error('Member insert error:', memberError)
      // Rollback org if possible
      await db.from('organizations').delete().eq('id', organization.id)

      if (memberError.code === '42501' && !hasServiceKey) {
        return NextResponse.json({
          error: 'SUPABASE_SERVICE_ROLE_KEY is missing in your .env file. Copy the "service_role" secret key from your Supabase Dashboard (Project Settings > API) to your .env file.'
        }, { status: 500 })
      }

      return NextResponse.json({
        error: `Could not assign workspace owner: ${memberError.message}. Add SUPABASE_SERVICE_ROLE_KEY to your .env file.`
      }, { status: 500 })
    }

    // Upsert profile
    await db.from('profiles').upsert({
      id: user.id,
      full_name: user.user_metadata?.full_name ?? null,
      company_name: user.user_metadata?.company_name ?? null,
      default_organization_id: organization.id,
    })

    return NextResponse.json({ organizationId: organization.id, role: 'owner' })
  } catch (error) {
    console.error('workspace bootstrap failed:', error)
    const message = error instanceof Error ? error.message : 'Unknown database error'
    return NextResponse.json({
      error: `Workspace setup failed: ${message}. Ensure SUPABASE_SERVICE_ROLE_KEY is set in .env.`
    }, { status: 500 })
  }
}
