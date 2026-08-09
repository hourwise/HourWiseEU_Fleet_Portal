-- ROUTE-001: Complete manager-side edit/cancel lifecycle for job assignments.
--
-- Verification: run the focused ROUTE-001 tests, then verify one published
-- assignment edit and cancellation in a manager company while checking the
-- related fleet_events and security_permission_audit_events rows.
-- Rollback: drop the two functions below and remove the two additive
-- permission catalogue rows/role grants if this lifecycle is reverted before
-- any client depends on it. Existing jobs, assignments, events, and audit
-- rows are intentionally retained; this migration does not delete data.

INSERT INTO public.security_permissions (key, area, resource, operation, description, risk_level, requires_audit)
VALUES
  ('operations.job.update', 'operations', 'job', 'update', 'Edit a non-cancelled job assignment and create its driver-visible update event.', 'high', true),
  ('operations.job.cancel', 'operations', 'job', 'cancel', 'Cancel a published job assignment and create its driver-visible cancellation event.', 'high', true)
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description, risk_level = EXCLUDED.risk_level, requires_audit = EXCLUDED.requires_audit;

INSERT INTO public.security_role_permissions (role_key, permission_key, effect, scope_level)
VALUES
  ('fleet_administrator', 'operations.job.update', 'allow', 'organisation'),
  ('fleet_administrator', 'operations.job.cancel', 'allow', 'organisation')
ON CONFLICT (role_key, permission_key, scope_level) DO UPDATE SET effect = EXCLUDED.effect;

