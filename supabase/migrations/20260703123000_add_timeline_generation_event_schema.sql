-- TIME-002: timeline generation/event/source/gap schema.
-- Timeline rows are versioned derived records. Generation code will be added
-- separately; this migration establishes the audit-safe schema boundary.

create or replace function public.set_timeline_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.timeline_generations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  driver_id uuid null references public.profiles(id) on delete set null,
  vehicle_id uuid null references public.vehicles(id) on delete set null,
  scope_type text not null,
  scope_id uuid null,
  range_start timestamptz not null,
  range_end timestamptz not null,
  generation_version text not null default 'timeline-mvp@1',
  status text not null default 'running',
  is_current boolean not null default true,
  generated_by uuid null references public.profiles(id) on delete set null,
  generated_by_kind text not null default 'system',
  generated_reason text not null default 'initial_import',
  source_import_id uuid null references public.tachograph_files(id) on delete set null,
  parser_run_id uuid null references public.tachograph_processing_runs(id) on delete set null,
  supersedes_generation_id uuid null references public.timeline_generations(id) on delete set null,
  superseded_by_generation_id uuid null references public.timeline_generations(id) on delete set null,
  superseded_at timestamptz null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timeline_generations_scope_type_check
    check (scope_type = any (array['driver'::text, 'vehicle'::text, 'import'::text, 'fleet_range'::text])),
  constraint timeline_generations_status_check
    check (status = any (array['running'::text, 'completed'::text, 'completed_with_warnings'::text, 'failed'::text, 'superseded'::text])),
  constraint timeline_generations_generated_by_kind_check
    check (generated_by_kind = any (array['system'::text, 'manager'::text, 'driver'::text, 'trigger'::text, 'backfill'::text])),
  constraint timeline_generations_generated_reason_check
    check (generated_reason = any (array['initial_import'::text, 'reprocess'::text, 'pairing_changed'::text, 'manual_rebuild'::text, 'backfill'::text])),
  constraint timeline_generations_range_check
    check (range_end > range_start)
);

create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  timeline_generation_id uuid not null references public.timeline_generations(id) on delete cascade,
  driver_id uuid null references public.profiles(id) on delete set null,
  vehicle_id uuid null references public.vehicles(id) on delete set null,
  event_type text not null,
  started_at timestamptz not null,
  ended_at timestamptz null,
  duration_seconds integer null,
  timezone text not null default 'UTC',
  confidence_state text not null default 'uncertain',
  source_summary text not null default 'Timeline generation',
  status text not null default 'current',
  is_current boolean not null default true,
  parser_run_id uuid null references public.tachograph_processing_runs(id) on delete set null,
  import_file_id uuid null references public.tachograph_files(id) on delete set null,
  source_table text null,
  source_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint timeline_events_event_type_check
    check (length(btrim(event_type)) > 0),
  constraint timeline_events_time_order_check
    check (ended_at is null or ended_at >= started_at),
  constraint timeline_events_duration_check
    check (duration_seconds is null or duration_seconds >= 0),
  constraint timeline_events_confidence_state_check
    check (confidence_state = any (array['confirmed'::text, 'likely'::text, 'possible'::text, 'uncertain'::text, 'insufficient_data'::text])),
  constraint timeline_events_status_check
    check (status = any (array['current'::text, 'superseded'::text, 'excluded'::text, 'needs_review'::text]))
);

create table if not exists public.timeline_event_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  timeline_event_id uuid not null references public.timeline_events(id) on delete cascade,
  timeline_generation_id uuid not null references public.timeline_generations(id) on delete cascade,
  source_type text not null,
  source_id uuid null,
  source_external_id text null,
  normalised_activity_id uuid null,
  parser_run_id uuid null references public.tachograph_processing_runs(id) on delete set null,
  parser_output_id uuid null references public.tachograph_parser_outputs(id) on delete set null,
  import_file_id uuid null references public.tachograph_files(id) on delete set null,
  source_reference_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint timeline_event_sources_source_type_check
    check (
      source_type = any (
        array[
          'tachograph_activity_segment'::text,
          'tachograph_technical_event'::text,
          'vehicle_motion_discrepancy'::text,
          'tachograph_reconciliation_item'::text,
          'work_session'::text,
          'driver_card_import'::text,
          'vehicle_unit_import'::text,
          'manual_entry'::text,
          'future_telematics'::text
        ]
      )
    ),
  constraint timeline_event_sources_source_identity_check
    check (source_id is not null or source_external_id is not null)
);

