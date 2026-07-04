-- TIME-003: read-only timeline bundle RPCs for current generated timeline rows.

create or replace function public.timeline_event_json(p_event public.timeline_events)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p_event.id,
    'timelineGenerationId', p_event.timeline_generation_id,
    'eventType', p_event.event_type,
    'driverId', p_event.driver_id,
    'vehicleId', p_event.vehicle_id,
    'startTime', p_event.started_at,
    'endTime', p_event.ended_at,
    'durationSeconds', p_event.duration_seconds,
    'timezone', p_event.timezone,
    'confidenceState', p_event.confidence_state,
    'status', p_event.status,
    'isCurrent', p_event.is_current,
    'sourceSummary', p_event.source_summary,
    'parserRunId', p_event.parser_run_id,
    'importFileId', p_event.import_file_id,
    'sourceTable', p_event.source_table,
    'sourceId', p_event.source_id,
    'metadata', p_event.metadata
  );
$$;

create or replace function public.timeline_gap_json(p_gap public.timeline_gaps)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p_gap.id,
    'timelineGenerationId', p_gap.timeline_generation_id,
    'driverId', p_gap.driver_id,
    'vehicleId', p_gap.vehicle_id,
    'startTime', p_gap.started_at,
    'endTime', p_gap.ended_at,
    'durationSeconds', p_gap.duration_seconds,
    'gapType', p_gap.gap_type,
    'severity', p_gap.severity,
    'reason', p_gap.reason,
    'status', p_gap.status,
    'metadata', p_gap.metadata
  );
$$;

create or replace function public.daily_timeline_summary_json(p_summary public.daily_timeline_summaries)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p_summary.id,
    'timelineGenerationId', p_summary.timeline_generation_id,
    'driverId', p_summary.driver_id,
    'vehicleId', p_summary.vehicle_id,
    'date', p_summary.summary_date,
    'drivingSeconds', p_summary.driving_seconds,
    'workSeconds', p_summary.work_seconds,
    'availabilitySeconds', p_summary.availability_seconds,
    'restSeconds', p_summary.rest_seconds,
    'breakSeconds', p_summary.break_seconds,
    'unknownSeconds', p_summary.unknown_seconds,
    'dutyStart', p_summary.duty_start,
    'dutyEnd', p_summary.duty_end,
    'gapCount', p_summary.gap_count,
    'findingCount', p_summary.finding_count,
    'confidenceState', p_summary.confidence_state,
    'metadata', p_summary.metadata
  );
$$;

create or replace function public.timeline_generation_json(p_generation public.timeline_generations)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p_generation.id,
    'companyId', p_generation.company_id,
    'driverId', p_generation.driver_id,
    'vehicleId', p_generation.vehicle_id,
    'scopeType', p_generation.scope_type,
    'scopeId', p_generation.scope_id,
    'rangeStart', p_generation.range_start,
    'rangeEnd', p_generation.range_end,
    'version', p_generation.generation_version,
    'status', p_generation.status,
    'isCurrent', p_generation.is_current,
    'generatedReason', p_generation.generated_reason,
    'sourceImportId', p_generation.source_import_id,
    'parserRunId', p_generation.parser_run_id,
    'supersedesGenerationId', p_generation.supersedes_generation_id,
    'supersededByGenerationId', p_generation.superseded_by_generation_id,
    'supersededAt', p_generation.superseded_at,
    'startedAt', p_generation.started_at,
    'completedAt', p_generation.completed_at,
    'metadata', p_generation.metadata
  );
$$;

create or replace function public.get_import_timeline_bundle(
  p_company_id uuid,
  p_import_id uuid
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with access as (
    select public.get_my_role() = 'manager'
      and public.get_my_company_id() = p_company_id as allowed
  ),
  generation as (
    select tg.*
    from public.timeline_generations tg, access
    where access.allowed
      and tg.company_id = p_company_id
      and tg.source_import_id = p_import_id
      and tg.is_current = true
    order by tg.started_at desc
    limit 1
  )
  select jsonb_build_object(
    'contractVersion', 'timeline-mvp-1',
    'timelineGeneration', coalesce((select public.timeline_generation_json(generation) from generation), 'null'::jsonb),
    'events', coalesce((
      select jsonb_agg(public.timeline_event_json(event) order by event.started_at, event.id)
      from public.timeline_events event
      join generation g on g.id = event.timeline_generation_id
      where event.is_current = true
    ), '[]'::jsonb),
    'gaps', coalesce((
      select jsonb_agg(public.timeline_gap_json(gap) order by gap.started_at, gap.id)
      from public.timeline_gaps gap
      join generation g on g.id = gap.timeline_generation_id
    ), '[]'::jsonb),
    'dailySummaries', coalesce((
      select jsonb_agg(public.daily_timeline_summary_json(summary) order by summary.summary_date)
      from public.daily_timeline_summaries summary
      join generation g on g.id = summary.timeline_generation_id
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', source.id,
        'timelineEventId', source.timeline_event_id,
        'timelineGenerationId', source.timeline_generation_id,
        'sourceType', source.source_type,
        'sourceId', source.source_id,
        'sourceExternalId', source.source_external_id,
        'parserRunId', source.parser_run_id,
        'parserOutputId', source.parser_output_id,
        'importFileId', source.import_file_id,
        'sourceReference', source.source_reference_json
      ) order by source.created_at, source.id)
      from public.timeline_event_sources source
      join generation g on g.id = source.timeline_generation_id
    ), '[]'::jsonb),
    'warnings', case
      when exists (select 1 from access where not allowed) then jsonb_build_array('Not authorised for company timeline.')
      when not exists (select 1 from generation) then jsonb_build_array('No current timeline generation exists for this import.')
      else '[]'::jsonb
    end
  );
