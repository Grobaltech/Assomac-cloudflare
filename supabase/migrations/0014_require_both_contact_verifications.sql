-- ASOMAC Phase 14: invited users must verify BOTH email and phone before activation.
-- Super-Administrator-created users are explicitly exempt because the administrator
-- creates and confirms the account directly.

alter table public.user_invitations
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists country_code text default '+256';

create or replace function public.validate_user_invitation(p_token text)
returns table (
  invitation_id uuid,
  email text,
  full_name text,
  phone text,
  country_code text,
  role_id uuid,
  role_code text,
  role_name text,
  company_id uuid,
  company_name text,
  branch_id uuid,
  branch_name text,
  expires_at timestamptz
)
language plpgsql security definer
set search_path = public, extensions
as $$
declare v_hash text;
begin
  if p_token is null or length(trim(p_token)) < 32 then
    raise exception 'Invalid invitation token';
  end if;
  v_hash := encode(digest(trim(p_token), 'sha256'), 'hex');

  update public.user_invitations
  set status='EXPIRED', updated_at=now()
  where token_hash=v_hash and status='PENDING' and expires_at<=now();

  return query
  select i.id,i.email,i.full_name,i.phone,i.country_code,i.role_id,
         r.code,r.name,i.company_id,c.name,i.branch_id,b.name,i.expires_at
  from public.user_invitations i
  join public.roles r on r.id=i.role_id
  left join public.companies c on c.id=i.company_id
  left join public.branches b on b.id=i.branch_id
  where i.token_hash=v_hash and i.status='PENDING' and i.expires_at>now();

  if not found then
    raise exception 'Invitation is invalid, expired, revoked, or already used';
  end if;
end;
$$;

create or replace function public.accept_user_invitation(p_token text)
returns table (invitation_id uuid,email text,role_id uuid,company_id uuid,branch_id uuid,accepted_at timestamptz)
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid:=auth.uid();
  v_hash text;
  v_inv public.user_invitations%rowtype;
  v_auth_email text;
  v_email_confirmed timestamptz;
  v_auth_phone text;
  v_phone_confirmed timestamptz;
begin
  if v_uid is null then raise exception 'You must be signed in before accepting an invitation'; end if;
  if p_token is null or length(trim(p_token))<32 then raise exception 'Invalid invitation token'; end if;
  v_hash:=encode(digest(trim(p_token),'sha256'),'hex');

  select * into v_inv from public.user_invitations where token_hash=v_hash for update;
  if not found then raise exception 'Invitation not found'; end if;
  if v_inv.status<>'PENDING' then raise exception 'Invitation has already been used or is no longer active'; end if;
  if v_inv.expires_at<=now() then
    update public.user_invitations set status='EXPIRED',updated_at=now() where id=v_inv.id;
    raise exception 'Invitation has expired';
  end if;

  select email,email_confirmed_at,phone,phone_confirmed_at
  into v_auth_email,v_email_confirmed,v_auth_phone,v_phone_confirmed
  from auth.users where id=v_uid;

  if lower(coalesce(v_auth_email,''))<>lower(v_inv.email) then
    raise exception 'The signed-in email does not match the invited email';
  end if;
  if v_email_confirmed is null then
    raise exception 'Email verification must be completed before accepting this invitation';
  end if;
  if v_inv.phone is null or trim(v_inv.phone)='' then
    raise exception 'This invitation has no phone number. Ask the administrator to issue a new invitation';
  end if;
  if regexp_replace(coalesce(v_auth_phone,''),'\\D','','g') <>
     regexp_replace(v_inv.phone,'\\D','','g') then
    raise exception 'The verified phone number does not match the invited phone number';
  end if;
  if v_phone_confirmed is null then
    raise exception 'Phone verification must be completed before accepting this invitation';
  end if;

  if exists(
    select 1 from public.user_roles
    where user_id=v_uid and role_id=v_inv.role_id
      and coalesce(company_id,'00000000-0000-0000-0000-000000000000')=coalesce(v_inv.company_id,'00000000-0000-0000-0000-000000000000')
      and coalesce(branch_id,'00000000-0000-0000-0000-000000000000')=coalesce(v_inv.branch_id,'00000000-0000-0000-0000-000000000000')
      and ended_at is null
  ) then raise exception 'This role assignment already exists for the account'; end if;

  insert into public.user_roles(user_id,role_id,company_id,branch_id,assigned_at,ended_at)
  values(v_uid,v_inv.role_id,v_inv.company_id,v_inv.branch_id,now(),null);

  update public.profiles
  set status='ACTIVE',email=v_inv.email,phone=v_inv.phone,
      country_code=coalesce(v_inv.country_code,country_code),
      phone_verified_at=v_phone_confirmed,updated_at=now()
  where id=v_uid;

  update public.user_invitations
  set status='ACCEPTED',accepted_user_id=v_uid,accepted_at=now(),updated_at=now()
  where id=v_inv.id;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,new_data)
  values(v_uid,'USER_INVITATION_ACCEPTED','user_invitation',v_inv.id,
    jsonb_build_object('email',v_inv.email,'phone',v_inv.phone,'role_id',v_inv.role_id,'company_id',v_inv.company_id,'branch_id',v_inv.branch_id,'accepted_at',now()));

  return query select v_inv.id,v_inv.email,v_inv.role_id,v_inv.company_id,v_inv.branch_id,v_inv.accepted_at;
end;
$$;

revoke all on function public.validate_user_invitation(text) from public;
revoke all on function public.accept_user_invitation(text) from public,anon;
grant execute on function public.validate_user_invitation(text) to anon,authenticated;
grant execute on function public.accept_user_invitation(text) to authenticated;
