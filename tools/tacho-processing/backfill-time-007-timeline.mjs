#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot, withLivePostgres } from './live-postgres-client.mjs';

const apply = process.argv.includes('--apply');
const outputPath = path.join(repoRoot, 'supabase', '.temp', `time-007-backfill-${new Date().toISOString().slice(0, 10)}.json`);

const PREVIEW_SQL = `
with candidate_pool as (
  select
    tf.id,
    coalesce(tf.source_type, case when tf.vehicle_id is not null then 'vehicle_unit' else 'driver_card' end) as source_type,
    tf.uploaded_at,
    (select count(*) from public.tachograph_activity_segments tas where tas.import_id = tf.id) as activity_count,
    (select count(*) from public.tachograph_technical_events tte where tte.import_id = tf.id) as technical_event_count,
    (select count(*) from public.tachograph_day_summaries tds where tds.import_id = tf.id) as day_summary_count,
    (
      (select count(*) from public.tachograph_vehicle_motion_discrepancies tvmd where tvmd.import_id = tf.id)
      +
      (select count(*) from public.tachograph_reconciliation_items tri where tri.import_id = tf.id and tri.status <> 'matched')
    ) as gap_source_count,
    exists (
      select 1
      from public.timeline_generations tg
      where tg.source_import_id = tf.id
        and tg.scope_type = 'import'
        and tg.is_current = true
    ) as has_current_timeline
  from public.tachograph_files tf
  where tf.status in ('processed', 'partial')
    and coalesce(tf.metadata->>'candidate_import_archived_at', '') = ''
    and coalesce(tf.metadata->>'driver_card_retention_state', 'active') <> 'archived'
),
ranked_candidates as (
  select
    *,
    row_number() over (partition by source_type order by uploaded_at desc) as source_rank
  from candidate_pool
  where activity_count > 0
    and day_summary_count > 0
    and has_current_timeline = false
)
select jsonb_pretty(jsonb_build_object(
  'mode', 'preview',
  'previewedAt', now(),
  'applyRequired', true,
  'candidateCounts', coalesce((
    select jsonb_object_agg(source_type, source_count)
    from (
      select source_type, count(*) as source_count
      from ranked_candidates
      group by source_type
    ) counts
  ), '{}'::jsonb),
  'selectedCandidates', coalesce((
    select jsonb_object_agg(
      source_type,
      jsonb_build_object(
        'uploadedAt', uploaded_at,
        'activityCount', activity_count,
        'technicalEventCount', technical_event_count,
        'daySummaryCount', day_summary_count,
        'gapSourceCount', gap_source_count
      )
    )
    from ranked_candidates
    where source_rank = 1
  ), '{}'::jsonb),
  'alreadyCurrentSourceTypes', coalesce((
    select jsonb_agg(distinct source_type order by source_type)
    from candidate_pool
    where has_current_timeline = true
  ), '[]'::jsonb),
  'blockedSourceTypes', (
    select jsonb_agg(source_type)
    from (
      values ('driver_card'::text), ('vehicle_unit'::text)
    ) required(source_type)
    where not exists (
      select 1 from ranked_candidates rc where rc.source_type = required.source_type
    )
    and not exists (
      select 1
      from candidate_pool cp
      where cp.source_type = required.source_type
        and cp.has_current_timeline = true
    )
  )
));
`;