$$;

create or replace function public.get_driver_timeline_bundle(
  p_company_id uuid,
  p_driver_id uuid,
  p_range text default '7d'
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with access as (
    select public.get_my_role() = 'manager'
      and public.get_my_company_id() = p_company_id as allowed
  ),
  range_start as (
    select public.resolve_tacho_range_start(p_range) as value
  ),
  generations as (
    select distinct tg.*
    from public.timeline_generations tg
    join public.timeline_events event on event.timeline_generation_id = tg.id
    cross join access
    cross join range_start
    where access.allowed
      and tg.company_id = p_company_id
      and tg.is_current = true
      and event.driver_id = p_driver_id
      and event.started_at >= range_start.value
  )
  select jsonb_build_object(
    'contractVersion', 'timeline-mvp-1',
    'timelineGenerations', coalesce((
      select jsonb_agg(public.timeline_generation_json(generation) order by generation.started_at desc)
      from generations generation
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(public.timeline_event_json(event) order by event.started_at, event.id)
      from public.timeline_events event
      join generations generation on generation.id = event.timeline_generation_id
      cross join range_start
      where event.driver_id = p_driver_id
        and event.is_current = true
        and event.started_at >= range_start.value
    ), '[]'::jsonb),
    'gaps', coalesce((
      select jsonb_agg(public.timeline_gap_json(gap) order by gap.started_at, gap.id)
      from public.timeline_gaps gap
      join generations generation on generation.id = gap.timeline_generation_id
      cross join range_start
      where gap.driver_id = p_driver_id
        and gap.started_at >= range_start.value
    ), '[]'::jsonb),
    'dailySummaries', coalesce((
      select jsonb_agg(public.daily_timeline_summary_json(summary) order by summary.summary_date)
      from public.daily_timeline_summaries summary
      join generations generation on generation.id = summary.timeline_generation_id
      cross join range_start
      where summary.driver_id = p_driver_id
        and summary.summary_date >= range_start.value::date
    ), '[]'::jsonb),
    'warnings', case
      when exists (select 1 from access where not allowed) then jsonb_build_array('Not authorised for company timeline.')
      else '[]'::jsonb
    end
  );
$$;

create or replace function public.get_vehicle_timeline_bundle(
  p_company_id uuid,
  p_vehicle_id uuid,
  p_range text default '7d'
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with access as (
    select public.get_my_role() = 'manager'
      and public.get_my_company_id() = p_company_id as allowed
  ),
  range_start as (
    select public.resolve_tacho_range_start(p_range) as value
  ),
  generations as (
    select distinct tg.*
    from public.timeline_generations tg
    join public.timeline_events event on event.timeline_generation_id = tg.id
    cross join access
    cross join range_start
    where access.allowed
      and tg.company_id = p_company_id
      and tg.is_current = true
      and event.vehicle_id = p_vehicle_id
      and event.started_at >= range_start.value
  )
  select jsonb_build_object(
    'contractVersion', 'timeline-mvp-1',
    'timelineGenerations', coalesce((
      select jsonb_agg(public.timeline_generation_json(generation) order by generation.started_at desc)
      from generations generation
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(public.timeline_event_json(event) order by event.started_at, event.id)
      from public.timeline_events event
      join generations generation on generation.id = event.timeline_generation_id
      cross join range_start
      where event.vehicle_id = p_vehicle_id
        and event.is_current = true
        and event.started_at >= range_start.value
    ), '[]'::jsonb),
    'gaps', coalesce((
      select jsonb_agg(public.timeline_gap_json(gap) order by gap.started_at, gap.id)
      from public.timeline_gaps gap
      join generations generation on generation.id = gap.timeline_generation_id
      cross join range_start
      where gap.vehicle_id = p_vehicle_id
        and gap.started_at >= range_start.value
    ), '[]'::jsonb),
    'dailySummaries', coalesce((
      select jsonb_agg(public.daily_timeline_summary_json(summary) order by summary.summary_date)
      from public.daily_timeline_summaries summary
      join generations generation on generation.id = summary.timeline_generation_id
      cross join range_start
      where summary.vehicle_id = p_vehicle_id
        and summary.summary_date >= range_start.value::date
    ), '[]'::jsonb),
    'warnings', case
      when exists (select 1 from access where not allowed) then jsonb_build_array('Not authorised for company timeline.')
      else '[]'::jsonb
    end
  );
$$;

grant execute on function public.timeline_event_json(public.timeline_events) to authenticated;
grant execute on function public.timeline_gap_json(public.timeline_gaps) to authenticated;
grant execute on function public.daily_timeline_summary_json(public.daily_timeline_summaries) to authenticated;
grant execute on function public.timeline_generation_json(public.timeline_generations) to authenticated;
grant execute on function public.get_import_timeline_bundle(uuid, uuid) to authenticated;
grant execute on function public.get_driver_timeline_bundle(uuid, uuid, text) to authenticated;
grant execute on function public.get_vehicle_timeline_bundle(uuid, uuid, text) to authenticated;
