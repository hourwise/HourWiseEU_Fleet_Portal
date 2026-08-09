-- FIN-002: preserve captured expenses as evidence and add a separate review boundary.

create table if not exists public.expense_reviews (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null unique references public.expenses(id) on delete cascade,
  decision text not null check (decision in ('approved', 'rejected')),
  note text,
  reviewed_by uuid not null references public.profiles(id),
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_expense_reviews_expense_id on public.expense_reviews(expense_id);
create index if not exists idx_expense_reviews_updated_at on public.expense_reviews(updated_at desc);

alter table public.expense_reviews enable row level security;

create or replace function public.set_expense_review_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp
as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists set_expense_review_updated_at on public.expense_reviews;
create trigger set_expense_review_updated_at before update on public.expense_reviews for each row execute function public.set_expense_review_updated_at();

insert into public.security_permissions (key, area, resource, operation, description, risk_level, requires_audit)
values
  ('finance.expense.read', 'finance', 'expense', 'read', 'Read company expense capture and review state.', 'high', false),
  ('finance.expense.review', 'finance', 'expense', 'review', 'Approve or reject a company expense for HourWise operations.', 'high', true)
on conflict (key) do update set description = excluded.description, risk_level = excluded.risk_level, requires_audit = excluded.requires_audit;

insert into public.security_role_permissions (role_key, permission_key, effect, scope_level)
values
  ('fleet_administrator', 'finance.expense.read', 'allow', 'organisation'),
  ('fleet_administrator', 'finance.expense.review', 'allow', 'organisation')
on conflict (role_key, permission_key, scope_level) do update set effect = excluded.effect;

drop policy if exists "Finance managers can read company expense reviews" on public.expense_reviews;
create policy "Finance managers can read company expense reviews"
on public.expense_reviews for select to authenticated
using (
  exists (
    select 1 from public.expenses e
    join public.profiles driver on driver.id = e.user_id
    where e.id = expense_reviews.expense_id
      and public.actor_has_permission('finance.expense.read', driver.company_id, null)
  )
);

create or replace function public.review_expense(
  p_expense_id uuid,
  p_decision text,
  p_note text default null,
  p_expected_updated_at timestamptz default null
)
returns public.expense_reviews
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  expense_company_id uuid;
  current_review public.expense_reviews;
  result_review public.expense_reviews;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'Invalid expense review decision'; end if;

  select driver.company_id into expense_company_id
  from public.expenses e join public.profiles driver on driver.id = e.user_id
  where e.id = p_expense_id
  for update;
  if expense_company_id is null then raise exception 'Expense not found in an accessible company'; end if;
  if not public.actor_has_permission('finance.expense.review', expense_company_id, null) then
    perform public.record_security_event(expense_company_id, null, 'finance.expense.review', 'denied', 'permission_missing', 'expense', p_expense_id, 'review');
    raise exception 'Expense review permission required';
  end if;

  select * into current_review from public.expense_reviews where expense_id = p_expense_id for update;
  if found then
    if p_expected_updated_at is null or current_review.updated_at is distinct from p_expected_updated_at then
      raise exception 'Expense review is stale; reload the current review before trying again';
    end if;
    update public.expense_reviews
    set decision = p_decision, note = nullif(trim(p_note), ''), reviewed_by = actor_id, reviewed_at = now()
    where id = current_review.id
    returning * into result_review;
  else
    insert into public.expense_reviews (expense_id, decision, note, reviewed_by)
    values (p_expense_id, p_decision, nullif(trim(p_note), ''), actor_id)
    returning * into result_review;
  end if;

  perform public.record_security_event(expense_company_id, null, 'finance.expense.review', 'allowed', 'expense_reviewed', 'expense', p_expense_id, 'review', null, jsonb_build_object('decision', p_decision, 'review_id', result_review.id));
  return result_review;
end;
$$;

revoke all on table public.expense_reviews from public, anon, authenticated;
grant select on table public.expense_reviews to authenticated;
revoke all on function public.review_expense(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.review_expense(uuid, text, text, timestamptz) to authenticated;

comment on table public.expense_reviews is 'FIN-002 manager review boundary. Missing row normalises to pending; this does not mean paid or reimbursed.';
