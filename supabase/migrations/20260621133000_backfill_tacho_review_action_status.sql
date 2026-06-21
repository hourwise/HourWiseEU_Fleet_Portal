begin;

update public.tachograph_finding_reviews
set status = 'action_required',
    reviewed_at = coalesce(reviewed_at, updated_at, created_at, now()),
    updated_at = now()
where status = 'open'
  and corrective_action_type is not null;

commit;
