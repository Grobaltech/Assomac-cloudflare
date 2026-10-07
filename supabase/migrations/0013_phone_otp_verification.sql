-- ASOMAC Phase 13: phone OTP verification state.

create or replace function public.mark_my_phone_verified()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_phone text;
  v_confirmed_at timestamptz;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select phone, phone_confirmed_at
    into v_phone, v_confirmed_at
  from auth.users
  where id = v_uid;

  if v_phone is null or trim(v_phone) = '' then
    raise exception 'No phone number is attached to this account';
  end if;

  if v_confirmed_at is null then
    raise exception 'Phone number has not been verified by Supabase Auth';
  end if;

  update public.profiles
  set phone = v_phone,
      phone_verified_at = v_confirmed_at,
      updated_at = now()
  where id = v_uid;

  if not found then
    raise exception 'User profile not found';
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, new_data)
  values (
    v_uid,
    'PHONE_VERIFIED',
    'user_profile',
    v_uid,
    jsonb_build_object('phone', v_phone, 'verified_at', v_confirmed_at)
  );
end;
$$;

revoke all on function public.mark_my_phone_verified() from public, anon;
grant execute on function public.mark_my_phone_verified() to authenticated;
