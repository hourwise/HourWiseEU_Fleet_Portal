-- Batch 16: source-driven compliance task resolution and bounded security review.

create or replace function public.prevent_stale_driver_compliance_resolution()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  driver_record public.profiles;
begin
  if new.source_type <> 'driver_compliance' or new.status <> 'resolved' then
    return new;
  end if;

  select * into driver_record
  from public.profiles
  where id = new.source_id
    and company_id = new.company_id
    and role = 'driver';

  if not found or driver_record.is_active is distinct from true then
    return new;
  end if;

  if driver_record.driving_licence_expiry is null or driver_record.driving_licence_expiry < current_date then
    raise exception 'Driver compliance handling cannot resolve while the driving licence source remains missing or expired' using errcode = '23514';
  end if;
  if driver_record.cpc_dqc_expiry is null or driver_record.cpc_dqc_expiry < current_date then
    raise exception 'Driver compliance handling cannot resolve while the CPC/DQC source remains missing or expired' using errcode = '23514';
  end if;
  if not exists (
    select 1
    from public.driver_documents document
    where document.company_id = new.company_id
      and document.user_id = new.source_id
      and document.document_type ~* '(medical|d4)'
      and document.expiry_date is not null
      and document.expiry_date >= current_date
  ) then
    raise exception 'Driver compliance handling cannot resolve while current medical evidence remains missing or expired' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_stale_driver_compliance_resolution on public.operational_task_handlings;
create trigger prevent_stale_driver_compliance_resolution
before insert or update of status, source_type, source_id, company_id
on public.operational_task_handlings
for each row execute function public.prevent_stale_driver_compliance_resolution();

revoke all on function public.prevent_stale_driver_compliance_resolution() from public, anon, authenticated;
grant execute on function public.prevent_stale_driver_compliance_resolution() to postgres;

-- Fix the remaining mutable search paths where the functions are safe to pin.
alter function public.generate_invoice_number() set search_path = public, pg_temp;
alter function public.get_current_user_company_id() set search_path = public, pg_temp;
alter function public.accept_driver_invite(uuid, uuid) set search_path = public, pg_temp;
alter function public.accept_driver_invite(text) set search_path = public, pg_temp;
alter function public.map_tachograph_status_to_contract(text) set search_path = public, pg_temp;
alter function public.resolve_tacho_range_start(text) set search_path = public, pg_temp;
alter function public.set_updated_at_timestamp() set search_path = public, pg_temp;
alter function public.set_timeline_updated_at() set search_path = public, pg_temp;
alter function public.timeline_event_json(public.timeline_events) set search_path = public, pg_temp;
alter function public.timeline_gap_json(public.timeline_gaps) set search_path = public, pg_temp;
alter function public.daily_timeline_summary_json(public.daily_timeline_summaries) set search_path = public, pg_temp;
alter function public.timeline_generation_json(public.timeline_generations) set search_path = public, pg_temp;

-- Anonymous onboarding remains intentional: lookup, validation, and the
-- authenticated invite-code acceptance path are still required by the edge flow.
revoke all on function public.accept_driver_invite(uuid, uuid) from public, anon, authenticated;
grant execute on function public.accept_driver_invite(uuid, uuid) to postgres;
revoke all on function public.get_auth_user_role() from public, anon;
grant execute on function public.get_auth_user_role() to authenticated;
revoke all on function public.is_manager_for_company_path(text) from public, anon;
grant execute on function public.is_manager_for_company_path(text) to authenticated;

-- Storage policy helpers are authenticated-only; their policy callers do not
-- require an anonymous RPC surface.
revoke all on function public.can_access_driver_document_object(text) from public, anon;
revoke all on function public.can_access_vehicle_document_object(text) from public, anon;
revoke all on function public.can_access_defect_photo_object(text) from public, anon;
grant execute on function public.can_access_driver_document_object(text) to authenticated;
grant execute on function public.can_access_vehicle_document_object(text) to authenticated;
grant execute on function public.can_access_defect_photo_object(text) to authenticated;

-- Tacho review/archive actions already have authenticated callers; remove the
-- inherited PUBLIC/anon execute privilege without changing their business logic.
revoke all on function public.archive_tacho_candidate_import(uuid, uuid, boolean, text) from public, anon;
revoke all on function public.confirm_tacho_candidate_import_storage_deleted(uuid, uuid, text) from public, anon;
revoke all on function public.mark_tacho_candidate_card_review(uuid, uuid, text, text) from public, anon;
revoke all on function public.pair_tacho_card_import_to_driver(uuid, uuid, uuid, text) from public, anon;
revoke all on function public.prepare_tacho_import_reprocess(uuid, uuid, text) from public, anon;
revoke all on function public.purge_company_driver_card_reads(uuid, boolean, boolean, text) from public, anon;
grant execute on function public.archive_tacho_candidate_import(uuid, uuid, boolean, text) to authenticated;
grant execute on function public.confirm_tacho_candidate_import_storage_deleted(uuid, uuid, text) to authenticated;
grant execute on function public.mark_tacho_candidate_card_review(uuid, uuid, text, text) to authenticated;
grant execute on function public.pair_tacho_card_import_to_driver(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.prepare_tacho_import_reprocess(uuid, uuid, text) to authenticated;
grant execute on function public.purge_company_driver_card_reads(uuid, boolean, boolean, text) to authenticated;

-- Trigger/event-trigger helpers are never browser RPCs.
revoke all on function public.enforce_tachograph_files_raw_identity_immutability() from public, anon, authenticated;
revoke all on function public.record_shift_audit_event() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
revoke all on function public.update_user_claims() from public, anon, authenticated;
grant execute on function public.enforce_tachograph_files_raw_identity_immutability() to postgres;
grant execute on function public.record_shift_audit_event() to postgres;
grant execute on function public.rls_auto_enable() to postgres;
grant execute on function public.update_user_claims() to postgres;
