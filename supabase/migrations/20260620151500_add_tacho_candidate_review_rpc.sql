-- Manager decision marker for unlinked/candidate driver-card checks.
-- This deliberately does not create a profile, invite, compliance action, or training record.

create or replace function public.mark_tacho_candidate_card_review(
  p_company_id uuid,
  p_import_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  import_record public.tachograph_files%rowtype;
  normalized_decision text;
begin
  if public.get_my_role() is distinct from 'manager'
     or public.get_my_company_id() is distinct from p_company_id then
    raise exception 'Only a manager can review candidate tachograph cards for their own company';
  end if;

  normalized_decision := lower(btrim(coalesce(p_decision, '')));
  if normalized_decision not in ('reviewed', 'no_hire', 'defer') then
    raise exception 'Unsupported candidate card review decision';
  end if;

  select *
  into import_record
  from public.tachograph_files
  where id = p_import_id
    and company_id = p_company_id
    and coalesce(source_type, 'driver_card') = 'driver_card';

  if not found then
    raise exception 'Driver-card import was not found for this company';
  end if;

  update public.tachograph_files
  set metadata = jsonb_strip_nulls(
    coalesce(metadata, '{}'::jsonb) ||
    jsonb_build_object(
      'candidate_review_decision', normalized_decision,
      'candidate_review_note', nullif(btrim(coalesce(p_note, '')), ''),
      'candidate_reviewed_at', now(),
      'candidate_reviewed_by_user_id', auth.uid()
    )
  )
  where id = p_import_id
    and company_id = p_company_id;

  return jsonb_build_object(
    'importId', p_import_id,
    'decision', normalized_decision,
    'reviewed', true
  );
end;
$$;

grant execute on function public.mark_tacho_candidate_card_review(uuid, uuid, text, text) to authenticated;
