-- Normalized tachograph persistence and RPC contract
-- This migration is additive to the existing raw tacho tables:
-- - public.tachograph_files
-- - public.tachograph_activities
-- - public.tachograph_speed_logs

alter table public.tachograph_files
  add column if not exists processed_at timestamptz null,
  add column if not exists external_card_number text null,
  add column if not exists vehicle_id uuid null references public.vehicles(id) on delete set null,
  add column if not exists source_type text null default 'driver_card';

alter table public.tachograph_files drop constraint if exists tachograph_files_status_check;

alter table public.tachograph_files
  add constraint tachograph_files_status_check
  check (
    status = any (
      array[
        'pending'::text,
        'processing'::text,
        'processed'::text,
        'partial'::text,
        'error'::text
      ]
    )
  );

create table if not exists public.tachograph_processing_runs (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.tachograph_files(id) on delete cascade,
  company_id uuid null references public.companies(id) on delete cascade,
  parser_version text not null,
  source text not null default 'normalized_findings',
  warnings jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  processed_at timestamptz not null default now()
);

create table if not exists public.driver_card_downloads (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.tachograph_files(id) on delete cascade,
  company_id uuid null references public.companies(id) on delete cascade,
  driver_id uuid null references public.profiles(id) on delete set null,
  driver_name text null,
  card_number text not null,
  card_expiry date null,
  issuing_country text null,
  downloaded_at timestamptz not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  download_status text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicle_unit_downloads (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.tachograph_files(id) on delete cascade,
  company_id uuid null references public.companies(id) on delete cascade,
  vehicle_id uuid null references public.vehicles(id) on delete set null,
  reg_number text null,
  vu_serial text not null,
  calibration_due date null,
  downloaded_at timestamptz not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  download_status text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.tachograph_activity_segments (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.tachograph_files(id) on delete cascade,
  company_id uuid null references public.companies(id) on delete cascade,
  driver_id uuid null references public.profiles(id) on delete set null,
  vehicle_id uuid null references public.vehicles(id) on delete set null,
  source text not null,
  activity_type text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  duration_mins integer not null,
  distance_km numeric(10,2) null,
  confidence text null,
  label text null,
  created_at timestamptz not null default now()
);

create table if not exists public.tachograph_day_summaries (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.tachograph_files(id) on delete cascade,
  company_id uuid null references public.companies(id) on delete cascade,
  driver_id uuid null references public.profiles(id) on delete set null,
  vehicle_id uuid null references public.vehicles(id) on delete set null,
  summary_date date not null,
  driving_mins integer not null default 0,
  work_mins integer not null default 0,
  poa_mins integer not null default 0,
  rest_mins integer not null default 0,
  app_driving_mins integer null,
  findings_count integer not null default 0,
  vu_event_count integer null,
  created_at timestamptz not null default now()
);

create table if not exists public.tachograph_findings (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.tachograph_files(id) on delete cascade,
  company_id uuid null references public.companies(id) on delete cascade,
  driver_id uuid null references public.profiles(id) on delete set null,
  vehicle_id uuid null references public.vehicles(id) on delete set null,
  source text not null,
  severity text not null,
  status text not null,
  rule_code text not null,
  title text not null,
  summary text not null,
  legal_basis text null,
  occurred_at timestamptz not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  evidence_refs jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tachograph_technical_events (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.tachograph_files(id) on delete cascade,
  company_id uuid null references public.companies(id) on delete cascade,
  driver_id uuid null references public.profiles(id) on delete set null,
  vehicle_id uuid null references public.vehicles(id) on delete set null,
  source text not null default 'vehicle_unit',
  severity text not null,
  status text not null,
  rule_code text not null,
  title text not null,
  summary text not null,
  occurred_at timestamptz not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  evidence_refs jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.driver_tacho_compliance_signals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references public.companies(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete cascade,
  period_days integer not null,
  average_score integer not null,
  total_violations integer not null,
  violations jsonb not null default '[]'::jsonb,
  recent_violations jsonb not null default '[]'::jsonb,
  missing_mileage jsonb not null default '[]'::jsonb,
  has_data boolean not null default false,
  source text not null default 'normalized_findings',
  generated_at timestamptz not null default now()
);

create table if not exists public.driver_tacho_risk_signals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references public.companies(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete cascade,
  period_days integer not null,
  legal_compliance_score integer not null,
  violation_count integer not null,
  missing_mileage_count integer not null default 0,
  app_mismatch_count integer not null default 0,
  source text not null default 'normalized_findings',
  generated_at timestamptz not null default now()
);

create index if not exists idx_tachograph_processing_runs_import
  on public.tachograph_processing_runs(import_id, processed_at desc);

create index if not exists idx_driver_card_downloads_driver
  on public.driver_card_downloads(company_id, driver_id, downloaded_at desc);

create index if not exists idx_vehicle_unit_downloads_vehicle
  on public.vehicle_unit_downloads(company_id, vehicle_id, downloaded_at desc);

create index if not exists idx_tachograph_activity_segments_driver
  on public.tachograph_activity_segments(company_id, driver_id, start_time desc);

create index if not exists idx_tachograph_activity_segments_vehicle
  on public.tachograph_activity_segments(company_id, vehicle_id, start_time desc);

create index if not exists idx_tachograph_activity_segments_import
  on public.tachograph_activity_segments(import_id, start_time desc);

create index if not exists idx_tachograph_day_summaries_driver
  on public.tachograph_day_summaries(company_id, driver_id, summary_date desc);

create index if not exists idx_tachograph_day_summaries_vehicle
  on public.tachograph_day_summaries(company_id, vehicle_id, summary_date desc);

create index if not exists idx_tachograph_findings_driver
  on public.tachograph_findings(company_id, driver_id, occurred_at desc);

create index if not exists idx_tachograph_findings_vehicle
  on public.tachograph_findings(company_id, vehicle_id, occurred_at desc);

create index if not exists idx_tachograph_findings_import
  on public.tachograph_findings(import_id, occurred_at desc);

create index if not exists idx_tachograph_technical_events_import
  on public.tachograph_technical_events(import_id, occurred_at desc);

create index if not exists idx_driver_tacho_compliance_signals_company_driver_period
  on public.driver_tacho_compliance_signals(company_id, driver_id, period_days, generated_at desc);

create index if not exists idx_driver_tacho_risk_signals_company_driver_period
  on public.driver_tacho_risk_signals(company_id, driver_id, period_days, generated_at desc);

create or replace function public.resolve_tacho_range_start(p_range text)
returns timestamptz
language sql
stable
as $$
  select case p_range
    when '30d' then now() - interval '30 days'
    when '3m' then now() - interval '3 months'
    when '6m' then now() - interval '6 months'
    else now() - interval '7 days'
  end;
$$;

create or replace function public.map_tachograph_status_to_contract(p_status text)
returns text
language sql
immutable
as $$
  select case p_status
    when 'processed' then 'complete'
    when 'error' then 'failed'
    else coalesce(p_status, 'queued')
  end;
$$;

create or replace function public.get_company_tacho_signals(
  p_company_id uuid,
  p_days integer default 14
)
returns table (
  driver_id uuid,
  compliance_signal jsonb,
  risk_signal jsonb
)
language sql
security definer
set search_path = public
as $$
  with latest_compliance as (
    select distinct on (driver_id)
      driver_id,
      jsonb_build_object(
        'driverId', driver_id,
        'source', source,
        'averageScore', average_score,
        'totalViolations', total_violations,
        'violations', violations,
        'recentViolations', recent_violations,
        'missingMileage', missing_mileage,
        'hasData', has_data
      ) as compliance_signal
    from public.driver_tacho_compliance_signals
    where company_id = p_company_id
      and period_days = p_days
    order by driver_id, generated_at desc
  ),
  latest_risk as (
    select distinct on (driver_id)
      driver_id,
      jsonb_build_object(
        'driverId', driver_id,
        'source', source,
        'legalComplianceScore', legal_compliance_score,
        'violationCount', violation_count,
        'missingMileageCount', missing_mileage_count,
        'appMismatchCount', app_mismatch_count
      ) as risk_signal
    from public.driver_tacho_risk_signals
    where company_id = p_company_id
      and period_days = case when p_days > 28 then 28 else p_days end
    order by driver_id, generated_at desc
  )
  select
    coalesce(c.driver_id, r.driver_id) as driver_id,
    c.compliance_signal,
    r.risk_signal
  from latest_compliance c
  full outer join latest_risk r on r.driver_id = c.driver_id;
$$;

create or replace function public.get_driver_tacho_analysis_bundle(
  p_company_id uuid,
  p_driver_id uuid,
  p_range text default '7d'
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with range_start as (
    select public.resolve_tacho_range_start(p_range) as value
  ),
  latest_import as (
    select tf.*
    from public.tachograph_files tf
    cross join range_start rs
    where tf.company_id = p_company_id
      and tf.driver_id = p_driver_id
      and tf.uploaded_at >= rs.value
    order by tf.uploaded_at desc
    limit 1
  ),
  latest_card as (
    select dcd.*
    from public.driver_card_downloads dcd
    cross join range_start rs
    where dcd.company_id = p_company_id
      and dcd.driver_id = p_driver_id
      and dcd.downloaded_at >= rs.value
    order by dcd.downloaded_at desc
    limit 1
  ),
  latest_driver_signals as (
    select distinct on (period_days) *
    from public.driver_tacho_compliance_signals
    where company_id = p_company_id
      and driver_id = p_driver_id
    order by period_days, generated_at desc
  ),
  latest_risk_signals as (
    select distinct on (period_days) *
    from public.driver_tacho_risk_signals
    where company_id = p_company_id
      and driver_id = p_driver_id
    order by period_days, generated_at desc
  )
  select jsonb_build_object(
    'contractVersion', '1.0',
    'importRecord', (
      select jsonb_build_object(
        'id', li.id,
        'sourceType', coalesce(li.source_type, 'driver_card'),
        'fileName', li.filename,
        'fileType', lower(coalesce(li.file_type, split_part(li.filename, '.', array_length(string_to_array(li.filename, '.'), 1)))),
        'importedAt', li.uploaded_at,
        'status', public.map_tachograph_status_to_contract(li.status),
        'progressPercent', case li.status
          when 'pending' then 10
          when 'processing' then 60
          when 'processed' then 100
          when 'partial' then 100
          when 'error' then 100
          else 0
        end,
        'driverName', p.full_name,
        'vehicleReg', coalesce(v.reg_number, li.metadata ->> 'vehicle_reg'),
        'summary', li.metadata ->> 'summary'
      )
      from latest_import li
      left join public.profiles p on p.id = li.driver_id
      left join public.vehicles v on v.id = li.vehicle_id
    ),
    'processingRun', (
      select jsonb_build_object(
        'importId', tpr.import_id,
        'parserVersion', tpr.parser_version,
        'source', tpr.source,
        'processedAt', tpr.processed_at,
        'warnings', tpr.warnings,
        'errors', tpr.errors
      )
      from public.tachograph_processing_runs tpr
      join latest_import li on li.id = tpr.import_id
      order by tpr.processed_at desc
      limit 1
    ),
    'driverCardDownload', (
      select jsonb_build_object(
        'importId', lc.import_id,
        'companyId', lc.company_id,
        'driverId', lc.driver_id,
        'driverName', lc.driver_name,
        'cardNumber', lc.card_number,
        'cardExpiry', lc.card_expiry,
        'issuingCountry', lc.issuing_country,
        'downloadedAt', lc.downloaded_at,
        'periodStart', lc.period_start,
        'periodEnd', lc.period_end,
        'downloadStatus', lc.download_status
      )
      from latest_card lc
    ),
    'activitySegments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'source', s.source,
        'activityType', s.activity_type,
        'driverId', s.driver_id,
        'vehicleId', s.vehicle_id,
        'startTime', s.start_time,
        'endTime', s.end_time,
        'durationMins', s.duration_mins,
        'distanceKm', s.distance_km,
        'confidence', s.confidence,
        'label', s.label
      ) order by s.start_time)
      from public.tachograph_activity_segments s
      cross join range_start rs
      where s.company_id = p_company_id
        and s.driver_id = p_driver_id
        and s.start_time >= rs.value
    ), '[]'::jsonb),
    'findings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id,
        'driverId', f.driver_id,
        'vehicleId', f.vehicle_id,
        'source', f.source,
        'severity', f.severity,
        'status', f.status,
        'ruleCode', f.rule_code,
        'title', f.title,
        'summary', f.summary,
        'occurredAt', f.occurred_at,
        'periodStart', f.period_start,
        'periodEnd', f.period_end,
        'legalBasis', f.legal_basis,
        'evidenceRefs', f.evidence_refs,
        'metadata', f.metadata
      ) order by f.occurred_at desc)
      from public.tachograph_findings f
      cross join range_start rs
      where f.company_id = p_company_id
        and f.driver_id = p_driver_id
        and f.occurred_at >= rs.value
    ), '[]'::jsonb),
    'technicalEvents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'driverId', e.driver_id,
        'vehicleId', e.vehicle_id,
        'source', e.source,
        'severity', e.severity,
        'status', e.status,
        'ruleCode', e.rule_code,
        'title', e.title,
        'summary', e.summary,
        'occurredAt', e.occurred_at,
        'periodStart', e.period_start,
        'periodEnd', e.period_end,
        'evidenceRefs', e.evidence_refs,
        'metadata', e.metadata
      ) order by e.occurred_at desc)
      from public.tachograph_technical_events e
      cross join range_start rs
      where e.company_id = p_company_id
        and e.driver_id = p_driver_id
        and e.occurred_at >= rs.value
    ), '[]'::jsonb),
    'daySummaries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', d.summary_date,
        'drivingMins', d.driving_mins,
        'workMins', d.work_mins,
        'poaMins', d.poa_mins,
        'restMins', d.rest_mins,
        'appDrivingMins', d.app_driving_mins,
        'findingsCount', d.findings_count,
        'vuEventCount', d.vu_event_count,
        'activities', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', s.id,
            'source', s.source,
            'activityType', s.activity_type,
            'driverId', s.driver_id,
            'vehicleId', s.vehicle_id,
            'startTime', s.start_time,
            'endTime', s.end_time,
            'durationMins', s.duration_mins,
            'distanceKm', s.distance_km,
            'confidence', s.confidence,
            'label', s.label
          ) order by s.start_time)
          from public.tachograph_activity_segments s
          where s.company_id = d.company_id
            and s.driver_id = d.driver_id
            and s.start_time::date = d.summary_date
        ), '[]'::jsonb)
      ) order by d.summary_date desc)
      from public.tachograph_day_summaries d
      cross join range_start rs
      where d.company_id = p_company_id
        and d.driver_id = p_driver_id
        and d.summary_date >= rs.value::date
    ), '[]'::jsonb),
    'driverComplianceSignals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'driverId', s.driver_id,
        'source', s.source,
        'averageScore', s.average_score,
        'totalViolations', s.total_violations,
        'violations', s.violations,
        'recentViolations', s.recent_violations,
        'missingMileage', s.missing_mileage,
        'hasData', s.has_data
      ) order by s.period_days asc)
      from latest_driver_signals s
    ), '[]'::jsonb),
    'driverRiskSignals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'driverId', s.driver_id,
        'source', s.source,
        'legalComplianceScore', s.legal_compliance_score,
        'violationCount', s.violation_count,
        'missingMileageCount', s.missing_mileage_count,
        'appMismatchCount', s.app_mismatch_count
      ) order by s.period_days asc)
      from latest_risk_signals s
    ), '[]'::jsonb)
  );
