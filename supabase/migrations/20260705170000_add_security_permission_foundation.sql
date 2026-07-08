-- SEC-007 additive permission foundation.
-- Adds role/permission catalogues, role assignments, audit events, and helper functions.
-- Intentionally does not replace existing RLS/RPC enforcement, add organisation_id,
-- enforce sites, or remove legacy profiles.role/company_id compatibility columns.

create table if not exists public.security_roles (
  key text primary key,
  name text not null,
  description text not null default '',
  scope_level text not null check (scope_level in ('platform', 'organisation', 'site_set', 'site', 'own')),
  parent_role_key text null references public.security_roles(key) on delete set null,
  is_system boolean not null default true,
  is_assignable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.security_permissions (
  key text primary key,
  area text not null,
  resource text not null,
  operation text not null,
  description text not null default '',
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  requires_audit boolean not null default false,
  created_at timestamptz not null default now(),
  constraint security_permissions_key_shape_check check (key = area || '.' || resource || '.' || operation)
);

create table if not exists public.security_role_permissions (
  role_key text not null references public.security_roles(key) on delete cascade,
  permission_key text not null references public.security_permissions(key) on delete cascade,
  effect text not null default 'allow' check (effect in ('allow', 'deny')),
  scope_level text not null check (scope_level in ('platform', 'organisation', 'site_set', 'site', 'own')),
  created_at timestamptz not null default now(),
  primary key (role_key, permission_key, scope_level)
);

create table if not exists public.security_role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  role_key text not null references public.security_roles(key) on delete restrict,
  scope_level text not null default 'organisation' check (scope_level in ('organisation', 'site_set', 'site', 'own')),
  site_id uuid null,
  status text not null default 'active' check (status in ('active', 'suspended', 'revoked')),
  source text not null default 'legacy_profile_backfill' check (source in ('legacy_profile_backfill', 'invite', 'admin', 'system')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz null,
  created_by_user_id uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint security_role_assignments_org_scope_no_site_check check (
    scope_level = 'organisation'
    and site_id is null
  ),
  constraint security_role_assignments_time_order_check check (ends_at is null or ends_at > starts_at)
);

create unique index if not exists security_role_assignments_active_unique
  on public.security_role_assignments (user_id, company_id, role_key, scope_level, coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'active';

create index if not exists idx_security_role_assignments_user_company_status
  on public.security_role_assignments (user_id, company_id, status);

create index if not exists idx_security_role_assignments_company_role_status
  on public.security_role_assignments (company_id, role_key, status);

create index if not exists idx_security_role_assignments_company_site_status
  on public.security_role_assignments (company_id, site_id, status);

create table if not exists public.security_permission_audit_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_user_id uuid null references public.profiles(id) on delete set null,
  actor_kind text not null default 'unknown' check (actor_kind in ('user', 'system_job', 'webhook', 'support', 'unknown')),
  company_id uuid null references public.companies(id) on delete set null,
  site_id uuid null,
  permission_key text null references public.security_permissions(key) on delete set null,
  decision text not null check (decision in ('allowed', 'denied', 'not_applicable', 'error')),
  reason text not null default 'unspecified',
  resource_type text null,
  resource_id uuid null,
  operation text null,
  request_id text null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_security_permission_audit_events_company_created
  on public.security_permission_audit_events (company_id, created_at desc);

create index if not exists idx_security_permission_audit_events_actor_created
  on public.security_permission_audit_events (actor_user_id, created_at desc);

alter table public.security_roles enable row level security;
alter table public.security_permissions enable row level security;
alter table public.security_role_permissions enable row level security;
alter table public.security_role_assignments enable row level security;
alter table public.security_permission_audit_events enable row level security;

create or replace function public.set_security_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_security_roles_updated_at on public.security_roles;
create trigger set_security_roles_updated_at
  before update on public.security_roles
  for each row execute function public.set_security_updated_at();

drop trigger if exists set_security_role_assignments_updated_at on public.security_role_assignments;
create trigger set_security_role_assignments_updated_at
  before update on public.security_role_assignments
  for each row execute function public.set_security_updated_at();

create or replace view public.organisation_memberships_v
with (security_invoker = true)
as
select
  p.id as user_id,
  p.company_id,
  case when coalesce(p.is_active, true) then 'active' else 'inactive' end as status,
  p.role::text as legacy_role,
  'profiles'::text as source
from public.profiles p
where p.company_id is not null;

create or replace function public.current_actor_company_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.get_my_company_id()
$$;

create or replace function public.current_actor_legacy_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.get_my_role()
$$;

create or replace function public.actor_has_permission(
  p_permission_key text,
  p_company_id uuid,
  p_site_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    auth.uid() is not null
    and p_permission_key is not null
    and p_company_id is not null
    and p_site_id is null
    and exists (
      select 1
      from public.security_role_assignments sra
      join public.security_role_permissions srp
        on srp.role_key = sra.role_key
       and srp.effect = 'allow'
      join public.security_permissions sp
        on sp.key = srp.permission_key
      where sra.user_id = auth.uid()
        and sra.company_id = p_company_id
        and sra.status = 'active'
        and sra.scope_level = 'organisation'
        and sra.site_id is null
        and sra.starts_at <= now()
        and (sra.ends_at is null or sra.ends_at > now())
        and sp.key = p_permission_key
        and srp.scope_level in ('organisation', 'own')
    ),
    false
  )
$$;

create or replace function public.record_security_event(
  p_company_id uuid default null,
  p_site_id uuid default null,
  p_permission_key text default null,
  p_decision text default 'not_applicable',
  p_reason text default 'unspecified',
  p_resource_type text default null,
  p_resource_id uuid default null,
  p_operation text default null,
  p_request_id text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_actor_kind text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted_id uuid;
  resolved_actor uuid := auth.uid();
  resolved_actor_kind text := coalesce(p_actor_kind, case when auth.uid() is null then 'unknown' else 'user' end);
  resolved_permission_key text;
begin
  if resolved_actor_kind not in ('user', 'system_job', 'webhook', 'support', 'unknown') then
    resolved_actor_kind := 'unknown';
  end if;

  if p_decision not in ('allowed', 'denied', 'not_applicable', 'error') then
    raise exception 'Invalid security decision: %', p_decision;
  end if;

  if p_permission_key is not null
     and exists (select 1 from public.security_permissions where key = p_permission_key) then
    resolved_permission_key := p_permission_key;
  end if;

  insert into public.security_permission_audit_events (
    actor_user_id,
    actor_kind,
    company_id,
    site_id,
    permission_key,
    decision,
    reason,
    resource_type,
    resource_id,
    operation,
    request_id,
    metadata
  ) values (
    resolved_actor,
    resolved_actor_kind,
    p_company_id,
    p_site_id,
    resolved_permission_key,
    p_decision,
    coalesce(nullif(p_reason, ''), 'unspecified'),
    p_resource_type,
    p_resource_id,
    p_operation,
    p_request_id,
    coalesce(p_metadata, '{}'::jsonb)
      || case
        when p_permission_key is not null and resolved_permission_key is null
          then jsonb_build_object('unresolved_permission_key', p_permission_key)
        else '{}'::jsonb
      end
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

create or replace function public.actor_can_access_driver(
  p_driver_id uuid,
  p_operation text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  target_driver public.profiles%rowtype;
  manager_permission text;
  own_permission text;
begin
  if auth.uid() is null or p_driver_id is null or p_operation is null then
    return false;
  end if;

  select *
  into target_driver
  from public.profiles
  where id = p_driver_id
  limit 1;

  if not found or target_driver.company_id is null then
    return false;
  end if;

  own_permission := case p_operation
    when 'read' then 'drivers.own_profile.read'
    when 'update' then 'drivers.own_profile.update'
    when 'acknowledge' then 'compliance.finding.acknowledge'
    else null
  end;

  if target_driver.id = auth.uid() and own_permission is not null then
    return public.actor_has_permission(own_permission, target_driver.company_id, null);
  end if;

  manager_permission := case p_operation
    when 'read' then 'drivers.profile.read'
    when 'update' then 'drivers.profile.update'
    when 'archive' then 'drivers.profile.archive'
    else null
  end;

  if manager_permission is null then
    return false;
  end if;

  return public.actor_has_permission(manager_permission, target_driver.company_id, null);
end;
$$;

create or replace function public.actor_can_access_vehicle(
  p_vehicle_id uuid,
  p_operation text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  target_company_id uuid;
  permission_key text;
begin
  if auth.uid() is null or p_vehicle_id is null or p_operation is null then
    return false;
  end if;

  select v.company_id
  into target_company_id
  from public.vehicles v
  where v.id = p_vehicle_id
  limit 1;

  if target_company_id is null then
    return false;
  end if;

  permission_key := case p_operation
    when 'read' then 'vehicles.record.read'
    when 'create' then 'vehicles.record.create'
    when 'update' then 'vehicles.record.update'
    when 'archive' then 'vehicles.record.archive'
    else null
  end;

  if permission_key is null then
    return false;
  end if;

  return public.actor_has_permission(permission_key, target_company_id, null);
end;
$$;

create or replace function public.actor_can_export(
  p_company_id uuid,
  p_resource_type text,
  p_resource_id uuid,
  p_permission_key text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  allowed boolean := false;
  reason text := 'denied';
begin
  if p_permission_key is null or p_permission_key !~ '\.export$' then
    perform public.record_security_event(
      p_company_id,
      null,
      p_permission_key,
      'denied',
      'permission_key_not_export',
      p_resource_type,
      p_resource_id,
      'export',
      null,
      '{}'::jsonb,
      null
    );
    return false;
  end if;

  allowed := public.actor_has_permission(p_permission_key, p_company_id, null);
  reason := case when allowed then 'permission_granted' else 'permission_missing' end;

  perform public.record_security_event(
    p_company_id,
    null,
    p_permission_key,
    case when allowed then 'allowed' else 'denied' end,
    reason,
    p_resource_type,
    p_resource_id,
    'export',
    null,
    '{}'::jsonb,
    null
  );

  return allowed;
end;
$$;

insert into public.security_roles (key, name, description, scope_level, parent_role_key, is_system, is_assignable)
values
  ('organisation_owner', 'Organisation Owner', 'Reserved owner role; not auto-backfilled until ownership source is confirmed.', 'organisation', null, true, false),
  ('operations_director', 'Operations Director', 'Reserved organisation operations role.', 'organisation', null, true, false),
  ('regional_manager', 'Regional Manager', 'Reserved site-set role for future site model.', 'site_set', null, true, false),
  ('site_manager', 'Site Manager', 'Reserved site role for future site model.', 'site', null, true, false),
  ('planner', 'Planner', 'Reserved planning role for future rota/job scope.', 'site_set', null, true, false),
  ('workshop_manager', 'Workshop Manager', 'Reserved workshop role for future maintenance scope.', 'site_set', null, true, false),
  ('fleet_administrator', 'Fleet Administrator', 'Compatibility backfill target for legacy managers.', 'organisation', null, true, true),
  ('driver', 'Driver', 'Compatibility backfill target for legacy drivers.', 'own', null, true, true),
  ('platform_admin', 'Platform Admin', 'Reserved platform role; no normal tenant assignment.', 'platform', null, true, false),
  ('system_job', 'System Job', 'Reserved system actor role for audited background operations.', 'organisation', null, true, false)
on conflict (key) do update
set name = excluded.name,
    description = excluded.description,
    scope_level = excluded.scope_level,
    parent_role_key = excluded.parent_role_key,
    is_system = excluded.is_system,
    is_assignable = excluded.is_assignable,
    updated_at = now();

insert into public.security_permissions (key, area, resource, operation, description, risk_level, requires_audit)
values
  ('administration.membership.admin', 'administration', 'membership', 'admin', 'Invite, remove, and manage tenant membership.', 'high', true),
  ('administration.role.admin', 'administration', 'role', 'admin', 'Manage role assignments and permissions.', 'critical', true),
  ('drivers.profile.read', 'drivers', 'profile', 'read', 'Read driver profile data.', 'medium', false),
  ('drivers.profile.update', 'drivers', 'profile', 'update', 'Update driver profile data.', 'high', true),
  ('drivers.profile.archive', 'drivers', 'profile', 'archive', 'Archive or remove driver profiles.', 'high', true),
  ('drivers.own_profile.read', 'drivers', 'own_profile', 'read', 'Read own driver profile.', 'low', false),
  ('drivers.own_profile.update', 'drivers', 'own_profile', 'update', 'Update own driver profile.', 'medium', true),
  ('vehicles.record.read', 'vehicles', 'record', 'read', 'Read vehicle records.', 'medium', false),
  ('vehicles.record.create', 'vehicles', 'record', 'create', 'Create vehicle records.', 'medium', true),
  ('vehicles.record.update', 'vehicles', 'record', 'update', 'Update vehicle records.', 'medium', true),
  ('vehicles.record.archive', 'vehicles', 'record', 'archive', 'Archive vehicle records.', 'high', true),
  ('tachograph.import.create', 'tachograph', 'import', 'create', 'Create tachograph import metadata.', 'high', true),
  ('tachograph.import.read', 'tachograph', 'import', 'read', 'Read tachograph import metadata.', 'high', false),
  ('tachograph.import.update', 'tachograph', 'import', 'update', 'Patch tachograph import review or metadata fields.', 'high', true),
  ('tachograph.import.archive', 'tachograph', 'import', 'archive', 'Archive tachograph import metadata.', 'high', true),
  ('tachograph.raw_file.read', 'tachograph', 'raw_file', 'read', 'Read raw tachograph file object through controlled paths.', 'high', true),
  ('tachograph.raw_file.export', 'tachograph', 'raw_file', 'export', 'Export or download raw tachograph files.', 'critical', true),
  ('tachograph.processing.run', 'tachograph', 'processing', 'run', 'Trigger or reprocess tachograph parser runs.', 'high', true),
  ('compliance.timeline.read', 'compliance', 'timeline', 'read', 'Read generated timeline and compliance evidence.', 'high', false),
  ('compliance.finding.review', 'compliance', 'finding', 'review', 'Review compliance findings as a manager.', 'high', true),
  ('compliance.finding.acknowledge', 'compliance', 'finding', 'acknowledge', 'Acknowledge assigned compliance findings.', 'medium', true),
  ('reporting.report.read', 'reporting', 'report', 'read', 'Preview reports.', 'medium', false),
  ('reporting.report.export', 'reporting', 'report', 'export', 'Export reports and evidence packs.', 'critical', true),
  ('documents.record.read', 'documents', 'record', 'read', 'Read document metadata.', 'high', false),
  ('documents.record.create', 'documents', 'record', 'create', 'Create document metadata.', 'high', true),
  ('documents.record.update', 'documents', 'record', 'update', 'Update document metadata.', 'high', true),
  ('documents.record.archive', 'documents', 'record', 'archive', 'Archive or delete document metadata.', 'high', true),
  ('messaging.thread.read', 'messaging', 'thread', 'read', 'Read permitted message threads.', 'medium', false),
  ('messaging.message.create', 'messaging', 'message', 'create', 'Send messages.', 'medium', true),
  ('atlas.conversation.create', 'atlas', 'conversation', 'create', 'Start tenant-aware Atlas conversation.', 'high', true),
  ('atlas.fleet_summary.read', 'atlas', 'fleet_summary', 'read', 'Read Atlas fleet summaries over tenant records.', 'high', true),
  ('support.session.admin', 'support', 'session', 'admin', 'Manage future support access sessions.', 'critical', true)
on conflict (key) do update
set area = excluded.area,
    resource = excluded.resource,
    operation = excluded.operation,
    description = excluded.description,
    risk_level = excluded.risk_level,
    requires_audit = excluded.requires_audit;

insert into public.security_role_permissions (role_key, permission_key, effect, scope_level)
values
  ('fleet_administrator', 'administration.membership.admin', 'allow', 'organisation'),
  ('fleet_administrator', 'drivers.profile.read', 'allow', 'organisation'),
  ('fleet_administrator', 'drivers.profile.update', 'allow', 'organisation'),
  ('fleet_administrator', 'drivers.profile.archive', 'allow', 'organisation'),
  ('fleet_administrator', 'vehicles.record.read', 'allow', 'organisation'),
  ('fleet_administrator', 'vehicles.record.create', 'allow', 'organisation'),
  ('fleet_administrator', 'vehicles.record.update', 'allow', 'organisation'),
  ('fleet_administrator', 'vehicles.record.archive', 'allow', 'organisation'),
  ('fleet_administrator', 'tachograph.import.create', 'allow', 'organisation'),
  ('fleet_administrator', 'tachograph.import.read', 'allow', 'organisation'),
  ('fleet_administrator', 'tachograph.import.update', 'allow', 'organisation'),
  ('fleet_administrator', 'tachograph.import.archive', 'allow', 'organisation'),
  ('fleet_administrator', 'tachograph.processing.run', 'allow', 'organisation'),
  ('fleet_administrator', 'compliance.timeline.read', 'allow', 'organisation'),
  ('fleet_administrator', 'compliance.finding.review', 'allow', 'organisation'),
  ('fleet_administrator', 'documents.record.read', 'allow', 'organisation'),
  ('fleet_administrator', 'documents.record.create', 'allow', 'organisation'),
  ('fleet_administrator', 'documents.record.update', 'allow', 'organisation'),
  ('fleet_administrator', 'documents.record.archive', 'allow', 'organisation'),
  ('fleet_administrator', 'reporting.report.read', 'allow', 'organisation'),
  ('fleet_administrator', 'messaging.thread.read', 'allow', 'organisation'),
  ('fleet_administrator', 'messaging.message.create', 'allow', 'organisation'),
  ('driver', 'drivers.own_profile.read', 'allow', 'own'),
  ('driver', 'drivers.own_profile.update', 'allow', 'own'),
  ('driver', 'compliance.timeline.read', 'allow', 'own'),
  ('driver', 'compliance.finding.acknowledge', 'allow', 'own'),
  ('driver', 'messaging.thread.read', 'allow', 'own'),
  ('driver', 'messaging.message.create', 'allow', 'own')
on conflict (role_key, permission_key, scope_level) do update
set effect = excluded.effect;

insert into public.security_role_assignments (
  user_id,
  company_id,
  role_key,
  scope_level,
  site_id,
  status,
  source,
  starts_at
)
select
  p.id,
  p.company_id,
  case p.role
    when 'manager' then 'fleet_administrator'
    when 'driver' then 'driver'
  end as role_key,
  'organisation'::text as scope_level,
  null::uuid as site_id,
  'active'::text as status,
  'legacy_profile_backfill'::text as source,
  now() as starts_at
from public.profiles p
where p.company_id is not null
  and p.role in ('manager', 'driver')
  and coalesce(p.is_active, true) = true
on conflict do nothing;

drop policy if exists "Authenticated can read security roles" on public.security_roles;
create policy "Authenticated can read security roles"
  on public.security_roles
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated can read security permissions" on public.security_permissions;
create policy "Authenticated can read security permissions"
  on public.security_permissions
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated can read security role permissions" on public.security_role_permissions;
create policy "Authenticated can read security role permissions"
  on public.security_role_permissions
  for select
  to authenticated
  using (true);

drop policy if exists "Users can read own security role assignments" on public.security_role_assignments;
create policy "Users can read own security role assignments"
  on public.security_role_assignments
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Fleet administrators can read company security role assignments" on public.security_role_assignments;
create policy "Fleet administrators can read company security role assignments"
  on public.security_role_assignments
  for select
  to authenticated
  using (
    company_id = public.current_actor_company_id()
    and public.actor_has_permission('administration.membership.admin', company_id, null)
  );

-- No direct authenticated insert/update/delete policies are added for role
-- assignments or audit events. Writes must go through controlled functions.

revoke all on table public.security_roles from public;
revoke all on table public.security_roles from anon;
revoke all on table public.security_permissions from public;
revoke all on table public.security_permissions from anon;
revoke all on table public.security_role_permissions from public;
revoke all on table public.security_role_permissions from anon;
revoke all on table public.security_role_assignments from public;
revoke all on table public.security_role_assignments from anon;
revoke all on table public.security_permission_audit_events from public;
revoke all on table public.security_permission_audit_events from anon;
revoke all on table public.security_permission_audit_events from authenticated;
revoke all on table public.organisation_memberships_v from public;
revoke all on table public.organisation_memberships_v from anon;
revoke insert, update, delete on table public.security_role_assignments from authenticated;

grant select on table public.security_roles to authenticated;
grant select on table public.security_permissions to authenticated;
grant select on table public.security_role_permissions to authenticated;
grant select on table public.security_role_assignments to authenticated;
grant select on table public.organisation_memberships_v to authenticated;

revoke all on function public.set_security_updated_at() from public;
revoke all on function public.set_security_updated_at() from anon;
revoke all on function public.set_security_updated_at() from authenticated;
revoke all on function public.current_actor_company_id() from public;
revoke all on function public.current_actor_company_id() from anon;
revoke all on function public.current_actor_legacy_role() from public;
revoke all on function public.current_actor_legacy_role() from anon;
revoke all on function public.actor_has_permission(text, uuid, uuid) from public;
revoke all on function public.actor_has_permission(text, uuid, uuid) from anon;
revoke all on function public.record_security_event(uuid, uuid, text, text, text, text, uuid, text, text, jsonb, text) from public;
revoke all on function public.record_security_event(uuid, uuid, text, text, text, text, uuid, text, text, jsonb, text) from anon;
revoke all on function public.record_security_event(uuid, uuid, text, text, text, text, uuid, text, text, jsonb, text) from authenticated;
revoke all on function public.actor_can_access_driver(uuid, text) from public;
revoke all on function public.actor_can_access_driver(uuid, text) from anon;
revoke all on function public.actor_can_access_vehicle(uuid, text) from public;
revoke all on function public.actor_can_access_vehicle(uuid, text) from anon;
revoke all on function public.actor_can_export(uuid, text, uuid, text) from public;
revoke all on function public.actor_can_export(uuid, text, uuid, text) from anon;

grant execute on function public.current_actor_company_id() to authenticated;
grant execute on function public.current_actor_legacy_role() to authenticated;
grant execute on function public.actor_has_permission(text, uuid, uuid) to authenticated;
grant execute on function public.actor_can_access_driver(uuid, text) to authenticated;
grant execute on function public.actor_can_access_vehicle(uuid, text) to authenticated;
grant execute on function public.actor_can_export(uuid, text, uuid, text) to authenticated;

comment on table public.security_roles is 'SEC-007 additive role catalogue. Does not replace legacy profiles.role enforcement by itself.';
comment on table public.security_permissions is 'SEC-007 additive permission catalogue for future zero-trust enforcement.';
comment on table public.security_role_permissions is 'SEC-007 additive role-permission grants. Export/admin/Atlas defaults remain denied unless explicitly granted.';
comment on table public.security_role_assignments is 'SEC-007 additive user role assignments backfilled from active legacy profiles with company_id.';
comment on table public.security_permission_audit_events is 'SEC-007 append-only security decision and sensitive operation event sink.';
comment on view public.organisation_memberships_v is 'Compatibility view over profiles.company_id and profiles.role; not an authoritative membership table.';
