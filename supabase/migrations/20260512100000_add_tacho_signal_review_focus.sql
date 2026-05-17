alter table public.driver_tacho_compliance_signals
  add column if not exists review_focus jsonb null;

alter table public.driver_tacho_risk_signals
  add column if not exists review_focus jsonb null;

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
        'reconciliationSummary', reconciliation_summary,
        'reviewFocus', review_focus,
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
        'appMismatchCount', app_mismatch_count,
        'reconciliationSummary', reconciliation_summary,
        'reviewFocus', review_focus
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
