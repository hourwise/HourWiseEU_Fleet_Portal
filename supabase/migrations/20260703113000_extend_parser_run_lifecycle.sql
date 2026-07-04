-- PARSE-002: parser-run lifecycle versioning and audit retention.
-- Reprocessing now creates a new current parser run and can supersede the
-- previous run without deleting the historical parser-run record.

alter table public.tachograph_processing_runs
  add column if not exists parser_name text null,
  add column if not exists parser_config_json jsonb not null default '{}'::jsonb,
  add column if not exists status text not null default 'completed',
  add column if not exists started_at timestamptz null,
  add column if not exists completed_at timestamptz null,
  add column if not exists duration_ms integer null,
  add column if not exists error_summary text null,
  add column if not exists triggered_by text null,
  add column if not exists supersedes_parser_run_id uuid null references public.tachograph_processing_runs(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists is_current boolean not null default true,
  add column if not exists run_sequence integer null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tachograph_processing_runs_status_check'
      and conrelid = 'public.tachograph_processing_runs'::regclass
  ) then
    alter table public.tachograph_processing_runs
      add constraint tachograph_processing_runs_status_check
      check (
        status = any (
          array[
            'queued'::text,
            'running'::text,
            'completed'::text,
            'completed_with_warnings'::text,
            'failed'::text,
            'unsupported'::text,
            'superseded'::text
          ]
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tachograph_processing_runs_duration_ms_check'
      and conrelid = 'public.tachograph_processing_runs'::regclass
  ) then
    alter table public.tachograph_processing_runs
      add constraint tachograph_processing_runs_duration_ms_check
      check (duration_ms is null or duration_ms >= 0);
  end if;
end $$;

with sequenced as (
  select
    id,
    row_number() over (partition by import_id order by processed_at asc, id asc) as sequence_number,
    row_number() over (partition by import_id order by processed_at desc, id desc) as latest_number
  from public.tachograph_processing_runs
)
update public.tachograph_processing_runs run
set
  run_sequence = coalesce(run.run_sequence, sequenced.sequence_number),
  is_current = sequenced.latest_number = 1
from sequenced
where run.id = sequenced.id;

update public.tachograph_processing_runs
set
  parser_name = coalesce(
    parser_name,
    case
      when source = 'hourwise_read_only_capture' then 'hourwise_read_only_capture'
      when parser_version ilike 'readesm%' then 'readesm'
      else source
    end,
    'unknown'
  ),
  started_at = coalesce(started_at, processed_at),
  completed_at = coalesce(completed_at, processed_at),
  status = case
    when jsonb_typeof(errors) = 'array' and jsonb_array_length(errors) > 0 then 'failed'
    when jsonb_typeof(warnings) = 'array' and jsonb_array_length(warnings) > 0 then 'completed_with_warnings'
    else status
  end,
  duration_ms = coalesce(
    duration_ms,
    greatest(0, floor(extract(epoch from (coalesce(completed_at, processed_at) - coalesce(started_at, processed_at))) * 1000)::integer)
  ),
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('parse_002_backfilled', true)
where parser_name is null
  or started_at is null
  or completed_at is null
  or duration_ms is null;

alter table public.tachograph_processing_runs
  alter column parser_name set not null;

create index if not exists idx_tachograph_processing_runs_current
  on public.tachograph_processing_runs(import_id, is_current, processed_at desc);

create index if not exists idx_tachograph_processing_runs_company_status
  on public.tachograph_processing_runs(company_id, status, started_at desc);

create index if not exists idx_tachograph_processing_runs_supersedes
  on public.tachograph_processing_runs(supersedes_parser_run_id);

create table if not exists public.tachograph_parser_outputs (
  id uuid primary key default gen_random_uuid(),
  parser_run_id uuid not null references public.tachograph_processing_runs(id) on delete cascade,
  import_id uuid not null references public.tachograph_files(id) on delete cascade,
  company_id uuid null references public.companies(id) on delete cascade,
  output_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_tachograph_parser_outputs_run
  on public.tachograph_parser_outputs(parser_run_id, created_at desc);

create index if not exists idx_tachograph_parser_outputs_import
  on public.tachograph_parser_outputs(import_id, output_type, created_at desc);

create table if not exists public.tachograph_parser_errors (
  id uuid primary key default gen_random_uuid(),
  parser_run_id uuid not null references public.tachograph_processing_runs(id) on delete cascade,
  import_id uuid not null references public.tachograph_files(id) on delete cascade,
  company_id uuid null references public.companies(id) on delete cascade,
  severity text not null default 'error',
  error_code text not null default 'parser_error',
  message text not null,
  details_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint tachograph_parser_errors_severity_check
    check (severity = any (array['info'::text, 'warning'::text, 'error'::text, 'critical'::text]))
);

create index if not exists idx_tachograph_parser_errors_run
  on public.tachograph_parser_errors(parser_run_id, created_at desc);

create index if not exists idx_tachograph_parser_errors_import
  on public.tachograph_parser_errors(import_id, severity, created_at desc);

alter table if exists public.driver_card_downloads
  add column if not exists parser_run_id uuid null references public.tachograph_processing_runs(id) on delete set null;

alter table if exists public.vehicle_unit_downloads
  add column if not exists parser_run_id uuid null references public.tachograph_processing_runs(id) on delete set null;

alter table if exists public.tachograph_activity_segments
  add column if not exists parser_run_id uuid null references public.tachograph_processing_runs(id) on delete set null;

alter table if exists public.tachograph_day_summaries
  add column if not exists parser_run_id uuid null references public.tachograph_processing_runs(id) on delete set null;

alter table if exists public.tachograph_findings
  add column if not exists parser_run_id uuid null references public.tachograph_processing_runs(id) on delete set null;

alter table if exists public.tachograph_technical_events
  add column if not exists parser_run_id uuid null references public.tachograph_processing_runs(id) on delete set null;

alter table if exists public.tachograph_vehicle_motion_discrepancies
  add column if not exists parser_run_id uuid null references public.tachograph_processing_runs(id) on delete set null;

alter table if exists public.tachograph_reconciliation_items
  add column if not exists parser_run_id uuid null references public.tachograph_processing_runs(id) on delete set null;

create index if not exists idx_driver_card_downloads_parser_run
  on public.driver_card_downloads(parser_run_id);

create index if not exists idx_vehicle_unit_downloads_parser_run
  on public.vehicle_unit_downloads(parser_run_id);

create index if not exists idx_tachograph_activity_segments_parser_run
  on public.tachograph_activity_segments(parser_run_id);

create index if not exists idx_tachograph_day_summaries_parser_run
  on public.tachograph_day_summaries(parser_run_id);

create index if not exists idx_tachograph_findings_parser_run
  on public.tachograph_findings(parser_run_id);

create index if not exists idx_tachograph_technical_events_parser_run
  on public.tachograph_technical_events(parser_run_id);

create index if not exists idx_tachograph_vehicle_motion_discrepancies_parser_run
  on public.tachograph_vehicle_motion_discrepancies(parser_run_id);

create index if not exists idx_tachograph_reconciliation_items_parser_run
  on public.tachograph_reconciliation_items(parser_run_id);

alter table public.tachograph_parser_outputs enable row level security;
alter table public.tachograph_parser_errors enable row level security;

drop policy if exists "Managers can read own company parser outputs" on public.tachograph_parser_outputs;
create policy "Managers can read own company parser outputs"
  on public.tachograph_parser_outputs for select
  to authenticated
  using (
    company_id = public.get_my_company_id()
    and public.get_my_role() = 'manager'
  );

drop policy if exists "Managers can read own company parser errors" on public.tachograph_parser_errors;
create policy "Managers can read own company parser errors"
  on public.tachograph_parser_errors for select
  to authenticated
  using (
    company_id = public.get_my_company_id()
    and public.get_my_role() = 'manager'
  );
