-- ROUTE-001: Add the first shared Portal-to-Driver-App job assignment foundation.
-- Route-provider calculation and Android UI remain separate future slices.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_assignment_status') THEN
    CREATE TYPE public.job_assignment_status AS ENUM ('draft', 'published', 'updated', 'cancelled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reference text NOT NULL,
  title text NOT NULL,
  job_type text NOT NULL DEFAULT 'other' CHECK (job_type IN ('delivery', 'collection', 'service', 'other')),
  customer_name text,
  address_text text NOT NULL,
  contact_name text,
  contact_phone text,
  instructions text,
  manager_notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.job_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  sequence integer NOT NULL DEFAULT 1 CHECK (sequence > 0),
  status public.job_assignment_status NOT NULL DEFAULT 'draft',
  planned_arrival_at timestamptz,
  planned_departure_at timestamptz,
  expected_duration_minutes integer CHECK (expected_duration_minutes IS NULL OR expected_duration_minutes > 0),
  published_at timestamptz,
  published_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (planned_departure_at IS NULL OR planned_arrival_at IS NULL OR planned_departure_at >= planned_arrival_at),
  UNIQUE (shift_id, sequence)
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can manage company jobs" ON public.jobs;
CREATE POLICY "Managers can manage company jobs" ON public.jobs FOR ALL TO authenticated
USING (company_id = public.get_my_company_id() AND public.get_my_role() = 'manager')
WITH CHECK (company_id = public.get_my_company_id() AND public.get_my_role() = 'manager');

DROP POLICY IF EXISTS "Managers can manage company job assignments" ON public.job_assignments;
CREATE POLICY "Managers can manage company job assignments" ON public.job_assignments FOR ALL TO authenticated
USING (company_id = public.get_my_company_id() AND public.get_my_role() = 'manager')
WITH CHECK (company_id = public.get_my_company_id() AND public.get_my_role() = 'manager');

DROP POLICY IF EXISTS "Drivers can view own published job assignments" ON public.job_assignments;
CREATE POLICY "Drivers can view own published job assignments" ON public.job_assignments FOR SELECT TO authenticated
USING (driver_id = auth.uid() AND status IN ('published', 'updated'));

DROP POLICY IF EXISTS "Drivers can view jobs from own assignments" ON public.jobs;
CREATE POLICY "Drivers can view jobs from own assignments" ON public.jobs FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.job_assignments ja
  WHERE ja.job_id = jobs.id AND ja.driver_id = auth.uid() AND ja.status IN ('published', 'updated')
));

CREATE INDEX IF NOT EXISTS jobs_company_created_idx ON public.jobs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS job_assignments_shift_sequence_idx ON public.job_assignments(shift_id, sequence);
CREATE INDEX IF NOT EXISTS job_assignments_driver_status_idx ON public.job_assignments(driver_id, status, planned_arrival_at);

INSERT INTO public.security_permissions (key, area, resource, operation, description, risk_level, requires_audit)
VALUES
  ('operations.job.create', 'operations', 'job', 'create', 'Create planned jobs and shift assignments.', 'high', true),
  ('operations.job.publish', 'operations', 'job', 'publish', 'Publish a planned job assignment to a driver.', 'high', true)
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description, risk_level = EXCLUDED.risk_level, requires_audit = EXCLUDED.requires_audit;

INSERT INTO public.security_role_permissions (role_key, permission_key, effect, scope_level)
VALUES
  ('fleet_administrator', 'operations.job.create', 'allow', 'organisation'),
  ('fleet_administrator', 'operations.job.publish', 'allow', 'organisation')
ON CONFLICT (role_key, permission_key, scope_level) DO UPDATE SET effect = EXCLUDED.effect;

