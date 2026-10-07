-- ASOMAC Phase 16: secure company branch management.
-- Company Administrators create and maintain branches belonging to their own company.
-- ASOMAC administrators may read branch information only when the company grants visibility.

create or replace function public.is_company_admin_for(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id=ur.role_id
    where ur.user_id=auth.uid()
      and ur.company_id=p_company_id
      and ur.ended_at is null
      and r.code='COMPANY_ADMIN'
  );
$$;

create or replace function public.list_manageable_companies_for_branches()
returns setof public.companies
language sql
stable
security definer
set search_path=public
as $$
  select c.*
  from public.companies c
  where public.is_super_admin()
     or public.is_company_admin_for(c.id)
     or (
       public.is_asomac_admin()
       and c.allow_asomac_branch_visibility=true
     )
  order by c.name;
$$;

create or replace function public.create_company_branch(
  p_company_id uuid,
  p_name text,
  p_address text default null,
  p_location text default null,
  p_phone text default null,
  p_email text default null,
  p_status public.record_status default 'ACTIVE'
)
returns public.branches
language plpgsql
security definer
set search_path=public
as $$
declare
  v_branch public.branches;
begin
  if not public.is_company_admin_for(p_company_id) then
    raise exception 'Only an active Company Administrator can create branches for this company';
  end if;

  if p_company_id is null then
    raise exception 'Company is required';
  end if;

  if p_name is null or trim(p_name)='' then
    raise exception 'Branch name is required';
  end if;

  if not exists (select 1 from public.companies where id=p_company_id) then
    raise exception 'Company not found';
  end if;

  if exists (
    select 1 from public.branches
    where company_id=p_company_id
      and lower(name)=lower(trim(p_name))
  ) then
    raise exception 'A branch with this name already exists for this company';
  end if;

  if p_email is not null and trim(p_email)<>'' and trim(p_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid branch email';
  end if;

  insert into public.branches(
    company_id,name,address,location,phone,email,status
  )
  values(
    p_company_id,
    trim(p_name),
    nullif(trim(coalesce(p_address,'')),''),
    nullif(trim(coalesce(p_location,'')),''),
    nullif(trim(coalesce(p_phone,'')),''),
    lower(nullif(trim(coalesce(p_email,'')),'')),
    coalesce(p_status,'ACTIVE')
  )
  returning * into v_branch;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,new_data)
  values(auth.uid(),'BRANCH_CREATED','branch',v_branch.id,to_jsonb(v_branch));

  return v_branch;
end;
$$;

create or replace function public.update_company_branch(
  p_branch_id uuid,
  p_name text,
  p_address text default null,
  p_location text default null,
  p_phone text default null,
  p_email text default null,
  p_status public.record_status default 'ACTIVE'
)
returns public.branches
language plpgsql
security definer
set search_path=public
as $$
declare
  v_branch public.branches;
  v_company_id uuid;
begin
  select company_id into v_company_id
  from public.branches
  where id=p_branch_id;

  if v_company_id is null then
    raise exception 'Branch not found';
  end if;

  if not public.is_company_admin_for(v_company_id) then
    raise exception 'Only an active Company Administrator can update branches for this company';
  end if;

  if p_name is null or trim(p_name)='' then
    raise exception 'Branch name is required';
  end if;

  if exists (
    select 1 from public.branches
    where company_id=v_company_id
      and lower(name)=lower(trim(p_name))
      and id<>p_branch_id
  ) then
    raise exception 'Another branch with this name already exists for this company';
  end if;

  if p_email is not null and trim(p_email)<>'' and trim(p_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid branch email';
  end if;

  update public.branches
  set
    name=trim(p_name),
    address=nullif(trim(coalesce(p_address,'')),''),
    location=nullif(trim(coalesce(p_location,'')),''),
    phone=nullif(trim(coalesce(p_phone,'')),''),
    email=lower(nullif(trim(coalesce(p_email,'')),'') ),
    status=coalesce(p_status,'ACTIVE'),
    updated_at=now()
  where id=p_branch_id
  returning * into v_branch;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,new_data)
  values(auth.uid(),'BRANCH_UPDATED','branch',v_branch.id,to_jsonb(v_branch));

  return v_branch;
end;
$$;

create or replace function public.deactivate_company_branch(p_branch_id uuid)
returns public.branches
language plpgsql
security definer
set search_path=public
as $$
declare
  v_branch public.branches;
begin
  select * into v_branch
  from public.branches
  where id=p_branch_id;

  if not found then
    raise exception 'Branch not found';
  end if;

  if not public.is_company_admin_for(v_branch.company_id) then
    raise exception 'Only an active Company Administrator can deactivate branches for this company';
  end if;

  update public.branches
  set status='INACTIVE', updated_at=now()
  where id=p_branch_id
  returning * into v_branch;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,old_data,new_data)
  values(
    auth.uid(),'BRANCH_DEACTIVATED','branch',v_branch.id,
    jsonb_build_object('status','ACTIVE'),
    to_jsonb(v_branch)
  );

  return v_branch;
end;
$$;

revoke all on function public.is_company_admin_for(uuid) from public,anon;
revoke all on function public.list_manageable_companies_for_branches() from public,anon;
revoke all on function public.create_company_branch(uuid,text,text,text,text,text,public.record_status) from public,anon;
revoke all on function public.update_company_branch(uuid,text,text,text,text,text,public.record_status) from public,anon;
revoke all on function public.deactivate_company_branch(uuid) from public,anon;

grant execute on function public.is_company_admin_for(uuid) to authenticated;
grant execute on function public.list_manageable_companies_for_branches() to authenticated;
grant execute on function public.create_company_branch(uuid,text,text,text,text,text,public.record_status) to authenticated;
grant execute on function public.update_company_branch(uuid,text,text,text,text,text,public.record_status) to authenticated;
grant execute on function public.deactivate_company_branch(uuid) to authenticated;
