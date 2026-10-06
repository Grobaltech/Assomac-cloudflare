-- ASSOMAC Phase 2: hierarchy, company branding, public company pages,
-- company/branch transfer permissions, and stronger multi-tenant RLS.

-- 1. Add platform and company administration roles.
insert into public.roles(code,name,scope,description) values
('SUPER_ADMIN','Super Administrator','ASSOMAC','Platform owner with full platform oversight'),
('COMPANY_ADMIN','Company Administrator','COMPANY','Manages one company and its branch information')
on conflict (code) do update set name=excluded.name, scope=excluded.scope, description=excluded.description;

-- 2. Company branding and public identity.
alter table public.companies
  add column if not exists slug text,
  add column if not exists primary_color text not null default '#00194C',
  add column if not exists secondary_color text not null default '#f35a02',
  add column if not exists accent_color text not null default '#ffffff',
  add column if not exists cover_image_url text,
  add column if not exists public_page_enabled boolean not null default true;

update public.companies
set slug = lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g'))
where slug is null;

create unique index if not exists companies_slug_unique_idx on public.companies(slug);

-- 3. Company public landing-page profile.
create table if not exists public.company_pages (
  company_id uuid primary key references public.companies(id) on delete cascade,
  headline text,
  tagline text,
  about_text text,
  contact_address text,
  contact_phone text,
  contact_email text,
  website_url text,
  facebook_url text,
  instagram_url text,
  youtube_url text,
  hero_image_url text,
  published boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- 4. Company activities/news/events. One content model keeps the public page flexible.
create table if not exists public.company_posts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  post_type text not null default 'ACTIVITY',
  title text not null,
  slug text not null,
  excerpt text,
  body text,
  cover_image_url text,
  event_start_at timestamptz,
  event_end_at timestamptz,
  location text,
  published boolean not null default false,
  published_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, slug),
  check (post_type in ('EVENT','ACTIVITY','ANNOUNCEMENT','NEWS'))
);

create index if not exists company_posts_public_idx
  on public.company_posts(company_id, published, published_at desc);

-- 5. Explicit transfer permissions.
insert into public.permissions(code,name,description) values
('company.transfer.view','View company transfers','View transfers between companies'),
('company.transfer.create','Create company transfers','Create a transfer between companies'),
('company.transfer.approve','Approve company transfers','Approve or reject company transfers'),
('branch.transfer.view','View branch transfers','View transfers between branches'),
('branch.transfer.create','Create branch transfers','Create a transfer between branches'),
('branch.transfer.approve','Approve branch transfers','Approve or reject branch transfers'),
('company.branding.view','View company branding','View company branding settings'),
('company.branding.manage','Manage company branding','Edit company branding settings'),
('company.page.view','View company landing page','View company public-page settings'),
('company.page.manage','Manage company landing page','Edit company public-page settings'),
('company.post.view','View company posts','View company events and activities'),
('company.post.create','Create company posts','Create company events and activities'),
('company.post.update','Update company posts','Edit company events and activities'),
('company.post.publish','Publish company posts','Publish or unpublish company events and activities')
on conflict (code) do update set name=excluded.name, description=excluded.description;

-- 6. Helper functions for the hierarchy.
create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id=ur.role_id
    where ur.user_id=auth.uid()
      and r.code='SUPER_ADMIN'
      and ur.ended_at is null
  );
$$;

create or replace function public.is_asomac_admin()
returns boolean
language sql stable security definer set search_path=public
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id=ur.role_id
    where ur.user_id=auth.uid()
      and r.code='ASSOMAC_ADMIN'
      and ur.ended_at is null
  );
$$;

create or replace function public.has_company_management_access(c uuid)
returns boolean
language sql stable security definer set search_path=public
as $$
  select public.is_super_admin()
    or public.is_asomac_admin()
    or exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id=ur.role_id
      where ur.user_id=auth.uid()
        and ur.company_id=c
        and ur.ended_at is null
        and r.code in ('COMPANY_ADMIN','COMPANY_DIRECTOR')
    );
$$;

create or replace function public.has_branch_information_access(b uuid)
returns boolean
language sql stable security definer set search_path=public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.branches b0
      where b0.id=b
        and public.has_company_management_access(b0.company_id)
    )
    or exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id=ur.role_id
      where ur.user_id=auth.uid()
        and ur.branch_id=b
        and ur.ended_at is null
        and r.code in ('BRANCH_DIRECTOR','BRANCH_MANAGER','STORE_MANAGER','SECRETARY','GROUND_MANAGER','FINANCE_MANAGER')
    );
$$;

create or replace function public.can_operate_branch(b uuid)
returns boolean
language sql stable security definer set search_path=public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id=ur.role_id
      where ur.user_id=auth.uid()
        and ur.branch_id=b
        and ur.ended_at is null
        and r.code in ('BRANCH_DIRECTOR','BRANCH_MANAGER','STORE_MANAGER','SECRETARY','GROUND_MANAGER','FINANCE_MANAGER')
    );
$$;

