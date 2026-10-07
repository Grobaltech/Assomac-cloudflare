-- ASOMAC Phase 15: company registry administration.
-- ASOMAC Administrators manage the official company registry only.
-- Company Administrators manage their own company branches after assignment.

alter table public.companies
  add column if not exists head_office text,
  add column if not exists contact_phone text,
  add column if not exists contact_email text,
  add column if not exists website_url text,
  add column if not exists profile_text text,
  add column if not exists membership_number text,
  add column if not exists membership_status text not null default 'PENDING',
  add column if not exists membership_started_at date,
  add column if not exists membership_notes text,
  add column if not exists allow_asomac_branch_visibility boolean not null default false,
  add column if not exists allow_asomac_user_visibility boolean not null default false,
  add column if not exists allow_asomac_reports boolean not null default false;

comment on column public.companies.allow_asomac_branch_visibility is
  'Company-controlled consent allowing ASOMAC administrators to see branch information.';
comment on column public.companies.allow_asomac_user_visibility is
  'Company-controlled consent allowing ASOMAC administrators to see company user information.';
comment on column public.companies.allow_asomac_reports is
  'Company-controlled consent allowing ASOMAC administrators to see company reports.';

create table if not exists public.company_directors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text not null,
  position_title text not null,
  phone text,
  email text,
  notes text,
  sort_order integer not null default 0,
  status public.record_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_directors_company_idx
  on public.company_directors(company_id, sort_order, full_name);

alter table public.company_directors enable row level security;

drop policy if exists company_directors_registry on public.company_directors;
create policy company_directors_registry
on public.company_directors for all
using (
  public.is_super_admin()
  or public.is_asomac_admin()
  or public.has_company_management_access(company_id)
)
with check (
  public.is_super_admin()
  or public.is_asomac_admin()
  or public.has_company_management_access(company_id)
);

create or replace function public.create_company_registry(
  p_name text,
  p_registration_number text default null,
  p_head_office text default null,
  p_contact_phone text default null,
  p_contact_email text default null,
  p_website_url text default null,
  p_profile_text text default null,
  p_logo_url text default null,
  p_membership_number text default null,
  p_membership_status text default 'PENDING',
  p_membership_started_at date default null,
  p_membership_notes text default null,
  p_status public.record_status default 'ACTIVE'
)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company public.companies;
  v_slug text;
begin
  if not (public.is_super_admin() or public.is_asomac_admin()) then
    raise exception 'Only a Super Administrator or ASOMAC Administrator can register a company';
  end if;

  if p_name is null or trim(p_name) = '' then
    raise exception 'Company name is required';
  end if;

  if p_contact_email is not null
     and trim(p_contact_email) <> ''
     and trim(p_contact_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid company contact email';
  end if;

  v_slug := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');

  if v_slug = '' then
    v_slug := 'company';
  end if;

  if exists (select 1 from public.companies where lower(name)=lower(trim(p_name))) then
    raise exception 'A company with this name already exists';
  end if;

  if p_registration_number is not null
     and trim(p_registration_number) <> ''
     and exists (
       select 1 from public.companies
       where registration_number = trim(p_registration_number)
     ) then
    raise exception 'A company with this registration number already exists';
  end if;

  while exists (select 1 from public.companies where slug = v_slug) loop
    v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6);
  end loop;

  insert into public.companies(
    name, registration_number, status, logo_url, slug,
    head_office, contact_phone, contact_email, website_url, profile_text,
    membership_number, membership_status, membership_started_at, membership_notes
  )
  values (
    trim(p_name),
    nullif(trim(coalesce(p_registration_number,'')),''),
    coalesce(p_status,'ACTIVE'),
    nullif(trim(coalesce(p_logo_url,'')),''),
    v_slug,
    nullif(trim(coalesce(p_head_office,'')),''),
    nullif(trim(coalesce(p_contact_phone,'')),''),
    lower(nullif(trim(coalesce(p_contact_email,'')),'')),
    nullif(trim(coalesce(p_website_url,'')),''),
    nullif(trim(coalesce(p_profile_text,'')),''),
    nullif(trim(coalesce(p_membership_number,'')),''),
    coalesce(nullif(trim(p_membership_status),''),'PENDING'),
    p_membership_started_at,
    nullif(trim(coalesce(p_membership_notes,'')),'')
  )
  returning * into v_company;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, new_data)
  values (
    auth.uid(), 'COMPANY_CREATED', 'company', v_company.id,
    to_jsonb(v_company)
  );

  return v_company;
