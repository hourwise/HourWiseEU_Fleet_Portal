-- EVENT-001-DESIGN: Additive operational event spine foundation.
-- No existing messaging UI or rota runtime enforcement is switched by this migration.

CREATE TABLE IF NOT EXISTS public.message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  thread_type text NOT NULL CHECK (thread_type IN ('broadcast', 'direct', 'system', 'rota')),
  subject text,
  driver_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_event_id uuid,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fleet_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES public.message_threads(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  priority text NOT NULL DEFAULT 'info' CHECK (priority IN ('info', 'advisory', 'warning', 'critical', 'emergency')),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_driver_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  related_shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  related_message_id uuid,
  title text NOT NULL,
  body text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  requires_ack boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
    AND table_name = 'fleet_events'
    AND constraint_name = 'fleet_events_related_message_id_fkey'
  ) THEN
    ALTER TABLE public.fleet_events
      ADD CONSTRAINT fleet_events_related_message_id_fkey
      FOREIGN KEY (related_message_id)
      REFERENCES public.messages(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
    AND table_name = 'message_threads'
    AND constraint_name = 'message_threads_last_event_id_fkey'
  ) THEN
    ALTER TABLE public.message_threads
      ADD CONSTRAINT message_threads_last_event_id_fkey
      FOREIGN KEY (last_event_id)
      REFERENCES public.fleet_events(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.driver_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.fleet_events(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, driver_id)
);

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS thread_id uuid REFERENCES public.message_threads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fleet_event_id uuid REFERENCES public.fleet_events(id) ON DELETE SET NULL;

ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_acknowledgements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can manage company message threads" ON public.message_threads;
CREATE POLICY "Managers can manage company message threads"
  ON public.message_threads FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'manager'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'manager'
    )
  );

DROP POLICY IF EXISTS "Drivers can view assigned or broadcast message threads" ON public.message_threads;
CREATE POLICY "Drivers can view assigned or broadcast message threads"
  ON public.message_threads FOR SELECT
  TO authenticated
  USING (
    driver_id = (SELECT auth.uid())
    OR (
      thread_type = 'broadcast'
      AND company_id IN (
        SELECT company_id
        FROM public.profiles
        WHERE id = (SELECT auth.uid())
        AND role = 'driver'
      )
    )
  );

DROP POLICY IF EXISTS "Managers can manage company fleet events" ON public.fleet_events;
CREATE POLICY "Managers can manage company fleet events"
  ON public.fleet_events FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'manager'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'manager'
    )
  );

DROP POLICY IF EXISTS "Drivers can view assigned or broadcast fleet events" ON public.fleet_events;
CREATE POLICY "Drivers can view assigned or broadcast fleet events"
  ON public.fleet_events FOR SELECT
  TO authenticated
  USING (
    recipient_driver_id = (SELECT auth.uid())
    OR (
      recipient_driver_id IS NULL
      AND company_id IN (
        SELECT company_id
        FROM public.profiles
        WHERE id = (SELECT auth.uid())
        AND role = 'driver'
      )
    )
  );

DROP POLICY IF EXISTS "Managers can view company driver acknowledgements" ON public.driver_acknowledgements;
CREATE POLICY "Managers can view company driver acknowledgements"
  ON public.driver_acknowledgements FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'manager'
    )
  );

DROP POLICY IF EXISTS "Drivers can manage own acknowledgements" ON public.driver_acknowledgements;
CREATE POLICY "Drivers can manage own acknowledgements"
  ON public.driver_acknowledgements FOR ALL
  TO authenticated
  USING (
    driver_id = (SELECT auth.uid())
  )
  WITH CHECK (
    driver_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.fleet_events fe
      WHERE fe.id = driver_acknowledgements.event_id
      AND fe.company_id = driver_acknowledgements.company_id
      AND (
        fe.recipient_driver_id = (SELECT auth.uid())
        OR fe.recipient_driver_id IS NULL
      )
    )
    AND company_id IN (
      SELECT company_id
      FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'driver'
    )
  );

CREATE INDEX IF NOT EXISTS message_threads_company_type_idx ON public.message_threads(company_id, thread_type);
CREATE INDEX IF NOT EXISTS message_threads_driver_idx ON public.message_threads(driver_id);
CREATE INDEX IF NOT EXISTS fleet_events_company_created_idx ON public.fleet_events(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS fleet_events_recipient_created_idx ON public.fleet_events(recipient_driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS fleet_events_thread_created_idx ON public.fleet_events(thread_id, created_at);
CREATE INDEX IF NOT EXISTS fleet_events_related_shift_idx ON public.fleet_events(related_shift_id);
CREATE INDEX IF NOT EXISTS driver_acknowledgements_event_idx ON public.driver_acknowledgements(event_id);
CREATE INDEX IF NOT EXISTS driver_acknowledgements_driver_idx ON public.driver_acknowledgements(driver_id, acknowledged_at DESC);
CREATE INDEX IF NOT EXISTS messages_thread_id_idx ON public.messages(thread_id);
CREATE INDEX IF NOT EXISTS messages_fleet_event_id_idx ON public.messages(fleet_event_id);

CREATE OR REPLACE VIEW public.driver_visible_fleet_events
WITH (security_invoker = true) AS
SELECT
  fe.id,
  fe.company_id,
  fe.thread_id,
  fe.event_type,
  fe.priority,
  fe.actor_id,
  fe.recipient_driver_id,
  fe.related_shift_id,
  fe.related_message_id,
  fe.title,
  fe.body,
  fe.payload,
  fe.requires_ack,
  fe.expires_at,
  fe.created_at
FROM public.fleet_events fe
WHERE
  fe.recipient_driver_id = (SELECT auth.uid())
  OR (
    fe.recipient_driver_id IS NULL
    AND fe.company_id IN (
      SELECT company_id
      FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'driver'
    )
  );
