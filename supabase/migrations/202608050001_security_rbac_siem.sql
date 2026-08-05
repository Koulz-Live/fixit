-- Separate tenant membership from platform administration and add security telemetry.
create type public.platform_admin_role as enum ('tier_1_admin','tier_2_admin','tier_3_admin','manager','executive','auditor','super_admin');
create type public.security_severity as enum ('info','low','medium','high','critical');

create table public.platform_admin_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(user_id) on delete cascade,
  role public.platform_admin_role not null,
  status text not null default 'active' check (status in ('active','suspended','revoked')),
  granted_by uuid not null references public.profiles(user_id),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  reason text not null default 'Administrative assignment'
);

create table public.role_permissions (
  role public.platform_admin_role not null,
  permission text not null,
  primary key (role, permission)
);

insert into public.role_permissions(role,permission) values
  ('tier_1_admin','users.read'),('tier_1_admin','support.triage'),('tier_1_admin','security.events.read'),
  ('tier_2_admin','users.read'),('tier_2_admin','support.resolve'),('tier_2_admin','integrations.read'),('tier_2_admin','security.events.read'),
  ('tier_3_admin','users.read'),('tier_3_admin','platform.diagnostics'),('tier_3_admin','platform.recovery'),('tier_3_admin','security.events.read'),('tier_3_admin','security.incidents.manage'),
  ('manager','users.read'),('manager','users.manage'),('manager','operations.approve'),('manager','security.events.read'),
  ('executive','portfolio.read'),('executive','risk.accept'),('executive','security.events.read'),('executive','security.metrics.read'),
  ('auditor','assurance.read'),('auditor','audit.export'),('auditor','security.events.read'),('auditor','security.metrics.read'),
  ('super_admin','users.read'),('super_admin','users.manage'),('super_admin','roles.manage'),('super_admin','tenants.manage'),('super_admin','platform.configure'),('super_admin','platform.diagnostics'),('super_admin','platform.recovery'),('super_admin','security.events.read'),('super_admin','security.metrics.read'),('super_admin','security.incidents.manage');

-- Preserve existing administrative assignments before reducing memberships to tenant-user scope.
insert into public.platform_admin_assignments(user_id,role,granted_by,reason)
select distinct on (m.user_id) m.user_id, m.role::public.platform_admin_role,
  coalesce((select p.user_id from public.profiles p order by p.created_at limit 1),m.user_id),
  'Migrated from legacy mixed membership role'
from public.memberships m
where m.role <> 'tenant_user'
order by m.user_id, case m.role
  when 'super_admin' then 7 when 'executive' then 6 when 'manager' then 5 when 'auditor' then 4
  when 'tier_3_admin' then 3 when 'tier_2_admin' then 2 else 1 end desc
on conflict(user_id) do nothing;

update public.memberships set role='tenant_user',updated_at=now() where role <> 'tenant_user';
alter table public.memberships drop constraint if exists memberships_role_check;
alter table public.memberships add constraint memberships_role_tenant_only check (role='tenant_user');
comment on column public.memberships.role is 'Tenant-plane membership only. Platform administration is stored in platform_admin_assignments.';

create table public.security_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  correlation_id uuid not null default gen_random_uuid(),
  actor_user_id uuid references public.profiles(user_id),
  tenant_id uuid references public.tenants(id),
  source text not null check (source in ('application','supabase_auth','rbac','vercel_waf','vercel_function','siem')),
  category text not null,
  action text not null,
  severity public.security_severity not null default 'info',
  outcome text not null check (outcome in ('success','failure','denied','challenged','rate_limited','observed')),
  ip_hash text,
  user_agent text,
  resource_type text,
  resource_id text,
  reason_code text,
  metadata jsonb not null default '{}'::jsonb
);
create index security_events_time_idx on public.security_events(occurred_at desc);
create index security_events_actor_idx on public.security_events(actor_user_id,occurred_at desc);
create index security_events_severity_idx on public.security_events(severity,occurred_at desc);

create table public.security_incidents (
  id uuid primary key default gen_random_uuid(),
  incident_number bigint generated always as identity unique,
  title text not null,
  severity public.security_severity not null,
  status text not null default 'open' check(status in ('open','investigating','contained','resolved','closed')),
  owner_user_id uuid references public.profiles(user_id),
  opened_by uuid not null references public.profiles(user_id),
  summary text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_platform_role() returns public.platform_admin_role
language sql stable security definer set search_path=public as $$
  select role from public.platform_admin_assignments
  where user_id=auth.uid() and status='active' and revoked_at is null and (expires_at is null or expires_at>now())
$$;

create or replace function public.has_platform_permission(p_permission text) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.platform_admin_assignments a
    join public.role_permissions p on p.role=a.role
    where a.user_id=auth.uid() and a.status='active' and a.revoked_at is null
      and (a.expires_at is null or a.expires_at>now()) and p.permission=p_permission
  )
$$;

