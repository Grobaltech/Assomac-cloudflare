-- ============================================================
-- ASOMAC PHASE 6
-- SUPER ADMIN USER MANAGEMENT
-- ============================================================
--
-- This migration creates secure database functions for the
-- Super Administrator Users module.
--
-- The frontend will NEVER be trusted to decide whether someone
-- is allowed to manage another user.
--
-- The database verifies SUPER_ADMIN authority.
-- ============================================================


-- ============================================================
-- 1. LIST ALL USERS
-- ============================================================

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
set search_path = public
as $$
begin

    -- --------------------------------------------------------
    -- Only Super Administrator can access the complete
    -- platform-wide user directory.
    -- --------------------------------------------------------

    if not public.is_super_admin() then
        raise exception
            'Only Super Administrator can view the complete user directory';
    end if;


    return query

    select
        p.id as user_id,
        p.email,
        p.full_name,
        p.common_name,
        p.phone,
        p.avatar_url,
        p.status,

        r.code as role_code,
        r.name as role_name,
        r.scope as role_scope,

        ur.company_id,
        c.name as company_name,

        ur.branch_id,
        b.name as branch_name,

        ur.ended_at as role_ended_at

    from public.profiles p

    left join lateral (
        select
            ur1.user_id,
            ur1.role_id,
            ur1.company_id,
            ur1.branch_id,
            ur1.ended_at
        from public.user_roles ur1
        where ur1.user_id = p.id
          and ur1.ended_at is null
        order by ur1.id
        limit 1
    ) ur on true

    left join public.roles r
        on r.id = ur.role_id

    left join public.companies c
        on c.id = ur.company_id

    left join public.branches b
        on b.id = ur.branch_id

    order by
        p.full_name nulls last,
        p.email;

end;
$$;


revoke all
on function public.admin_list_users()
from public;

grant execute
on function public.admin_list_users()
to authenticated;


-- ============================================================
-- 2. UPDATE USER PROFILE
-- ============================================================
--
-- Super Admin may update system-controlled profile information.
--
-- Email is intentionally NOT included.
--
-- Email changes will later have a dedicated verification
-- workflow.
--
-- Role/company/branch changes will also have dedicated secure
-- workflows.
-- ============================================================

create or replace function public.admin_update_user_profile(
    p_user_id uuid,
    p_full_name text,
    p_phone text,
    p_status public.record_status
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
    v_profile public.profiles;
    v_old_data jsonb;
    v_new_data jsonb;
begin

    -- --------------------------------------------------------
    -- Authorization
    -- --------------------------------------------------------

    if not public.is_super_admin() then
        raise exception
            'Only Super Administrator can edit system-managed user information';
    end if;


    -- --------------------------------------------------------
    -- Prevent editing a nonexistent user
    -- --------------------------------------------------------

    select to_jsonb(p)
    into v_old_data
    from public.profiles p
    where p.id = p_user_id;

    if v_old_data is null then
        raise exception
            'User profile not found';
    end if;


    -- --------------------------------------------------------
    -- Validate full name
    -- --------------------------------------------------------

    if trim(coalesce(p_full_name, '')) = '' then
        raise exception
            'Full name is required';
    end if;


    -- --------------------------------------------------------
    -- Update protected profile information
    -- --------------------------------------------------------

    update public.profiles
    set
        full_name = trim(p_full_name),
        phone = nullif(trim(coalesce(p_phone, '')), ''),
        status = p_status
    where id = p_user_id
    returning *
    into v_profile;


    -- --------------------------------------------------------
    -- Prepare new audit data
    -- --------------------------------------------------------

    v_new_data := to_jsonb(v_profile);


    -- --------------------------------------------------------
    -- Audit
    -- --------------------------------------------------------

    insert into public.audit_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        old_data,
        new_data
    )
    values (
        auth.uid(),
        'UPDATE',
        'user_profile',
        p_user_id,
        v_old_data,
        v_new_data
    );


    return v_profile;

end;
$$;


revoke all
on function public.admin_update_user_profile(
    uuid,
    text,
    text,
    public.record_status
)
from public;

grant execute
on function public.admin_update_user_profile(
    uuid,
    text,
    text,
    public.record_status
)
to authenticated;


-- ============================================================
-- 3. UPDATE USER SELF-SERVICE PROFILE
-- ============================================================
--
-- A normal user can update ONLY:
--
--     common_name
--     avatar_url
--
-- They cannot change:
--
--     full_name
--     email
--     phone
--     status
--     role
--     company
--     branch
-- ============================================================

create or replace function public.update_my_profile(
    p_common_name text,
    p_avatar_url text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
    v_profile public.profiles;
begin

    if auth.uid() is null then
        raise exception
            'Authentication required';
    end if;


    update public.profiles
    set
        common_name = nullif(trim(coalesce(p_common_name, '')), ''),
        avatar_url = nullif(trim(coalesce(p_avatar_url, '')), '')
    where id = auth.uid()
    returning *
    into v_profile;


    if v_profile.id is null then
        raise exception
            'Your profile could not be found';
    end if;


    insert into public.audit_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        new_data
    )
    values (
        auth.uid(),
        'UPDATE_SELF_PROFILE',
        'user_profile',
        auth.uid(),
        jsonb_build_object(
            'common_name', v_profile.common_name,
            'avatar_url', v_profile.avatar_url
        )
    );


    return v_profile;

end;
$$;


revoke all
on function public.update_my_profile(
    text,
    text
)
from public;

grant execute
on function public.update_my_profile(
    text,
    text
)
to authenticated;


-- ============================================================
-- 4. FINAL CHECK
-- ============================================================

do $$
begin

    if not exists (
        select 1
        from public.roles
        where code = 'SUPER_ADMIN'
          and scope = 'ASSOMAC'
    ) then

        raise exception
            'SUPER_ADMIN role is missing';
    end if;


    raise notice
        'ASOMAC Phase 6 Super Admin User Management installed successfully.';

end;
$$;