$$;

create or replace function public.get_vehicle_unit_analysis_bundle(
  p_company_id uuid,
  p_vehicle_id uuid,
  p_range text default '7d'
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with range_start as (
    select public.resolve_tacho_range_start(p_range) as value
  ),
  latest_import as (
    select tf.*
    from public.tachograph_files tf
    cross join range_start rs
    where tf.company_id = p_company_id
      and tf.vehicle_id = p_vehicle_id
      and tf.uploaded_at >= rs.value
    order by tf.uploaded_at desc
    limit 1
  ),
  latest_vu as (
    select vud.*
    from public.vehicle_unit_downloads vud
    cross join range_start rs
    where vud.company_id = p_company_id
      and vud.vehicle_id = p_vehicle_id
      and vud.downloaded_at >= rs.value
    order by vud.downloaded_at desc
    limit 1
  )
  select jsonb_build_object(
    'contractVersion', '1.0',
    'importRecord', (
      select jsonb_build_object(
        'id', li.id,
        'sourceType', coalesce(li.source_type, 'vehicle_unit'),
        'fileName', li.filename,
        'fileType', lower(coalesce(li.file_type, split_part(li.filename, '.', array_length(string_to_array(li.filename, '.'), 1)))),
        'importedAt', li.uploaded_at,
        'status', public.map_tachograph_status_to_contract(li.status),
        'progressPercent', case li.status
          when 'pending' then 10
          when 'processing' then 60
          when 'processed' then 100
          when 'partial' then 100
          when 'error' then 100
          else 0
        end,
        'driverName', p.full_name,
        'vehicleReg', coalesce(v.reg_number, li.metadata ->> 'vehicle_reg'),
        'summary', li.metadata ->> 'summary'
      )
      from latest_import li
      left join public.profiles p on p.id = li.driver_id
      left join public.vehicles v on v.id = li.vehicle_id
    ),
    'processingRun', (
      select jsonb_build_object(
        'importId', tpr.import_id,
        'parserVersion', tpr.parser_version,
        'source', tpr.source,
        'processedAt', tpr.processed_at,
        'warnings', tpr.warnings,
        'errors', tpr.errors
      )
      from public.tachograph_processing_runs tpr
      join latest_import li on li.id = tpr.import_id
      order by tpr.processed_at desc
      limit 1
    ),
    'vehicleUnitDownload', (
      select jsonb_build_object(
        'importId', lv.import_id,
        'companyId', lv.company_id,
        'vehicleId', lv.vehicle_id,
        'regNumber', lv.reg_number,
        'vuSerial', lv.vu_serial,
        'calibrationDue', lv.calibration_due,
        'downloadedAt', lv.downloaded_at,
        'periodStart', lv.period_start,
        'periodEnd', lv.period_end,
        'downloadStatus', lv.download_status
      )
      from latest_vu lv
    ),
    'activitySegments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'source', s.source,
        'activityType', s.activity_type,
        'driverId', s.driver_id,
        'vehicleId', s.vehicle_id,
        'startTime', s.start_time,
        'endTime', s.end_time,
        'durationMins', s.duration_mins,
        'distanceKm', s.distance_km,
        'confidence', s.confidence,
        'label', s.label
      ) order by s.start_time)
      from public.tachograph_activity_segments s
      cross join range_start rs
      where s.company_id = p_company_id
        and s.vehicle_id = p_vehicle_id
        and s.start_time >= rs.value
    ), '[]'::jsonb),
    'findings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id,
        'driverId', f.driver_id,
        'vehicleId', f.vehicle_id,
        'source', f.source,
        'severity', f.severity,
        'status', f.status,
        'ruleCode', f.rule_code,
        'title', f.title,
        'summary', f.summary,
        'occurredAt', f.occurred_at,
        'periodStart', f.period_start,
        'periodEnd', f.period_end,
        'legalBasis', f.legal_basis,
        'evidenceRefs', f.evidence_refs,
        'metadata', f.metadata
      ) order by f.occurred_at desc)
      from public.tachograph_findings f
      cross join range_start rs
      where f.company_id = p_company_id
        and f.vehicle_id = p_vehicle_id
        and f.occurred_at >= rs.value
    ), '[]'::jsonb),
    'technicalEvents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'driverId', e.driver_id,
        'vehicleId', e.vehicle_id,
        'source', e.source,
        'severity', e.severity,
        'status', e.status,
        'ruleCode', e.rule_code,
        'title', e.title,
        'summary', e.summary,
        'occurredAt', e.occurred_at,
        'periodStart', e.period_start,
        'periodEnd', e.period_end,
        'evidenceRefs', e.evidence_refs,
        'metadata', e.metadata
      ) order by e.occurred_at desc)
      from public.tachograph_technical_events e
      cross join range_start rs
      where e.company_id = p_company_id
        and e.vehicle_id = p_vehicle_id
        and e.occurred_at >= rs.value
    ), '[]'::jsonb),
    'daySummaries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', d.summary_date,
        'drivingMins', d.driving_mins,
        'workMins', d.work_mins,
        'poaMins', d.poa_mins,
        'restMins', d.rest_mins,
        'appDrivingMins', d.app_driving_mins,
        'findingsCount', d.findings_count,
        'vuEventCount', d.vu_event_count,
        'activities', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', s.id,
            'source', s.source,
            'activityType', s.activity_type,
            'driverId', s.driver_id,
            'vehicleId', s.vehicle_id,
            'startTime', s.start_time,
            'endTime', s.end_time,
            'durationMins', s.duration_mins,
            'distanceKm', s.distance_km,
            'confidence', s.confidence,
            'label', s.label
          ) order by s.start_time)
          from public.tachograph_activity_segments s
          where s.company_id = d.company_id
            and s.vehicle_id = d.vehicle_id
            and s.start_time::date = d.summary_date
        ), '[]'::jsonb)
      ) order by d.summary_date desc)
      from public.tachograph_day_summaries d
      cross join range_start rs
      where d.company_id = p_company_id
        and d.vehicle_id = p_vehicle_id
        and d.summary_date >= rs.value::date
    ), '[]'::jsonb),
    'driverComplianceSignals', '[]'::jsonb,
    'driverRiskSignals', '[]'::jsonb
  );
