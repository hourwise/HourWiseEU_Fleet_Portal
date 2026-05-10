-- Infringement management table
-- Formalises detected violations from work_sessions into a managed record
-- with debrief workflow and optional training linkage.

CREATE TABLE IF NOT EXISTS infringements (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid REFERENCES companies(id)         ON DELETE CASCADE  NOT NULL,
  driver_id           uuid REFERENCES profiles(id)          ON DELETE CASCADE  NOT NULL,
  session_id          uuid REFERENCES work_sessions(id)     ON DELETE SET NULL,
  violation_type      text NOT NULL,                        -- raw string from compliance_violations
  regulation          text NOT NULL DEFAULT 'REG_561'
    CHECK (regulation IN ('REG_561', 'WTD', 'DOMESTIC', 'OTHER')),
  severity            text NOT NULL DEFAULT 'minor'
    CHECK (severity IN ('minor', 'serious', 'very_serious')),
  occurred_at         date NOT NULL,
  status              text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'debriefed', 'closed')),
  driver_statement    text,
  manager_notes       text,
  debriefed_at        timestamptz,
  debriefed_by        uuid REFERENCES auth.users(id)        ON DELETE SET NULL,
  training_record_id  uuid REFERENCES training_records(id)  ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now(),
  created_by          uuid REFERENCES auth.users(id)        ON DELETE SET NULL
);

-- RLS
ALTER TABLE infringements ENABLE ROW LEVEL SECURITY;

-- Managers: full access within their company
DROP POLICY IF EXISTS "infringements_manager_all" ON infringements;
CREATE POLICY "infringements_manager_all" ON infringements
  FOR ALL TO authenticated
  USING (
    get_my_role() = 'manager'
    AND company_id = get_my_company_id()
  )
  WITH CHECK (
    get_my_role() = 'manager'
    AND company_id = get_my_company_id()
  );

-- Drivers: read-only view of their own infringements (transparency / debrief copy)
DROP POLICY IF EXISTS "infringements_driver_select" ON infringements;
CREATE POLICY "infringements_driver_select" ON infringements
  FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_infringements_company_status
  ON infringements (company_id, status, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_infringements_driver
  ON infringements (driver_id, status);
