-- EVENT-001: Make manager shift updates/cancellations create driver-visible events atomically.

INSERT INTO public.security_permissions (key, area, resource, operation, description, risk_level, requires_audit)
VALUES
  ('rota.shift.update', 'rota', 'shift', 'update', 'Update a published driver rota shift and create its operational event.', 'high', true),
  ('rota.shift.cancel', 'rota', 'shift', 'cancel', 'Cancel a driver rota shift and create its operational event.', 'high', true)
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description, risk_level = EXCLUDED.risk_level, requires_audit = EXCLUDED.requires_audit;

INSERT INTO public.security_role_permissions (role_key, permission_key, effect, scope_level)
VALUES
  ('fleet_administrator', 'rota.shift.update', 'allow', 'organisation'),
  ('fleet_administrator', 'rota.shift.cancel', 'allow', 'organisation')
ON CONFLICT (role_key, permission_key, scope_level) DO UPDATE SET effect = EXCLUDED.effect;

CREATE OR REPLACE FUNCTION public.update_shift_with_event(
  p_shift_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_vehicle_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_requires_ack boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_shift public.shifts%ROWTYPE;
  actor_role text := public.get_my_role();
  actor_company_id uuid := public.get_my_company_id();
  legacy_allowed boolean := false;
  permission_allowed boolean := false;
  rota_thread_id uuid;
  event_id uuid;
  resulting_status shift_status;
BEGIN
  SELECT * INTO target_shift FROM public.shifts WHERE id = p_shift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shift not found' USING ERRCODE = '42501'; END IF;
  legacy_allowed := COALESCE(actor_role = 'manager' AND target_shift.company_id = actor_company_id, false);
  BEGIN
    permission_allowed := COALESCE(public.actor_has_permission('rota.shift.update', target_shift.company_id, NULL), false);
    IF legacy_allowed IS DISTINCT FROM permission_allowed THEN
      PERFORM public.record_security_event(target_shift.company_id, NULL, 'rota.shift.update', CASE WHEN permission_allowed THEN 'allowed' ELSE 'denied' END, 'shadow_permission_mismatch', 'shift', target_shift.id, 'update', NULL, jsonb_build_object('shadow_comparison', 'update_shift_with_event', 'legacy_allowed', legacy_allowed, 'permission_allowed', permission_allowed, 'legacy_role', actor_role), 'user');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'EVENT-001 shadow permission comparison failed for update_shift_with_event shift_id=%: %', p_shift_id, SQLERRM;
  END;
  IF NOT legacy_allowed THEN RAISE EXCEPTION 'Only managers in the shift company can update rota shifts' USING ERRCODE = '42501'; END IF;

  resulting_status := CASE WHEN target_shift.status IN ('published', 'updated') THEN 'updated'::shift_status ELSE 'draft'::shift_status END;
  UPDATE public.shifts SET date = p_date, start_time = p_start_time, end_time = p_end_time, vehicle_id = p_vehicle_id, notes = p_notes, status = resulting_status,
    cancelled_at = CASE WHEN resulting_status = 'draft' THEN NULL ELSE cancelled_at END,
    cancelled_by = CASE WHEN resulting_status = 'draft' THEN NULL ELSE cancelled_by END
  WHERE id = target_shift.id;

  IF resulting_status = 'updated' THEN
    SELECT fe.thread_id INTO rota_thread_id FROM public.fleet_events fe WHERE fe.related_shift_id = target_shift.id AND fe.thread_id IS NOT NULL ORDER BY fe.created_at DESC LIMIT 1;
    IF rota_thread_id IS NULL THEN
      INSERT INTO public.message_threads (company_id, thread_type, subject, driver_id, created_by)
      VALUES (target_shift.company_id, 'rota', 'Rota updates', target_shift.driver_id, auth.uid()) RETURNING id INTO rota_thread_id;
    END IF;
    INSERT INTO public.fleet_events (company_id, thread_id, event_type, priority, actor_id, recipient_driver_id, related_shift_id, title, body, payload, requires_ack)
    VALUES (target_shift.company_id, rota_thread_id, 'rota_shift_updated', 'advisory', auth.uid(), target_shift.driver_id, target_shift.id, 'Rota shift updated', format('Your shift for %s from %s to %s has been updated.', p_date, to_char(p_start_time, 'HH24:MI'), to_char(p_end_time, 'HH24:MI')), jsonb_build_object('previous_date', target_shift.date, 'previous_start_time', target_shift.start_time, 'previous_end_time', target_shift.end_time, 'date', p_date, 'start_time', p_start_time, 'end_time', p_end_time, 'vehicle_id', p_vehicle_id, 'notes', p_notes), COALESCE(p_requires_ack, true)) RETURNING id INTO event_id;
    UPDATE public.message_threads SET last_event_id = event_id, updated_at = NOW() WHERE id = rota_thread_id;
  END IF;
  PERFORM public.record_security_event(target_shift.company_id, NULL, 'rota.shift.update', 'allowed', CASE WHEN event_id IS NULL THEN 'draft_shift_updated' ELSE 'rota_shift_updated' END, 'shift', target_shift.id, 'update', NULL, jsonb_build_object('event_id', event_id, 'permission_allowed', permission_allowed), 'user');
  RETURN jsonb_build_object('shift_id', target_shift.id, 'status', resulting_status, 'event_id', event_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_shift_with_event(p_shift_id uuid, p_requires_ack boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_shift public.shifts%ROWTYPE;
  actor_role text := public.get_my_role(); actor_company_id uuid := public.get_my_company_id();
  legacy_allowed boolean := false; permission_allowed boolean := false; rota_thread_id uuid; event_id uuid;
BEGIN
  SELECT * INTO target_shift FROM public.shifts WHERE id = p_shift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shift not found' USING ERRCODE = '42501'; END IF;
  legacy_allowed := COALESCE(actor_role = 'manager' AND target_shift.company_id = actor_company_id, false);
  BEGIN
    permission_allowed := COALESCE(public.actor_has_permission('rota.shift.cancel', target_shift.company_id, NULL), false);
    IF legacy_allowed IS DISTINCT FROM permission_allowed THEN
      PERFORM public.record_security_event(target_shift.company_id, NULL, 'rota.shift.cancel', CASE WHEN permission_allowed THEN 'allowed' ELSE 'denied' END, 'shadow_permission_mismatch', 'shift', target_shift.id, 'cancel', NULL, jsonb_build_object('shadow_comparison', 'cancel_shift_with_event', 'legacy_allowed', legacy_allowed, 'permission_allowed', permission_allowed, 'legacy_role', actor_role), 'user');
    END IF;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'EVENT-001 shadow permission comparison failed for cancel_shift_with_event shift_id=%: %', p_shift_id, SQLERRM;
  END;
  IF NOT legacy_allowed THEN RAISE EXCEPTION 'Only managers in the shift company can cancel rota shifts' USING ERRCODE = '42501'; END IF;
  IF target_shift.status = 'cancelled' THEN RAISE EXCEPTION 'Shift is already cancelled' USING ERRCODE = '22023'; END IF;
  UPDATE public.shifts SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = auth.uid() WHERE id = target_shift.id;
  IF target_shift.status IN ('published', 'updated') THEN
    SELECT fe.thread_id INTO rota_thread_id FROM public.fleet_events fe WHERE fe.related_shift_id = target_shift.id AND fe.thread_id IS NOT NULL ORDER BY fe.created_at DESC LIMIT 1;
    IF rota_thread_id IS NULL THEN INSERT INTO public.message_threads (company_id, thread_type, subject, driver_id, created_by) VALUES (target_shift.company_id, 'rota', 'Rota updates', target_shift.driver_id, auth.uid()) RETURNING id INTO rota_thread_id; END IF;
    INSERT INTO public.fleet_events (company_id, thread_id, event_type, priority, actor_id, recipient_driver_id, related_shift_id, title, body, payload, requires_ack)
    VALUES (target_shift.company_id, rota_thread_id, 'rota_shift_cancelled', 'warning', auth.uid(), target_shift.driver_id, target_shift.id, 'Rota shift cancelled', format('Your shift for %s from %s to %s has been cancelled.', target_shift.date, to_char(target_shift.start_time, 'HH24:MI'), to_char(target_shift.end_time, 'HH24:MI')), jsonb_build_object('date', target_shift.date, 'start_time', target_shift.start_time, 'end_time', target_shift.end_time, 'vehicle_id', target_shift.vehicle_id, 'notes', target_shift.notes), COALESCE(p_requires_ack, true)) RETURNING id INTO event_id;
    UPDATE public.message_threads SET last_event_id = event_id, updated_at = NOW() WHERE id = rota_thread_id;
  END IF;
  PERFORM public.record_security_event(target_shift.company_id, NULL, 'rota.shift.cancel', 'allowed', CASE WHEN event_id IS NULL THEN 'draft_shift_cancelled' ELSE 'rota_shift_cancelled' END, 'shift', target_shift.id, 'cancel', NULL, jsonb_build_object('event_id', event_id, 'permission_allowed', permission_allowed), 'user');
  RETURN jsonb_build_object('shift_id', target_shift.id, 'status', 'cancelled', 'event_id', event_id);
END;
$$;

REVOKE ALL ON FUNCTION public.update_shift_with_event(uuid, date, time, time, uuid, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_shift_with_event(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_shift_with_event(uuid, date, time, time, uuid, text, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.cancel_shift_with_event(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_shift_with_event(uuid, date, time, time, uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_shift_with_event(uuid, boolean) TO authenticated;
