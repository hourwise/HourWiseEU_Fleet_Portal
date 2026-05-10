-- Create incidents table for Accidents & Workplace Injuries
CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL, -- Nullable for workplace injuries
  type text NOT NULL, -- 'accident', 'incident', 'injury'
  occurred_at timestamptz NOT NULL,
  location text NOT NULL,
  description text NOT NULL,
  has_injury boolean DEFAULT false,
  injury_details text,
  is_third_party_involved boolean DEFAULT false,
  third_party_details jsonb DEFAULT '{}'::jsonb, -- {name, contact, reg, insurance}
  police_ref text,
  photo_urls text[] DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'reported', -- 'reported', 'investigating', 'closed'
  manager_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

-- Managers can manage everything for their company
DROP POLICY IF EXISTS "Managers can manage company incidents" ON incidents;
CREATE POLICY "Managers can manage company incidents"
  ON incidents FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (select auth.uid()) AND role = 'manager'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (select auth.uid()) AND role = 'manager'
    )
  );

-- Drivers can report and see their own history
DROP POLICY IF EXISTS "Drivers can report incidents" ON incidents;
CREATE POLICY "Drivers can report incidents"
  ON incidents FOR INSERT
  TO authenticated
  WITH CHECK (driver_id = (select auth.uid()));

DROP POLICY IF EXISTS "Drivers can view their own incidents" ON incidents;
CREATE POLICY "Drivers can view their own incidents"
  ON incidents FOR SELECT
  TO authenticated
  USING (driver_id = (select auth.uid()));

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_incidents_company_date ON incidents(company_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_vehicle_id ON incidents(vehicle_id);

-- Trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_incidents_updated_at'
  ) THEN
    CREATE TRIGGER update_incidents_updated_at
      BEFORE UPDATE ON incidents
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
