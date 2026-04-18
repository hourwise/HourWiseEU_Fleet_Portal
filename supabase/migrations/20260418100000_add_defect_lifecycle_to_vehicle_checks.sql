-- Add defect resolution lifecycle tracking to vehicle_checks
-- Managers can move defects from reported → in_progress → fixed
-- and add workshop notes alongside each status change.

ALTER TABLE vehicle_checks
  ADD COLUMN IF NOT EXISTS defect_lifecycle_status text
    DEFAULT 'reported'
    CHECK (defect_lifecycle_status IN ('reported', 'in_progress', 'fixed')),
  ADD COLUMN IF NOT EXISTS resolution_notes text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Back-fill existing defect rows so they have an explicit status
UPDATE vehicle_checks
SET defect_lifecycle_status = 'reported'
WHERE check_status = 'defect'
  AND defect_lifecycle_status IS NULL;

-- Pass checks don't need a lifecycle status — leave NULL so the
-- UI can distinguish "pass (no defect tracking needed)" clearly.
UPDATE vehicle_checks
SET defect_lifecycle_status = NULL
WHERE check_status = 'pass';

-- Index to speed up "open defects per company" queries used on the fleet page
CREATE INDEX IF NOT EXISTS idx_vehicle_checks_open_defects
  ON vehicle_checks (company_id, reg_number, defect_lifecycle_status)
  WHERE check_status = 'defect' AND defect_lifecycle_status <> 'fixed';