create table if not exists public.timeline_gaps (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  timeline_generation_id uuid not null references public.timeline_generations(id) on delete cascade,
  driver_id uuid null references public.profiles(id) on delete set null,
  vehicle_id uuid null references public.vehicles(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds integer not null,
  gap_type text not null,
  severity text not null default 'medium',
  reason text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint timeline_gaps_time_order_check
    check (ended_at > started_at),
  constraint timeline_gaps_duration_check
    check (duration_seconds >= 0),
  constraint timeline_gaps_gap_type_check
    check (
      gap_type = any (
        array[
          'missing_driver_card_data'::text,
          'missing_vehicle_unit_data'::text,
          'unmatched_activity'::text,
          'unknown_driver'::text,
          'parser_gap'::text,
          'manual_review_required'::text,
          'app_tacho_mismatch'::text
        ]
      )
    ),
  constraint timeline_gaps_severity_check
    check (severity = any (array['low'::text, 'medium'::text, 'high'::text, 'critical'::text])),
  constraint timeline_gaps_status_check
    check (status = any (array['open'::text, 'in_review'::text, 'resolved'::text, 'superseded'::text, 'accepted'::text]))
);

create table if not exists public.daily_timeline_summaries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  timeline_generation_id uuid not null references public.timeline_generations(id) on delete cascade,
  driver_id uuid null references public.profiles(id) on delete set null,
  vehicle_id uuid null references public.vehicles(id) on delete set null,
  summary_date date not null,
  driving_seconds integer not null default 0,
  work_seconds integer not null default 0,
  availability_seconds integer not null default 0,
  rest_seconds integer not null default 0,
  break_seconds integer not null default 0,
  unknown_seconds integer not null default 0,
  duty_start timestamptz null,
  duty_end timestamptz null,
  gap_count integer not null default 0,
  finding_count integer not null default 0,
  confidence_state text not null default 'uncertain',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint daily_timeline_summaries_seconds_check
    check (
      driving_seconds >= 0
      and work_seconds >= 0
      and availability_seconds >= 0
      and rest_seconds >= 0
      and break_seconds >= 0
      and unknown_seconds >= 0
      and gap_count >= 0
      and finding_count >= 0
    ),
  constraint daily_timeline_summaries_duty_order_check
    check (duty_end is null or duty_start is null or duty_end >= duty_start),
  constraint daily_timeline_summaries_confidence_state_check
    check (confidence_state = any (array['confirmed'::text, 'likely'::text, 'possible'::text, 'uncertain'::text, 'insufficient_data'::text]))
);

create index if not exists idx_timeline_generations_driver_current
  on public.timeline_generations(company_id, driver_id, is_current, range_start, range_end);

create index if not exists idx_timeline_generations_vehicle_current
  on public.timeline_generations(company_id, vehicle_id, is_current, range_start, range_end);

create index if not exists idx_timeline_generations_import_current
  on public.timeline_generations(company_id, source_import_id, is_current, started_at desc);

create index if not exists idx_timeline_generations_parser_run
  on public.timeline_generations(parser_run_id);

create index if not exists idx_timeline_events_driver_range
  on public.timeline_events(company_id, driver_id, started_at);

create index if not exists idx_timeline_events_vehicle_range
  on public.timeline_events(company_id, vehicle_id, started_at);

create index if not exists idx_timeline_events_generation_range
  on public.timeline_events(company_id, timeline_generation_id, started_at);

create index if not exists idx_timeline_events_event_type_range
  on public.timeline_events(company_id, event_type, started_at);

create index if not exists idx_timeline_events_parser_run
  on public.timeline_events(parser_run_id);

create index if not exists idx_timeline_events_import_file
  on public.timeline_events(import_file_id, started_at);

create index if not exists idx_timeline_event_sources_event
  on public.timeline_event_sources(timeline_event_id);

create index if not exists idx_timeline_event_sources_generation
  on public.timeline_event_sources(timeline_generation_id);

create index if not exists idx_timeline_event_sources_reverse_lookup
  on public.timeline_event_sources(company_id, source_type, source_id);

create index if not exists idx_timeline_event_sources_parser_run
  on public.timeline_event_sources(parser_run_id);

create index if not exists idx_timeline_gaps_driver_queue
  on public.timeline_gaps(company_id, driver_id, status, started_at);

create index if not exists idx_timeline_gaps_vehicle_queue
  on public.timeline_gaps(company_id, vehicle_id, status, started_at);

create index if not exists idx_timeline_gaps_generation
  on public.timeline_gaps(timeline_generation_id, started_at);

