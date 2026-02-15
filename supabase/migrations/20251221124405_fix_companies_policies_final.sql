/*
  # Fix Companies RLS Policies - Final

  ## Problem
  Old policies still exist in database that reference helper functions.
  These are interfering with the correct policies.

  ## Changes
  1. Drop ALL existing policies on companies table
  2. Drop the helper functions that cause recursion
  3. Create simple, direct policies using only auth.uid()

  ## New Policies
  - INSERT: Any authenticated user can create a company if they set created_by to their own ID
  - SELECT: Any authenticated user can view any company (needed for drivers to see their company)
  - UPDATE: Only the creator can update their company
*/

-- Drop ALL existing company policies
DROP POLICY IF EXISTS "Allow authenticated users to create a company" ON companies;
DROP POLICY IF EXISTS "Managers can view their own company" ON companies;
DROP POLICY IF EXISTS "Managers can update their own company" ON companies;
DROP POLICY IF EXISTS "anyone_can_create_company" ON companies;
DROP POLICY IF EXISTS "authenticated_can_view_companies" ON companies;
DROP POLICY IF EXISTS "creator_can_update_company" ON companies;
DROP POLICY IF EXISTS "View own company" ON companies;
DROP POLICY IF EXISTS "Create company" ON companies;
DROP POLICY IF EXISTS "Update own company" ON companies;

-- Drop helper functions that may cause issues
DROP FUNCTION IF EXISTS get_my_role() CASCADE;
DROP FUNCTION IF EXISTS get_my_company_id() CASCADE;

-- Create clean, simple policies
CREATE POLICY "authenticated_users_insert_company"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "authenticated_users_view_companies"
  ON companies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "creator_updates_company"
  ON companies FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);