create or replace function public.can_manage_company_posts(c uuid)
returns boolean
language sql stable security definer set search_path=public
as $$
  select public.is_super_admin()
    or public.is_asomac_admin()
    or exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id=ur.role_id
      where ur.user_id=auth.uid()
        and ur.company_id=c
        and ur.ended_at is null
        and r.code in ('COMPANY_ADMIN','COMPANY_DIRECTOR')
    );
$$;

-- 7. Replace the old broad/role-specific helpers with hierarchy-aware versions.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path=public
as $$
  select public.is_asomac_admin();
$$;

create or replace function public.has_company_access(c uuid)
returns boolean
language sql stable security definer set search_path=public
as $$
  select public.has_company_management_access(c);
$$;

create or replace function public.has_branch_access(b uuid)
returns boolean
language sql stable security definer set search_path=public
as $$
  select public.has_branch_information_access(b);
$$;

-- 8. Public pages must be readable without login, but only when enabled/published.
alter table public.company_pages enable row level security;
alter table public.company_posts enable row level security;

drop policy if exists company_pages_public_read on public.company_pages;
create policy company_pages_public_read
on public.company_pages for select
using (
  published = true
  and exists (
    select 1 from public.companies c
    where c.id=company_pages.company_id
      and c.status='ACTIVE'
      and c.public_page_enabled=true
  )
);

drop policy if exists company_pages_management on public.company_pages;
create policy company_pages_management
on public.company_pages for all
using (public.can_manage_company_posts(company_id))
with check (public.can_manage_company_posts(company_id));

drop policy if exists company_posts_public_read on public.company_posts;
create policy company_posts_public_read
on public.company_posts for select
using (
  published = true
  and exists (
    select 1 from public.companies c
    where c.id=company_posts.company_id
      and c.status='ACTIVE'
      and c.public_page_enabled=true
  )
);

drop policy if exists company_posts_management on public.company_posts;
create policy company_posts_management
on public.company_posts for all
using (public.can_manage_company_posts(company_id))
with check (public.can_manage_company_posts(company_id));

-- 9. Strengthen company/branch access boundaries.
drop policy if exists companies_read on public.companies;
create policy companies_read on public.companies
for select
using (
  public.is_super_admin()
  or public.is_asomac_admin()
  or public.has_company_management_access(id)
);

drop policy if exists branches_read on public.branches;
create policy branches_read on public.branches
for select
using (public.has_branch_information_access(id));

drop policy if exists branches_company_management on public.branches;
create policy branches_company_management on public.branches
for all
using (public.has_company_management_access(company_id))
with check (public.has_company_management_access(company_id));

-- 10. Company admins can manage their company's branding, but ASOMAC admins
-- cannot alter the platform owner or platform configuration.
drop policy if exists companies_management on public.companies;
create policy companies_management on public.companies
for update
using (
  public.is_super_admin()
  or exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id=ur.role_id
    where ur.user_id=auth.uid()
      and ur.company_id=companies.id
      and ur.ended_at is null
      and r.code='COMPANY_ADMIN'
  )
)
with check (
  public.is_super_admin()
  or exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id=ur.role_id
    where ur.user_id=auth.uid()
      and ur.company_id=companies.id
      and ur.ended_at is null
      and r.code='COMPANY_ADMIN'
  )
);

-- 11. Company-level and branch-level person transfers are both supported.
-- Existing transfers table remains compatible, but add a transfer_level marker.
alter table public.transfers
  add column if not exists transfer_level text;

update public.transfers
set transfer_level =
  case
    when from_company_id is distinct from to_company_id then 'COMPANY'
    else 'BRANCH'
  end
where transfer_level is null;

alter table public.transfers
  alter column transfer_level set default 'BRANCH';

alter table public.transfers
  add constraint transfers_level_check
  check (transfer_level in ('COMPANY','BRANCH'));

create index if not exists transfers_level_idx
  on public.transfers(transfer_level,effective_date desc);

drop policy if exists transfers_read on public.transfers;
create policy transfers_read on public.transfers
for select
using (
  public.is_super_admin()
  or (
    transfer_level='COMPANY'
    and (
      public.has_company_management_access(to_company_id)
      or (from_company_id is not null and public.has_company_management_access(from_company_id))
    )
  )
  or (
    transfer_level='BRANCH'
    and (
      public.has_branch_information_access(to_branch_id)
      or (from_branch_id is not null and public.has_branch_information_access(from_branch_id))
    )
  )
);

-- Creation/approval will be implemented through dedicated application functions
-- so the UI cannot bypass approval rules by directly editing transfer rows.

-- 12. Ensure audit/history remain platform-controlled.
drop policy if exists audit_admin on public.audit_logs;
create policy audit_admin on public.audit_logs
for select
using (public.is_asomac_admin());

-- 13. Useful indexes.
create index if not exists branches_company_idx on public.branches(company_id);
create index if not exists user_roles_company_idx on public.user_roles(company_id);
create index if not exists user_roles_branch_idx on public.user_roles(branch_id);
