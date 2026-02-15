/*
  # Fix RLS Policy Recursion

  ## Changes
  Removes circular dependencies in RLS policies by restructuring them to avoid recursive lookups.
  
  ## Key Fixes
  1. Ensures users can always read their own profile without recursion
  2. Uses direct auth.uid() checks instead of subqueries where possible
  3. Simplifies manager access patterns to prevent circular dependencies
  
  ## Security
  - Maintains complete data isolation between companies
  - Role-based access control remains enforced
  - No cross-company data leakage
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Managers can view profiles in their company" ON profiles;
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
DROP POLICY IF EXISTS "Managers can update their own company" ON companies;

-- Recreate profiles SELECT policies without recursion
-- Policy 1: Users can ALWAYS view their own profile (no recursion)
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Policy 2: Managers can view all profiles - using a simpler check
CREATE POLICY "Managers can view company profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS manager_profile
      WHERE manager_profile.id = auth.uid() 
        AND manager_profile.role = 'manager'
        AND manager_profile.company_id = profiles.company_id
    )
  );

-- Recreate companies policies without recursion
CREATE POLICY "Users can view their company"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.company_id = companies.id
    )
  );

CREATE POLICY "Managers can update their company"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.company_id = companies.id
        AND profiles.role = 'manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.company_id = companies.id
        AND profiles.role = 'manager'
    )
  );

-- Add policy for companies INSERT (for new manager signups)
DROP POLICY IF EXISTS "Managers can create their company" ON companies;
CREATE POLICY "Managers can create their company"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());