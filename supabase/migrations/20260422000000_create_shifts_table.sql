-- Create shifts table for roster/shift planning
CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Managers can manage company shifts"
  ON shifts FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM profiles
      WHERE id = (select auth.uid())
      AND role = 'manager'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM profiles
      WHERE id = (select auth.uid())
      AND role = 'manager'
    )
  );

CREATE POLICY "Drivers can view their own shifts"
  ON shifts FOR SELECT
  TO authenticated
  USING (
    driver_id = (select auth.uid())
  );

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS shifts_company_id_idx ON shifts(company_id);
CREATE INDEX IF NOT EXISTS shifts_driver_id_idx ON shifts(driver_id);
CREATE INDEX IF NOT EXISTS shifts_date_idx ON shifts(date);

-- Trigger for updated_at
CREATE TRIGGER update_shifts_updated_at
  BEFORE UPDATE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
