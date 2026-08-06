-- EVENT-001: Publish a rota shift and create its driver-visible operational event atomically.
-- Legacy manager/company authorisation remains the enforcement path while the SEC-007
-- permission result is observed and audited for the later RBAC cutover.

INSERT INTO public.security_permissions (
  key,
  area,
  resource,
  operation,
  description,
  risk_level,
  requires_audit
)
VALUES (
  'rota.shift.publish',
  'rota',
  'shift',
  'publish',
  'Publish a driver rota shift and create its operational event.',
  'high',
  true
)
ON CONFLICT (key) DO UPDATE
SET
  description = EXCLUDED.description,
  risk_level = EXCLUDED.risk_level,
  requires_audit = EXCLUDED.requires_audit;

INSERT INTO public.security_role_permissions (role_key, permission_key, effect, scope_level)
VALUES ('fleet_administrator', 'rota.shift.publish', 'allow', 'organisation')
ON CONFLICT (role_key, permission_key, scope_level) DO UPDATE
SET effect = EXCLUDED.effect;

CREATE OR REPLACE FUNCTION public.publish_shift_with_event(
  p_shift_id uuid,
  p_requires_ack boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_shift public.shifts%ROWTYPE;
  actor_role text := public.get_my_role();
  actor_company_id uuid := public.get_my_company_id();
  legacy_allowed boolean := false;
  permission_allowed boolean := false;
  rota_thread_id uuid;
  published_event_id uuid;
BEGIN
  SELECT *
  INTO target_shift
  FROM public.shifts
  WHERE id = p_shift_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shift not found'
      USING ERRCODE = '42501';
  END IF;

  legacy_allowed := COALESCE(
    actor_role = 'manager'
    AND target_shift.company_id = actor_company_id,
    false
  );

  BEGIN
    permission_allowed := COALESCE(
      public.actor_has_permission('rota.shift.publish', target_shift.company_id, NULL),
      false
    );

    IF legacy_allowed IS DISTINCT FROM permission_allowed THEN
      PERFORM public.record_security_event(
        target_shift.company_id,
        NULL,
        'rota.shift.publish',
        CASE WHEN permission_allowed THEN 'allowed' ELSE 'denied' END,
        'shadow_permission_mismatch',
        'shift',
        target_shift.id,
        'publish',
        NULL,
        jsonb_build_object(
          'shadow_comparison', 'publish_shift_with_event',
          'legacy_allowed', legacy_allowed,
          'permission_allowed', permission_allowed,
          'legacy_role', actor_role,
          'actor_company_id', actor_company_id
        ),
        'user'
      );
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'EVENT-001 shadow permission comparison failed for publish_shift_with_event shift_id=%: %',
        p_shift_id,
        SQLERRM;
  END;

  IF NOT legacy_allowed THEN
    PERFORM public.record_security_event(
      target_shift.company_id,
      NULL,
      'rota.shift.publish',
      'denied',
      'legacy_authorisation_denied',
      'shift',
      target_shift.id,
      'publish',
      NULL,
      jsonb_build_object(
        'legacy_role', actor_role,
        'actor_company_id', actor_company_id,
        'permission_allowed', permission_allowed
      ),
      'user'
    );

    RAISE EXCEPTION 'Only managers in the shift company can publish rota shifts'
      USING ERRCODE = '42501';
  END IF;

  IF target_shift.status NOT IN ('draft', 'updated') THEN
    RAISE EXCEPTION 'Only draft or updated shifts can be published'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.shifts
  SET
    status = 'published',
    published_at = NOW(),
    published_by = auth.uid(),
    cancelled_at = NULL,
    cancelled_by = NULL
  WHERE id = target_shift.id;

  SELECT fe.thread_id
  INTO rota_thread_id
  FROM public.fleet_events fe
  WHERE fe.related_shift_id = target_shift.id
    AND fe.thread_id IS NOT NULL
  ORDER BY fe.created_at DESC
  LIMIT 1;

  IF rota_thread_id IS NULL THEN
    INSERT INTO public.message_threads (
      company_id,
      thread_type,
      subject,
      driver_id,
      created_by
    )
    VALUES (
      target_shift.company_id,
      'rota',
      'Rota updates',
      target_shift.driver_id,
      auth.uid()
    )
    RETURNING id INTO rota_thread_id;
  END IF;

  INSERT INTO public.fleet_events (
    company_id,
    thread_id,
    event_type,
    priority,
    actor_id,
    recipient_driver_id,
    related_shift_id,
    title,
    body,
    payload,
    requires_ack
  )
  VALUES (
    target_shift.company_id,
    rota_thread_id,
    'rota_shift_published',
    'info',
    auth.uid(),
    target_shift.driver_id,
    target_shift.id,
    'Rota shift published',
    format(
      'Your shift for %s from %s to %s has been published.',
      target_shift.date,
      to_char(target_shift.start_time, 'HH24:MI'),
      to_char(target_shift.end_time, 'HH24:MI')
    ),
    jsonb_build_object(
      'date', target_shift.date,
      'start_time', target_shift.start_time,
      'end_time', target_shift.end_time,
      'vehicle_id', target_shift.vehicle_id,
      'notes', target_shift.notes,
      'publication_source', 'rota_shift_publish'
    ),
    COALESCE(p_requires_ack, true)
  )
  RETURNING id INTO published_event_id;

  UPDATE public.message_threads
  SET
    last_event_id = published_event_id,
    updated_at = NOW()
  WHERE id = rota_thread_id;

  PERFORM public.record_security_event(
    target_shift.company_id,
    NULL,
    'rota.shift.publish',
    'allowed',
    'rota_shift_published',
    'shift',
    target_shift.id,
    'publish',
    NULL,
    jsonb_build_object(
      'event_id', published_event_id,
      'thread_id', rota_thread_id,
      'recipient_driver_id', target_shift.driver_id,
      'requires_ack', COALESCE(p_requires_ack, true),
      'permission_allowed', permission_allowed
    ),
    'user'
  );

  RETURN jsonb_build_object(
    'shift_id', target_shift.id,
    'status', 'published',
    'thread_id', rota_thread_id,
    'event_id', published_event_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.publish_shift_with_event(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_shift_with_event(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.publish_shift_with_event(uuid, boolean) TO authenticated;
