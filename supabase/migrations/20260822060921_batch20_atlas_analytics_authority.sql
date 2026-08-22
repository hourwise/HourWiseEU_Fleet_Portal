-- Batch 20: governed aggregate containment analytics and explicit paid-inference authority.
-- The policy preference and spending authority are intentionally separate. No
-- owner/billing authority is available in this batch, so paid activation stays unavailable.

alter table private.atlas_containment_daily
  add column if not exists compound_query_count integer not null default 0;

alter table private.atlas_inference_policies
  add column if not exists paid_inference_activation_authority text not null default 'unavailable';

alter table private.atlas_inference_policies
  drop constraint if exists atlas_inference_policies_paid_activation_authority_check;

alter table private.atlas_inference_policies
  add constraint atlas_inference_policies_paid_activation_authority_check
  check (paid_inference_activation_authority in ('unavailable', 'owner', 'billing'));

insert into public.security_permissions (key, area, resource, operation, description, risk_level, requires_audit)
values ('atlas.inference.activate', 'atlas', 'inference', 'activate', 'Authorise paid Atlas inference spending for a company.', 'critical', true)
on conflict (key) do update set description = excluded.description, risk_level = excluded.risk_level, requires_audit = excluded.requires_audit;

drop function if exists public.get_atlas_inference_policy();