CREATE OR REPLACE FUNCTION public.update_job_assignment_with_event(
  p_assignment_id uuid,
  p_reference text,
  p_title text,
  p_job_type text,
  p_address_text text,
  p_customer_name text DEFAULT NULL,
  p_contact_name text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL,
  p_instructions text DEFAULT NULL,
  p_sequence integer DEFAULT 1,
  p_planned_arrival_at timestamptz DEFAULT NULL,
  p_planned_departure_at timestamptz DEFAULT NULL,
  p_expected_duration_minutes integer DEFAULT NULL,
  p_expected_updated_at timestamptz DEFAULT NULL,
  p_requires_ack boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_assignment public.job_assignments%ROWTYPE;
  target_job public.jobs%ROWTYPE;
  target_shift public.shifts%ROWTYPE;
  actor_role text := public.get_my_role();
  actor_company_id uuid := public.get_my_company_id();
  legacy_allowed boolean := false;
  permission_allowed boolean := false;
  rota_thread_id uuid;
  event_id uuid;
  resulting_status public.job_assignment_status;
  previous_payload jsonb;
  next_payload jsonb;
BEGIN
  IF NULLIF(trim(p_reference), '') IS NULL OR NULLIF(trim(p_title), '') IS NULL OR NULLIF(trim(p_address_text), '') IS NULL THEN
    RAISE EXCEPTION 'Job reference, title, and address are required' USING ERRCODE = '22023';
  END IF;
  IF p_job_type NOT IN ('delivery', 'collection', 'service', 'other') OR p_sequence < 1 THEN
    RAISE EXCEPTION 'Invalid job type or sequence' USING ERRCODE = '22023';
  END IF;
  IF p_expected_duration_minutes IS NOT NULL AND p_expected_duration_minutes < 1 THEN
    RAISE EXCEPTION 'Expected duration must be positive' USING ERRCODE = '22023';
  END IF;
  IF p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'A current assignment version is required' USING ERRCODE = '22023';
  END IF;

  -- Lock assignment, shift, and job in a stable order so a concurrent edit or
  -- cancellation cannot produce a partial driver-visible change.
  SELECT * INTO target_assignment FROM public.job_assignments WHERE id = p_assignment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job assignment not found' USING ERRCODE = '42501'; END IF;
  SELECT * INTO target_shift FROM public.shifts WHERE id = target_assignment.shift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shift not found' USING ERRCODE = '42501'; END IF;
  SELECT * INTO target_job FROM public.jobs WHERE id = target_assignment.job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job not found' USING ERRCODE = '42501'; END IF;

  legacy_allowed := COALESCE(
    actor_role = 'manager'
    AND target_assignment.company_id = actor_company_id
    AND target_shift.company_id = actor_company_id
    AND target_job.company_id = actor_company_id,
    false
  );
  BEGIN
    permission_allowed := COALESCE(public.actor_has_permission('operations.job.update', target_assignment.company_id, NULL), false);
    IF legacy_allowed IS DISTINCT FROM permission_allowed THEN
      PERFORM public.record_security_event(target_assignment.company_id, NULL, 'operations.job.update', CASE WHEN permission_allowed THEN 'allowed' ELSE 'denied' END, 'shadow_permission_mismatch', 'job_assignment', target_assignment.id, 'update', NULL, jsonb_build_object('shadow_comparison', 'update_job_assignment_with_event', 'legacy_allowed', legacy_allowed, 'permission_allowed', permission_allowed, 'legacy_role', actor_role), 'user');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'ROUTE-001 shadow permission comparison failed for update_job_assignment_with_event assignment_id=%: %', p_assignment_id, SQLERRM;
  END;
  IF NOT legacy_allowed THEN RAISE EXCEPTION 'Only managers in the assignment company can update job assignments' USING ERRCODE = '42501'; END IF;
  IF target_assignment.status = 'cancelled' THEN RAISE EXCEPTION 'Job assignment is already cancelled' USING ERRCODE = '22023'; END IF;
  IF target_shift.status NOT IN ('published', 'updated') THEN RAISE EXCEPTION 'Jobs can only be edited on a published or updated shift' USING ERRCODE = '22023'; END IF;
  IF target_assignment.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Job assignment changed since it was loaded; refresh before editing' USING ERRCODE = '40001';
  END IF;

  previous_payload := jsonb_build_object(
    'reference', target_job.reference,
    'title', target_job.title,
    'job_type', target_job.job_type,
    'customer_name', target_job.customer_name,
    'address_text', target_job.address_text,
    'contact_name', target_job.contact_name,
    'contact_phone', target_job.contact_phone,
    'instructions', target_job.instructions,
    'sequence', target_assignment.sequence,
    'planned_arrival_at', target_assignment.planned_arrival_at,
    'planned_departure_at', target_assignment.planned_departure_at,
    'expected_duration_minutes', target_assignment.expected_duration_minutes
  );
  next_payload := jsonb_build_object(
    'reference', trim(p_reference),
    'title', trim(p_title),
    'job_type', p_job_type,
    'customer_name', NULLIF(trim(p_customer_name), ''),
    'address_text', trim(p_address_text),
    'contact_name', NULLIF(trim(p_contact_name), ''),
    'contact_phone', NULLIF(trim(p_contact_phone), ''),
    'instructions', NULLIF(trim(p_instructions), ''),
    'sequence', p_sequence,
    'planned_arrival_at', p_planned_arrival_at,
    'planned_departure_at', p_planned_departure_at,
    'expected_duration_minutes', p_expected_duration_minutes
  );

  UPDATE public.jobs
  SET reference = trim(p_reference),
      title = trim(p_title),
      job_type = p_job_type,
      customer_name = NULLIF(trim(p_customer_name), ''),
      address_text = trim(p_address_text),
      contact_name = NULLIF(trim(p_contact_name), ''),
      contact_phone = NULLIF(trim(p_contact_phone), ''),
      instructions = NULLIF(trim(p_instructions), ''),
      updated_at = NOW()
  WHERE id = target_job.id;

  resulting_status := CASE
    WHEN target_assignment.status = 'draft' THEN 'draft'::public.job_assignment_status
    ELSE 'updated'::public.job_assignment_status
  END;
  UPDATE public.job_assignments
  SET sequence = p_sequence,
      status = resulting_status,
      planned_arrival_at = p_planned_arrival_at,
      planned_departure_at = p_planned_departure_at,
      expected_duration_minutes = p_expected_duration_minutes,
      updated_at = NOW()
  WHERE id = target_assignment.id;

  IF target_assignment.status IN ('published', 'updated') THEN
    SELECT fe.thread_id INTO rota_thread_id FROM public.fleet_events fe WHERE fe.related_shift_id = target_shift.id AND fe.thread_id IS NOT NULL ORDER BY fe.created_at DESC LIMIT 1;
    IF rota_thread_id IS NULL THEN
      INSERT INTO public.message_threads (company_id, thread_type, subject, driver_id, created_by)
      VALUES (target_shift.company_id, 'rota', 'Rota updates', target_shift.driver_id, auth.uid()) RETURNING id INTO rota_thread_id;
    END IF;
    INSERT INTO public.fleet_events (company_id, thread_id, event_type, priority, actor_id, recipient_driver_id, related_shift_id, title, body, payload, requires_ack)
    VALUES (target_assignment.company_id, rota_thread_id, 'job_updated', 'advisory', auth.uid(), target_assignment.driver_id, target_assignment.shift_id, 'Job assignment updated', format('%s on your shift has been updated.', trim(p_title)), jsonb_build_object('job_id', target_assignment.job_id, 'job_assignment_id', target_assignment.id, 'previous', previous_payload, 'updated', next_payload), COALESCE(p_requires_ack, true))
    RETURNING id INTO event_id;
    UPDATE public.message_threads SET last_event_id = event_id, updated_at = NOW() WHERE id = rota_thread_id;
  END IF;

  PERFORM public.record_security_event(target_assignment.company_id, NULL, 'operations.job.update', 'allowed', CASE WHEN event_id IS NULL THEN 'job_assignment_updated' ELSE 'job_updated' END, 'job_assignment', target_assignment.id, 'update', NULL, jsonb_build_object('job_id', target_assignment.job_id, 'event_id', event_id, 'previous', previous_payload, 'updated', next_payload, 'permission_allowed', permission_allowed), 'user');
  RETURN jsonb_build_object('job_id', target_assignment.job_id, 'job_assignment_id', target_assignment.id, 'event_id', event_id, 'status', resulting_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_job_assignment_with_event(
  p_assignment_id uuid,
  p_expected_updated_at timestamptz DEFAULT NULL,
  p_requires_ack boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_assignment public.job_assignments%ROWTYPE;
  target_job public.jobs%ROWTYPE;
  target_shift public.shifts%ROWTYPE;
  actor_role text := public.get_my_role();
  actor_company_id uuid := public.get_my_company_id();
  legacy_allowed boolean := false;
  permission_allowed boolean := false;
  rota_thread_id uuid;
  event_id uuid;
  previous_payload jsonb;
BEGIN
  IF p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'A current assignment version is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO target_assignment FROM public.job_assignments WHERE id = p_assignment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job assignment not found' USING ERRCODE = '42501'; END IF;
  SELECT * INTO target_shift FROM public.shifts WHERE id = target_assignment.shift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shift not found' USING ERRCODE = '42501'; END IF;
  SELECT * INTO target_job FROM public.jobs WHERE id = target_assignment.job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job not found' USING ERRCODE = '42501'; END IF;

  legacy_allowed := COALESCE(
    actor_role = 'manager'
    AND target_assignment.company_id = actor_company_id
    AND target_shift.company_id = actor_company_id
    AND target_job.company_id = actor_company_id,
    false
  );
  BEGIN
    permission_allowed := COALESCE(public.actor_has_permission('operations.job.cancel', target_assignment.company_id, NULL), false);
    IF legacy_allowed IS DISTINCT FROM permission_allowed THEN
      PERFORM public.record_security_event(target_assignment.company_id, NULL, 'operations.job.cancel', CASE WHEN permission_allowed THEN 'allowed' ELSE 'denied' END, 'shadow_permission_mismatch', 'job_assignment', target_assignment.id, 'cancel', NULL, jsonb_build_object('shadow_comparison', 'cancel_job_assignment_with_event', 'legacy_allowed', legacy_allowed, 'permission_allowed', permission_allowed, 'legacy_role', actor_role), 'user');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'ROUTE-001 shadow permission comparison failed for cancel_job_assignment_with_event assignment_id=%: %', p_assignment_id, SQLERRM;
  END;
  IF NOT legacy_allowed THEN RAISE EXCEPTION 'Only managers in the assignment company can cancel job assignments' USING ERRCODE = '42501'; END IF;
  IF target_assignment.status = 'cancelled' THEN RAISE EXCEPTION 'Job assignment is already cancelled' USING ERRCODE = '22023'; END IF;
  IF target_assignment.status NOT IN ('published', 'updated') THEN RAISE EXCEPTION 'Only published job assignments can be cancelled' USING ERRCODE = '22023'; END IF;
  IF target_shift.status NOT IN ('published', 'updated') THEN RAISE EXCEPTION 'Jobs can only be cancelled on a published or updated shift' USING ERRCODE = '22023'; END IF;
  IF target_assignment.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Job assignment changed since it was loaded; refresh before cancelling' USING ERRCODE = '40001';
  END IF;

  previous_payload := jsonb_build_object(
    'job_id', target_assignment.job_id,
    'job_assignment_id', target_assignment.id,
    'reference', target_job.reference,
    'title', target_job.title,
    'sequence', target_assignment.sequence,
    'planned_arrival_at', target_assignment.planned_arrival_at,
    'planned_departure_at', target_assignment.planned_departure_at,
    'expected_duration_minutes', target_assignment.expected_duration_minutes,
    'status', target_assignment.status
  );

  UPDATE public.job_assignments
  SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = auth.uid(), updated_at = NOW()
  WHERE id = target_assignment.id;

  SELECT fe.thread_id INTO rota_thread_id FROM public.fleet_events fe WHERE fe.related_shift_id = target_shift.id AND fe.thread_id IS NOT NULL ORDER BY fe.created_at DESC LIMIT 1;
  IF rota_thread_id IS NULL THEN
    INSERT INTO public.message_threads (company_id, thread_type, subject, driver_id, created_by)
    VALUES (target_shift.company_id, 'rota', 'Rota updates', target_shift.driver_id, auth.uid()) RETURNING id INTO rota_thread_id;
  END IF;
  INSERT INTO public.fleet_events (company_id, thread_id, event_type, priority, actor_id, recipient_driver_id, related_shift_id, title, body, payload, requires_ack)
  VALUES (target_assignment.company_id, rota_thread_id, 'job_cancelled', 'warning', auth.uid(), target_assignment.driver_id, target_assignment.shift_id, 'Job assignment cancelled', format('%s has been cancelled on your shift.', target_job.reference), previous_payload, COALESCE(p_requires_ack, true))
  RETURNING id INTO event_id;
  UPDATE public.message_threads SET last_event_id = event_id, updated_at = NOW() WHERE id = rota_thread_id;

  PERFORM public.record_security_event(target_assignment.company_id, NULL, 'operations.job.cancel', 'allowed', 'job_cancelled', 'job_assignment', target_assignment.id, 'cancel', NULL, jsonb_build_object('job_id', target_assignment.job_id, 'event_id', event_id, 'previous', previous_payload, 'permission_allowed', permission_allowed), 'user');
  RETURN jsonb_build_object('job_id', target_assignment.job_id, 'job_assignment_id', target_assignment.id, 'event_id', event_id, 'status', 'cancelled');
END;
$$;

REVOKE ALL ON FUNCTION public.update_job_assignment_with_event(uuid, text, text, text, text, text, text, text, text, integer, timestamptz, timestamptz, integer, timestamptz, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_job_assignment_with_event(uuid, text, text, text, text, text, text, text, text, integer, timestamptz, timestamptz, integer, timestamptz, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_job_assignment_with_event(uuid, text, text, text, text, text, text, text, text, integer, timestamptz, timestamptz, integer, timestamptz, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_job_assignment_with_event(uuid, timestamptz, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_job_assignment_with_event(uuid, timestamptz, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_job_assignment_with_event(uuid, timestamptz, boolean) TO authenticated;
