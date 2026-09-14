import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') || '/'
  if (!code) return NextResponse.redirect(new URL('/login?error=missing_code', url.origin))

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(new URL('/login?error=auth_callback', url.origin))

  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    try {
      const hasServiceKey = Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
      const admin = hasServiceKey ? createAdminClient() : supabase
      const { data: existing } = await admin
        .from('organization_members').select('organization_id').eq('user_id', user.id)
        .order('created_at', { ascending: true }).limit(1).maybeSingle()

      if (!existing) {
        const name = String(user.user_metadata?.company_name || user.user_metadata?.full_name || 'My Workspace').trim().slice(0, 120) || 'My Workspace'
        const { data: organization, error: organizationError } = await admin
          .from('organizations').insert({ name, created_by: user.id }).select('id').single()
        if (organization && !organizationError) {
          const { error: memberError } = await admin.from('organization_members').insert({
            organization_id: organization.id, user_id: user.id, role: 'owner',
          })
          if (!memberError) {
            await admin.from('profiles').upsert({
              id: user.id,
              full_name: user.user_metadata?.full_name ?? null,
              company_name: user.user_metadata?.company_name ?? null,
              default_organization_id: organization.id,
            })
          } else {
            await admin.from('organizations').delete().eq('id', organization.id)
          }
        }
      }
    } catch (provisioningError) {
      console.error('auth workspace provisioning failed', provisioningError)
    }
  }

  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'
  return NextResponse.redirect(new URL(safeNext, url.origin))
}
