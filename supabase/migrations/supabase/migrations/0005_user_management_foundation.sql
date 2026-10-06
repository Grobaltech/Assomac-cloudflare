-- ============================================================
-- ASOMAC PHASE 5
-- USER MANAGEMENT FOUNDATION
-- ============================================================
--
-- Rules:
--
-- 1. Users may edit:
--      - common_name
--      - avatar/profile picture
--
-- 2. System-controlled fields:
--      - legal/full name
--      - email
--      - phone
--      - status
--      - role
--      - company
--      - branch
--      - permissions
--
-- 3. Email and phone changes will later use verification
--    workflows.
--
-- 4. Platform roles do not require company or branch.
--
-- 5. Sensitive administrative changes must be audited.
-- ============================================================


-- ============================================================
-- 1. USER PROFILE SELF-SERVICE FIELDS
-- ============================================================

alter table public.profiles
    add column if not exists common_name text;

alter table public.profiles
    add column if not exists avatar_url text;


-- ============================================================
-- 2. DOCUMENT THE PURPOSE OF THE PROFILE FIELDS
-- ============================================================

comment on column public.profiles.common_name is
'User-editable preferred/common display name. Does not replace legal name.';

comment on column public.profiles.avatar_url is
'User profile picture URL. User may update this through the approved profile workflow.';

comment on column public.profiles.full_name is
'System-controlled official/legal name. Users cannot directly modify this field.';

comment on column public.profiles.email is
'System-controlled email address. Future changes require verification workflow.';

comment on column public.profiles.phone is
'System-controlled phone number. Future changes require verification workflow.';


-- ============================================================
-- 3. PLATFORM ROLES MUST NOT REQUIRE COMPANY OR BRANCH
-- ============================================================

alter table public.user_roles
    alter column company_id drop not null;

alter table public.user_roles
    alter column branch_id drop not null;


-- ============================================================
-- 4. PREVENT INVALID PLATFORM ROLE ASSIGNMENTS
-- ============================================================
--
-- Platform-level roles:
--
--   SUPER_ADMIN
--   ASSOMAC_ADMIN
--
-- must not be attached to a company or branch.
--
-- Company/branch roles must have the appropriate scope.
-- ============================================================

create or replace function public.validate_user_role_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_role_scope text;
    v_role_code text;
begin

    select
        scope,
        code
    into
        v_role_scope,
        v_role_code
    from public.roles
    where id = new.role_id;


    if v_role_scope is null then
        raise exception 'Invalid role';
    end if;


    -- --------------------------------------------------------
    -- Platform roles
    -- --------------------------------------------------------

    if v_role_code in ('SUPER_ADMIN', 'ASSOMAC_ADMIN') then

        if new.company_id is not null
           or new.branch_id is not null then

            raise exception
                'Platform role % cannot be assigned to a company or branch',
                v_role_code;

        end if;

    end if;


    -- --------------------------------------------------------
    -- Branch-specific assignment
    -- --------------------------------------------------------
    --
    -- If a branch is supplied, make sure the company matches
    -- the branch's company.
    -- --------------------------------------------------------

    if new.branch_id is not null then

        if new.company_id is null then
            raise exception
                'A branch assignment requires a company assignment';
        end if;


        if not exists (
            select 1
            from public.branches b
            where b.id = new.branch_id
              and b.company_id = new.company_id
        ) then

            raise exception
                'The selected branch does not belong to the selected company';

        end if;

    end if;


    return new;

end;
$$;


drop trigger if exists trg_validate_user_role_scope
on public.user_roles;


create trigger trg_validate_user_role_scope
before insert or update
on public.user_roles
for each row
execute function public.validate_user_role_scope();


-- ============================================================
-- 5. INDEXES FOR USER MANAGEMENT
-- ============================================================

create index if not exists idx_profiles_email
on public.profiles(email);

create index if not exists idx_profiles_common_name
on public.profiles(common_name);

create index if not exists idx_profiles_status
on public.profiles(status);

create index if not exists idx_user_roles_user_id
on public.user_roles(user_id);

create index if not exists idx_user_roles_role_id
on public.user_roles(role_id);

create index if not exists idx_user_roles_company_id
on public.user_roles(company_id);

create index if not exists idx_user_roles_branch_id
on public.user_roles(branch_id);


-- ============================================================
-- 6. ADMINISTRATIVE USER ACTION AUDIT EVENTS
-- ============================================================
--
-- These action names are reserved for the user-management
-- system.
-- ============================================================

comment on table public.audit_logs is
'Immutable-style administrative history for platform, organization, company, branch and user actions.';


-- ============================================================
-- 7. USER MANAGEMENT PERMISSIONS
-- ============================================================
--
-- These permissions allow the application to distinguish
-- between viewing users and changing users.
-- ============================================================

insert into public.permissions (
    code,
    name,
    description
)
values
(
    'user.view',
    'View Users',
    'View users within the administrator''s permitted scope.'
),
(
    'user.create',
    'Create Users',
    'Create or invite users within the administrator''s permitted scope.'
),
(
    'user.edit',
    'Edit Users',
    'Edit system-managed user information within the administrator''s permitted scope.'
),
(
    'user.activate',
    'Activate Users',
    'Activate users within the administrator''s permitted scope.'
),
(
    'user.deactivate',
    'Deactivate Users',
    'Deactivate users within the administrator''s permitted scope.'
),
(
    'user.assign_role',
    'Assign Roles',
    'Assign authorized roles to users.'
),
(
    'user.assign_company',
    'Assign Company',
    'Assign users to authorized companies.'
),
(
    'user.assign_branch',
    'Assign Branch',
    'Assign users to authorized branches.'
),
(
    'user.manage_permissions',
    'Manage User Permissions',
    'Manage exceptional user permissions.'
)
on conflict (code) do nothing;


-- ============================================================
-- 8. FINAL CHECK
-- ============================================================

do $$
begin

    if not exists (
        select 1
        from public.profiles
        where id = 'd88fb69c-b42e-4d79-9bb3-30add6497f00'
    ) then

        raise notice
            'Warning: current Super Administrator profile was not found.';

    end if;


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
        'ASOMAC Phase 5 User Management Foundation installed successfully.';

end;
$$;
