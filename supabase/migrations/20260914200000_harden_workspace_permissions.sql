do $$
begin
  if to_regprocedure('public.is_org_admin(uuid)') is not null then
    execute 'grant execute on function public.is_org_admin(uuid) to authenticated';
  end if;
  if to_regprocedure('public.is_org_member(uuid)') is not null then
    execute 'grant execute on function public.is_org_member(uuid) to authenticated';
  end if;
end $$;

-- Keep organization helper functions safe for RLS while allowing the authenticated
-- application role to invoke them. The functions themselves remain server-owned.
