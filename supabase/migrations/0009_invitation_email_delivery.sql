-- ASSOMAC migration 0009
-- Invitation email delivery support.
-- The delivery endpoint can only prepare/send an invitation that belongs to
-- the authenticated inviter, and successful delivery is recorded.

alter table public.user_invitations
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_send_count integer not null default 0;

create or replace function public.prepare_user_invitation_email(
  p_invitation_id uuid,
  p_invitation_token text
)
returns table (
  invitation_id uuid,
  email text,
  role_name text,
  role_code text,
  company_name text,
  branch_name text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.user_invitations%rowtype;
  v_hash text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_invitation_token is null or length(trim(p_invitation_token)) < 32 then
    raise exception 'Invalid invitation token';
  end if;

  v_hash := encode(digest(trim(p_invitation_token), 'sha256'), 'hex');

  select *
    into v_inv
  from public.user_invitations
  where id = p_invitation_id
    and token_hash = v_hash
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  if v_inv.invited_by <> v_uid then
    raise exception 'You are not authorized to send this invitation';
  end if;

  if v_inv.status <> 'PENDING' then
    raise exception 'Invitation is no longer active';
  end if;

  if v_inv.expires_at <= now() then
    update public.user_invitations
       set status = 'EXPIRED',
           updated_at = now()
     where id = v_inv.id;

    raise exception 'Invitation has expired';
  end if;

  return query
  select
    v_inv.id,
    v_inv.email,
    r.name,
    r.code,
    c.name,
    b.name,
    v_inv.expires_at
  from public.roles r
  left join public.companies c on c.id = v_inv.company_id
  left join public.branches b on b.id = v_inv.branch_id
  where r.id = v_inv.role_id;
end;
$$;

create or replace function public.mark_user_invitation_email_sent(
  p_invitation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  update public.user_invitations
     set email_sent_at = now(),
         email_send_count = email_send_count + 1,
         updated_at = now()
   where id = p_invitation_id
     and invited_by = v_uid
     and status = 'PENDING';

  if not found then
    raise exception 'Invitation not found or not authorized';
  end if;

  insert into public.audit_logs(
    actor_id,
    action,
    entity_type,
    entity_id,
    new_data
  )
  values(
    v_uid,
    'USER_INVITATION_EMAIL_SENT',
    'user_invitation',
    p_invitation_id,
    jsonb_build_object(
      'sent_at', now()
    )
  );

  return true;
end;
$$;

revoke all on function public.prepare_user_invitation_email(uuid,text) from public, anon;
revoke all on function public.mark_user_invitation_email_sent(uuid) from public, anon;

grant execute on function public.prepare_user_invitation_email(uuid,text) to authenticated;
grant execute on function public.mark_user_invitation_email_sent(uuid) to authenticated;
