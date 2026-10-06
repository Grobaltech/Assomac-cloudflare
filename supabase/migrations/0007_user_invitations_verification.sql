-- ASSOMAC migration 0007
-- User invitations, cryptographic token generation, verification and one-time acceptance.

create extension if not exists pgcrypto;

create table if not exists public.user_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  invited_by uuid not null references auth.users(id),
  role_id uuid not null references public.roles(id),
  company_id uuid references public.companies(id),
  branch_id uuid references public.branches(id),
  token_hash text not null unique,
  status text not null default 'PENDING'
    check (status in ('PENDING','ACCEPTED','EXPIRED','REVOKED')),
  expires_at timestamptz not null,
  accepted_user_id uuid references auth.users(id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_invitations_email_idx
  on public.user_invitations (lower(email));

create index if not exists user_invitations_status_idx
  on public.user_invitations (status, expires_at);

alter table public.user_invitations enable row level security;

-- Invitation records are never directly writable from the browser.
-- All writes go through security-definer functions.
revoke all on public.user_invitations from anon, authenticated;

create or replace function public.create_user_invitation(
  p_email text,
  p_role_id uuid,
  p_company_id uuid default null,
  p_branch_id uuid default null,
  p_expires_in_hours integer default 168
)
returns table (
  invitation_id uuid,
  invitation_token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.roles%rowtype;
  v_inviter_company uuid;
  v_inviter_branch uuid;
  v_token text;
  v_hash text;
  v_id uuid;
  v_expires timestamptz;
  v_email text := lower(trim(p_email));
  v_is_super boolean := false;
  v_is_asomac boolean := false;
  v_allowed boolean := false;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if v_email is null or v_email = '' or position('@' in v_email) = 0 then
    raise exception 'A valid email address is required';
  end if;

  if p_expires_in_hours < 1 or p_expires_in_hours > 720 then
    raise exception 'Invitation expiry must be between 1 and 720 hours';
  end if;

  select exists(
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = v_uid
      and r.code = 'SUPER_ADMIN'
      and ur.ended_at is null
  ) into v_is_super;

  select exists(
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = v_uid
      and r.code = 'ASSOMAC_ADMIN'
      and ur.ended_at is null
  ) into v_is_asomac;

  select r.*
    into v_role
  from public.roles r
  where r.id = p_role_id;

  if not found then
    raise exception 'Target role not found';
  end if;

  -- Determine the inviter's company/branch scope.
  select ur.company_id, ur.branch_id
    into v_inviter_company, v_inviter_branch
  from public.user_roles ur
  where ur.user_id = v_uid
    and ur.ended_at is null
    and (ur.company_id is not null or ur.branch_id is not null)
  order by ur.assigned_at desc
  limit 1;

  -- Platform roles are controlled only by Super Admin.
  if v_role.scope = 'ASSOMAC' and not v_is_super then
    raise exception 'Only a Super Administrator can invite platform administrators';
  end if;

  -- Super Admin can invite within any valid scope.
  if v_is_super then
    v_allowed := true;
  elsif v_is_asomac then
    -- ASOMAC may invite company/branch users, but not another ASOMAC administrator.
    v_allowed := v_role.scope <> 'ASSOMAC';
  elsif public.has_permission('user.create') then
    -- Company/branch administrators are restricted to their own scope.
    if v_role.scope = 'COMPANY' then
      v_allowed := p_company_id is not null and p_company_id = v_inviter_company;
    elsif v_role.scope = 'BRANCH' then
      v_allowed := p_branch_id is not null and p_branch_id = v_inviter_branch;
    else
      v_allowed := false;
    end if;
  end if;

  if not v_allowed then
    raise exception 'You are not authorized to create this invitation';
  end if;

  if v_role.scope = 'COMPANY' and p_company_id is null then
    raise exception 'A company is required for a company-scoped role';
  end if;

  if v_role.scope = 'BRANCH' and p_branch_id is null then
    raise exception 'A branch is required for a branch-scoped role';
  end if;

  if v_role.scope = 'ASSOMAC' and (p_company_id is not null or p_branch_id is not null) then
    raise exception 'Platform administrators cannot be assigned to a company or branch';
  end if;

  if p_branch_id is not null then
    if not exists (
      select 1 from public.branches b
      where b.id = p_branch_id
        and (p_company_id is null or b.company_id = p_company_id)
    ) then
      raise exception 'Selected branch does not belong to the selected company';
    end if;
  end if;

  -- Only one live invitation per email at a time.
  update public.user_invitations
  set status = 'EXPIRED', updated_at = now()
  where lower(email) = v_email
    and status = 'PENDING'
    and expires_at <= now();

  if exists (
    select 1 from public.user_invitations
    where lower(email) = v_email
      and status = 'PENDING'
      and expires_at > now()
  ) then
    raise exception 'A pending invitation already exists for this email';
  end if;

  -- 256 bits of random entropy. The raw token is returned once and is never stored.
  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');
  v_expires := now() + make_interval(hours => p_expires_in_hours);

  insert into public.user_invitations (
    email, invited_by, role_id, company_id, branch_id,
    token_hash, status, expires_at
  )
  values (
    v_email, v_uid, p_role_id, p_company_id, p_branch_id,
    v_hash, 'PENDING', v_expires
  )
  returning id into v_id;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, new_data
  )
  values (
    v_uid,
    'USER_INVITATION_CREATED',
    'user_invitation',
    v_id,
    jsonb_build_object(
      'email', v_email,
      'role_id', p_role_id,
      'role_code', v_role.code,
      'company_id', p_company_id,
      'branch_id', p_branch_id,
      'expires_at', v_expires
    )
  );

  return query select v_id, v_token, v_expires;
end;
$$;

create or replace function public.validate_user_invitation(
  p_token text
)
returns table (
  invitation_id uuid,
  email text,
  role_id uuid,
  role_code text,
  role_name text,
  company_id uuid,
  company_name text,
  branch_id uuid,
  branch_name text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  if p_token is null or length(trim(p_token)) < 32 then
    raise exception 'Invalid invitation token';
  end if;

  v_hash := encode(digest(trim(p_token), 'sha256'), 'hex');

  update public.user_invitations
  set status = 'EXPIRED', updated_at = now()
  where token_hash = v_hash
    and status = 'PENDING'
    and expires_at <= now();

  return query
  select
    i.id,
    i.email,
    i.role_id,
    r.code,
    r.name,
    i.company_id,
    c.name,
    i.branch_id,
    b.name,
    i.expires_at
  from public.user_invitations i
  join public.roles r on r.id = i.role_id
  left join public.companies c on c.id = i.company_id
  left join public.branches b on b.id = i.branch_id
  where i.token_hash = v_hash
    and i.status = 'PENDING'
    and i.expires_at > now();

  if not found then
    raise exception 'Invitation is invalid, expired, revoked, or already used';
  end if;
end;
$$;

create or replace function public.accept_user_invitation(
  p_token text
)
returns table (
  invitation_id uuid,
  email text,
  role_id uuid,
  company_id uuid,
  branch_id uuid,
  accepted_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_inv public.user_invitations%rowtype;
  v_auth_email text;
  v_confirmed_at timestamptz;
begin
  if v_uid is null then
    raise exception 'You must be signed in before accepting an invitation';
  end if;

  if p_token is null or length(trim(p_token)) < 32 then
    raise exception 'Invalid invitation token';
  end if;

  v_hash := encode(digest(trim(p_token), 'sha256'), 'hex');

  select *
    into v_inv
  from public.user_invitations
  where token_hash = v_hash
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  if v_inv.status <> 'PENDING' then
    raise exception 'Invitation has already been used or is no longer active';
  end if;

  if v_inv.expires_at <= now() then
    update public.user_invitations
    set status = 'EXPIRED', updated_at = now()
    where id = v_inv.id;
    raise exception 'Invitation has expired';
  end if;

  select email, email_confirmed_at
    into v_auth_email, v_confirmed_at
  from auth.users
  where id = v_uid;

  if lower(coalesce(v_auth_email, '')) <> lower(v_inv.email) then
    raise exception 'The signed-in email does not match the invited email';
  end if;

  if v_confirmed_at is null then
    raise exception 'Email verification must be completed before accepting this invitation';
  end if;

  update public.user_invitations
  set
    status = 'ACCEPTED',
    accepted_user_id = v_uid,
    accepted_at = now(),
    updated_at = now()
  where id = v_inv.id;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, new_data
  )
  values (
    v_uid,
    'USER_INVITATION_ACCEPTED',
    'user_invitation',
    v_inv.id,
    jsonb_build_object(
      'email', v_inv.email,
      'role_id', v_inv.role_id,
      'company_id', v_inv.company_id,
      'branch_id', v_inv.branch_id,
      'accepted_at', now()
    )
  );

  return query
  select
    v_inv.id,
    v_inv.email,
    v_inv.role_id,
    v_inv.company_id,
    v_inv.branch_id,
    v_inv.accepted_at;
end;
$$;

create or replace function public.revoke_user_invitation(
  p_invitation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.user_invitations%rowtype;
  v_allowed boolean := false;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_inv
  from public.user_invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  select
    exists(
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = v_uid
        and r.code = 'SUPER_ADMIN'
        and ur.ended_at is null
    )
    or
    exists(
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = v_uid
        and r.code = 'ASSOMAC_ADMIN'
        and ur.ended_at is null
    )
    or (
      public.has_permission('user.deactivate')
      and exists(
        select 1
        from public.user_roles ur
        where ur.user_id = v_uid
          and ur.ended_at is null
          and (
            (v_inv.company_id is not null and ur.company_id = v_inv.company_id)
            or
            (v_inv.branch_id is not null and ur.branch_id = v_inv.branch_id)
          )
      )
    )
  into v_allowed;

  if not v_allowed then
    raise exception 'You are not authorized to revoke this invitation';
  end if;

  if v_inv.status <> 'PENDING' then
    return false;
  end if;

  update public.user_invitations
  set
    status = 'REVOKED',
    revoked_at = now(),
    revoked_by = v_uid,
    updated_at = now()
  where id = p_invitation_id;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, old_data, new_data
  )
  values (
    v_uid,
    'USER_INVITATION_REVOKED',
    'user_invitation',
    v_inv.id,
    jsonb_build_object('status', v_inv.status, 'email', v_inv.email),
    jsonb_build_object('status', 'REVOKED', 'revoked_at', now())
  );

  return true;
end;
$$;

create or replace function public.resend_user_invitation(
  p_invitation_id uuid,
  p_expires_in_hours integer default 168
)
returns table (
  invitation_id uuid,
  invitation_token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_inv public.user_invitations%rowtype;
  v_uid uuid := auth.uid();
  v_token text;
  v_hash text;
  v_expires timestamptz;
  v_allowed boolean := false;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_expires_in_hours < 1 or p_expires_in_hours > 720 then
    raise exception 'Invitation expiry must be between 1 and 720 hours';
  end if;

  select * into v_inv
  from public.user_invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  select
    exists(
      select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = v_uid and r.code = 'SUPER_ADMIN' and ur.ended_at is null
    )
    or exists(
      select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = v_uid and r.code = 'ASSOMAC_ADMIN' and ur.ended_at is null
    )
    or (
      public.has_permission('user.create')
      and exists(
        select 1 from public.user_roles ur
        where ur.user_id = v_uid
          and ur.ended_at is null
          and (
            (v_inv.company_id is not null and ur.company_id = v_inv.company_id)
            or
            (v_inv.branch_id is not null and ur.branch_id = v_inv.branch_id)
          )
      )
    )
  into v_allowed;

  if not v_allowed then
    raise exception 'You are not authorized to resend this invitation';
  end if;

  if v_inv.status <> 'PENDING' then
    raise exception 'Only pending invitations can be resent';
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');
  v_expires := now() + make_interval(hours => p_expires_in_hours);

  update public.user_invitations
  set token_hash = v_hash,
      expires_at = v_expires,
      updated_at = now()
  where id = p_invitation_id;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, new_data
  )
  values (
    v_uid,
    'USER_INVITATION_RESENT',
    'user_invitation',
    v_inv.id,
    jsonb_build_object('email', v_inv.email, 'expires_at', v_expires)
  );

  return query select v_inv.id, v_token, v_expires;
end;
$$;

revoke all on function public.create_user_invitation(text,uuid,uuid,uuid,integer) from public, anon;
revoke all on function public.validate_user_invitation(text) from public;
revoke all on function public.accept_user_invitation(text) from public, anon;
revoke all on function public.revoke_user_invitation(uuid) from public, anon;
revoke all on function public.resend_user_invitation(uuid,integer) from public, anon;

grant execute on function public.create_user_invitation(text,uuid,uuid,uuid,integer) to authenticated;
grant execute on function public.validate_user_invitation(text) to anon, authenticated;
grant execute on function public.accept_user_invitation(text) to authenticated;
grant execute on function public.revoke_user_invitation(uuid) to authenticated;
grant execute on function public.resend_user_invitation(uuid,integer) to authenticated;