CREATE OR REPLACE FUNCTION public.create_job_assignment_with_event(
  p_shift_id uuid,
  p_reference text,
  p_title text,
  p_job_type text,
  p_address_text text,
  p_customer_name text DEFAULT NULL,
  p_contact_name text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL,
  p_instructions text DEFAULT NULL,
  p_manager_notes text DEFAULT NULL,
  p_sequence integer DEFAULT 1,
  p_planned_arrival_at timestamptz DEFAULT NULL,
  p_planned_departure_at timestamptz DEFAULT NULL,
  p_expected_duration_minutes integer DEFAULT NULL,
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
  created_job_id uuid;
  created_assignment_id uuid;
  rota_thread_id uuid;
  event_id uuid;
BEGIN
  IF NULLIF(trim(p_reference), '') IS NULL OR NULLIF(trim(p_title), '') IS NULL OR NULLIF(trim(p_address_text), '') IS NULL THEN
    RAISE EXCEPTION 'Job reference, title, and address are required' USING ERRCODE = '22023';
  END IF;
  IF p_job_type NOT IN ('delivery', 'collection', 'service', 'other') OR p_sequence < 1 THEN
    RAISE EXCEPTION 'Invalid job type or sequence' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO target_shift FROM public.shifts WHERE id = p_shift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shift not found' USING ERRCODE = '42501'; END IF;
  legacy_allowed := COALESCE(actor_role = 'manager' AND target_shift.company_id = actor_company_id, false);
  BEGIN
    permission_allowed := COALESCE(public.actor_has_permission('operations.job.publish', target_shift.company_id, NULL), false);
    IF legacy_allowed IS DISTINCT FROM permission_allowed THEN
      PERFORM public.record_security_event(target_shift.company_id, NULL, 'operations.job.publish', CASE WHEN permission_allowed THEN 'allowed' ELSE 'denied' END, 'shadow_permission_mismatch', 'shift', target_shift.id, 'publish_job', NULL, jsonb_build_object('shadow_comparison', 'create_job_assignment_with_event', 'legacy_allowed', legacy_allowed, 'permission_allowed', permission_allowed, 'legacy_role', actor_role), 'user');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'ROUTE-001 shadow permission comparison failed for create_job_assignment_with_event shift_id=%: %', p_shift_id, SQLERRM;
  END;
  IF NOT legacy_allowed THEN RAISE EXCEPTION 'Only managers in the shift company can publish job assignments' USING ERRCODE = '42501'; END IF;
  IF target_shift.status NOT IN ('published', 'updated') THEN RAISE EXCEPTION 'Jobs can only be published to a published or updated shift' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.jobs (company_id, reference, title, job_type, customer_name, address_text, contact_name, contact_phone, instructions, manager_notes, created_by)
  VALUES (target_shift.company_id, trim(p_reference), trim(p_title), p_job_type, NULLIF(trim(p_customer_name), ''), trim(p_address_text), NULLIF(trim(p_contact_name), ''), NULLIF(trim(p_contact_phone), ''), NULLIF(trim(p_instructions), ''), NULLIF(trim(p_manager_notes), ''), auth.uid())
  RETURNING id INTO created_job_id;

  INSERT INTO public.job_assignments (company_id, job_id, shift_id, driver_id, vehicle_id, sequence, status, planned_arrival_at, planned_departure_at, expected_duration_minutes, published_at, published_by)
  VALUES (target_shift.company_id, created_job_id, target_shift.id, target_shift.driver_id, target_shift.vehicle_id, p_sequence, 'published', p_planned_arrival_at, p_planned_departure_at, p_expected_duration_minutes, NOW(), auth.uid())
  RETURNING id INTO created_assignment_id;

  SELECT fe.thread_id INTO rota_thread_id FROM public.fleet_events fe WHERE fe.related_shift_id = target_shift.id AND fe.thread_id IS NOT NULL ORDER BY fe.created_at DESC LIMIT 1;
  IF rota_thread_id IS NULL THEN
    INSERT INTO public.message_threads (company_id, thread_type, subject, driver_id, created_by)
    VALUES (target_shift.company_id, 'rota', 'Rota updates', target_shift.driver_id, auth.uid()) RETURNING id INTO rota_thread_id;
  END IF;
  INSERT INTO public.fleet_events (company_id, thread_id, event_type, priority, actor_id, recipient_driver_id, related_shift_id, title, body, payload, requires_ack)
  VALUES (target_shift.company_id, rota_thread_id, 'job_assigned', 'advisory', auth.uid(), target_shift.driver_id, target_shift.id, 'New job assigned', format('%s has been added to your shift.', trim(p_title)), jsonb_build_object('job_id', created_job_id, 'job_assignment_id', created_assignment_id, 'reference', trim(p_reference), 'job_type', p_job_type, 'address_text', trim(p_address_text), 'planned_arrival_at', p_planned_arrival_at, 'planned_departure_at', p_planned_departure_at, 'expected_duration_minutes', p_expected_duration_minutes), COALESCE(p_requires_ack, true))
  RETURNING id INTO event_id;
  UPDATE public.message_threads SET last_event_id = event_id, updated_at = NOW() WHERE id = rota_thread_id;
  PERFORM public.record_security_event(target_shift.company_id, NULL, 'operations.job.publish', 'allowed', 'job_assigned', 'job_assignment', created_assignment_id, 'publish', NULL, jsonb_build_object('job_id', created_job_id, 'event_id', event_id, 'permission_allowed', permission_allowed), 'user');
  RETURN jsonb_build_object('job_id', created_job_id, 'job_assignment_id', created_assignment_id, 'event_id', event_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_job_assignment_with_event(uuid, text, text, text, text, text, text, text, text, text, integer, timestamptz, timestamptz, integer, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_job_assignment_with_event(uuid, text, text, text, text, text, text, text, text, text, integer, timestamptz, timestamptz, integer, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_job_assignment_with_event(uuid, text, text, text, text, text, text, text, text, text, integer, timestamptz, timestamptz, integer, boolean) TO authenticated;
