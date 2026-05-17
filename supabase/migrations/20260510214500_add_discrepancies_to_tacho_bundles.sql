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
    'vehicleMotionDiscrepancies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'date', d.discrepancy_date,
        'startTime', d.start_time,
        'endTime', d.end_time,
        'durationMins', d.duration_mins,
        'severity', d.severity,
        'status', d.status,
        'summary', d.summary,
        'linkedDriverName', d.linked_driver_name,
        'evidenceRefs', d.evidence_refs
      ) order by d.start_time desc)
      from public.tachograph_vehicle_motion_discrepancies d
      cross join range_start rs
      where d.company_id = p_company_id
        and d.vehicle_id = p_vehicle_id
        and d.start_time >= rs.value
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
    where tf.id = p_import_id
      and tf.company_id = p_company_id
    limit 1
  )
  select jsonb_build_object(
    'contractVersion', '1.0',
    'importRecord', (
      select jsonb_build_object(
        'id', ir.id,
        'sourceType', coalesce(ir.source_type, case when ir.vehicle_id is not null then 'vehicle_unit' else 'driver_card' end),
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
    'vehicleMotionDiscrepancies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'date', d.discrepancy_date,
        'startTime', d.start_time,
        'endTime', d.end_time,
        'durationMins', d.duration_mins,
        'severity', d.severity,
        'status', d.status,
        'summary', d.summary,
        'linkedDriverName', d.linked_driver_name,
        'evidenceRefs', d.evidence_refs
      ) order by d.start_time desc)
      from public.tachograph_vehicle_motion_discrepancies d
      where d.import_id = p_import_id
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
