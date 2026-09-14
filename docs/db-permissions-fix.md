# Database permissions fix

The workspace relies on `public.is_org_member(uuid)` and `public.is_org_admin(uuid)` for organization-scoped RLS. Execute privileges for the authenticated role were repaired in the connected Supabase project so authenticated workspace reads/imports can evaluate the policies correctly.
