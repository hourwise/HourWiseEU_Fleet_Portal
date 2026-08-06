-- EVENT-001: Write a manager message and its operational event as one transaction.
-- Existing message reads and driver reply flows remain compatible.

CREATE OR REPLACE FUNCTION public.send_manager_message_with_event(
  p_body text,
  p_recipient_driver_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor_role text := public.get_my_role();
  actor_company_id uuid := public.get_my_company_id();
  target_driver_id uuid;
  legacy_allowed boolean := false;
  permission_allowed boolean := false;
  message_thread_id uuid;
  message_event_id uuid;
  message_id uuid;
  thread_kind text;
BEGIN
  IF NULLIF(trim(p_body), '') IS NULL THEN
    RAISE EXCEPTION 'Message body cannot be empty' USING ERRCODE = '22023';
  END IF;

  IF p_recipient_driver_id IS NOT NULL THEN
    SELECT p.id
    INTO target_driver_id
    FROM public.profiles p
    WHERE p.id = p_recipient_driver_id
      AND p.company_id = actor_company_id
      AND p.role = 'driver'
      AND coalesce(p.is_active, true) = true;

    IF target_driver_id IS NULL THEN
      RAISE EXCEPTION 'Recipient driver not found for current company' USING ERRCODE = '42501';
    END IF;
  END IF;

  legacy_allowed := COALESCE(actor_role = 'manager' AND actor_company_id IS NOT NULL, false);

  BEGIN
    permission_allowed := COALESCE(
      public.actor_has_permission('messaging.message.create', actor_company_id, NULL),
      false
    );
    IF legacy_allowed IS DISTINCT FROM permission_allowed THEN
      PERFORM public.record_security_event(
        actor_company_id, NULL, 'messaging.message.create',
        CASE WHEN permission_allowed THEN 'allowed' ELSE 'denied' END,
        'shadow_permission_mismatch', 'message', NULL, 'create', NULL,
        jsonb_build_object(
          'shadow_comparison', 'send_manager_message_with_event',
          'legacy_allowed', legacy_allowed,
          'permission_allowed', permission_allowed,
          'legacy_role', actor_role
        ), 'user'
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'EVENT-001 shadow permission comparison failed for send_manager_message_with_event: %', SQLERRM;
  END;

  IF NOT legacy_allowed THEN
    RAISE EXCEPTION 'Only managers can send company messages' USING ERRCODE = '42501';
  END IF;

  thread_kind := CASE WHEN target_driver_id IS NULL THEN 'broadcast' ELSE 'direct' END;
  SELECT mt.id
  INTO message_thread_id
  FROM public.message_threads mt
  WHERE mt.company_id = actor_company_id
    AND mt.thread_type = thread_kind
    AND mt.driver_id IS NOT DISTINCT FROM target_driver_id
    AND mt.archived_at IS NULL
  ORDER BY mt.updated_at DESC
  LIMIT 1;

  IF message_thread_id IS NULL THEN
    INSERT INTO public.message_threads (company_id, thread_type, subject, driver_id, created_by)
    VALUES (
      actor_company_id,
      thread_kind,
      CASE WHEN target_driver_id IS NULL THEN 'Company announcements' ELSE 'Direct messages' END,
      target_driver_id,
      auth.uid()
    )
    RETURNING id INTO message_thread_id;
  END IF;

  INSERT INTO public.fleet_events (
    company_id, thread_id, event_type, priority, actor_id, recipient_driver_id,
    title, body, payload, requires_ack
  )
  VALUES (
    actor_company_id, message_thread_id, 'message_sent', 'info', auth.uid(), target_driver_id,
    CASE WHEN target_driver_id IS NULL THEN 'New company message' ELSE 'New manager message' END,
    trim(p_body), jsonb_build_object('message_kind', thread_kind), false
  )
  RETURNING id INTO message_event_id;

  INSERT INTO public.messages (company_id, sender_id, recipient_id, body, thread_id, fleet_event_id)
  VALUES (actor_company_id, auth.uid(), target_driver_id, trim(p_body), message_thread_id, message_event_id)
  RETURNING id INTO message_id;

  UPDATE public.fleet_events SET related_message_id = message_id WHERE id = message_event_id;
  UPDATE public.message_threads SET last_event_id = message_event_id, updated_at = NOW() WHERE id = message_thread_id;

  PERFORM public.record_security_event(
    actor_company_id, NULL, 'messaging.message.create', 'allowed', 'manager_message_sent',
    'message', message_id, 'create', NULL,
    jsonb_build_object('event_id', message_event_id, 'thread_id', message_thread_id, 'recipient_driver_id', target_driver_id),
    'user'
  );

  RETURN jsonb_build_object('message_id', message_id, 'event_id', message_event_id, 'thread_id', message_thread_id);
END;
$$;

REVOKE ALL ON FUNCTION public.send_manager_message_with_event(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.send_manager_message_with_event(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.send_manager_message_with_event(text, uuid) TO authenticated;
