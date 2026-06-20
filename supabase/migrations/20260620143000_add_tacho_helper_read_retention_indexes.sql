-- Lookup support for HourWise helper read superseding/retention.
-- Repeated live card reads keep the import audit row but replace derived analysis rows.

create index if not exists idx_tachograph_files_company_source_card_uploaded
  on public.tachograph_files(company_id, source_type, external_card_number, uploaded_at desc);

create index if not exists idx_tachograph_files_company_source_driver_uploaded
  on public.tachograph_files(company_id, source_type, driver_id, uploaded_at desc);

create index if not exists idx_driver_tacho_compliance_signals_source
  on public.driver_tacho_compliance_signals(company_id, driver_id, source, generated_at desc);

create index if not exists idx_driver_tacho_risk_signals_source
  on public.driver_tacho_risk_signals(company_id, driver_id, source, generated_at desc);
