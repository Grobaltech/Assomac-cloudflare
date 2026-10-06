-- ASSOMAC migration 0010
-- Super Administrator invitation history and control center.
-- Direct table access remains blocked; only the Super Administrator RPC can read it.

create or replace function public.admin_list_user_invitations()
returns table (
  invitation_id uuid,
  email text,
  role_id uuid,
  role_code text,
  role_name text,
  role_scope text,
  company_id uuid,
  company_name text,
  branch_id uuid,
  branch_name text,
  invited_by uuid,
  invited_by_email text,
  status text,
  email_sent_at timestamptz,
  email_send_count integer,
  expires_at timestamptz,
  accepted_user_id uuid,
  accepted_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_is_super boolean := false;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select exists(
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = v_uid
      and r.code = 'SUPER_ADMIN'
      and ur.ended_at is null
  ) into v_is_super;

  if not v_is_super then
    raise exception 'Only a Super Administrator can view sent invitations';
  end if;

  return query
  select
    i.id,
    i.email,
    i.role_id,
    r.code,
    r.name,
    r.scope,
    i.company_id,
    c.name,
    i.branch_id,
    b.name,
    i.invited_by,
    au.email,
    i.status,
    i.email_sent_at,
    i.email_send_count,
    i.expires_at,
    i.accepted_user_id,
    i.accepted_at,
    i.revoked_at,
    i.revoked_by,
    i.created_at,
    i.updated_at
  from public.user_invitations i
  join public.roles r on r.id = i.role_id
  left join public.companies c on c.id = i.company_id
  left join public.branches b on b.id = i.branch_id
  left join auth.users au on au.id = i.invited_by
  order by i.created_at desc;
end;
$$;

revoke all on function public.admin_list_user_invitations() from public, anon;
grant execute on function public.admin_list_user_invitations() to authenticated;
