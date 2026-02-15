/*
  # Fix Profile RLS - No Recursion

  ## Problem
  Any policy that queries the profiles table causes infinite recursion during INSERT/SELECT.
  
  ## Solution
  Make ALL policies use only direct auth.uid() checks without any subqueries to profiles.

  ## Changes
  1. Drop ALL existing policies first
  2. Drop the security definer function
  3. Create minimal policies using ONLY auth.uid()
*/

-- Drop all existing policies on profiles first
DROP POLICY IF EXISTS "Users view own profile" ON profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
DROP POLICY IF EXISTS "View same company profiles" ON profiles;
DROP POLICY IF EXISTS "Managers can view company profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- Drop all company policies that depend on the function
DROP POLICY IF EXISTS "View own company" ON companies;
DROP POLICY IF EXISTS "Create company" ON companies;
DROP POLICY IF EXISTS "Update own company" ON companies;
DROP POLICY IF EXISTS "Users can view their company" ON companies;
DROP POLICY IF EXISTS "Managers can update their company" ON companies;
DROP POLICY IF EXISTS "Managers can create their company" ON companies;

-- Now drop the function
DROP FUNCTION IF EXISTS is_manager_of_company(uuid) CASCADE;

-- PROFILES: Use ONLY auth.uid() - no subqueries to profiles at all

CREATE POLICY "select_own_profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "insert_own_profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "update_own_profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- COMPANIES: Simple policies without profile lookups

CREATE POLICY "anyone_can_create_company"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "authenticated_can_view_companies"
  ON companies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "creator_can_update_company"
  ON companies FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);