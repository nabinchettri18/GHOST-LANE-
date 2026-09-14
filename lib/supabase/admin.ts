import { createClient } from '@supabase/supabase-js'

/** Server-only Supabase client for trusted workspace provisioning. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase server secret is not configured')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
