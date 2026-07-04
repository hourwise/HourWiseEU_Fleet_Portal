#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot, withLivePostgres } from './live-postgres-client.mjs';

const outputPath = path.join(repoRoot, 'supabase', '.temp', `time-007-live-state-${new Date().toISOString().slice(0, 10)}.json`);

const SQL = `
with import_counts as (
  select
    coalesce(tf.source_type, case when tf.vehicle_id is not null then 'vehicle_unit' else 'driver_card' end) as source_type,
    tf.status,
    count(*) as import_count,
    count(*) filter (
      where exists (
        select 1
        from public.tachograph_activity_segments tas
        where tas.import_id = tf.id
      )
    ) as with_activity_rows,
    count(*) filter (
      where exists (
        select 1
        from public.timeline_generations tg
        where tg.source_import_id = tf.id
          and tg.scope_type = 'import'
          and tg.is_current = true
      )
    ) as with_current_timeline
  from public.tachograph_files tf
  group by 1, 2
),
eligible_imports as (
  select
    coalesce(tf.source_type, case when tf.vehicle_id is not null then 'vehicle_unit' else 'driver_card' end) as source_type,
    count(*) as eligible_count,
    count(*) filter (where tf.file_path is not null and tf.file_path <> '') as with_storage_path,
    max(tf.uploaded_at) as latest_import_at
  from public.tachograph_files tf
  where tf.status in ('processed', 'partial')
    and coalesce(tf.metadata->>'candidate_import_archived_at', '') = ''
    and coalesce(tf.metadata->>'driver_card_retention_state', 'active') <> 'archived'
  group by 1
),
latest_imports as (
  select
    source_type,
    jsonb_agg(
      jsonb_build_object(
        'status', status,
        'uploadedAt', uploaded_at,
        'activityRows', activity_rows,
        'technicalRows', technical_rows,
        'dayRows', day_rows,
        'motionRows', motion_rows,
        'reconciliationIssueRows', reconciliation_issue_rows,
        'hasTimeline', has_timeline,
        'hasStoragePath', has_storage_path
      )
      order by uploaded_at desc
    ) as imports
  from (
    select
      coalesce(tf.source_type, case when tf.vehicle_id is not null then 'vehicle_unit' else 'driver_card' end) as source_type,
      tf.status,
      tf.uploaded_at,
      coalesce(tf.file_path <> '', false) as has_storage_path,
      (select count(*) from public.tachograph_activity_segments tas where tas.import_id = tf.id) as activity_rows,
      (select count(*) from public.tachograph_technical_events tte where tte.import_id = tf.id) as technical_rows,
      (select count(*) from public.tachograph_day_summaries tds where tds.import_id = tf.id) as day_rows,
      (select count(*) from public.tachograph_vehicle_motion_discrepancies tvmd where tvmd.import_id = tf.id) as motion_rows,
      (select count(*) from public.tachograph_reconciliation_items tri where tri.import_id = tf.id and tri.status <> 'matched') as reconciliation_issue_rows,
      exists (
        select 1
        from public.timeline_generations tg
        where tg.source_import_id = tf.id
          and tg.scope_type = 'import'
          and tg.is_current = true
      ) as has_timeline,
      row_number() over (
        partition by coalesce(tf.source_type, case when tf.vehicle_id is not null then 'vehicle_unit' else 'driver_card' end)
        order by tf.uploaded_at desc
      ) as row_num
    from public.tachograph_files tf
    where tf.status in ('processed', 'partial')
      and coalesce(tf.metadata->>'candidate_import_archived_at', '') = ''
      and coalesce(tf.metadata->>'driver_card_retention_state', 'active') <> 'archived'
  ) ranked
  where row_num <= 3
  group by source_type
)
select jsonb_pretty(jsonb_build_object(
  'inspectedAt', now(),
  'companyCount', (select count(*) from public.companies),
  'vehicleCount', (select count(*) from public.vehicles),
  'tachographImportCounts', coalesce((
    select jsonb_agg(to_jsonb(import_counts) order by source_type, status)
    from import_counts
  ), '[]'::jsonb),
  'eligibleImportsBySourceType', coalesce((
    select jsonb_agg(to_jsonb(eligible_imports) order by source_type)
    from eligible_imports
  ), '[]'::jsonb),
  'latestEligibleImportsBySourceType', coalesce((
    select jsonb_object_agg(source_type, imports)
    from latest_imports
  ), '{}'::jsonb)
));
`;

const rows = await withLivePostgres('hourwise-time-007-inspect', (connection) => connection.query(SQL));
const report = JSON.parse(rows[0].jsonb_pretty);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  reportPath: path.relative(repoRoot, outputPath),
  companyCount: report.companyCount,
  vehicleCount: report.vehicleCount,
  eligibleImportsBySourceType: report.eligibleImportsBySourceType,
  latestEligibleImportsBySourceType: report.latestEligibleImportsBySourceType,
}, null, 2));
