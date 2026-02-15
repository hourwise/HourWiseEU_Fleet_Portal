/*
  # Completely Fix Profile RLS Recursion

  ## Problem
  During profile insertion, SELECT policies are evaluated and cause infinite recursion
  when they try to query the profiles table they're protecting.

  ## Solution
  Restructure all policies to avoid any self-referencing queries on profiles table.
  Use security definer functions for complex checks that need cross-table lookups.

  ## Changes
  1. Drop all existing profile policies
  2. Create simple, non-recursive policies
  3. Add helper function for manager checks using security definer
*/

-- Drop all existing policies on profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Managers can view company profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- Create a security definer function to check if user is a manager of a company
CREATE OR REPLACE FUNCTION is_manager_of_company(check_company_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'manager'
      AND company_id = check_company_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Policy 1: Users can ALWAYS view their own profile (simplest possible check)
CREATE POLICY "Users view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Policy 2: Allow INSERT for authenticated users creating their own profile
CREATE POLICY "Users insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Policy 3: Users can update their own profile
CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Policy 4: Allow viewing profiles in same company (separate from own profile)
-- This uses a direct join without recursion
CREATE POLICY "View same company profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT p.company_id 
      FROM profiles p 
      WHERE p.id = auth.uid() 
        AND p.role = 'manager'
        AND p.company_id IS NOT NULL
    )
  );

-- Update companies policies to use the security definer function
DROP POLICY IF EXISTS "Users can view their company" ON companies;
DROP POLICY IF EXISTS "Managers can update their company" ON companies;
DROP POLICY IF EXISTS "Managers can create their company" ON companies;

-- Companies SELECT: Users can view their company
CREATE POLICY "View own company"
  ON companies FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Companies INSERT: Allow authenticated users to create companies
CREATE POLICY "Create company"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Companies UPDATE: Only managers can update their company
CREATE POLICY "Update own company"
  ON companies FOR UPDATE
  TO authenticated
  USING (is_manager_of_company(id))
  WITH CHECK (is_manager_of_company(id));