end;
$$;

create or replace function public.update_company_registry(
  p_company_id uuid,
  p_name text,
  p_registration_number text default null,
  p_head_office text default null,
  p_contact_phone text default null,
  p_contact_email text default null,
  p_website_url text default null,
  p_profile_text text default null,
  p_logo_url text default null,
  p_membership_number text default null,
  p_membership_status text default 'PENDING',
  p_membership_started_at date default null,
  p_membership_notes text default null,
  p_status public.record_status default 'ACTIVE',
  p_allow_asomac_branch_visibility boolean default false,
  p_allow_asomac_user_visibility boolean default false,
  p_allow_asomac_reports boolean default false
)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company public.companies;
begin
  if not (public.is_super_admin() or public.is_asomac_admin()) then
    raise exception 'Only a Super Administrator or ASOMAC Administrator can maintain the company registry';
  end if;

  if p_company_id is null then
    raise exception 'Company is required';
  end if;

  if p_name is null or trim(p_name) = '' then
    raise exception 'Company name is required';
  end if;

  if not exists (select 1 from public.companies where id=p_company_id) then
    raise exception 'Company not found';
  end if;

  if exists (
    select 1 from public.companies
    where lower(name)=lower(trim(p_name)) and id<>p_company_id
  ) then
    raise exception 'Another company already uses this name';
  end if;

  if p_registration_number is not null
     and trim(p_registration_number) <> ''
     and exists (
       select 1 from public.companies
       where registration_number=trim(p_registration_number)
         and id<>p_company_id
     ) then
    raise exception 'Another company already uses this registration number';
  end if;

  update public.companies
  set
    name=trim(p_name),
    registration_number=nullif(trim(coalesce(p_registration_number,'')),''),
    head_office=nullif(trim(coalesce(p_head_office,'')),''),
    contact_phone=nullif(trim(coalesce(p_contact_phone,'')),''),
    contact_email=lower(nullif(trim(coalesce(p_contact_email,'')),'')),
    website_url=nullif(trim(coalesce(p_website_url,'')),''),
    profile_text=nullif(trim(coalesce(p_profile_text,'')),''),
    logo_url=nullif(trim(coalesce(p_logo_url,'')),''),
    membership_number=nullif(trim(coalesce(p_membership_number,'')),''),
    membership_status=coalesce(nullif(trim(p_membership_status),''),'PENDING'),
    membership_started_at=p_membership_started_at,
    membership_notes=nullif(trim(coalesce(p_membership_notes,'')),''),
    status=coalesce(p_status,'ACTIVE'),
    allow_asomac_branch_visibility=coalesce(p_allow_asomac_branch_visibility,false),
    allow_asomac_user_visibility=coalesce(p_allow_asomac_user_visibility,false),
    allow_asomac_reports=coalesce(p_allow_asomac_reports,false),
    updated_at=now()
  where id=p_company_id
  returning * into v_company;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, new_data)
  values (
    auth.uid(), 'COMPANY_UPDATED', 'company', v_company.id,
    to_jsonb(v_company)
  );

  return v_company;
end;
$$;

create or replace function public.list_company_directors(p_company_id uuid)
returns setof public.company_directors
language sql
security definer
set search_path = public
as $$
  select d.*
  from public.company_directors d
  where d.company_id=p_company_id
    and (
      public.is_super_admin()
      or public.is_asomac_admin()
      or public.has_company_management_access(d.company_id)
    )
  order by d.sort_order, d.full_name;
$$;

create or replace function public.save_company_director(
  p_id uuid default null,
  p_company_id uuid default null,
  p_full_name text default null,
  p_position_title text default null,
  p_phone text default null,
  p_email text default null,
  p_notes text default null,
  p_sort_order integer default 0,
  p_status public.record_status default 'ACTIVE'
)
returns public.company_directors
language plpgsql
security definer
set search_path=public
as $$
declare
  v_director public.company_directors;
