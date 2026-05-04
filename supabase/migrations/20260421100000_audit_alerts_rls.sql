/*
  # Audit Alerts RLS Policies

  ## Changes
  1. Optimize RLS policies for `alerts` table to prevent recursion and improve performance.
  2. Use `(select auth.uid())` wrapper for `auth.uid()` calls.
  3. Use existing `get_user_company_id()` function where applicable.
*/

-- Drop existing policies to recreate them optimized
DROP POLICY IF EXISTS "Managers can view company alerts" ON alerts;
DROP POLICY IF EXISTS "Managers can update company alerts" ON alerts;

-- Recreate optimized SELECT policy
CREATE POLICY "Managers can view company alerts"
  ON alerts FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM profiles
      WHERE id = (select auth.uid())
      AND role = 'manager'
    )
  );

-- Recreate optimized UPDATE policy
CREATE POLICY "Managers can update company alerts"
  ON alerts FOR UPDATE
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
