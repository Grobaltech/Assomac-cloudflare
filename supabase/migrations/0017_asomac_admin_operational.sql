-- ASOMAC Phase 17: make platform administration operational for
-- Super Administrators and ASOMAC Administrators.
--
-- This migration fills the administrative RPCs used by the web application.
-- Super Administrators retain unrestricted platform control.
-- ASOMAC Administrators can manage non-platform users, but cannot create,
-- modify, or delete SUPER_ADMIN / ASSOMAC_ADMIN accounts.

create or replace function public.admin_list_users()
returns table (
  user_id uuid,
  email text,
  full_name text,
  common_name text,
  phone text,
  avatar_url text,
  status public.record_status,
  role_code text,
  role_name text,
  role_scope public.user_scope,
  company_id uuid,
  company_name text,
  branch_id uuid,
  branch_name text,
  role_ended_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_asomac_admin() then
    raise exception 'Platform administration access required';
  end if;

  return query
  select
    p.id,
    coalesce(au.email::text, p.email),
    p.full_name,
    p.common_name,
    p.phone,
    p.avatar_url,
    p.status,
    r.code,
    r.name,
    r.scope,
    ur.company_id,
    c.name,
    ur.branch_id,
    b.name,
    ur.ended_at
  from public.profiles p
  left join auth.users au on au.id=p.id
  left join lateral (
    select ur.*
    from public.user_roles ur
    where ur.user_id=p.id
      and ur.ended_at is null
    order by ur.assigned_at desc
    limit 1
  ) ur on true
  left join public.roles r on r.id=ur.role_id
  left join public.companies c on c.id=ur.company_id
  left join public.branches b on b.id=ur.branch_id
  order by lower(coalesce(p.full_name, au.email::text, '')) asc;
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;


create or replace function public.admin_update_user_profile(
  p_user_id uuid,
  p_full_name text default null,
  p_phone text default null,
  p_status text default 'ACTIVE'
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_actor uuid := auth.uid();
  v_target_platform boolean;
  v_old jsonb;
begin
  if v_actor is null or not public.is_asomac_admin() then
    raise exception 'Platform administration access required';
  end if;

  if p_user_id is null then
    raise exception 'User ID is required';
  end if;

  if not exists (select 1 from public.profiles where id=p_user_id) then
    raise exception 'User profile not found';
  end if;

  if p_status not in ('ACTIVE','INACTIVE','SUSPENDED','CLOSED') then
    raise exception 'Invalid user status';
  end if;

  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id=ur.role_id
    where ur.user_id=p_user_id
      and ur.ended_at is null
      and r.code in ('SUPER_ADMIN','ASSOMAC_ADMIN')
  ) into v_target_platform;

  if v_target_platform and not public.is_super_admin() then
    raise exception 'Only the Super Administrator can modify platform administrator accounts';
  end if;

  if p_user_id=v_actor and p_status<>'ACTIVE' then
    raise exception 'You cannot deactivate your own administrator account';
  end if;

  select to_jsonb(p) into v_old
  from public.profiles p
  where p.id=p_user_id;

  update public.profiles
  set
    full_name=coalesce(nullif(trim(p_full_name),''),full_name),
    phone=case
      when p_phone is null then phone
      else nullif(trim(p_phone),'')
    end,
    status=p_status::public.record_status,
    updated_at=now()
  where id=p_user_id;

  insert into public.audit_logs(
    actor_id,action,entity_type,entity_id,old_data,new_data
  )
  values(
    v_actor,
    'USER_PROFILE_UPDATED',
    'user',
    p_user_id,
    v_old,
    (select to_jsonb(p) from public.profiles p where p.id=p_user_id)
  );
end;
$$;

revoke all on function public.admin_update_user_profile(uuid,text,text,text) from public, anon;
grant execute on function public.admin_update_user_profile(uuid,text,text,text) to authenticated;


create or replace function public.admin_update_user_access(
  p_user_id uuid,
  p_role_id uuid,
  p_company_id uuid default null,
  p_branch_id uuid default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.roles%rowtype;
  v_target_platform boolean;
  v_old jsonb;
  v_branch_company uuid;
begin
  if v_actor is null or not public.is_asomac_admin() then
    raise exception 'Platform administration access required';
  end if;

  if p_user_id is null or p_role_id is null then
    raise exception 'User and role are required';
  end if;

  if not exists (select 1 from auth.users where id=p_user_id) then
    raise exception 'User account not found';
  end if;

  select * into v_role from public.roles where id=p_role_id;
  if not found then
    raise exception 'Selected role was not found';
  end if;

  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id=ur.role_id
    where ur.user_id=p_user_id
      and ur.ended_at is null
      and r.code in ('SUPER_ADMIN','ASSOMAC_ADMIN')
  ) into v_target_platform;

  if (v_target_platform or v_role.code in ('SUPER_ADMIN','ASSOMAC_ADMIN'))
     and not public.is_super_admin() then
    raise exception 'Only the Super Administrator can manage platform administrator roles';
  end if;

  if v_role.code='SUPER_ADMIN' and p_company_id is not null then
    raise exception 'Super Administrator is a platform-level role and cannot have a company';
  end if;

  if v_role.scope='ASSOMAC' and (p_company_id is not null or p_branch_id is not null) then
    raise exception 'ASOMAC roles cannot have company or branch scope';
  end if;

  if v_role.scope='COMPANY' and p_company_id is null then
    raise exception 'A company is required for this role';
  end if;

  if v_role.scope='COMPANY' and p_branch_id is not null then
    raise exception 'A company-level role cannot have a branch';
  end if;

  if v_role.scope='BRANCH' and (p_company_id is null or p_branch_id is null) then
    raise exception 'A company and branch are required for a branch role';
  end if;

  if v_role.scope='OWN_ACCOUNT' and (p_company_id is not null or p_branch_id is not null) then
    raise exception 'Own-account roles cannot have company or branch scope';
  end if;

  if p_branch_id is not null then
    select company_id into v_branch_company
    from public.branches
    where id=p_branch_id;

    if v_branch_company is null then
      raise exception 'Selected branch was not found';
    end if;

    if v_branch_company<>p_company_id then
      raise exception 'Selected branch does not belong to the selected company';
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',ur.id,
    'role_id',ur.role_id,
    'role_code',r.code,
    'company_id',ur.company_id,
    'branch_id',ur.branch_id,
    'ended_at',ur.ended_at
  )),'[]'::jsonb)
  into v_old
  from public.user_roles ur
  join public.roles r on r.id=ur.role_id
  where ur.user_id=p_user_id
    and ur.ended_at is null;

  update public.user_roles
  set ended_at=now()
  where user_id=p_user_id
    and ended_at is null;

  insert into public.user_roles(
    user_id,role_id,company_id,branch_id,assigned_at,ended_at
  )
  values(p_user_id,p_role_id,p_company_id,p_branch_id,now(),null);

  insert into public.audit_logs(
    actor_id,action,entity_type,entity_id,old_data,new_data
  )
  values(
    v_actor,
    'USER_ROLE_SCOPE_UPDATED',
    'user',
    p_user_id,
    v_old,
    jsonb_build_object(
      'user_id',p_user_id,
      'role_id',p_role_id,
      'role_code',v_role.code,
      'company_id',p_company_id,
      'branch_id',p_branch_id
    )
  );