create function public.get_atlas_inference_policy()
returns table (
  company_id uuid,
  enabled boolean,
  allowed_tiers text[],
  monthly_budget_minor_units bigint,
  per_request_budget_minor_units bigint,
  daily_request_limit integer,
  monthly_request_limit integer,
  provider_slot text,
  paid_inference_activation_authority text,
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
    select p.company_id, p.enabled, p.allowed_tiers, p.monthly_budget_minor_units,
      p.per_request_budget_minor_units, p.daily_request_limit, p.monthly_request_limit,
      p.provider_slot, p.paid_inference_activation_authority, p.updated_by, p.updated_at
    from private.atlas_inference_policies p
    where p.company_id = actor_company_id;
end;
$$;

drop function if exists public.update_atlas_inference_policy(boolean, text[], integer, integer, integer, integer);

create function public.update_atlas_inference_policy(
  p_enabled boolean,
  p_allowed_tiers text[],
  p_monthly_budget_minor_units bigint default null,
  p_per_request_budget_minor_units bigint default null,
  p_daily_request_limit integer default null,
  p_monthly_request_limit integer default null
)
returns table (
  company_id uuid,
  enabled boolean,
  allowed_tiers text[],
  monthly_budget_minor_units bigint,
  per_request_budget_minor_units bigint,
  daily_request_limit integer,
  monthly_request_limit integer,
  provider_slot text,
  paid_inference_activation_authority text,
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
  insert into private.atlas_inference_policies (company_id, enabled, allowed_tiers, monthly_budget_minor_units,
    per_request_budget_minor_units, daily_request_limit, monthly_request_limit, updated_by)
  values (actor_company_id, coalesce(p_enabled, false), coalesce(p_allowed_tiers, array['SYNTHESIS', 'STANDARD', 'DEEP']::text[]),
    p_monthly_budget_minor_units, p_per_request_budget_minor_units, p_daily_request_limit, p_monthly_request_limit, actor_id)
  on conflict (company_id) do update set enabled = excluded.enabled, allowed_tiers = excluded.allowed_tiers,
    monthly_budget_minor_units = excluded.monthly_budget_minor_units,
    per_request_budget_minor_units = excluded.per_request_budget_minor_units,
    daily_request_limit = excluded.daily_request_limit, monthly_request_limit = excluded.monthly_request_limit,
    updated_by = actor_id, updated_at = now();
  return query select * from public.get_atlas_inference_policy();
end;
$$;

create or replace function public.record_atlas_containment_outcome(
  p_outcome text,
  p_question_fingerprint text,
  p_entity_count integer default 0,
  p_compound_query boolean default false
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
  if p_outcome not in ('deterministic', 'faq', 'clarification', 'unresolved', 'reasoning_candidate')
    or p_question_fingerprint !~ '^q-[0-9a-f]{8}$' then
    raise exception 'Invalid privacy-bounded Atlas telemetry payload' using errcode = '22023';
  end if;
  insert into private.atlas_containment_daily (company_id, day, outcome, question_fingerprint, event_count, entity_count, compound_query_count)
  values (actor_company_id, current_date, p_outcome, p_question_fingerprint, 1, greatest(coalesce(p_entity_count, 0), 0), case when coalesce(p_compound_query, false) then 1 else 0 end)
  on conflict (company_id, day, outcome, question_fingerprint) do update set
    event_count = private.atlas_containment_daily.event_count + 1,
    entity_count = private.atlas_containment_daily.entity_count + greatest(coalesce(p_entity_count, 0), 0),
    compound_query_count = private.atlas_containment_daily.compound_query_count + case when coalesce(p_compound_query, false) then 1 else 0 end,
    updated_at = now();
end;
$$;

create or replace function public.get_atlas_containment_analytics(
  p_from_date date default current_date - 29,
  p_to_date date default current_date
)
returns table (
  day date,
  total_questions bigint,
  deterministic_answers bigint,
  faq_answers bigint,
  clarifications bigint,
  reasoning_candidates bigint,
  unknown_questions bigint,
  containment_rate numeric,
  entity_resolution_count bigint,
  compound_query_count bigint
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
begin
  if auth.uid() is null or actor_company_id is null or not public.actor_has_permission('atlas.policy.admin', actor_company_id, null) then
    raise exception 'Atlas containment analytics requires the governed Atlas policy permission' using errcode = '42501';
  end if;
  if p_from_date is null or p_to_date is null or p_from_date > p_to_date or p_to_date - p_from_date > 30 then
    raise exception 'Atlas analytics date range must be between one and thirty-one days' using errcode = '22023';
  end if;
  return query
    with daily as (
      select series.day::date as day,
        coalesce(sum(d.event_count), 0)::bigint as total_questions,
        coalesce(sum(d.event_count) filter (where d.outcome = 'deterministic'), 0)::bigint as deterministic_answers,
        coalesce(sum(d.event_count) filter (where d.outcome = 'faq'), 0)::bigint as faq_answers,
        coalesce(sum(d.event_count) filter (where d.outcome = 'clarification'), 0)::bigint as clarifications,
        coalesce(sum(d.event_count) filter (where d.outcome = 'reasoning_candidate'), 0)::bigint as reasoning_candidates,
        coalesce(sum(d.event_count) filter (where d.outcome = 'unresolved'), 0)::bigint as unknown_questions,
        coalesce(sum(d.entity_count), 0)::bigint as entity_resolution_count,
        coalesce(sum(d.compound_query_count), 0)::bigint as compound_query_count
      from generate_series(p_from_date, p_to_date, interval '1 day') series(day)
      left join private.atlas_containment_daily d on d.company_id = actor_company_id and d.day = series.day::date
      group by series.day
    )
    select daily.day, daily.total_questions, daily.deterministic_answers, daily.faq_answers, daily.clarifications,
      daily.reasoning_candidates, daily.unknown_questions,
      case when daily.total_questions = 0 then 0 else round(((daily.deterministic_answers + daily.faq_answers + daily.clarifications)::numeric / daily.total_questions), 4) end,
      daily.entity_resolution_count, daily.compound_query_count
    from daily
    order by daily.day;
end;
$$;

revoke all on function public.get_atlas_inference_policy() from public, anon;
revoke all on function public.update_atlas_inference_policy(boolean, text[], bigint, bigint, integer, integer) from public, anon;
revoke all on function public.record_atlas_containment_outcome(text, text, integer, boolean) from public, anon;
revoke all on function public.get_atlas_containment_analytics(date, date) from public, anon;
grant execute on function public.get_atlas_inference_policy() to authenticated;
grant execute on function public.update_atlas_inference_policy(boolean, text[], bigint, bigint, integer, integer) to authenticated;
grant execute on function public.record_atlas_containment_outcome(text, text, integer, boolean) to authenticated;
grant execute on function public.get_atlas_containment_analytics(date, date) to authenticated;

comment on column private.atlas_inference_policies.paid_inference_activation_authority is 'Separate authority for paid inference activation; unavailable until an owner or billing authority source is implemented.';
comment on function public.get_atlas_containment_analytics(date, date) is 'Aggregate company-scoped Atlas containment analytics. Raw questions and fingerprints are never returned.';
