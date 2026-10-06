-- ASSOMAC Phase 3: production-safe role assignments, company creation/public directory,
-- and correct company-vs-branch transfer structure.

-- 1. Fix user_roles so platform-level roles can have NULL company/branch scope.
alter table public.user_roles drop constraint if exists user_roles_pkey;
alter table public.user_roles add column if not exists id uuid default gen_random_uuid();
update public.user_roles set id=gen_random_uuid() where id is null;
alter table public.user_roles alter column id set not null;
alter table public.user_roles add constraint user_roles_pkey primary key (id);
create unique index if not exists user_roles_active_scope_unique_idx
on public.user_roles(user_id,role_id,coalesce(company_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(branch_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(ended_at,'infinity'::timestamptz));

-- 2. Profile creation helper for authenticated users.
create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer set search_path=public
as $$
begin
  insert into public.profiles(id,full_name,email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',new.email,'ASSOMAC User'),
    new.email
  )
  on conflict (id) do update set email=excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_profile();

-- 3. Public company directory.
drop policy if exists companies_public_read on public.companies;
create policy companies_public_read on public.companies
for select
using (status='ACTIVE' and public_page_enabled=true);

-- 4. Super Admin can create companies. ASOMAC Admin can create companies.
drop policy if exists companies_create on public.companies;
create policy companies_create on public.companies
for insert
with check (public.is_super_admin() or public.is_asomac_admin());

-- 5. Company admins can update only their own company. Super Admin retains full control.
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

-- 6. Correct transfer structure: company transfers may not require branches.
alter table public.transfers alter column from_branch_id drop not null;
alter table public.transfers alter column to_branch_id drop not null;

alter table public.transfers drop constraint if exists transfers_level_check;
alter table public.transfers add constraint transfers_level_check
check (
  (transfer_level='COMPANY'
    and from_company_id is not null
    and to_company_id is not null)
  or
  (transfer_level='BRANCH'
    and from_branch_id is not null
    and to_branch_id is not null
    and from_company_id is not null
    and to_company_id is not null
    and from_company_id=to_company_id)
);

-- 7. Allow authenticated users to read their own profile and own role assignments.
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
for select using (id=auth.uid() or public.is_super_admin() or public.is_asomac_admin());

drop policy if exists user_roles_admin on public.user_roles;
create policy user_roles_admin on public.user_roles
for select
using (
  user_id=auth.uid()
  or public.is_super_admin()
  or public.is_asomac_admin()
);

-- Only platform administrators can create/update/delete role assignments.
create policy user_roles_platform_manage on public.user_roles
for all
using (public.is_super_admin() or public.is_asomac_admin())
with check (public.is_super_admin() or public.is_asomac_admin());

-- 8. Make company pages/posts visible to company admins and platform admins.
-- Existing management policy already covers this; this ensures branding/page permissions
-- are controlled by the same company-management boundary.

-- 9. Helpful indexes.
create index if not exists companies_status_public_idx
on public.companies(status,public_page_enabled);
create index if not exists companies_slug_idx on public.companies(slug);