end;
$$;

revoke all on function public.admin_update_user_access(uuid,uuid,uuid,uuid) from public, anon;
grant execute on function public.admin_update_user_access(uuid,uuid,uuid,uuid) to authenticated;


create or replace function public.admin_delete_user(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_actor uuid := auth.uid();
  v_email text;
  v_old jsonb;
  v_target_platform boolean;
  v_super_count integer;
begin
  if v_actor is null or not public.is_asomac_admin() then
    raise exception 'Platform administration access required';
  end if;

  if p_user_id is null then
    raise exception 'User ID is required';
  end if;

  if p_user_id=v_actor then
    raise exception 'You cannot delete your own administrator account';
  end if;

  select email::text into v_email
  from auth.users
  where id=p_user_id;

  if v_email is null then
    raise exception 'User account not found';
  end if;

  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id=ur.role_id
    where ur.user_id=p_user_id
      and ur.ended_at is null
      and r.code in ('SUPER_ADMIN','ASSOMAC_ADMIN')
  ) into v_target_platform;

  if v_target_platform and not public.is_super_admin() then
    raise exception 'Only the Super Administrator can delete platform administrator accounts';
  end if;

  select count(*) into v_super_count
  from public.user_roles ur
  join public.roles r on r.id=ur.role_id
  where r.code='SUPER_ADMIN'
    and ur.ended_at is null;

  if exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id=ur.role_id
    where ur.user_id=p_user_id
      and r.code='SUPER_ADMIN'
      and ur.ended_at is null
  ) and v_super_count<=1 then
    raise exception 'The last Super Administrator cannot be deleted';
  end if;

  select jsonb_build_object(
    'user_id',p_user_id,
    'email',v_email,
    'profile',(select to_jsonb(p) from public.profiles p where p.id=p_user_id),
    'roles',coalesce((
      select jsonb_agg(jsonb_build_object(
        'role_id',ur.role_id,
        'role_code',r.code,
        'company_id',ur.company_id,
        'branch_id',ur.branch_id,
        'ended_at',ur.ended_at
      ))
      from public.user_roles ur
      join public.roles r on r.id=ur.role_id
      where ur.user_id=p_user_id
    ),'[]'::jsonb)
  ) into v_old;

  insert into public.audit_logs(
    actor_id,action,entity_type,entity_id,old_data,new_data
  )
  values(
    v_actor,
    'USER_DELETED',
    'user',
    p_user_id,
    v_old,
    jsonb_build_object('deleted',true,'email',v_email)
  );

  delete from auth.users where id=p_user_id;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;


-- Direct creation intentionally remains Super Administrator-only.
-- ASOMAC Administrators use the secure invitation flow.