begin
  if not (public.is_super_admin() or public.is_asomac_admin()) then
    raise exception 'Only a Super Administrator or ASOMAC Administrator can maintain board records';
  end if;

  if p_company_id is null then raise exception 'Company is required'; end if;
  if p_full_name is null or trim(p_full_name)='' then raise exception 'Director name is required'; end if;
  if p_position_title is null or trim(p_position_title)='' then raise exception 'Director position is required'; end if;

  if p_id is null then
    insert into public.company_directors(
      company_id, full_name, position_title, phone, email, notes, sort_order, status
    )
    values(
      p_company_id, trim(p_full_name), trim(p_position_title),
      nullif(trim(coalesce(p_phone,'')),''),
      lower(nullif(trim(coalesce(p_email,'')),'')),
      nullif(trim(coalesce(p_notes,'')),''),
      coalesce(p_sort_order,0), coalesce(p_status,'ACTIVE')
    )
    returning * into v_director;
  else
    update public.company_directors
    set
      full_name=trim(p_full_name),
      position_title=trim(p_position_title),
      phone=nullif(trim(coalesce(p_phone,'')),''),
      email=lower(nullif(trim(coalesce(p_email,'')),'')),
      notes=nullif(trim(coalesce(p_notes,'')),''),
      sort_order=coalesce(p_sort_order,0),
      status=coalesce(p_status,'ACTIVE'),
      updated_at=now()
    where id=p_id and company_id=p_company_id
    returning * into v_director;

    if not found then raise exception 'Board member not found'; end if;
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, new_data)
  values (
    auth.uid(),
    case when p_id is null then 'COMPANY_DIRECTOR_CREATED' else 'COMPANY_DIRECTOR_UPDATED' end,
    'company_director',
    v_director.id,
    to_jsonb(v_director)
  );

  return v_director;
end;
$$;

create or replace function public.delete_company_director(p_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_director public.company_directors;
begin
  if not (public.is_super_admin() or public.is_asomac_admin()) then
    raise exception 'Only a Super Administrator or ASOMAC Administrator can delete board records';
  end if;

  select * into v_director from public.company_directors where id=p_id;
  if not found then raise exception 'Board member not found'; end if;

  delete from public.company_directors where id=p_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, old_data)
  values (auth.uid(), 'COMPANY_DIRECTOR_DELETED', 'company_director', p_id, to_jsonb(v_director));
end;
$$;

revoke all on function public.create_company_registry(text,text,text,text,text,text,text,text,text,text,date,text,public.record_status) from public, anon;
revoke all on function public.update_company_registry(uuid,text,text,text,text,text,text,text,text,text,text,date,text,public.record_status,boolean,boolean,boolean) from public, anon;
revoke all on function public.list_company_directors(uuid) from public, anon;
revoke all on function public.save_company_director(uuid,uuid,text,text,text,text,text,integer,public.record_status) from public, anon;
revoke all on function public.delete_company_director(uuid) from public, anon;

grant execute on function public.create_company_registry(text,text,text,text,text,text,text,text,text,text,date,text,public.record_status) to authenticated;
grant execute on function public.update_company_registry(uuid,text,text,text,text,text,text,text,text,text,text,date,text,public.record_status,boolean,boolean,boolean) to authenticated;
grant execute on function public.list_company_directors(uuid) to authenticated;
grant execute on function public.save_company_director(uuid,uuid,text,text,text,text,text,integer,public.record_status) to authenticated;
grant execute on function public.delete_company_director(uuid) to authenticated;

-- Tighten branch visibility: ASOMAC administrators do not see branches
-- unless the company explicitly grants branch-information visibility.
drop policy if exists branches_read on public.branches;
create policy branches_read on public.branches for select using (
  public.is_super_admin()
  or (
    public.is_asomac_admin()
    and exists (
      select 1 from public.companies c
      where c.id=branches.company_id
        and c.allow_asomac_branch_visibility=true
    )
  )
  or exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id=ur.role_id
    where ur.user_id=auth.uid()
      and ur.company_id=company_id
      and ur.ended_at is null
      and r.code in ('COMPANY_ADMIN','COMPANY_DIRECTOR')
  )
  or exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id=ur.role_id
    where ur.user_id=auth.uid()
      and ur.branch_id=branches.id
      and ur.ended_at is null
      and r.code in ('BRANCH_DIRECTOR','BRANCH_MANAGER','STORE_MANAGER','SECRETARY','GROUND_MANAGER','FINANCE_MANAGER')
  )
);

-- Branch writes are intentionally not opened here.
-- They will be enabled for Company Administrators in the next hierarchy phase.
