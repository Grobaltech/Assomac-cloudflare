-- ============================================================
-- ASOMAC PHASE 4
-- Secure Administration RPCs
-- ============================================================
--
-- Purpose:
-- 1. Allow Super Admin / ASOMAC Admin to create companies safely.
-- 2. Allow ONLY Super Admin to assign platform-level roles.
-- 3. Keep sensitive administration logic server-side.
--
-- IMPORTANT:
-- The FIRST Super Administrator is bootstrapped separately
-- through the Supabase SQL Editor by the database owner.
-- ============================================================


-- ============================================================
-- 1. SECURE COMPANY CREATION
-- ============================================================

create or replace function public.create_company(
    p_name text,
    p_registration_number text default null,
    p_description text default null,
    p_primary_color text default '#00194C',
    p_secondary_color text default '#f35a02',
    p_accent_color text default '#ffffff'
)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
    v_company public.companies;
    v_slug text;
    v_base_slug text;
begin

    -- --------------------------------------------------------
    -- Authorization
    -- Super Administrator and ASOMAC Administrator may create
    -- companies.
    -- --------------------------------------------------------

    if not (
        public.is_super_admin()
        or public.is_asomac_admin()
    ) then
        raise exception 'Not authorized to create a company';
    end if;


    -- --------------------------------------------------------
    -- Validate company name
    -- --------------------------------------------------------

    if trim(coalesce(p_name, '')) = '' then
        raise exception 'Company name is required';
    end if;


    -- --------------------------------------------------------
    -- Generate a clean public slug
    -- --------------------------------------------------------

    v_base_slug := lower(
        regexp_replace(
            trim(p_name),
            '[^a-zA-Z0-9]+',
            '-',
            'g'
        )
    );

    v_base_slug := trim(both '-' from v_base_slug);

    if v_base_slug = '' then
        v_base_slug := 'company';
    end if;

    v_slug := v_base_slug;


    -- --------------------------------------------------------
    -- Make slug unique
    -- --------------------------------------------------------

    while exists (
        select 1
        from public.companies
        where slug = v_slug
    ) loop

        v_slug :=
            v_base_slug
            || '-'
            || substr(
                replace(gen_random_uuid()::text, '-', ''),
                1,
                6
            );

    end loop;


    -- --------------------------------------------------------
    -- Create company
    -- --------------------------------------------------------

    insert into public.companies (
        name,
        registration_number,
        description,
        slug,
        primary_color,
        secondary_color,
        accent_color
    )
    values (
        trim(p_name),
        nullif(trim(p_registration_number), ''),
        p_description,
        v_slug,
        coalesce(nullif(trim(p_primary_color), ''), '#00194C'),
        coalesce(nullif(trim(p_secondary_color), ''), '#f35a02'),
        coalesce(nullif(trim(p_accent_color), ''), '#ffffff')
    )
    returning *
    into v_company;


    -- --------------------------------------------------------
    -- Automatically create the company's public page
    -- --------------------------------------------------------

    insert into public.company_pages (
        company_id,
        headline,
        tagline,
        published
    )
    values (
        v_company.id,
        v_company.name,
        'Welcome to our company page.',
        true
    );


    -- --------------------------------------------------------
    -- Audit trail
    -- --------------------------------------------------------

    insert into public.audit_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        new_data
    )
    values (
        auth.uid(),
        'CREATE',
        'company',
        v_company.id,
        to_jsonb(v_company)
    );


    return v_company;

end;
$$;


-- ------------------------------------------------------------
-- Lock down execution.
-- ------------------------------------------------------------

revoke all
on function public.create_company(
    text,
    text,
    text,
    text,
    text,
    text
)
from public;


grant execute
on function public.create_company(
    text,
    text,
    text,
    text,
    text,
    text
)
to authenticated;


-- ============================================================
-- 2. PLATFORM ROLE ASSIGNMENT
-- ============================================================
--
-- Only SUPER_ADMIN can use this function.
--
-- This is intentionally NOT usable by ASOMAC_ADMIN.
-- ============================================================

create or replace function public.assign_platform_role(
    p_user_id uuid,
    p_role_code text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_role_id uuid;
    v_user_exists boolean;
begin

    -- --------------------------------------------------------
    -- Only Super Administrator may assign platform roles.
    -- --------------------------------------------------------

    if not public.is_super_admin() then
        raise exception
            'Only Super Administrator can assign platform roles';
    end if;


    -- --------------------------------------------------------
    -- Verify target user exists in profiles.
    -- --------------------------------------------------------

    select exists (
        select 1
        from public.profiles
        where id = p_user_id
    )
    into v_user_exists;

    if not v_user_exists then
        raise exception
            'Target user profile does not exist';
    end if;


    -- --------------------------------------------------------
    -- Only ASSOMAC-scope roles can be assigned here.
    -- --------------------------------------------------------

    select id
    into v_role_id
    from public.roles
    where code = upper(trim(p_role_code))
      and scope = 'ASSOMAC'
    limit 1;


    if v_role_id is null then
        raise exception
            'Invalid platform role: %',
            p_role_code;
    end if;


    -- --------------------------------------------------------
    -- Prevent duplicate active role assignment.
    -- --------------------------------------------------------

    insert into public.user_roles (
        user_id,
        role_id
    )
    values (
        p_user_id,
        v_role_id
    )
    on conflict do nothing;


    -- --------------------------------------------------------
    -- Audit trail
    -- --------------------------------------------------------

    insert into public.audit_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        new_data
    )
    values (
        auth.uid(),
        'ASSIGN_ROLE',
        'user',
        p_user_id,
        jsonb_build_object(
            'role',
            upper(trim(p_role_code))
        )
    );

end;
$$;


-- ------------------------------------------------------------
-- Lock down execution.
-- ------------------------------------------------------------

revoke all
on function public.assign_platform_role(
    uuid,
    text
)
from public;


grant execute
on function public.assign_platform_role(
    uuid,
    text
)
to authenticated;


-- ============================================================
-- 3. VERIFY REQUIRED PLATFORM ROLES EXIST
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
            'SUPER_ADMIN role is missing from public.roles';

    end if;


    if not exists (
        select 1
        from public.roles
        where code = 'ASSOMAC_ADMIN'
        and scope = 'ASSOMAC'
    ) then

        raise exception
            'ASSOMAC_ADMIN role is missing from public.roles';

    end if;

end;
$$;


-- ============================================================
-- 4. FINAL MESSAGE
-- ============================================================

do $$
begin

    raise notice
        'ASOMAC Phase 4 administration RPCs installed successfully.';

end;
$$;