create index if not exists idx_daily_timeline_summaries_driver
  on public.daily_timeline_summaries(company_id, driver_id, summary_date desc);

create index if not exists idx_daily_timeline_summaries_vehicle
  on public.daily_timeline_summaries(company_id, vehicle_id, summary_date desc);

create index if not exists idx_daily_timeline_summaries_generation
  on public.daily_timeline_summaries(timeline_generation_id, summary_date desc);

drop trigger if exists set_timeline_generations_updated_at on public.timeline_generations;
create trigger set_timeline_generations_updated_at
  before update on public.timeline_generations
  for each row execute function public.set_timeline_updated_at();

drop trigger if exists set_timeline_events_updated_at on public.timeline_events;
create trigger set_timeline_events_updated_at
  before update on public.timeline_events
  for each row execute function public.set_timeline_updated_at();

drop trigger if exists set_timeline_gaps_updated_at on public.timeline_gaps;
create trigger set_timeline_gaps_updated_at
  before update on public.timeline_gaps
  for each row execute function public.set_timeline_updated_at();

drop trigger if exists set_daily_timeline_summaries_updated_at on public.daily_timeline_summaries;
create trigger set_daily_timeline_summaries_updated_at
  before update on public.daily_timeline_summaries
  for each row execute function public.set_timeline_updated_at();

alter table public.timeline_generations enable row level security;
alter table public.timeline_events enable row level security;
alter table public.timeline_event_sources enable row level security;
alter table public.timeline_gaps enable row level security;
alter table public.daily_timeline_summaries enable row level security;

drop policy if exists "Managers can read own company timeline generations" on public.timeline_generations;
create policy "Managers can read own company timeline generations"
  on public.timeline_generations for select
  to authenticated
  using (
    company_id = public.get_my_company_id()
    and public.get_my_role() = 'manager'
  );

drop policy if exists "Drivers can read own timeline generations" on public.timeline_generations;
create policy "Drivers can read own timeline generations"
  on public.timeline_generations for select
  to authenticated
  using (
    driver_id = auth.uid()
    and public.get_my_role() = 'driver'
  );

drop policy if exists "Managers can read own company timeline events" on public.timeline_events;
create policy "Managers can read own company timeline events"
  on public.timeline_events for select
  to authenticated
  using (
    company_id = public.get_my_company_id()
    and public.get_my_role() = 'manager'
  );

drop policy if exists "Drivers can read own timeline events" on public.timeline_events;
create policy "Drivers can read own timeline events"
  on public.timeline_events for select
  to authenticated
  using (
    driver_id = auth.uid()
    and public.get_my_role() = 'driver'
  );

drop policy if exists "Managers can read own company timeline event sources" on public.timeline_event_sources;
create policy "Managers can read own company timeline event sources"
  on public.timeline_event_sources for select
  to authenticated
  using (
    company_id = public.get_my_company_id()
    and public.get_my_role() = 'manager'
  );

drop policy if exists "Drivers can read own timeline event sources" on public.timeline_event_sources;
create policy "Drivers can read own timeline event sources"
  on public.timeline_event_sources for select
  to authenticated
  using (
    public.get_my_role() = 'driver'
    and exists (
      select 1
      from public.timeline_events event
      where event.id = timeline_event_sources.timeline_event_id
        and event.driver_id = auth.uid()
    )
  );

drop policy if exists "Managers can read own company timeline gaps" on public.timeline_gaps;
create policy "Managers can read own company timeline gaps"
  on public.timeline_gaps for select
  to authenticated
  using (
    company_id = public.get_my_company_id()
    and public.get_my_role() = 'manager'
  );

drop policy if exists "Drivers can read own timeline gaps" on public.timeline_gaps;
create policy "Drivers can read own timeline gaps"
  on public.timeline_gaps for select
  to authenticated
  using (
    driver_id = auth.uid()
    and public.get_my_role() = 'driver'
  );

drop policy if exists "Managers can read own company daily timeline summaries" on public.daily_timeline_summaries;
create policy "Managers can read own company daily timeline summaries"
  on public.daily_timeline_summaries for select
  to authenticated
  using (
    company_id = public.get_my_company_id()
    and public.get_my_role() = 'manager'
  );

drop policy if exists "Drivers can read own daily timeline summaries" on public.daily_timeline_summaries;
create policy "Drivers can read own daily timeline summaries"
  on public.daily_timeline_summaries for select
  to authenticated
  using (
    driver_id = auth.uid()
    and public.get_my_role() = 'driver'
  );
