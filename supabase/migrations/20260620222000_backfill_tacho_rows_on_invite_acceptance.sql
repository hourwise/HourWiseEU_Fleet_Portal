-- When a card-based invite is accepted, attach the prior candidate import and all
-- derived tacho rows to the accepted driver profile. This keeps the driver file and
-- Driver Card Analysis from remaining in candidate/unlinked mode after signup.

create or replace function public.accept_driver_invite(p_invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  invite_record record;
  profile_record record;
  pay_snapshot jsonb;
  pay_columns text;
  resolved_card_number text;
  matched_import_ids uuid[] := array[]::uuid[];
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select
    di.id,
    di.company_id,
    di.email,
    di.full_name,
    di.pay_config_snapshot,
    di.tacho_card_number,
    di.tacho_source_import_id
  into invite_record
  from public.driver_invites di
  where di.invite_code = upper(trim(p_invite_code))
    and di.status = 'pending'
    and di.expires_at > now()
  for update;

  if not found then
    raise exception 'Invalid or expired invite code';
  end if;

  select p.id, p.email, p.company_id, p.role
  into profile_record
  from public.profiles p
  where p.id = current_user_id
  for update;

  if not found then
    raise exception 'User profile not found';
  end if;

  if lower(coalesce(profile_record.email, '')) <> lower(coalesce(invite_record.email, '')) then
    raise exception 'Invite email does not match the signed-in user';
  end if;

  if profile_record.company_id is not null
     and profile_record.company_id is distinct from invite_record.company_id then
    raise exception 'Signed-in user already belongs to another company';
  end if;

  resolved_card_number := nullif(upper(btrim(coalesce(invite_record.tacho_card_number, ''))), '');

  perform set_config('app.allow_profile_membership_update', 'true', true);

  update public.profiles
  set company_id = invite_record.company_id,
      full_name = coalesce(nullif(invite_record.full_name, ''), full_name),
      role = 'driver',
      tacho_card_number = coalesce(resolved_card_number, tacho_card_number)
  where id = current_user_id;

  if to_regclass('public.pay_configurations') is not null then
    pay_snapshot := coalesce(invite_record.pay_config_snapshot, '{}'::jsonb)
      || jsonb_build_object('user_id', current_user_id);

    delete from public.pay_configurations
    where user_id = current_user_id;

    select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
    into pay_columns
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'pay_configurations'
      and c.column_name <> 'id'
      and pay_snapshot ? c.column_name;

    if pay_columns is not null then
      execute format(
        'insert into public.pay_configurations (%1$s) select %1$s from jsonb_populate_record(null::public.pay_configurations, $1)',
        pay_columns
      ) using pay_snapshot;
    end if;
  end if;

  update public.driver_invites
  set status = 'accepted',
      accepted_by_user_id = current_user_id
  where id = invite_record.id
    and status = 'pending';

  if not found then
    raise exception 'Invite was already accepted';
  end if;

  select coalesce(array_agg(tf.id), array[]::uuid[])
  into matched_import_ids
  from public.tachograph_files tf
  where tf.company_id = invite_record.company_id
    and coalesce(tf.source_type, 'driver_card') = 'driver_card'
    and tf.driver_id is null
    and (
      tf.id = invite_record.tacho_source_import_id
      or (
        resolved_card_number is not null
        and (
          upper(coalesce(tf.external_card_number, '')) = resolved_card_number
          or upper(coalesce(tf.metadata ->> 'driver_card_number_hint', '')) = resolved_card_number
        )
      )
    );

  update public.tachograph_files
  set
    driver_id = current_user_id,
    external_card_number = coalesce(resolved_card_number, external_card_number),
    metadata = jsonb_strip_nulls(
      coalesce(metadata, '{}'::jsonb) ||
      jsonb_build_object(
        'driver_name', coalesce(nullif(invite_record.full_name, ''), metadata ->> 'driver_name'),
        'driver_card_number_hint', coalesce(resolved_card_number, metadata ->> 'driver_card_number_hint'),
        'paired_driver_id', current_user_id,
        'paired_driver_name', nullif(invite_record.full_name, ''),
        'paired_at', now(),
        'paired_by_invite_id', invite_record.id,
        'candidate_invite_status', 'accepted',
        'candidate_invite_accepted_at', now()
      )
    )
  where id = any(matched_import_ids);

  update public.driver_card_downloads
  set driver_id = current_user_id,
      driver_name = coalesce(nullif(invite_record.full_name, ''), driver_name),
      card_number = coalesce(resolved_card_number, card_number)
  where company_id = invite_record.company_id
    and driver_id is null
    and (
      import_id = any(matched_import_ids)
      or (resolved_card_number is not null and upper(card_number) = resolved_card_number)
    );

  update public.tachograph_activity_segments
  set driver_id = current_user_id
  where company_id = invite_record.company_id
    and driver_id is null
    and import_id = any(matched_import_ids);

  update public.tachograph_day_summaries
  set driver_id = current_user_id
  where company_id = invite_record.company_id
    and driver_id is null
    and import_id = any(matched_import_ids);

  update public.tachograph_findings
  set driver_id = current_user_id
  where company_id = invite_record.company_id
    and driver_id is null
    and import_id = any(matched_import_ids);

  update public.tachograph_technical_events
  set driver_id = current_user_id
  where company_id = invite_record.company_id
    and driver_id is null
    and import_id = any(matched_import_ids);

  if to_regclass('public.tachograph_reconciliation_items') is not null then
    update public.tachograph_reconciliation_items
    set driver_id = current_user_id
    where company_id = invite_record.company_id
      and driver_id is null
      and import_id = any(matched_import_ids);
  end if;

  if to_regclass('public.tachograph_vehicle_motion_discrepancies') is not null then
    update public.tachograph_vehicle_motion_discrepancies
    set driver_id = current_user_id,
        linked_driver_name = coalesce(nullif(invite_record.full_name, ''), linked_driver_name)
    where company_id = invite_record.company_id
      and driver_id is null
      and import_id = any(matched_import_ids);
  end if;

  if to_regclass('public.tachograph_activities') is not null then
    update public.tachograph_activities
    set driver_id = current_user_id
    where driver_id is null
      and file_id::text in (select unnest(matched_import_ids)::text);
  end if;

  return jsonb_build_object(
    'success', true,
    'company_id', invite_record.company_id,
    'driver_id', current_user_id,
    'tacho_card_number', resolved_card_number,
    'linked_import_count', coalesce(array_length(matched_import_ids, 1), 0)
  );
end;
$$;

do $$
begin
  -- Repair candidate-card imports for invites that were accepted before this
  -- function version was deployed.
  update public.tachograph_files tf
  set
    driver_id = di.accepted_by_user_id,
    external_card_number = coalesce(nullif(upper(btrim(di.tacho_card_number)), ''), tf.external_card_number),
    metadata = jsonb_strip_nulls(
      coalesce(tf.metadata, '{}'::jsonb) ||
      jsonb_build_object(
        'driver_name', coalesce(nullif(di.full_name, ''), tf.metadata ->> 'driver_name'),
        'driver_card_number_hint', coalesce(nullif(upper(btrim(di.tacho_card_number)), ''), tf.metadata ->> 'driver_card_number_hint'),
        'paired_driver_id', di.accepted_by_user_id,
        'paired_driver_name', nullif(di.full_name, ''),
        'paired_at', now(),
        'paired_by_invite_id', di.id,
        'candidate_invite_status', 'accepted',
        'candidate_invite_accepted_at', now()
      )
    )
  from public.driver_invites di
  where di.status = 'accepted'
    and di.accepted_by_user_id is not null
    and tf.company_id = di.company_id
    and coalesce(tf.source_type, 'driver_card') = 'driver_card'
    and tf.driver_id is null
    and (
      tf.id = di.tacho_source_import_id
      or (
        nullif(upper(btrim(di.tacho_card_number)), '') is not null
        and (
          upper(coalesce(tf.external_card_number, '')) = nullif(upper(btrim(di.tacho_card_number)), '')
          or upper(coalesce(tf.metadata ->> 'driver_card_number_hint', '')) = nullif(upper(btrim(di.tacho_card_number)), '')
        )
      )
    );

  update public.driver_card_downloads dcd
  set driver_id = di.accepted_by_user_id,
      driver_name = coalesce(nullif(di.full_name, ''), dcd.driver_name),
      card_number = coalesce(nullif(upper(btrim(di.tacho_card_number)), ''), dcd.card_number)
  from public.driver_invites di
  where di.status = 'accepted'
    and di.accepted_by_user_id is not null
    and dcd.company_id = di.company_id
    and dcd.driver_id is null
    and (
      dcd.import_id = di.tacho_source_import_id
      or (
        nullif(upper(btrim(di.tacho_card_number)), '') is not null
        and upper(coalesce(dcd.card_number, '')) = nullif(upper(btrim(di.tacho_card_number)), '')
      )
    );

  update public.profiles p
  set tacho_card_number = coalesce(nullif(upper(btrim(di.tacho_card_number)), ''), p.tacho_card_number)
  from public.driver_invites di
  where di.status = 'accepted'
    and di.accepted_by_user_id = p.id
    and nullif(upper(btrim(di.tacho_card_number)), '') is not null
    and p.tacho_card_number is null;

  update public.tachograph_activity_segments tas
  set driver_id = tf.driver_id
  from public.tachograph_files tf
  where tas.company_id = tf.company_id
    and tas.import_id = tf.id
    and tas.driver_id is null
    and tf.driver_id is not null
    and coalesce(tf.source_type, 'driver_card') = 'driver_card';

  update public.tachograph_day_summaries tds
  set driver_id = tf.driver_id
  from public.tachograph_files tf
  where tds.company_id = tf.company_id
    and tds.import_id = tf.id
    and tds.driver_id is null
    and tf.driver_id is not null
    and coalesce(tf.source_type, 'driver_card') = 'driver_card';

  update public.tachograph_findings tfnd
  set driver_id = tf.driver_id
  from public.tachograph_files tf
  where tfnd.company_id = tf.company_id
    and tfnd.import_id = tf.id
    and tfnd.driver_id is null
    and tf.driver_id is not null
    and coalesce(tf.source_type, 'driver_card') = 'driver_card';

  update public.tachograph_technical_events tte
  set driver_id = tf.driver_id
  from public.tachograph_files tf
  where tte.company_id = tf.company_id
    and tte.import_id = tf.id
    and tte.driver_id is null
    and tf.driver_id is not null
    and coalesce(tf.source_type, 'driver_card') = 'driver_card';

  if to_regclass('public.tachograph_reconciliation_items') is not null then
    update public.tachograph_reconciliation_items tri
    set driver_id = tf.driver_id
    from public.tachograph_files tf
    where tri.company_id = tf.company_id
      and tri.import_id = tf.id
      and tri.driver_id is null
      and tf.driver_id is not null
      and coalesce(tf.source_type, 'driver_card') = 'driver_card';
  end if;

  if to_regclass('public.tachograph_vehicle_motion_discrepancies') is not null then
    update public.tachograph_vehicle_motion_discrepancies tvmd
    set driver_id = tf.driver_id,
        linked_driver_name = coalesce(nullif(tf.metadata ->> 'paired_driver_name', ''), tvmd.linked_driver_name)
    from public.tachograph_files tf
    where tvmd.company_id = tf.company_id
      and tvmd.import_id = tf.id
      and tvmd.driver_id is null
      and tf.driver_id is not null
      and coalesce(tf.source_type, 'driver_card') = 'driver_card';
  end if;

  if to_regclass('public.tachograph_activities') is not null then
    update public.tachograph_activities ta
    set driver_id = tf.driver_id
    from public.tachograph_files tf
    where ta.driver_id is null
      and ta.file_id::text = tf.id::text
      and tf.driver_id is not null
      and coalesce(tf.source_type, 'driver_card') = 'driver_card';
  end if;
end $$;

grant execute on function public.accept_driver_invite(text) to authenticated;
