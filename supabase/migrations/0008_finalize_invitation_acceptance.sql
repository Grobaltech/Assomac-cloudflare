-- ASSOMAC migration 0008
-- Finalize invitation acceptance: activate profile and assign the invited role.
-- Also prevent invitations to the SUPER_ADMIN platform role.

create or replace function public.create_user_invitation(
  p_email text,
  p_role_id uuid,
  p_company_id uuid default null,
  p_branch_id uuid default null,
  p_expires_in_hours integer default 168
)
returns table (invitation_id uuid, invitation_token text, expires_at timestamptz)
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
  if v_uid is null then raise exception 'Authentication required'; end if;
  if v_email is null or v_email = '' or position('@' in v_email) = 0 then raise exception 'A valid email address is required'; end if;
  if p_expires_in_hours < 1 or p_expires_in_hours > 720 then raise exception 'Invitation expiry must be between 1 and 720 hours'; end if;

  select exists(
    select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
    where ur.user_id=v_uid and r.code='SUPER_ADMIN' and ur.ended_at is null
  ) into v_is_super;

  select exists(
    select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
    where ur.user_id=v_uid and r.code='ASSOMAC_ADMIN' and ur.ended_at is null
  ) into v_is_asomac;

  select r.* into v_role from public.roles r where r.id=p_role_id;
  if not found then raise exception 'Target role not found'; end if;

  if v_role.code = 'SUPER_ADMIN' then
    raise exception 'SUPER_ADMIN invitations are disabled; Super Administrator accounts must be bootstrapped securely';
  end if;

  select ur.company_id, ur.branch_id into v_inviter_company, v_inviter_branch
  from public.user_roles ur
  where ur.user_id=v_uid and ur.ended_at is null and (ur.company_id is not null or ur.branch_id is not null)
  order by ur.assigned_at desc limit 1;

  if v_role.scope='ASSOMAC' and not v_is_super then
    raise exception 'Only a Super Administrator can invite platform administrators';
  end if;

  if v_is_super then
    v_allowed := true;
  elsif v_is_asomac then
    v_allowed := v_role.scope <> 'ASSOMAC';
  elsif public.has_permission('user.create') then
    if v_role.scope='COMPANY' then
      v_allowed := p_company_id is not null and p_company_id=v_inviter_company;
    elsif v_role.scope='BRANCH' then
      v_allowed := p_branch_id is not null and p_branch_id=v_inviter_branch;
    end if;
  end if;

  if not v_allowed then raise exception 'You are not authorized to create this invitation'; end if;

  if v_role.scope='COMPANY' and p_company_id is null then raise exception 'A company is required for a company-scoped role'; end if;
  if v_role.scope='BRANCH' and p_branch_id is null then raise exception 'A branch is required for a branch-scoped role'; end if;
  if v_role.scope='ASSOMAC' and (p_company_id is not null or p_branch_id is not null) then raise exception 'Platform administrators cannot be assigned to a company or branch'; end if;

  if p_branch_id is not null and not exists(
    select 1 from public.branches b where b.id=p_branch_id and (p_company_id is null or b.company_id=p_company_id)
  ) then raise exception 'Selected branch does not belong to the selected company'; end if;

  update public.user_invitations set status='EXPIRED', updated_at=now()
  where lower(email)=v_email and status='PENDING' and expires_at<=now();

  if exists(select 1 from public.user_invitations where lower(email)=v_email and status='PENDING' and expires_at>now()) then
    raise exception 'A pending invitation already exists for this email';
  end if;

  v_token := encode(gen_random_bytes(32),'hex');
  v_hash := encode(digest(v_token,'sha256'),'hex');
  v_expires := now()+make_interval(hours=>p_expires_in_hours);

  insert into public.user_invitations(email,invited_by,role_id,company_id,branch_id,token_hash,status,expires_at)
  values(v_email,v_uid,p_role_id,p_company_id,p_branch_id,v_hash,'PENDING',v_expires)
  returning id into v_id;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,new_data)
  values(v_uid,'USER_INVITATION_CREATED','user_invitation',v_id,
    jsonb_build_object('email',v_email,'role_id',p_role_id,'role_code',v_role.code,'company_id',p_company_id,'branch_id',p_branch_id,'expires_at',v_expires));

  return query select v_id,v_token,v_expires;
end;
$$;

create or replace function public.accept_user_invitation(p_token text)
returns table (invitation_id uuid,email text,role_id uuid,company_id uuid,branch_id uuid,accepted_at timestamptz)
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
  v_role_scope public.user_scope;
begin
  if v_uid is null then raise exception 'You must be signed in before accepting an invitation'; end if;
  if p_token is null or length(trim(p_token)) < 32 then raise exception 'Invalid invitation token'; end if;

  v_hash := encode(digest(trim(p_token),'sha256'),'hex');

  select * into v_inv from public.user_invitations where token_hash=v_hash for update;
  if not found then raise exception 'Invitation not found'; end if;
  if v_inv.status <> 'PENDING' then raise exception 'Invitation has already been used or is no longer active'; end if;

  if v_inv.expires_at<=now() then
    update public.user_invitations set status='EXPIRED',updated_at=now() where id=v_inv.id;
    raise exception 'Invitation has expired';
  end if;

  select email,email_confirmed_at into v_auth_email,v_confirmed_at from auth.users where id=v_uid;
  if lower(coalesce(v_auth_email,''))<>lower(v_inv.email) then raise exception 'The signed-in email does not match the invited email'; end if;
  if v_confirmed_at is null then raise exception 'Email verification must be completed before accepting this invitation'; end if;

  select scope into v_role_scope from public.roles where id=v_inv.role_id;
  if not found then raise exception 'Assigned role no longer exists'; end if;

  if exists(
    select 1 from public.user_roles
    where user_id=v_uid and role_id=v_inv.role_id
      and coalesce(company_id,'00000000-0000-0000-0000-000000000000')=coalesce(v_inv.company_id,'00000000-0000-0000-0000-000000000000')
      and coalesce(branch_id,'00000000-0000-0000-0000-000000000000')=coalesce(v_inv.branch_id,'00000000-0000-0000-0000-000000000000')
      and ended_at is null
  ) then
    raise exception 'This role assignment already exists for the account';
  end if;

  insert into public.user_roles(user_id,role_id,company_id,branch_id,assigned_at,ended_at)
  values(v_uid,v_inv.role_id,v_inv.company_id,v_inv.branch_id,now(),null);

  update public.profiles
  set status='ACTIVE', email=v_inv.email, updated_at=now()
  where id=v_uid;

  update public.user_invitations
  set status='ACCEPTED',accepted_user_id=v_uid,accepted_at=now(),updated_at=now()
  where id=v_inv.id;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,new_data)
  values(v_uid,'USER_INVITATION_ACCEPTED','user_invitation',v_inv.id,
    jsonb_build_object('email',v_inv.email,'role_id',v_inv.role_id,'role_scope',v_role_scope,'company_id',v_inv.company_id,'branch_id',v_inv.branch_id,'accepted_at',now()));

  return query select v_inv.id,v_inv.email,v_inv.role_id,v_inv.company_id,v_inv.branch_id,v_inv.accepted_at;
end;
$$;

revoke all on function public.create_user_invitation(text,uuid,uuid,uuid,integer) from public,anon;
revoke all on function public.accept_user_invitation(text) from public,anon;
grant execute on function public.create_user_invitation(text,uuid,uuid,uuid,integer) to authenticated;
grant execute on function public.accept_user_invitation(text) to authenticated;
