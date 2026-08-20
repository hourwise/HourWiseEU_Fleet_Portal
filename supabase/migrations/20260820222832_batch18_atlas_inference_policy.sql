-- Batch 18: server-only Atlas inference policy and usage ledger contract.
-- Paid inference remains disabled. These private tables are intentionally not
-- exposed to the browser or PostgREST; a future server gateway may use them.

create table if not exists private.atlas_inference_policies (
  company_id uuid primary key references public.companies(id) on delete cascade,
  enabled boolean not null default false,
  allowed_tiers text[] not null default array['SYNTHESIS', 'STANDARD', 'DEEP'],
  monthly_budget_minor_units bigint,
  per_request_budget_minor_units bigint,
  daily_request_limit integer,
  monthly_request_limit integer,
  provider_slot text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (monthly_budget_minor_units is null or monthly_budget_minor_units >= 0),
  check (per_request_budget_minor_units is null or per_request_budget_minor_units >= 0),
  check (daily_request_limit is null or daily_request_limit >= 0),
  check (monthly_request_limit is null or monthly_request_limit >= 0)
);

create table if not exists private.atlas_inference_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  logical_tier text not null check (logical_tier in ('SYNTHESIS', 'STANDARD', 'DEEP', 'FALLBACK')),
  provider_slot text,
  cost_class text not null check (cost_class in ('free', 'low', 'medium', 'high')),
  estimated_cost_minor_units bigint,
  actual_cost_minor_units bigint,
  input_tokens integer,
  output_tokens integer,
  success boolean,
  intent text not null,
  purpose text not null,
  request_fingerprint text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (estimated_cost_minor_units is null or estimated_cost_minor_units >= 0),
  check (actual_cost_minor_units is null or actual_cost_minor_units >= 0),
  check (input_tokens is null or input_tokens >= 0),
  check (output_tokens is null or output_tokens >= 0)
);

create index if not exists atlas_inference_usage_company_requested_idx
  on private.atlas_inference_usage_ledger(company_id, requested_at desc);

alter table private.atlas_inference_policies enable row level security;
alter table private.atlas_inference_usage_ledger enable row level security;

revoke all on table private.atlas_inference_policies from public, anon, authenticated;
revoke all on table private.atlas_inference_usage_ledger from public, anon, authenticated;

comment on table private.atlas_inference_policies is 'Server-only company Atlas policy. Disabled by default; no browser or PostgREST access.';
comment on table private.atlas_inference_usage_ledger is 'Server-only future Atlas usage audit. Stores bounded metadata, never full prompts or responses.';
