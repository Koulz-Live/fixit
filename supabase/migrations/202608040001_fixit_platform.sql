create extension if not exists pgcrypto;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  status text not null default 'active' check (status in ('active','invited','suspended')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  tenant_type text not null check (tenant_type in ('client_individual','client_organization','artisan_individual','artisan_business','platform_internal')),
  country_code text not null default 'ZA',
  status text not null default 'active' check (status in ('active','suspended')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), user_id uuid not null references public.profiles(user_id),
  role text not null check (role in ('tenant_user','tier_1_admin','tier_2_admin','tier_3_admin','manager','executive','auditor','super_admin')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(tenant_id,user_id)
);

create table public.tenant_role_assignments (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), user_id uuid not null references public.profiles(user_id),
  role_code text not null check (role_code in ('user_client','user_artisan')), granted_by uuid not null references public.profiles(user_id),
  granted_at timestamptz not null default now(), revoked_at timestamptz, unique(tenant_id,user_id,role_code)
);

create table public.access_audit_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), actor_user_id uuid not null references public.profiles(user_id),
  target_user_id uuid not null references public.profiles(user_id), action text not null, from_role text, to_role text, created_at timestamptz not null default now()
);

create table public.client_profiles (
  tenant_id uuid primary key references public.tenants(id), client_type text not null, preferred_contact_method text not null default 'in_app',
  profile_status text not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.artisan_profiles (
  tenant_id uuid primary key references public.tenants(id), public_slug text not null unique, trading_name text not null, biography text not null,
  years_experience integer not null default 0, base_hourly_rate_minor bigint not null default 0, currency_code text not null default 'ZAR', callout_fee_minor bigint,
  pricing_model text not null default 'hourly', availability_status text not null default 'available', verification_status text not null default 'pending',
  profile_status text not null default 'draft', published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.disciplines (id uuid primary key default gen_random_uuid(), code text not null unique, name text not null, is_active boolean not null default true);
create table public.artisan_disciplines (artisan_tenant_id uuid not null references public.tenants(id), discipline_id uuid not null references public.disciplines(id), is_primary boolean not null default false, years_experience integer, primary key(artisan_tenant_id,discipline_id));
create table public.artisan_service_areas (id uuid primary key default gen_random_uuid(), artisan_tenant_id uuid not null references public.tenants(id), country_code text not null, province_region text not null, municipality_city text not null, locality text, public_label text not null);
create table public.service_requests (
  id uuid primary key default gen_random_uuid(), client_tenant_id uuid not null references public.tenants(id), discipline_id uuid not null references public.disciplines(id),
  title text not null, description text not null, area_label text not null, budget_min_minor bigint, budget_max_minor bigint, currency_code text not null default 'ZAR',
  status text not null default 'draft' check(status in ('draft','published','matching','quotations_received','awarded','converted_to_job','closed','cancelled','expired','withdrawn')),
  created_by uuid not null references public.profiles(user_id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.quotes (id uuid primary key default gen_random_uuid(), service_request_id uuid references public.service_requests(id), client_tenant_id uuid not null references public.tenants(id), artisan_tenant_id uuid not null references public.tenants(id), quote_number text not null, version_number integer not null default 1, status text not null default 'draft', currency_code text not null default 'ZAR', subtotal_minor bigint not null, tax_minor bigint not null default 0, total_minor bigint not null, valid_until timestamptz, created_by uuid not null references public.profiles(user_id), created_at timestamptz not null default now());
create table public.jobs (id uuid primary key default gen_random_uuid(), accepted_quote_id uuid references public.quotes(id), client_tenant_id uuid not null references public.tenants(id), artisan_tenant_id uuid not null references public.tenants(id), job_number text not null unique, title text not null, scope_baseline text not null, area_label text not null, status text not null default 'proposed', planned_start_at timestamptz, planned_end_at timestamptz, created_by uuid not null references public.profiles(user_id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.invoices (id uuid primary key default gen_random_uuid(), job_id uuid not null references public.jobs(id), client_tenant_id uuid not null references public.tenants(id), artisan_tenant_id uuid not null references public.tenants(id), invoice_number text not null unique, status text not null default 'draft', currency_code text not null default 'ZAR', total_minor bigint not null, amount_paid_minor bigint not null default 0, amount_due_minor bigint not null, due_at timestamptz, created_at timestamptz not null default now());
create table public.artisan_reviews (id uuid primary key default gen_random_uuid(), job_id uuid not null unique references public.jobs(id), client_tenant_id uuid not null references public.tenants(id), artisan_tenant_id uuid not null references public.tenants(id), rating_overall integer not null check(rating_overall between 1 and 5), review_text text, moderation_status text not null default 'published', created_by uuid not null references public.profiles(user_id), created_at timestamptz not null default now());
create table public.marketplace_audit_events (id uuid primary key default gen_random_uuid(), actor_user_id uuid not null references public.profiles(user_id), actor_tenant_id uuid not null references public.tenants(id), active_role text not null, correlation_id uuid not null, action text not null, resource_type text not null, resource_id uuid not null, outcome text not null, reason_code text, occurred_at timestamptz not null default now());

create index idx_memberships_user on public.memberships(user_id,tenant_id);
create index idx_role_assignments_user on public.tenant_role_assignments(user_id,tenant_id) where revoked_at is null;
create index idx_artisan_directory on public.artisan_profiles(profile_status,verification_status,base_hourly_rate_minor);
create index idx_service_requests_tenant on public.service_requests(client_tenant_id,status,created_at desc);
create index idx_jobs_client on public.jobs(client_tenant_id,status,updated_at desc);
create index idx_jobs_artisan on public.jobs(artisan_tenant_id,status,updated_at desc);
create index idx_invoices_artisan on public.invoices(artisan_tenant_id,status,due_at);

create or replace function public.has_tenant_role(p_tenant_id uuid,p_role text) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.tenant_role_assignments where tenant_id=p_tenant_id and user_id=auth.uid() and role_code=p_role and revoked_at is null) $$;
create or replace function public.is_tenant_member(p_tenant_id uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.memberships where tenant_id=p_tenant_id and user_id=auth.uid()) or exists(select 1 from public.tenant_role_assignments where tenant_id=p_tenant_id and user_id=auth.uid() and revoked_at is null) $$;

create or replace function public.ensure_access_profile(p_display_name text) returns uuid language plpgsql security definer set search_path=public as $$
declare v_tenant uuid; v_role text;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  insert into public.profiles(user_id,email,display_name) values(auth.uid(),coalesce(auth.jwt()->>'email',''),p_display_name) on conflict(user_id) do update set email=excluded.email,display_name=excluded.display_name,last_seen_at=now();
  select id into v_tenant from public.tenants where slug='enterprise-architecture-office';
  if v_tenant is null then insert into public.tenants(name,slug,tenant_type,created_by) values('Enterprise Architecture Office','enterprise-architecture-office','platform_internal',auth.uid()) returning id into v_tenant; end if;
  if not exists(select 1 from public.memberships) then v_role:='super_admin'; else v_role:='tenant_user'; end if;
  insert into public.memberships(tenant_id,user_id,role) values(v_tenant,auth.uid(),v_role) on conflict(tenant_id,user_id) do nothing;
  return v_tenant;
end $$;

create or replace function public.ensure_marketplace_context(p_display_name text) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_client uuid; v_artisan uuid; v_suffix text:=replace(auth.uid()::text,'-','');
begin
  perform public.ensure_access_profile(p_display_name);
  select id into v_client from public.tenants where slug='client-'||v_suffix;
  if v_client is null then insert into public.tenants(name,slug,tenant_type,created_by) values(p_display_name||' Household','client-'||v_suffix,'client_individual',auth.uid()) returning id into v_client; end if;
  select id into v_artisan from public.tenants where slug='artisan-'||v_suffix;
  if v_artisan is null then insert into public.tenants(name,slug,tenant_type,created_by) values(p_display_name||' Artisan Services','artisan-'||v_suffix,'artisan_individual',auth.uid()) returning id into v_artisan; end if;
  insert into public.tenant_role_assignments(tenant_id,user_id,role_code,granted_by) values(v_client,auth.uid(),'user_client',auth.uid()) on conflict do nothing;
  insert into public.tenant_role_assignments(tenant_id,user_id,role_code,granted_by) values(v_artisan,auth.uid(),'user_artisan',auth.uid()) on conflict do nothing;
  insert into public.client_profiles(tenant_id,client_type) values(v_client,'individual') on conflict do nothing;
  insert into public.artisan_profiles(tenant_id,public_slug,trading_name,biography,base_hourly_rate_minor,callout_fee_minor) values(v_artisan,'artisan-'||v_suffix,p_display_name||' Artisan Services','Local artisan services with governed quotations, job evidence and transparent pricing.',45000,25000) on conflict do nothing;
  insert into public.disciplines(code,name) values('plumbing','Plumbing'),('electrical','Electrical'),('carpentry','Carpentry'),('painting','Painting') on conflict(code) do nothing;
  return jsonb_build_object('clientTenantId',v_client,'artisanTenantId',v_artisan);
end $$;

create or replace function public.create_service_request(p_title text,p_description text,p_discipline_code text,p_area_label text,p_budget_min_minor bigint,p_budget_max_minor bigint) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_ctx jsonb; v_client uuid; v_disc uuid; v_id uuid:=gen_random_uuid(); v_corr uuid:=gen_random_uuid();
begin
  v_ctx:=public.ensure_marketplace_context(coalesce(auth.jwt()->'user_metadata'->>'full_name',split_part(auth.jwt()->>'email','@',1))); v_client:=(v_ctx->>'clientTenantId')::uuid;
  if not public.has_tenant_role(v_client,'user_client') then raise exception 'FORBIDDEN'; end if;
  select id into v_disc from public.disciplines where code=p_discipline_code and is_active;
  if v_disc is null or length(trim(p_title))<5 or length(trim(p_description))<10 or p_budget_min_minor<0 or p_budget_max_minor<p_budget_min_minor then raise exception 'INVALID_REQUEST'; end if;
  insert into public.service_requests(id,client_tenant_id,discipline_id,title,description,area_label,budget_min_minor,budget_max_minor,status,created_by) values(v_id,v_client,v_disc,trim(p_title),trim(p_description),trim(p_area_label),p_budget_min_minor,p_budget_max_minor,'published',auth.uid());
  insert into public.marketplace_audit_events(actor_user_id,actor_tenant_id,active_role,correlation_id,action,resource_type,resource_id,outcome) values(auth.uid(),v_client,'user_client',v_corr,'service_request.published','service_request',v_id,'success');
  return jsonb_build_object('id',v_id,'correlationId',v_corr);
end $$;

create or replace function public.change_platform_role(p_tenant_id uuid,p_target_user_id uuid,p_role text) returns void language plpgsql security definer set search_path=public as $$
declare v_old text;
begin
  if not exists(select 1 from public.memberships where tenant_id=p_tenant_id and user_id=auth.uid() and role='super_admin') then raise exception 'FORBIDDEN'; end if;
  if p_role not in ('tenant_user','tier_1_admin','tier_2_admin','tier_3_admin','manager','executive','auditor','super_admin') then raise exception 'INVALID_ROLE'; end if;
  select role into v_old from public.memberships where tenant_id=p_tenant_id and user_id=p_target_user_id; if v_old is null then raise exception 'MEMBER_NOT_FOUND'; end if;
  if p_target_user_id=auth.uid() and p_role<>'super_admin' then raise exception 'SELF_DEMOTION_BLOCKED'; end if;
  update public.memberships set role=p_role,updated_at=now() where tenant_id=p_tenant_id and user_id=p_target_user_id;
  insert into public.access_audit_events(tenant_id,actor_user_id,target_user_id,action,from_role,to_role) values(p_tenant_id,auth.uid(),p_target_user_id,'role.changed',v_old,p_role);
end $$;

alter table public.profiles enable row level security; alter table public.tenants enable row level security; alter table public.memberships enable row level security; alter table public.tenant_role_assignments enable row level security; alter table public.access_audit_events enable row level security; alter table public.client_profiles enable row level security; alter table public.artisan_profiles enable row level security; alter table public.disciplines enable row level security; alter table public.artisan_disciplines enable row level security; alter table public.artisan_service_areas enable row level security; alter table public.service_requests enable row level security; alter table public.quotes enable row level security; alter table public.jobs enable row level security; alter table public.invoices enable row level security; alter table public.artisan_reviews enable row level security; alter table public.marketplace_audit_events enable row level security;

create policy "own profile" on public.profiles for select using(user_id=auth.uid());
create policy "tenant visibility" on public.tenants for select using(public.is_tenant_member(id));
create policy "membership visibility" on public.memberships for select using(public.is_tenant_member(tenant_id));
create policy "role assignment visibility" on public.tenant_role_assignments for select using(public.is_tenant_member(tenant_id));
create policy "access audit visibility" on public.access_audit_events for select using(public.is_tenant_member(tenant_id));
create policy "client profile visibility" on public.client_profiles for select using(public.is_tenant_member(tenant_id));
create policy "public artisan directory" on public.artisan_profiles for select using(profile_status='published' or public.is_tenant_member(tenant_id));
create policy "public disciplines" on public.disciplines for select using(is_active);
create policy "public artisan disciplines" on public.artisan_disciplines for select using(true);
create policy "public service areas" on public.artisan_service_areas for select using(true);
create policy "client request visibility" on public.service_requests for select using(public.is_tenant_member(client_tenant_id));
create policy "quote participants" on public.quotes for select using(public.is_tenant_member(client_tenant_id) or public.is_tenant_member(artisan_tenant_id));
create policy "job participants" on public.jobs for select using(public.is_tenant_member(client_tenant_id) or public.is_tenant_member(artisan_tenant_id));
create policy "invoice participants" on public.invoices for select using(public.is_tenant_member(client_tenant_id) or public.is_tenant_member(artisan_tenant_id));
create policy "review visibility" on public.artisan_reviews for select using(moderation_status='published' or public.is_tenant_member(client_tenant_id) or public.is_tenant_member(artisan_tenant_id));
create policy "audit tenant visibility" on public.marketplace_audit_events for select using(public.is_tenant_member(actor_tenant_id));

grant execute on function public.ensure_access_profile(text) to authenticated;
grant execute on function public.ensure_marketplace_context(text) to authenticated;
grant execute on function public.create_service_request(text,text,text,text,bigint,bigint) to authenticated;
grant execute on function public.change_platform_role(uuid,uuid,text) to authenticated;
