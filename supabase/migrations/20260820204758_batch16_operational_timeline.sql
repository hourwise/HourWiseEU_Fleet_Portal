-- Batch 16: manager-only operational timeline projection.
-- This is a read model over authoritative sources; it is not a second event store.

create index if not exists fleet_events_company_created_id_idx
  on public.fleet_events(company_id, created_at desc, id desc);
create index if not exists security_audit_company_created_id_idx
  on public.security_permission_audit_events(company_id, created_at desc, id desc);
create index if not exists job_evidence_company_uploaded_id_idx
  on public.job_evidence(company_id, uploaded_at desc, id desc);
create index if not exists driver_documents_company_uploaded_id_idx
  on public.driver_documents(company_id, uploaded_at desc, id desc);
create index if not exists task_handlings_company_updated_id_idx
  on public.operational_task_handlings(company_id, updated_at desc, id desc);

create or replace function public.list_manager_operational_timeline(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_category text default null,
  p_event_type text default null,
  p_driver_id uuid default null,
  p_vehicle_id uuid default null,
  p_trailer_id uuid default null,
  p_job_assignment_id uuid default null,
  p_proposal_id uuid default null,
  p_task_id uuid default null,
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null,
  p_unresolved_only boolean default false,
  p_limit integer default 50
)
returns setof jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_company_id uuid := public.get_my_company_id();
  result_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if actor_id is null or public.get_my_role() is distinct from 'manager' then
    raise exception 'Only an authenticated manager can view operational timeline' using errcode = '42501';
  end if;
  if p_category is not null and p_category not in ('job', 'assignment', 'proposal', 'task', 'pod', 'compliance', 'security') then
    raise exception 'Unsupported operational timeline category' using errcode = '22023';
  end if;
  if p_from is not null and p_to is not null and p_from > p_to then
    raise exception 'Operational timeline date range is invalid' using errcode = '22023';
  end if;

  return query
  with fleet_rows as (
    select
      fe.*,
      case when fe.payload ->> 'job_assignment_id' ~* '^[0-9a-f-]{36}$'
        then (fe.payload ->> 'job_assignment_id')::uuid end as payload_assignment_id,
      case when fe.payload ->> 'proposal_id' ~* '^[0-9a-f-]{36}$'
        then (fe.payload ->> 'proposal_id')::uuid end as payload_proposal_id,
      case when fe.payload ->> 'vehicle_id' ~* '^[0-9a-f-]{36}$'
        then (fe.payload ->> 'vehicle_id')::uuid end as payload_vehicle_id,
      case when fe.payload ->> 'trailer_id' ~* '^[0-9a-f-]{36}$'
        then (fe.payload ->> 'trailer_id')::uuid end as payload_trailer_id
    from public.fleet_events fe
    where fe.company_id = actor_company_id
      and (p_from is null or fe.created_at >= p_from)
      and (p_to is null or fe.created_at <= p_to)
  ),
  source_rows as (
    select
      fe.created_at as occurred_at,
      case when fe.payload_assignment_id is not null then 'job' when fe.related_shift_id is not null then 'assignment' else 'security' end as category,
      fe.event_type,
      fe.priority as severity,
      fe.actor_id,
      coalesce(ja.driver_id, fe.recipient_driver_id) as driver_id,
      coalesce(ja.vehicle_id, s.vehicle_id, fe.payload_vehicle_id) as vehicle_id,
      coalesce(ja.trailer_id, fe.payload_trailer_id) as trailer_id,
      coalesce(ja.id, fe.payload_assignment_id) as job_assignment_id,
      null::uuid as proposal_id,
      case when fe.related_shift_id is not null then 'shift' when coalesce(ja.id, fe.payload_assignment_id) is not null then 'job_assignment' else 'fleet_event' end as entity_type,
      coalesce(ja.id, fe.related_shift_id, fe.id) as entity_id,
      case when fe.related_shift_id is not null then 'Shift ' || left(fe.related_shift_id::text, 8) when coalesce(ja.id, fe.payload_assignment_id) is not null then 'Job assignment ' || left(coalesce(ja.id, fe.payload_assignment_id)::text, 8) else 'Fleet event ' || left(fe.id::text, 8) end as entity_label,
      left(coalesce(fe.title, 'Operational event'), 240) as summary,
      'fleet_events' as source_system,
      fe.id as source_id,
      fe.id as related_event_id,
      fe.payload_proposal_id as related_proposal_id,
      '/dashboard?workspace=people&people=messages' as navigation_target,
      (fe.requires_ack and not exists (select 1 from public.driver_acknowledgements da where da.company_id = actor_company_id and da.event_id = fe.id)) as unresolved
    from fleet_rows fe
    left join public.job_assignments ja on ja.company_id = actor_company_id and ja.id = fe.payload_assignment_id
    left join public.shifts s on s.company_id = actor_company_id and s.id = fe.related_shift_id

    union all

    select
      coalesce(ap.applied_at, ap.reviewed_at, ap.created_at) as occurred_at,
      'proposal' as category,
      case when ap.status = 'pending_review' then 'proposal_pending_review' else 'proposal_' || ap.status end as event_type,
      case when ap.status in ('failed', 'applying') then 'critical' when ap.status in ('pending_review', 'approved') then 'warning' else 'info' end as severity,
      coalesce(ap.applied_by, ap.reviewed_by, ap.created_by) as actor_id,
      ja.driver_id,
      ja.vehicle_id,
      case when ap.proposed_change ->> 'trailer_id' ~* '^[0-9a-f-]{36}$' then (ap.proposed_change ->> 'trailer_id')::uuid end as trailer_id,
      case when ap.target_entity_type = 'job_assignment' then ap.target_entity_id end as job_assignment_id,
      ap.id as proposal_id,
      ap.target_entity_type as entity_type,
      ap.target_entity_id as entity_id,
      initcap(replace(ap.target_entity_type, '_', ' ')) || ' ' || left(ap.target_entity_id::text, 8) as entity_label,
      case when ap.status = 'applied' then 'Atlas proposal applied' when ap.status = 'rejected' then 'Atlas proposal rejected' else 'Atlas proposal requires review or follow-up' end as summary,
      'atlas_proposals' as source_system,
      ap.id as source_id,
      ap.resulting_event_id as related_event_id,
      ap.id as related_proposal_id,
      '/dashboard?workspace=people&people=atlas' as navigation_target,
      ap.status not in ('applied', 'rejected') as unresolved
    from public.atlas_proposals ap
    left join public.job_assignments ja on ja.company_id = actor_company_id and ap.target_entity_type = 'job_assignment' and ja.id = ap.target_entity_id
    where ap.company_id = actor_company_id
      and (p_from is null or coalesce(ap.applied_at, ap.reviewed_at, ap.created_at) >= p_from)
      and (p_to is null or coalesce(ap.applied_at, ap.reviewed_at, ap.created_at) <= p_to)

    union all

    select
      audit.created_at as occurred_at,
      'proposal' as category,
      'proposal_audit' as event_type,
      case when audit.decision = 'denied' then 'critical' else 'info' end as severity,
      audit.actor_user_id as actor_id,
      null::uuid as driver_id,
      null::uuid as vehicle_id,
      null::uuid as trailer_id,
      case when audit.resource_type = 'job_assignment' then audit.resource_id end as job_assignment_id,
      case when audit.metadata ->> 'proposal_id' ~* '^[0-9a-f-]{36}$' then (audit.metadata ->> 'proposal_id')::uuid end as proposal_id,
      coalesce(audit.resource_type, 'audit_event') as entity_type,
      audit.resource_id as entity_id,
      initcap(replace(coalesce(audit.resource_type, 'audit event'), '_', ' ')) || coalesce(' ' || left(audit.resource_id::text, 8), '') as entity_label,
      'Atlas proposal audit action recorded' as summary,
      'security_permission_audit_events' as source_system,
      audit.id as source_id,
      case when audit.metadata ->> 'resulting_event_id' ~* '^[0-9a-f-]{36}$' then (audit.metadata ->> 'resulting_event_id')::uuid end as related_event_id,
      case when audit.metadata ->> 'proposal_id' ~* '^[0-9a-f-]{36}$' then (audit.metadata ->> 'proposal_id')::uuid end as related_proposal_id,
      '/dashboard?workspace=people&people=atlas' as navigation_target,
      false as unresolved
    from public.security_permission_audit_events audit
    where audit.company_id = actor_company_id
      and audit.metadata ->> 'proposal_id' is not null
      and (p_from is null or audit.created_at >= p_from)
      and (p_to is null or audit.created_at <= p_to)

    union all

    select
      handling.updated_at as occurred_at,
      'task' as category,
      'task_' || handling.status as event_type,
      case when handling.status = 'resolved' then 'info' when handling.status = 'in_progress' then 'warning' else 'advisory' end as severity,
      handling.updated_by as actor_id,
      null::uuid as driver_id,
      null::uuid as vehicle_id,
      null::uuid as trailer_id,
      case when handling.source_type = 'job_assignment' then handling.source_id end as job_assignment_id,
      null::uuid as proposal_id,
      handling.source_type as entity_type,
      handling.source_id as entity_id,
      initcap(replace(handling.source_type, '_', ' ')) || ' ' || left(handling.source_id::text, 8) as entity_label,
      case when handling.status = 'resolved' then 'Operational task handling resolved' else 'Operational task handling updated' end as summary,
      'operational_task_handlings' as source_system,
      handling.id as source_id,
      null::uuid as related_event_id,
      null::uuid as related_proposal_id,
      case when handling.source_type = 'driver_compliance' then '/dashboard?workspace=people&people=drivers' when handling.source_type in ('job_assignment', 'shift') then '/dashboard?workspace=people&people=jobs' else '/dashboard?workspace=fleet&fleet=vehicles' end as navigation_target,
      handling.status <> 'resolved' as unresolved
    from public.operational_task_handlings handling
    where handling.company_id = actor_company_id
      and (p_from is null or handling.updated_at >= p_from)
      and (p_to is null or handling.updated_at <= p_to)

    union all

    select
      coalesce(evidence.reviewed_at, evidence.uploaded_at) as occurred_at,
      'pod' as category,
      case when evidence.reviewed_at is null then 'pod_uploaded' else 'pod_review_' || evidence.review_status end as event_type,
      case when evidence.review_status = 'needs_follow_up' then 'warning' when evidence.review_status = 'rejected' then 'high' else 'info' end as severity,
      coalesce(evidence.reviewed_by, evidence.uploaded_by) as actor_id,
      ja.driver_id,
      ja.vehicle_id,
      ja.trailer_id,
      evidence.job_assignment_id,
      null::uuid as proposal_id,
      'job_assignment' as entity_type,
      evidence.job_assignment_id as entity_id,
      'Job assignment ' || left(evidence.job_assignment_id::text, 8) as entity_label,
      case when evidence.reviewed_at is null then 'POD evidence uploaded' else 'POD evidence review recorded' end as summary,
      'job_evidence' as source_system,
      evidence.id as source_id,
      null::uuid as related_event_id,
      null::uuid as related_proposal_id,
      '/dashboard?workspace=people&people=jobs' as navigation_target,
      evidence.review_status in ('pending', 'needs_follow_up') as unresolved
    from public.job_evidence evidence
    join public.job_assignments ja on ja.company_id = actor_company_id and ja.id = evidence.job_assignment_id
    where evidence.company_id = actor_company_id
      and (p_from is null or coalesce(evidence.reviewed_at, evidence.uploaded_at) >= p_from)
      and (p_to is null or coalesce(evidence.reviewed_at, evidence.uploaded_at) <= p_to)

    union all

    select
      documents.uploaded_at as occurred_at,
      'compliance' as category,
      'driver_document_uploaded' as event_type,
      'info' as severity,
      documents.uploaded_by as actor_id,
      documents.user_id as driver_id,
      null::uuid as vehicle_id,
      null::uuid as trailer_id,
      null::uuid as job_assignment_id,
      null::uuid as proposal_id,
      'driver' as entity_type,
      documents.user_id as entity_id,
      'Driver compliance evidence' as entity_label,
      'Driver compliance evidence recorded' as summary,
      'driver_documents' as source_system,
      documents.id as source_id,
      null::uuid as related_event_id,
      null::uuid as related_proposal_id,
      '/dashboard?workspace=people&people=drivers' as navigation_target,
      false as unresolved
    from public.driver_documents documents
    where documents.company_id = actor_company_id
      and (p_from is null or documents.uploaded_at >= p_from)
      and (p_to is null or documents.uploaded_at <= p_to)

    union all

    select
      audit.created_at as occurred_at,
      'security' as category,
      'security_permission_' || audit.decision as event_type,
      case when audit.decision = 'denied' then 'critical' else 'info' end as severity,
      audit.actor_user_id as actor_id,
      null::uuid as driver_id,
      null::uuid as vehicle_id,
      null::uuid as trailer_id,
      null::uuid as job_assignment_id,
      null::uuid as proposal_id,
      coalesce(audit.resource_type, 'security') as entity_type,
      audit.resource_id as entity_id,
      initcap(replace(coalesce(audit.resource_type, 'security event'), '_', ' ')) as entity_label,
      'Security permission decision recorded' as summary,
      'security_permission_audit_events' as source_system,
      audit.id as source_id,
      null::uuid as related_event_id,
      null::uuid as related_proposal_id,
      '/dashboard?workspace=settings&settings=security' as navigation_target,
      false as unresolved
    from public.security_permission_audit_events audit
    where audit.company_id = actor_company_id
      and audit.metadata ->> 'proposal_id' is null
      and (p_from is null or audit.created_at >= p_from)
      and (p_to is null or audit.created_at <= p_to)
  )
  select jsonb_build_object(
    'id', source_rows.source_system || ':' || source_rows.source_id::text,
    'occurredAt', source_rows.occurred_at,
    'category', source_rows.category,
    'eventType', source_rows.event_type,
    'severity', source_rows.severity,
    'actor', case when source_rows.actor_id is null then null else jsonb_build_object('id', source_rows.actor_id, 'label', coalesce(actor_profile.full_name, 'Portal actor'), 'role', actor_profile.role) end,
    'entity', jsonb_build_object('type', source_rows.entity_type, 'id', source_rows.entity_id, 'label', source_rows.entity_label),
    'summary', source_rows.summary,
    'sourceSystem', source_rows.source_system,
    'sourceId', source_rows.source_id,
    'relatedEventId', source_rows.related_event_id,
    'relatedProposalId', source_rows.related_proposal_id,
    'navigationTarget', source_rows.navigation_target
  )
  from source_rows
  left join public.profiles actor_profile on actor_profile.id = source_rows.actor_id and actor_profile.company_id = actor_company_id
  where (p_category is null or source_rows.category = p_category)
    and (p_event_type is null or source_rows.event_type = p_event_type)
    and (p_driver_id is null or source_rows.driver_id = p_driver_id)
    and (p_vehicle_id is null or source_rows.vehicle_id = p_vehicle_id)
    and (p_trailer_id is null or source_rows.trailer_id = p_trailer_id)
    and (p_job_assignment_id is null or source_rows.job_assignment_id = p_job_assignment_id)
    and (p_proposal_id is null or source_rows.proposal_id = p_proposal_id or source_rows.related_proposal_id = p_proposal_id)
    and (p_task_id is null or (source_rows.source_system = 'operational_task_handlings' and source_rows.source_id = p_task_id))
    and (not coalesce(p_unresolved_only, false) or source_rows.unresolved)
    and (p_cursor_at is null or source_rows.occurred_at < p_cursor_at or (source_rows.occurred_at = p_cursor_at and source_rows.source_id < coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
  order by source_rows.occurred_at desc, source_rows.source_id desc
  limit result_limit;
end;
$$;

revoke all on function public.list_manager_operational_timeline(timestamptz, timestamptz, text, text, uuid, uuid, uuid, uuid, uuid, uuid, timestamptz, uuid, boolean, integer) from public, anon;
grant execute on function public.list_manager_operational_timeline(timestamptz, timestamptz, text, text, uuid, uuid, uuid, uuid, uuid, uuid, timestamptz, uuid, boolean, integer) to authenticated;

comment on function public.list_manager_operational_timeline(timestamptz, timestamptz, text, text, uuid, uuid, uuid, uuid, uuid, uuid, timestamptz, uuid, boolean, integer)
is 'Bounded manager-only operational timeline projection over authoritative event, proposal, task, POD, compliance, and security sources. It does not duplicate source truth or expose raw metadata.';
