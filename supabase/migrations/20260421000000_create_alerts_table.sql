-- Add pmi_alert_days to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS pmi_alert_days integer DEFAULT 14;

-- Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'pmi', 'mot', 'tacho', 'loler', 'insurance', 'defect', 'shift_violation'
  severity text NOT NULL DEFAULT 'warning', -- 'info', 'warning', 'critical'
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  is_dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Managers can view company alerts" ON alerts;
CREATE POLICY "Managers can view company alerts"
  ON alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.company_id = alerts.company_id
    )
  );

DROP POLICY IF EXISTS "Managers can update company alerts" ON alerts;
CREATE POLICY "Managers can update company alerts"
  ON alerts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.company_id = alerts.company_id
    )
  );

-- Add index for performance
CREATE INDEX IF NOT EXISTS alerts_company_id_idx ON alerts(company_id);
CREATE INDEX IF NOT EXISTS alerts_is_dismissed_idx ON alerts(is_dismissed);
CREATE INDEX IF NOT EXISTS alerts_created_at_idx ON alerts(created_at DESC);