create or replace function public.record_security_event(
  p_correlation_id uuid,p_source text,p_category text,p_action text,p_severity public.security_severity,
  p_outcome text,p_tenant_id uuid default null,p_resource_type text default null,p_resource_id text default null,
  p_reason_code text default null,p_ip_hash text default null,p_user_agent text default null,p_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid:=gen_random_uuid();
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if p_source not in ('application','supabase_auth','rbac','vercel_waf','vercel_function','siem') then raise exception 'INVALID_SOURCE'; end if;
  if p_outcome not in ('success','failure','denied','challenged','rate_limited','observed') then raise exception 'INVALID_OUTCOME'; end if;
  insert into public.security_events(id,correlation_id,actor_user_id,tenant_id,source,category,action,severity,outcome,ip_hash,user_agent,resource_type,resource_id,reason_code,metadata)
  values(v_id,p_correlation_id,auth.uid(),p_tenant_id,p_source,p_category,p_action,p_severity,p_outcome,p_ip_hash,left(p_user_agent,500),p_resource_type,p_resource_id,p_reason_code,coalesce(p_metadata,'{}'::jsonb));
  return v_id;
end $$;

create or replace function public.change_platform_role(p_tenant_id uuid,p_target_user_id uuid,p_role text) returns void
language plpgsql security definer set search_path=public as $$
declare v_old text; v_corr uuid:=gen_random_uuid();
begin
  if not public.has_platform_permission('roles.manage') then raise exception 'FORBIDDEN'; end if;
  select role::text into v_old from public.platform_admin_assignments where user_id=p_target_user_id and status='active' and revoked_at is null;
  if p_target_user_id=auth.uid() and p_role<>'super_admin' then raise exception 'SELF_DEMOTION_BLOCKED'; end if;
  if p_role='tenant_user' then
    update public.platform_admin_assignments set status='revoked',revoked_at=now() where user_id=p_target_user_id and revoked_at is null;
  elsif p_role in ('tier_1_admin','tier_2_admin','tier_3_admin','manager','executive','auditor','super_admin') then
    insert into public.platform_admin_assignments(user_id,role,granted_by,reason)
    values(p_target_user_id,p_role::public.platform_admin_role,auth.uid(),'Role changed through access console')
    on conflict(user_id) do update set role=excluded.role,status='active',granted_by=auth.uid(),granted_at=now(),expires_at=null,revoked_at=null,reason=excluded.reason;
  else raise exception 'INVALID_ROLE'; end if;
  insert into public.access_audit_events(tenant_id,actor_user_id,target_user_id,action,from_role,to_role)
  values(p_tenant_id,auth.uid(),p_target_user_id,'platform_admin_role.changed',v_old,p_role);
  perform public.record_security_event(v_corr,'rbac','authorization','platform_admin_role.changed','high','success',p_tenant_id,'profile',p_target_user_id::text,null,null,null,jsonb_build_object('fromRole',v_old,'toRole',p_role));
end $$;

create or replace function public.get_security_overview() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
  if not public.has_platform_permission('security.events.read') then raise exception 'FORBIDDEN'; end if;
  select jsonb_build_object(
    'metrics',jsonb_build_object(
      'events24h',(select count(*) from public.security_events where occurred_at>now()-interval '24 hours'),
      'highRisk24h',(select count(*) from public.security_events where occurred_at>now()-interval '24 hours' and severity in ('high','critical')),
      'denied24h',(select count(*) from public.security_events where occurred_at>now()-interval '24 hours' and outcome in ('denied','challenged','rate_limited')),
      'openIncidents',(select count(*) from public.security_incidents where status not in ('resolved','closed'))
    ),
    'events',coalesce((select jsonb_agg(row_to_json(e)) from (select id,occurred_at,correlation_id,source,category,action,severity,outcome,resource_type,reason_code from public.security_events order by occurred_at desc limit 50)e),'[]'::jsonb),
    'incidents',coalesce((select jsonb_agg(row_to_json(i)) from (select id,incident_number,title,severity,status,summary,created_at from public.security_incidents order by created_at desc limit 20)i),'[]'::jsonb)
  ) into result;
  return result;
end $$;

alter table public.platform_admin_assignments enable row level security;
alter table public.role_permissions enable row level security;
alter table public.security_events enable row level security;
alter table public.security_incidents enable row level security;
create policy "own or authorized admin assignment" on public.platform_admin_assignments for select using(user_id=auth.uid() or public.has_platform_permission('users.read'));
create policy "authenticated role catalogue" on public.role_permissions for select to authenticated using(true);
create policy "security event readers" on public.security_events for select using(public.has_platform_permission('security.events.read'));
create policy "security incident readers" on public.security_incidents for select using(public.has_platform_permission('security.events.read'));

grant execute on function public.current_platform_role() to authenticated;
grant execute on function public.has_platform_permission(text) to authenticated;
grant execute on function public.record_security_event(uuid,text,text,text,public.security_severity,text,uuid,text,text,text,text,text,jsonb) to authenticated;
grant execute on function public.get_security_overview() to authenticated;
