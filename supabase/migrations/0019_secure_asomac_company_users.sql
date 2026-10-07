-- Phase 19: secure ASOMAC company-user assignment helpers.
-- Super Administrator retains global authority; ASOMAC Chairperson can use these
-- helpers only for company-level administration.

create or replace function public.list_company_administrators(p_company_id uuid)
returns table(
  user_id uuid,
  email text,
  full_name text,
  phone text,
  status public.record_status,
  assigned_at timestamptz,
  role_ended_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null or not (public.is_super_admin() or public.is_asomac_admin()) then
    raise exception 'ASOMAC company administration access required';
  end if;

  if p_company_id is null then
    raise exception 'Company is required';
  end if;

  return query
  select
    p.id,
    p.email,
    p.full_name,
    p.phone,
    p.status,
    ur.assigned_at,
    ur.ended_at
  from public.user_roles ur
  join public.roles r on r.id=ur.role_id
  join public.profiles p on p.id=ur.user_id
  where ur.company_id=p_company_id
    and r.code='COMPANY_ADMIN'
  order by ur.ended_at nulls first, p.full_name;
end;
$$;

revoke all on function public.list_company_administrators(uuid) from public, anon;
grant execute on function public.list_company_administrators(uuid) to authenticated;
