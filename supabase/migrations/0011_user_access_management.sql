-- ASSOMAC Phase 11: Super Administrator user access management.
-- Adds secure role/scope assignment and user deletion RPCs.

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
  v_role_code text;
  v_scope public.user_scope;
  v_old jsonb;
  v_new jsonb;
  v_branch_company uuid;
begin
  if v_actor is null or not public.is_super_admin() then
    raise exception 'Only a Super Administrator can change user roles and scope';
  end if;

  if p_user_id is null or p_role_id is null then
    raise exception 'User and role are required';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'User account not found';
  end if;

  select r.code, r.scope
    into v_role_code, v_scope
  from public.roles r
  where r.id = p_role_id;

  if v_role_code is null then
    raise exception 'Selected role was not found';
  end if;

  if v_role_code = 'SUPER_ADMIN' and p_company_id is not null then
    raise exception 'Super Administrator is a platform-level role and cannot have a company';
  end if;

  if v_scope = 'ASSOMAC' and (p_company_id is not null or p_branch_id is not null) then
    raise exception 'ASSOMAC roles cannot have company or branch scope';
  end if;

  if v_scope = 'COMPANY' and p_company_id is null then
    raise exception 'A company is required for this role';
  end if;

  if v_scope = 'COMPANY' and p_branch_id is not null then
    raise exception 'A company-level role cannot have a branch';
  end if;

  if v_scope = 'BRANCH' and p_branch_id is null then
    raise exception 'A branch is required for this role';
  end if;

  if v_scope = 'BRANCH' and p_company_id is null then
    raise exception 'A company is required for a branch role';
  end if;

  if v_scope = 'OWN_ACCOUNT' and (p_company_id is not null or p_branch_id is not null) then
    raise exception 'Own-account roles cannot have company or branch scope';
  end if;

  if p_branch_id is not null then
    select company_id into v_branch_company
    from public.branches
    where id = p_branch_id;

    if v_branch_company is null then
      raise exception 'Selected branch was not found';
    end if;

    if v_branch_company <> p_company_id then
      raise exception 'Selected branch does not belong to the selected company';
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ur.id,
    'role_id', ur.role_id,
    'role_code', r.code,
    'company_id', ur.company_id,
    'branch_id', ur.branch_id,
    'ended_at', ur.ended_at
  )), '[]'::jsonb)
  into v_old
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = p_user_id
    and ur.ended_at is null;

  update public.user_roles
  set ended_at = now()
  where user_id = p_user_id
    and ended_at is null;

  insert into public.user_roles(user_id, role_id, company_id, branch_id, assigned_at, ended_at)
  values (p_user_id, p_role_id, p_company_id, p_branch_id, now(), null);

  select jsonb_build_object(
    'user_id', p_user_id,
    'role_id', p_role_id,
    'role_code', v_role_code,
    'company_id', p_company_id,
    'branch_id', p_branch_id
  ) into v_new;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, old_data, new_data)
  values (
    v_actor,
    'USER_ROLE_SCOPE_UPDATED',
    'user',
    p_user_id,
    v_old,
    v_new
  );
end;
$$;

revoke all on function public.admin_update_user_access(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.admin_update_user_access(uuid, uuid, uuid, uuid) to authenticated;


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
  v_super_count integer;
begin
  if v_actor is null or not public.is_super_admin() then
    raise exception 'Only a Super Administrator can delete users';
  end if;

  if p_user_id is null then
    raise exception 'User ID is required';
  end if;

  if p_user_id = v_actor then
    raise exception 'You cannot delete your own Super Administrator account';
  end if;

  select email::text
    into v_email
  from auth.users
  where id = p_user_id;

  if v_email is null then
    raise exception 'User account not found';
  end if;

  select count(*)
    into v_super_count
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where r.code = 'SUPER_ADMIN'
    and ur.ended_at is null;

  if exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user_id
      and r.code = 'SUPER_ADMIN'
      and ur.ended_at is null
  ) and v_super_count <= 1 then
    raise exception 'The last Super Administrator cannot be deleted';
  end if;

  select jsonb_build_object(
    'user_id', p_user_id,
    'email', v_email,
    'profile', (
      select to_jsonb(p)
      from public.profiles p
      where p.id = p_user_id
    ),
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'role_id', ur.role_id,
        'role_code', r.code,
        'company_id', ur.company_id,
        'branch_id', ur.branch_id,
        'ended_at', ur.ended_at
      ))
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = p_user_id
    ), '[]'::jsonb)
  )
  into v_old;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, old_data, new_data)
  values (
    v_actor,
    'USER_DELETED',
    'user',
    p_user_id,
    v_old,
    jsonb_build_object('deleted', true, 'email', v_email)
  );

  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
