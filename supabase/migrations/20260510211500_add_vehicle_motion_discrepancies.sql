create table if not exists public.tachograph_vehicle_motion_discrepancies (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.tachograph_files(id) on delete cascade,
  company_id uuid null references public.companies(id) on delete cascade,
  driver_id uuid null references public.profiles(id) on delete set null,
  vehicle_id uuid null references public.vehicles(id) on delete set null,
  discrepancy_date date not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  duration_mins integer not null default 0,
  severity text not null,
  status text not null,
  summary text not null,
  linked_driver_name text null,
  evidence_refs jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_tachograph_vehicle_motion_discrepancies_import
  on public.tachograph_vehicle_motion_discrepancies(import_id, start_time desc);

create index if not exists idx_tachograph_vehicle_motion_discrepancies_vehicle
  on public.tachograph_vehicle_motion_discrepancies(company_id, vehicle_id, start_time desc);

create index if not exists idx_tachograph_vehicle_motion_discrepancies_driver
  on public.tachograph_vehicle_motion_discrepancies(company_id, driver_id, start_time desc);
