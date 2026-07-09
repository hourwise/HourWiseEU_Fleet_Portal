-- ROTA-002: Add publish/status/audit semantics to existing shifts.
-- This is additive and preserves current behaviour by marking existing shifts as published.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_status') THEN
    CREATE TYPE shift_status AS ENUM ('draft', 'published', 'updated', 'cancelled');
  END IF;
END $$;

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS status shift_status NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.shifts
SET
  status = 'published',
  published_at = COALESCE(published_at, created_at)
WHERE status IS NULL OR status = 'published';

CREATE TABLE IF NOT EXISTS public.shift_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  previous_status shift_status,
  new_status shift_status,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shift_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can view company shift audit events" ON public.shift_audit_events;
CREATE POLICY "Managers can view company shift audit events"
  ON public.shift_audit_events FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'manager'
    )
  );

DROP POLICY IF EXISTS "Managers can insert company shift audit events" ON public.shift_audit_events;
CREATE POLICY "Managers can insert company shift audit events"
  ON public.shift_audit_events FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'manager'
    )
  );

DROP POLICY IF EXISTS "Drivers can view own published shifts" ON public.shifts;
DROP POLICY IF EXISTS "Drivers can view their own shifts" ON public.shifts;
CREATE POLICY "Drivers can view own published shifts"
  ON public.shifts FOR SELECT
  TO authenticated
  USING (
    driver_id = (SELECT auth.uid())
    AND status IN ('published', 'updated')
  );

CREATE INDEX IF NOT EXISTS shifts_status_idx ON public.shifts(status);
CREATE INDEX IF NOT EXISTS shifts_driver_status_date_idx ON public.shifts(driver_id, status, date);
CREATE INDEX IF NOT EXISTS shift_audit_events_shift_id_idx ON public.shift_audit_events(shift_id);
CREATE INDEX IF NOT EXISTS shift_audit_events_company_created_idx ON public.shift_audit_events(company_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.record_shift_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  payload jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    payload := jsonb_build_object(
      'date', NEW.date,
      'driver_id', NEW.driver_id,
      'vehicle_id', NEW.vehicle_id,
      'start_time', NEW.start_time,
      'end_time', NEW.end_time
    );

    INSERT INTO public.shift_audit_events (
      shift_id,
      company_id,
      actor_id,
      event_type,
      previous_status,
      new_status,
      event_payload
    )
    VALUES (
      NEW.id,
      NEW.company_id,
      actor,
      'created',
      NULL,
      NEW.status,
      payload
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      payload := jsonb_build_object(
        'old_date', OLD.date,
        'new_date', NEW.date,
        'old_driver_id', OLD.driver_id,
        'new_driver_id', NEW.driver_id,
        'old_vehicle_id', OLD.vehicle_id,
        'new_vehicle_id', NEW.vehicle_id,
        'old_start_time', OLD.start_time,
        'new_start_time', NEW.start_time,
        'old_end_time', OLD.end_time,
        'new_end_time', NEW.end_time
      );

      INSERT INTO public.shift_audit_events (
        shift_id,
        company_id,
        actor_id,
        event_type,
        previous_status,
        new_status,
        event_payload
      )
      VALUES (
        NEW.id,
        NEW.company_id,
        actor,
        'status_changed',
        OLD.status,
        NEW.status,
        payload
      );
    ELSIF
      OLD.driver_id IS DISTINCT FROM NEW.driver_id OR
      OLD.vehicle_id IS DISTINCT FROM NEW.vehicle_id OR
      OLD.date IS DISTINCT FROM NEW.date OR
      OLD.start_time IS DISTINCT FROM NEW.start_time OR
      OLD.end_time IS DISTINCT FROM NEW.end_time OR
      OLD.notes IS DISTINCT FROM NEW.notes
    THEN
      payload := jsonb_build_object(
        'old_date', OLD.date,
        'new_date', NEW.date,
        'old_driver_id', OLD.driver_id,
        'new_driver_id', NEW.driver_id,
        'old_vehicle_id', OLD.vehicle_id,
        'new_vehicle_id', NEW.vehicle_id,
        'old_start_time', OLD.start_time,
        'new_start_time', NEW.start_time,
        'old_end_time', OLD.end_time,
        'new_end_time', NEW.end_time
      );

      INSERT INTO public.shift_audit_events (
        shift_id,
        company_id,
        actor_id,
        event_type,
        previous_status,
        new_status,
        event_payload
      )
      VALUES (
        NEW.id,
        NEW.company_id,
        actor,
        'updated',
        OLD.status,
        NEW.status,
        payload
      );
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.shift_audit_events (
      shift_id,
      company_id,
      actor_id,
      event_type,
      previous_status,
      new_status,
      event_payload
    )
    VALUES (
      OLD.id,
      OLD.company_id,
      actor,
      'deleted',
      OLD.status,
      NULL,
      jsonb_build_object(
        'date', OLD.date,
        'driver_id', OLD.driver_id,
        'vehicle_id', OLD.vehicle_id,
        'start_time', OLD.start_time,
        'end_time', OLD.end_time
      )
    );

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS record_shift_audit_event_trigger ON public.shifts;
CREATE TRIGGER record_shift_audit_event_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.record_shift_audit_event();

