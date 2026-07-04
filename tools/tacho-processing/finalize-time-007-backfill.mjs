#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot, withLivePostgres } from './live-postgres-client.mjs';

const apply = process.argv.includes('--apply');
const outputPath = path.join(repoRoot, 'supabase', '.temp', `time-007-finalize-${new Date().toISOString().slice(0, 10)}.json`);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuidLiteral(value) {
  if (!UUID_RE.test(value)) {
    throw new Error(`Refusing to interpolate invalid UUID value: ${value}`);
  }
  return `'${value}'::uuid`;
}

function numberLiteral(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`Refusing to interpolate invalid count value: ${value}`);
  }
  return String(number);
}

const CHOSEN_SQL = `
with candidates as (
  select
    tg.id,
    tg.source_import_id,
    coalesce(tg.metadata->>'source_type', tf.source_type, case when tf.vehicle_id is not null then 'vehicle_unit' else 'driver_card' end) as source_type,
    tg.created_at,
    (select count(*) from public.timeline_events te where te.timeline_generation_id = tg.id) as event_count,
    (select count(*) from public.timeline_event_sources tes where tes.timeline_generation_id = tg.id) as event_source_count,
    (select count(*) from public.timeline_gaps tgaps where tgaps.timeline_generation_id = tg.id) as gap_count,
    (select count(*) from public.daily_timeline_summaries dts where dts.timeline_generation_id = tg.id) as daily_summary_count
  from public.timeline_generations tg
  join public.tachograph_files tf on tf.id = tg.source_import_id
  where tg.metadata->>'time_007_backfill' = 'true'
),
ranked as (
  select
    *,
    row_number() over (partition by source_import_id order by created_at desc) as import_rank
  from candidates
  where event_count > 0
    and daily_summary_count > 0
)
select *
from ranked
where import_rank = 1
order by source_type;
`;

const REPORT_SQL = `
with gens as (
  select
    tg.id,
    tg.source_import_id,
    coalesce(tg.metadata->>'source_type', tf.source_type, case when tf.vehicle_id is not null then 'vehicle_unit' else 'driver_card' end) as source_type,
    tg.status,
    tg.is_current,
    tg.created_at,
    tg.completed_at,
    tg.superseded_at,
    tg.superseded_by_generation_id is not null as has_superseded_by,
    tg.metadata,
    (select count(*) from public.timeline_events te where te.timeline_generation_id = tg.id) as event_count,
    (select count(*) from public.timeline_event_sources tes where tes.timeline_generation_id = tg.id) as event_source_count,
    (select count(*) from public.timeline_gaps tgaps where tgaps.timeline_generation_id = tg.id) as gap_count,
    (select count(*) from public.daily_timeline_summaries dts where dts.timeline_generation_id = tg.id) as daily_summary_count
  from public.timeline_generations tg
  join public.tachograph_files tf on tf.id = tg.source_import_id
  where tg.metadata->>'time_007_backfill' = 'true'
)
select jsonb_pretty(jsonb_build_object(
  'mode', '${apply ? 'apply' : 'preview'}',
  'reportedAt', now(),
  'time007GenerationCount', (select count(*) from gens),
  'currentTime007GenerationCount', (select count(*) from gens where is_current = true),
  'runningTime007GenerationCount', (select count(*) from gens where status = 'running'),
  'supersededTime007GenerationCount', (select count(*) from gens where status = 'superseded'),
  'selectedCurrentGenerations', coalesce((
    select jsonb_agg(jsonb_build_object(
      'sourceType', source_type,
      'status', status,
      'isCurrent', is_current,
      'createdAt', created_at,
      'completedAt', completed_at,
      'eventCount', event_count,
      'eventSourceCount', event_source_count,
      'gapCount', gap_count,
      'dailySummaryCount', daily_summary_count,
      'finalized', coalesce((metadata->>'time_007_backfill_finalized')::boolean, false)
    ) order by source_type)
    from gens
    where is_current = true
  ), '[]'::jsonb),
  'allTime007Generations', coalesce((
    select jsonb_agg(jsonb_build_object(
      'sourceType', source_type,
      'status', status,
      'isCurrent', is_current,
      'createdAt', created_at,
      'completedAt', completed_at,
      'supersededAt', superseded_at,
      'hasSupersededBy', has_superseded_by,
      'eventCount', event_count,
      'gapCount', gap_count,
      'dailySummaryCount', daily_summary_count
    ) order by created_at)
    from gens
  ), '[]'::jsonb)
));
`;

async function finalizeChosenGeneration(connection, chosen) {
  const generationId = uuidLiteral(chosen.id);
  const sourceImportId = uuidLiteral(chosen.source_import_id);
  const eventCount = numberLiteral(chosen.event_count);
  const eventSourceCount = numberLiteral(chosen.event_source_count);
  const gapCount = numberLiteral(chosen.gap_count);
  const dailySummaryCount = numberLiteral(chosen.daily_summary_count);
  const completedStatus = Number(chosen.gap_count) > 0 ? 'completed_with_warnings' : 'completed';

  await connection.query(`
    update public.timeline_generations
    set
      status = 'superseded',
      is_current = false,
      superseded_by_generation_id = ${generationId},
      superseded_at = coalesce(superseded_at, now()),
      updated_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('time_007_backfill_finalized', false)
    where source_import_id = ${sourceImportId}
      and id <> ${generationId}
      and metadata->>'time_007_backfill' = 'true';
  `);

  await connection.query(`
    update public.timeline_generations
    set
      status = 'superseded',
      is_current = false,
      superseded_by_generation_id = ${generationId},
      superseded_at = coalesce(superseded_at, now()),
      updated_at = now()
    where source_import_id = ${sourceImportId}
      and scope_type = 'import'
      and id <> ${generationId}
      and is_current = true;
  `);

  await connection.query(`
    update public.timeline_generations
    set
      status = '${completedStatus}',
      is_current = true,
      completed_at = coalesce(completed_at, now()),
      updated_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'event_count', ${eventCount},
        'event_source_count', ${eventSourceCount},
        'gap_count', ${gapCount},
        'daily_summary_count', ${dailySummaryCount},
        'time_007_backfill_completed', true,
        'time_007_backfill_finalized', true
      )
    where id = ${generationId};
  `);
}

const reportRows = await withLivePostgres('hourwise-time-007-finalize', async (connection) => {
  const chosenRows = await connection.query(CHOSEN_SQL);

  if (apply && chosenRows.length > 0) {
    await connection.query('begin;');
    try {
      for (const chosen of chosenRows) {
        await finalizeChosenGeneration(connection, chosen);
      }
      await connection.query('commit;');
    } catch (error) {
      await connection.query('rollback;');
      throw error;
    }
  }

  return connection.query(REPORT_SQL);
});

const report = JSON.parse(reportRows[0].jsonb_pretty);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify({
  reportPath: path.relative(repoRoot, outputPath),
  applyRequired: !apply,
  ...report,
}, null, 2));
