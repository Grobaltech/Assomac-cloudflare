-- Phase 18: fix the company registration RPC used by Companies.tsx.
-- The frontend supplies the three ASOMAC visibility flags, so the RPC must accept
-- and persist them.

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
  if v_slug = '' then v_slug := 'company'; end if;

  if exists (select 1 from public.companies where lower(name)=lower(trim(p_name))) then
    raise exception 'A company with this name already exists';
  end if;

  if p_registration_number is not null
     and trim(p_registration_number) <> ''
     and exists (
       select 1 from public.companies
       where registration_number=trim(p_registration_number)
     ) then
    raise exception 'A company with this registration number already exists';
  end if;

  while exists (select 1 from public.companies where slug=v_slug) loop
    v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6);
  end loop;

  insert into public.companies(
    name, registration_number, status, logo_url, slug,
    head_office, contact_phone, contact_email, website_url, profile_text,
    membership_number, membership_status, membership_started_at, membership_notes,
    allow_asomac_branch_visibility, allow_asomac_user_visibility, allow_asomac_reports
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
    nullif(trim(coalesce(p_membership_notes,'')),''),
    coalesce(p_allow_asomac_branch_visibility,false),
    coalesce(p_allow_asomac_user_visibility,false),
    coalesce(p_allow_asomac_reports,false)
  )
  returning * into v_company;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, new_data)
  values (auth.uid(), 'COMPANY_CREATED', 'company', v_company.id, to_jsonb(v_company));

  return v_company;
end;
$$;

revoke all on function public.create_company_registry(
  text,text,text,text,text,text,text,text,text,text,date,text,public.record_status,boolean,boolean,boolean
) from public, anon;

grant execute on function public.create_company_registry(
  text,text,text,text,text,text,text,text,text,text,date,text,public.record_status,boolean,boolean,boolean
) to authenticated;
