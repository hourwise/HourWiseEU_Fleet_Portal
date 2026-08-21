-- Batch 19: deterministic Atlas containment aggregates and governed policy administration.
-- No raw question text is stored and private policy tables remain outside the Data API.

create table if not exists private.atlas_containment_daily (
  company_id uuid not null references public.companies(id) on delete cascade,
  day date not null default current_date,
  outcome text not null check (outcome in ('deterministic', 'faq', 'clarification', 'unresolved', 'reasoning_candidate')),
  question_fingerprint text not null check (question_fingerprint ~ '^q-[0-9a-f]{8}$'),
  event_count integer not null default 0 check (event_count >= 0),
  entity_count integer not null default 0 check (entity_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, day, outcome, question_fingerprint)
);

alter table private.atlas_containment_daily enable row level security;
revoke all on table private.atlas_containment_daily from public, anon, authenticated;

insert into public.security_permissions (key, area, resource, operation, description, risk_level, requires_audit)
values ('atlas.policy.admin', 'atlas', 'policy', 'admin', 'Read and update the governed company Atlas inference policy.', 'critical', true)
on conflict (key) do update set description = excluded.description, risk_level = excluded.risk_level, requires_audit = excluded.requires_audit;

insert into public.security_role_permissions (role_key, permission_key, effect, scope_level)
values ('fleet_administrator', 'atlas.policy.admin', 'allow', 'organisation')
on conflict (role_key, permission_key, scope_level) do update set effect = excluded.effect;

create or replace function public.get_atlas_inference_policy()
returns table (
  company_id uuid,
  enabled boolean,
  allowed_tiers text[],
  monthly_budget_minor_units integer,
  per_request_budget_minor_units integer,
  daily_request_limit integer,
  monthly_request_limit integer,
  provider_slot text,
  updated_by uuid,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
begin
  if auth.uid() is null or actor_company_id is null or not public.actor_has_permission('atlas.policy.admin', actor_company_id, null) then
    raise exception 'Atlas policy administration requires the governed Atlas policy permission' using errcode = '42501';
  end if;
  return query
    select p.company_id, p.enabled, p.allowed_tiers, p.monthly_budget_minor_units, p.per_request_budget_minor_units,
      p.daily_request_limit, p.monthly_request_limit, p.provider_slot, p.updated_by, p.updated_at
    from private.atlas_inference_policies p
    where p.company_id = actor_company_id;
end;
$$;

create or replace function public.update_atlas_inference_policy(
  p_enabled boolean,
  p_allowed_tiers text[],
  p_monthly_budget_minor_units integer default null,
  p_per_request_budget_minor_units integer default null,
  p_daily_request_limit integer default null,
  p_monthly_request_limit integer default null
)
returns table (
  company_id uuid,
  enabled boolean,
  allowed_tiers text[],
  monthly_budget_minor_units integer,
  per_request_budget_minor_units integer,
  daily_request_limit integer,
  monthly_request_limit integer,
  provider_slot text,
  updated_by uuid,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
  actor_id uuid := auth.uid();
begin
  if actor_id is null or actor_company_id is null or not public.actor_has_permission('atlas.policy.admin', actor_company_id, null) then
    raise exception 'Atlas policy administration requires the governed Atlas policy permission' using errcode = '42501';
  end if;
  if p_allowed_tiers is null or not (p_allowed_tiers <@ array['SYNTHESIS', 'STANDARD', 'DEEP']::text[]) then
    raise exception 'Atlas policy contains an unsupported model tier' using errcode = '22023';
  end if;
  insert into private.atlas_inference_policies (company_id, enabled, allowed_tiers, monthly_budget_minor_units, per_request_budget_minor_units, daily_request_limit, monthly_request_limit, updated_by)
  values (actor_company_id, coalesce(p_enabled, false), coalesce(p_allowed_tiers, array['SYNTHESIS', 'STANDARD', 'DEEP']::text[]), p_monthly_budget_minor_units, p_per_request_budget_minor_units, p_daily_request_limit, p_monthly_request_limit, actor_id)
  on conflict (company_id) do update set enabled = excluded.enabled, allowed_tiers = excluded.allowed_tiers, monthly_budget_minor_units = excluded.monthly_budget_minor_units, per_request_budget_minor_units = excluded.per_request_budget_minor_units, daily_request_limit = excluded.daily_request_limit, monthly_request_limit = excluded.monthly_request_limit, updated_by = actor_id, updated_at = now();
  return query select * from public.get_atlas_inference_policy();
end;
$$;

create or replace function public.record_atlas_containment_outcome(
  p_outcome text,
  p_question_fingerprint text,
  p_entity_count integer default 0
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
begin
  if auth.uid() is null or actor_company_id is null or public.get_my_role() is distinct from 'manager' then
    raise exception 'Only an authenticated manager can record Atlas containment telemetry' using errcode = '42501';
  end if;
  if p_outcome not in ('deterministic', 'faq', 'clarification', 'unresolved', 'reasoning_candidate') or p_question_fingerprint !~ '^q-[0-9a-f]{8}$' then
    raise exception 'Invalid privacy-bounded Atlas telemetry payload' using errcode = '22023';
  end if;
  insert into private.atlas_containment_daily (company_id, day, outcome, question_fingerprint, event_count, entity_count)
  values (actor_company_id, current_date, p_outcome, p_question_fingerprint, 1, greatest(coalesce(p_entity_count, 0), 0))
  on conflict (company_id, day, outcome, question_fingerprint) do update set event_count = private.atlas_containment_daily.event_count + 1, entity_count = private.atlas_containment_daily.entity_count + greatest(coalesce(p_entity_count, 0), 0), updated_at = now();
end;
$$;

revoke all on function public.get_atlas_inference_policy() from public, anon;
revoke all on function public.update_atlas_inference_policy(boolean, text[], integer, integer, integer, integer) from public, anon;
revoke all on function public.record_atlas_containment_outcome(text, text, integer) from public, anon;
grant execute on function public.get_atlas_inference_policy() to authenticated;
grant execute on function public.update_atlas_inference_policy(boolean, text[], integer, integer, integer, integer) to authenticated;
grant execute on function public.record_atlas_containment_outcome(text, text, integer) to authenticated;

comment on table private.atlas_containment_daily is 'Aggregate Atlas routing outcomes only; raw questions are intentionally never stored.';
