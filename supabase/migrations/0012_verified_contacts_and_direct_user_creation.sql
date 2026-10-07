-- ASOMAC Phase 12: verified contact details and direct administrator user provisioning.

alter table public.profiles
  add column if not exists country_code text default '+256',
  add column if not exists phone_verified_at timestamptz;

alter table public.user_invitations
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists country_code text default '+256';

comment on column public.profiles.country_code is 'Locked international dialing code selected by the application.';
comment on column public.profiles.phone_verified_at is 'Timestamp of successful phone OTP verification.';
comment on column public.user_invitations.phone is 'Invited user phone number in E.164 format.';
comment on column public.user_invitations.country_code is 'International dialing code used for the invited phone number.';

create index if not exists idx_profiles_phone on public.profiles(phone);
create index if not exists idx_invitations_phone on public.user_invitations(phone);

-- New invitation entry point. It deliberately delegates permission checks and
-- secure token generation to the existing create_user_invitation function.
create or replace function public.create_user_invitation_v2(
  p_email text,
  p_full_name text,
  p_phone text,
  p_country_code text,
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
  v_created record;
  v_country text := trim(coalesce(p_country_code, '+256'));
  v_phone text := trim(coalesce(p_phone, ''));
begin
  if p_email is null or position('@' in trim(p_email)) = 0 then
    raise exception 'A valid email address is required';
  end if;

  if p_full_name is null or trim(p_full_name) = '' then
    raise exception 'Full name is required';
  end if;

  if v_phone = '' or v_phone !~ '^\\+[0-9]{8,15}$' then
    raise exception 'A valid international phone number is required';
  end if;

  if v_country !~ '^\\+[0-9]{1,4}$' then
    raise exception 'A valid country calling code is required';
  end if;

  select *
  into v_created
  from public.create_user_invitation(
    lower(trim(p_email)),
    p_role_id,
    p_company_id,
    p_branch_id,
    p_expires_in_hours
  );

  update public.user_invitations
  set
    full_name = trim(p_full_name),
    phone = v_phone,
    country_code = v_country,
    updated_at = now()
  where id = v_created.invitation_id;

  return query
  select v_created.invitation_id, v_created.invitation_token, v_created.expires_at;
end;
$$;

revoke all on function public.create_user_invitation_v2(text,text,text,text,uuid,uuid,uuid,integer) from public, anon;
grant execute on function public.create_user_invitation_v2(text,text,text,text,uuid,uuid,uuid,integer) to authenticated;

-- Called only by the trusted Worker after Supabase Auth has created a user.
-- The browser never receives service-role credentials.
create or replace function public.admin_register_auth_user(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_phone text,
  p_country_code text,
  p_role_id uuid,
  p_company_id uuid default null,
  p_branch_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.roles%rowtype;
begin
  if v_actor is null or not public.is_super_admin() then
    raise exception 'Only a Super Administrator can add users directly';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Auth user was not created';
  end if;

  select * into v_role from public.roles where id = p_role_id;
  if not found then
    raise exception 'Selected role was not found';
  end if;

  if v_role.code = 'SUPER_ADMIN' and p_company_id is not null then
    raise exception 'Super Administrator cannot have company scope';
  end if;

  if v_role.scope = 'COMPANY' and p_company_id is null then
    raise exception 'A company is required for this role';
  end if;

  if v_role.scope = 'BRANCH' and (p_company_id is null or p_branch_id is null) then
    raise exception 'A company and branch are required for this role';
  end if;

  if p_branch_id is not null and not exists (
    select 1 from public.branches b
    where b.id = p_branch_id and b.company_id = p_company_id
  ) then
    raise exception 'Selected branch does not belong to the selected company';
  end if;

  insert into public.profiles(id, full_name, phone, email, country_code, status)
  values (
    p_user_id,
    trim(p_full_name),
    nullif(trim(p_phone), ''),
    lower(trim(p_email)),
    coalesce(nullif(trim(p_country_code), ''), '+256'),
    'ACTIVE'
  )
  on conflict (id) do update
  set full_name = excluded.full_name,
      phone = excluded.phone,
      email = excluded.email,
      country_code = excluded.country_code,
      updated_at = now();

  update public.user_roles
  set ended_at = now()
  where user_id = p_user_id and ended_at is null;

  insert into public.user_roles(user_id, role_id, company_id, branch_id)
  values (p_user_id, p_role_id, p_company_id, p_branch_id);

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, new_data)
  values (
    v_actor,
    'USER_CREATED',
    'user',
    p_user_id,
    jsonb_build_object(
      'email', lower(trim(p_email)),
      'role_id', p_role_id,
      'role_code', v_role.code,
      'company_id', p_company_id,
      'branch_id', p_branch_id
    )
  );
end;
$$;

revoke all on function public.admin_register_auth_user(uuid,text,text,text,text,uuid,uuid,uuid) from public, anon;
grant execute on function public.admin_register_auth_user(uuid,text,text,text,text,uuid,uuid,uuid) to authenticated;

-- Keep direct user management explicitly platform-admin-only.
comment on function public.admin_register_auth_user(uuid,text,text,text,text,uuid,uuid,uuid)
is 'Creates the application profile and role assignment after the trusted server creates auth.users.';
