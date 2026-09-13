import { NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

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
    const { data: existing } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (!existing) {
      const name = String(user.user_metadata?.company_name || user.user_metadata?.full_name || 'My Workspace').trim().slice(0, 120) || 'My Workspace'
      const { data: organization } = await supabase.from('organizations').insert({ name, created_by: user.id }).select('id').single()
      if (organization) {
        const { error: memberError } = await supabase.from('organization_members').insert({ organization_id: organization.id, user_id: user.id, role: 'owner' })
        if (!memberError) await supabase.from('profiles').update({ default_organization_id: organization.id }).eq('id', user.id)
      }
    }
  }

  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'
  return NextResponse.redirect(new URL(safeNext, url.origin))
}