$$;

create or replace function public.get_tacho_import_bundle(
  p_company_id uuid,
  p_import_id uuid
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with import_row as (
    select tf.*
    from public.tachograph_files tf
    where tf.company_id = p_company_id
      and tf.id = p_import_id
    limit 1
  )
  select jsonb_build_object(
    'contractVersion', '1.0',
    'importRecord', (
      select jsonb_build_object(
        'id', ir.id,
        'sourceType', coalesce(ir.source_type, 'driver_card'),
        'fileName', ir.filename,
        'fileType', lower(coalesce(ir.file_type, split_part(ir.filename, '.', array_length(string_to_array(ir.filename, '.'), 1)))),
        'importedAt', ir.uploaded_at,
        'status', public.map_tachograph_status_to_contract(ir.status),
        'progressPercent', case ir.status
          when 'pending' then 10
          when 'processing' then 60
          when 'processed' then 100
          when 'partial' then 100
          when 'error' then 100
          else 0
        end,
        'driverName', p.full_name,
        'vehicleReg', coalesce(v.reg_number, ir.metadata ->> 'vehicle_reg'),
        'summary', ir.metadata ->> 'summary'
      )
      from import_row ir
      left join public.profiles p on p.id = ir.driver_id
      left join public.vehicles v on v.id = ir.vehicle_id
    ),
    'processingRun', (
      select jsonb_build_object(
        'importId', tpr.import_id,
        'parserVersion', tpr.parser_version,
        'source', tpr.source,
        'processedAt', tpr.processed_at,
        'warnings', tpr.warnings,
        'errors', tpr.errors
      )
      from public.tachograph_processing_runs tpr
      where tpr.import_id = p_import_id
      order by tpr.processed_at desc
      limit 1
    ),
    'driverCardDownload', (
      select jsonb_build_object(
        'importId', dcd.import_id,
        'companyId', dcd.company_id,
        'driverId', dcd.driver_id,
        'driverName', dcd.driver_name,
        'cardNumber', dcd.card_number,
        'cardExpiry', dcd.card_expiry,
        'issuingCountry', dcd.issuing_country,
        'downloadedAt', dcd.downloaded_at,
        'periodStart', dcd.period_start,
        'periodEnd', dcd.period_end,
        'downloadStatus', dcd.download_status
      )
      from public.driver_card_downloads dcd
      where dcd.import_id = p_import_id
      order by dcd.downloaded_at desc
      limit 1
    ),
    'vehicleUnitDownload', (
      select jsonb_build_object(
        'importId', vud.import_id,
        'companyId', vud.company_id,
        'vehicleId', vud.vehicle_id,
        'regNumber', vud.reg_number,
        'vuSerial', vud.vu_serial,
        'calibrationDue', vud.calibration_due,
        'downloadedAt', vud.downloaded_at,
        'periodStart', vud.period_start,
        'periodEnd', vud.period_end,
        'downloadStatus', vud.download_status
      )
      from public.vehicle_unit_downloads vud
      where vud.import_id = p_import_id
      order by vud.downloaded_at desc
      limit 1
    ),
    'activitySegments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'source', s.source,
        'activityType', s.activity_type,
        'driverId', s.driver_id,
        'vehicleId', s.vehicle_id,
        'startTime', s.start_time,
        'endTime', s.end_time,
        'durationMins', s.duration_mins,
        'distanceKm', s.distance_km,
        'confidence', s.confidence,
        'label', s.label
      ) order by s.start_time)
      from public.tachograph_activity_segments s
      where s.import_id = p_import_id
    ), '[]'::jsonb),
    'findings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id,
        'driverId', f.driver_id,
        'vehicleId', f.vehicle_id,
        'source', f.source,
        'severity', f.severity,
        'status', f.status,
        'ruleCode', f.rule_code,
        'title', f.title,
        'summary', f.summary,
        'occurredAt', f.occurred_at,
        'periodStart', f.period_start,
        'periodEnd', f.period_end,
        'legalBasis', f.legal_basis,
        'evidenceRefs', f.evidence_refs,
        'metadata', f.metadata
      ) order by f.occurred_at desc)
      from public.tachograph_findings f
      where f.import_id = p_import_id
    ), '[]'::jsonb),
    'technicalEvents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'driverId', e.driver_id,
        'vehicleId', e.vehicle_id,
        'source', e.source,
        'severity', e.severity,
        'status', e.status,
        'ruleCode', e.rule_code,
        'title', e.title,
        'summary', e.summary,
        'occurredAt', e.occurred_at,
        'periodStart', e.period_start,
        'periodEnd', e.period_end,
        'evidenceRefs', e.evidence_refs,
        'metadata', e.metadata
      ) order by e.occurred_at desc)
      from public.tachograph_technical_events e
      where e.import_id = p_import_id
    ), '[]'::jsonb),
    'daySummaries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', d.summary_date,
        'drivingMins', d.driving_mins,
        'workMins', d.work_mins,
        'poaMins', d.poa_mins,
        'restMins', d.rest_mins,
        'appDrivingMins', d.app_driving_mins,
        'findingsCount', d.findings_count,
        'vuEventCount', d.vu_event_count,
        'activities', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', s.id,
            'source', s.source,
            'activityType', s.activity_type,
            'driverId', s.driver_id,
            'vehicleId', s.vehicle_id,
            'startTime', s.start_time,
            'endTime', s.end_time,
            'durationMins', s.duration_mins,
            'distanceKm', s.distance_km,
            'confidence', s.confidence,
            'label', s.label
          ) order by s.start_time)
          from public.tachograph_activity_segments s
          where s.import_id = d.import_id
            and s.start_time::date = d.summary_date
            and coalesce(s.driver_id, '00000000-0000-0000-0000-000000000000'::uuid) =
                coalesce(d.driver_id, '00000000-0000-0000-0000-000000000000'::uuid)
            and coalesce(s.vehicle_id, '00000000-0000-0000-0000-000000000000'::uuid) =
                coalesce(d.vehicle_id, '00000000-0000-0000-0000-000000000000'::uuid)
        ), '[]'::jsonb)
      ) order by d.summary_date desc)
      from public.tachograph_day_summaries d
      where d.import_id = p_import_id
    ), '[]'::jsonb),
    'driverComplianceSignals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'driverId', s.driver_id,
        'source', s.source,
        'averageScore', s.average_score,
        'totalViolations', s.total_violations,
        'violations', s.violations,
        'recentViolations', s.recent_violations,
        'missingMileage', s.missing_mileage,
        'hasData', s.has_data
      ) order by s.period_days asc)
      from (
        select distinct on (period_days) *
        from public.driver_tacho_compliance_signals
        where driver_id = (select driver_id from import_row)
          and company_id = p_company_id
        order by period_days, generated_at desc
      ) s
    ), '[]'::jsonb),
    'driverRiskSignals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'driverId', s.driver_id,
        'source', s.source,
        'legalComplianceScore', s.legal_compliance_score,
        'violationCount', s.violation_count,
        'missingMileageCount', s.missing_mileage_count,
        'appMismatchCount', s.app_mismatch_count
      ) order by s.period_days asc)
      from (
        select distinct on (period_days) *
        from public.driver_tacho_risk_signals
        where driver_id = (select driver_id from import_row)
          and company_id = p_company_id
        order by period_days, generated_at desc
      ) s
    ), '[]'::jsonb)
  );
$$;