const APPLY_SQL = `
begin;

with candidate_pool as (
  select
    tf.id,
    tf.company_id,
    tf.driver_id,
    tf.vehicle_id,
    coalesce(tf.source_type, case when tf.vehicle_id is not null then 'vehicle_unit' else 'driver_card' end) as source_type,
    tf.uploaded_at,
    (select tpr.id from public.tachograph_processing_runs tpr where tpr.import_id = tf.id and tpr.is_current = true order by tpr.processed_at desc nulls last limit 1) as current_parser_run_id,
    (select count(*) from public.tachograph_activity_segments tas where tas.import_id = tf.id) as activity_count,
    (select count(*) from public.tachograph_technical_events tte where tte.import_id = tf.id) as technical_event_count,
    (select count(*) from public.tachograph_day_summaries tds where tds.import_id = tf.id) as day_summary_count,
    (
      (select count(*) from public.tachograph_vehicle_motion_discrepancies tvmd where tvmd.import_id = tf.id)
      +
      (select count(*) from public.tachograph_reconciliation_items tri where tri.import_id = tf.id and tri.status <> 'matched')
    ) as gap_source_count,
    exists (
      select 1
      from public.timeline_generations tg
      where tg.source_import_id = tf.id
        and tg.scope_type = 'import'
        and tg.is_current = true
    ) as has_current_timeline
  from public.tachograph_files tf
  where tf.status in ('processed', 'partial')
    and coalesce(tf.metadata->>'candidate_import_archived_at', '') = ''
    and coalesce(tf.metadata->>'driver_card_retention_state', 'active') <> 'archived'
),
selected as (
  select *
  from (
    select
      candidate_pool.*,
      row_number() over (partition by source_type order by uploaded_at desc) as source_rank
    from candidate_pool
    where activity_count > 0
      and day_summary_count > 0
      and has_current_timeline = false
  ) ranked
  where source_rank = 1
),
range_bounds as (
  select
    selected.id as import_id,
    min(tas.start_time) as range_start,
    max(tas.end_time) as range_end
  from selected
  join public.tachograph_activity_segments tas on tas.import_id = selected.id
  group by selected.id
),
previous_generations as (
  select tg.id, tg.source_import_id
  from public.timeline_generations tg
  join selected on selected.id = tg.source_import_id
  where tg.scope_type = 'import'
    and tg.is_current = true
),
inserted_generations as (
  insert into public.timeline_generations (
    company_id,
    driver_id,
    vehicle_id,
    scope_type,
    scope_id,
    range_start,
    range_end,
    generation_version,
    status,
    is_current,
    generated_by,
    generated_by_kind,
    generated_reason,
    source_import_id,
    parser_run_id,
    supersedes_generation_id,
    metadata
  )
  select
    selected.company_id,
    selected.driver_id,
    selected.vehicle_id,
    'import',
    selected.id,
    range_bounds.range_start,
    range_bounds.range_end,
    'timeline-mvp@1',
    'running',
    false,
    null,
    'backfill',
    'backfill',
    selected.id,
    selected.current_parser_run_id,
    previous_generations.id,
    jsonb_build_object(
      'time_007_backfill', true,
      'source_type', selected.source_type,
      'activity_source_count', selected.activity_count,
      'technical_event_source_count', selected.technical_event_count,
      'gap_source_count', selected.gap_source_count,
      'daily_summary_source_count', selected.day_summary_count
    )
  from selected
  join range_bounds on range_bounds.import_id = selected.id
  left join previous_generations on previous_generations.source_import_id = selected.id
  where range_bounds.range_end > range_bounds.range_start
  returning id, company_id, source_import_id, parser_run_id
),
activity_events as (
  insert into public.timeline_events (
    company_id,
    timeline_generation_id,
    driver_id,
    vehicle_id,
    event_type,
    started_at,
    ended_at,
    duration_seconds,
    timezone,
    confidence_state,
    source_summary,
    status,
    is_current,
    parser_run_id,
    import_file_id,
    source_table,
    source_id,
    metadata
  )
  select
    ig.company_id,
    ig.id,
    tas.driver_id,
    tas.vehicle_id,
    case tas.activity_type
      when 'driving' then 'driving'
      when 'work' then 'other_work'
      when 'poa' then 'availability'
      when 'break_rest' then 'rest'
      else 'unknown'
    end,
    tas.start_time,
    tas.end_time,
    greatest(0, coalesce(tas.duration_mins, 0) * 60),
    'UTC',
    case tas.confidence
      when 'high' then 'confirmed'
      when 'medium' then 'likely'
      when 'low' then 'possible'
      else 'uncertain'
    end,
    coalesce(tas.label, 'Tachograph ' || tas.activity_type || ' activity'),
    'current',
    true,
    coalesce(tas.parser_run_id, ig.parser_run_id),
    ig.source_import_id,
    'tachograph_activity_segments',
    tas.id,
    jsonb_build_object(
      'tachograph_source', tas.source,
      'activity_type', tas.activity_type,
      'time_007_backfill', true
    )
  from inserted_generations ig
  join public.tachograph_activity_segments tas on tas.import_id = ig.source_import_id
  returning id, company_id, timeline_generation_id, source_table, source_id, parser_run_id, import_file_id
),
technical_events as (
  insert into public.timeline_events (
    company_id,
    timeline_generation_id,
    driver_id,
    vehicle_id,
    event_type,
    started_at,
    ended_at,
    duration_seconds,
    timezone,
    confidence_state,
    source_summary,
    status,
    is_current,
    parser_run_id,
    import_file_id,
    source_table,
    source_id,
    metadata
  )
  select
    ig.company_id,
    ig.id,
    tte.driver_id,
    tte.vehicle_id,
    case tte.rule_code
      when 'VU_DRIVING_WITHOUT_CARD' then 'movement_without_card'
      when 'VU_OVERSPEED' then 'overspeed'
      else 'technical_event'
    end,
    coalesce(tte.period_start, tte.occurred_at),
    coalesce(tte.period_end, tte.occurred_at),
    greatest(0, floor(extract(epoch from (coalesce(tte.period_end, tte.occurred_at) - coalesce(tte.period_start, tte.occurred_at))))::integer),
    'UTC',
    'confirmed',
    coalesce(tte.summary, tte.title, 'Tachograph technical event'),
    'current',
    true,
    coalesce(tte.parser_run_id, ig.parser_run_id),
    ig.source_import_id,
    'tachograph_technical_events',
    tte.id,
    jsonb_build_object(
      'rule_code', tte.rule_code,
      'severity', tte.severity,
      'title', tte.title,
      'time_007_backfill', true
    )
  from inserted_generations ig
  join public.tachograph_technical_events tte on tte.import_id = ig.source_import_id
  returning id, company_id, timeline_generation_id, source_table, source_id, parser_run_id, import_file_id
),
all_events as (
  select * from activity_events
  union all
  select * from technical_events
),
event_sources as (
  insert into public.timeline_event_sources (
    company_id,
    timeline_event_id,
    timeline_generation_id,
    source_type,
    source_id,
    parser_run_id,
    import_file_id,
    source_reference_json
  )
  select
    all_events.company_id,
    all_events.id,
    all_events.timeline_generation_id,
    case all_events.source_table
      when 'tachograph_activity_segments' then 'tachograph_activity_segment'
      when 'tachograph_technical_events' then 'tachograph_technical_event'
      else 'manual_entry'
    end,
    all_events.source_id,
    all_events.parser_run_id,
    all_events.import_file_id,
    jsonb_build_object(
      'source_table', all_events.source_table,
      'source_id', all_events.source_id,
      'time_007_backfill', true
    )
  from all_events
  where all_events.source_id is not null
  returning id
),
discrepancy_gaps as (
  insert into public.timeline_gaps (
    company_id,
    timeline_generation_id,
    driver_id,
    vehicle_id,
    started_at,
    ended_at,
    duration_seconds,
    gap_type,
    severity,
    reason,
    status,
    metadata
  )
  select
    ig.company_id,
    ig.id,
    tvmd.driver_id,
    tvmd.vehicle_id,
    tvmd.start_time,
    tvmd.end_time,
    greatest(0, coalesce(tvmd.duration_mins, 0) * 60),
    case tvmd.status
      when 'unassigned_motion' then 'unknown_driver'
      when 'card_gap' then 'missing_driver_card_data'
      when 'driver_mismatch' then 'app_tacho_mismatch'
      else 'manual_review_required'
    end,
    coalesce(tvmd.severity, 'medium'),
    coalesce(tvmd.summary, 'Vehicle motion discrepancy requires review.'),
    'open',
    jsonb_build_object(
      'source_table', 'tachograph_vehicle_motion_discrepancies',
      'source_id', tvmd.id,
      'import_id', tvmd.import_id,
      'parser_run_id', tvmd.parser_run_id,
      'discrepancy_status', tvmd.status,
      'time_007_backfill', true
    )
  from inserted_generations ig
  join public.tachograph_vehicle_motion_discrepancies tvmd on tvmd.import_id = ig.source_import_id
  returning id, timeline_generation_id, started_at
),
reconciliation_gaps as (
  insert into public.timeline_gaps (
    company_id,
    timeline_generation_id,
    driver_id,
    vehicle_id,
    started_at,
    ended_at,
    duration_seconds,
    gap_type,
    severity,
    reason,
    status,
    metadata
  )
  select
    ig.company_id,
    ig.id,
    tri.driver_id,
    tri.vehicle_id,
    (tri.recon_date::text || 'T00:00:00.000Z')::timestamptz,
    ((tri.recon_date + interval '1 day')::date::text || 'T00:00:00.000Z')::timestamptz,
    86400,
    'app_tacho_mismatch',
    case tri.status when 'uncertain' then 'low' else 'medium' end,
    coalesce(tri.summary, 'App and tachograph activity do not match.'),
    'open',
    jsonb_build_object(
      'source_table', 'tachograph_reconciliation_items',
      'source_id', tri.id,
      'import_id', tri.import_id,
      'parser_run_id', tri.parser_run_id,
      'reconciliation_status', tri.status,
      'app_label', tri.app_label,
      'tacho_label', tri.tacho_label,
      'time_007_backfill', true
    )
  from inserted_generations ig
  join public.tachograph_reconciliation_items tri on tri.import_id = ig.source_import_id
  where tri.status <> 'matched'
  returning id, timeline_generation_id, started_at
),
all_gaps as (
  select * from discrepancy_gaps
  union all
  select * from reconciliation_gaps
),
daily_summaries as (
  insert into public.daily_timeline_summaries (
    company_id,
    timeline_generation_id,
    driver_id,
    vehicle_id,
    summary_date,
    driving_seconds,
    work_seconds,
    availability_seconds,
    rest_seconds,
    break_seconds,
    unknown_seconds,
    duty_start,
    duty_end,
    gap_count,
    finding_count,
    confidence_state,
    metadata
  )
  select
    ig.company_id,
    ig.id,
    tds.driver_id,
    tds.vehicle_id,
    tds.summary_date,
    greatest(0, coalesce(tds.driving_mins, 0) * 60),
    greatest(0, coalesce(tds.work_mins, 0) * 60),
    greatest(0, coalesce(tds.poa_mins, 0) * 60),
    greatest(0, coalesce(tds.rest_mins, 0) * 60),
    0,
    0,
    null,
    null,
    (
      select count(*)
      from all_gaps gap
      where gap.timeline_generation_id = ig.id
        and gap.started_at::date = tds.summary_date
    ),
    greatest(0, coalesce(tds.findings_count, 0)),
    'confirmed',
    jsonb_build_object(
      'source_table', 'tachograph_day_summaries',
      'source_id', tds.id,
      'import_id', tds.import_id,
      'parser_run_id', tds.parser_run_id,
      'time_007_backfill', true
    )
  from inserted_generations ig
  join public.tachograph_day_summaries tds on tds.import_id = ig.source_import_id
  returning id, timeline_generation_id
),
superseded as (
  update public.timeline_generations old_generation
  set
    status = 'superseded',
    is_current = false,
    superseded_by_generation_id = inserted_generations.id,
    superseded_at = now()
  from inserted_generations
  where old_generation.id in (
    select previous_generations.id
    from previous_generations
    where previous_generations.source_import_id = inserted_generations.source_import_id
  )
  returning old_generation.id
),
completed as (
  update public.timeline_generations tg
  set
    status = case when (select count(*) from all_gaps where timeline_generation_id = tg.id) > 0 then 'completed_with_warnings' else 'completed' end,
    is_current = true,
    completed_at = now(),
    metadata = coalesce(tg.metadata, '{}'::jsonb) || jsonb_build_object(
      'event_count', (select count(*) from all_events where timeline_generation_id = tg.id),
      'gap_count', (select count(*) from all_gaps where timeline_generation_id = tg.id),
      'daily_summary_count', (select count(*) from daily_summaries where timeline_generation_id = tg.id),
      'time_007_backfill_completed', true
    )
  where tg.id in (select id from inserted_generations)
  returning tg.id, tg.source_import_id, tg.status
)
select jsonb_pretty(jsonb_build_object(
  'mode', 'apply',
  'appliedAt', now(),
  'createdGenerations', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'sourceType', selected.source_type,
        'uploadedAt', selected.uploaded_at,
        'status', completed.status,
        'activityEvents', (select count(*) from activity_events where timeline_generation_id = completed.id),
        'technicalEvents', (select count(*) from technical_events where timeline_generation_id = completed.id),
        'eventSources', (select count(*) from event_sources),
        'gaps', (select count(*) from all_gaps where timeline_generation_id = completed.id),
        'dailySummaries', (select count(*) from daily_summaries where timeline_generation_id = completed.id)
      )
      order by selected.source_type
    )
    from completed
    join selected on selected.id = completed.source_import_id
  ), '[]'::jsonb),
  'selectedDiagnostics', coalesce((
    select jsonb_agg(jsonb_build_object(
      'sourceType', selected.source_type,
      'uploadedAt', selected.uploaded_at,
      'activityCount', selected.activity_count,
      'daySummaryCount', selected.day_summary_count,
      'rangeStart', range_bounds.range_start,
      'rangeEnd', range_bounds.range_end,
      'rangeValid', range_bounds.range_end > range_bounds.range_start,
      'hasCurrentParserRun', selected.current_parser_run_id is not null
    ))
    from selected
    left join range_bounds on range_bounds.import_id = selected.id
  ), '[]'::jsonb),
  'blockedSourceTypes', (
    select jsonb_agg(source_type)
    from (
      values ('driver_card'::text), ('vehicle_unit'::text)
    ) required(source_type)
    where not exists (
      select 1 from selected where selected.source_type = required.source_type
    )
    and not exists (
      select 1
      from candidate_pool cp
      where cp.source_type = required.source_type
        and cp.has_current_timeline = true
    )
  ),
  'alreadyCurrentSourceTypes', coalesce((
    select jsonb_agg(distinct source_type order by source_type)
    from candidate_pool
    where has_current_timeline = true
  ), '[]'::jsonb)
));

commit;
`;

const rows = await withLivePostgres('hourwise-time-007-backfill', async (connection) => {
  if (!apply) return connection.query(PREVIEW_SQL);

  await connection.query('begin;');
  try {
    const writeRows = await connection.query(APPLY_SQL.replace(/^\s*begin;\s*/i, '').replace(/\s*commit;\s*$/i, ''));
    await connection.query('commit;');
    return writeRows;
  } catch (error) {
    await connection.query('rollback;');
    throw error;
  }
});
const report = JSON.parse(rows[0].jsonb_pretty);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  reportPath: path.relative(repoRoot, outputPath),
  ...report,
}, null, 2));
