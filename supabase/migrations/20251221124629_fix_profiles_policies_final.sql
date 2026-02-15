/*
  # Fix Profiles RLS Policies - Final

  ## Problem
  Current policies are too restrictive and prevent:
  - Managers from viewing/updating driver profiles
  - Proper company hierarchy access
  
  ## Changes
  1. Drop all existing profiles policies
  2. Create comprehensive policies that support:
     - Self-access (users can manage their own profile)
     - Manager access (managers can view/update profiles in their company)

  ## New Policies
  - INSERT: Users can create their own profile
  - SELECT: Users can view their own profile OR profiles in their company
  - UPDATE: Users can update their own profile OR managers can update profiles in their company
  - DELETE: Users can delete their own profile
*/

-- Drop ALL existing profiles policies
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;
DROP POLICY IF EXISTS "Allow driver to update their own profile" ON profiles;
DROP POLICY IF EXISTS "Managers can view drivers in their company" ON profiles;
DROP POLICY IF EXISTS "Managers can update drivers in their company" ON profiles;

-- INSERT: Users can create their own profile
CREATE POLICY "users_insert_own_profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- SELECT: Users can view their own profile OR profiles in same company
CREATE POLICY "users_view_profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR 
    company_id IN (
      SELECT company_id 
      FROM profiles 
      WHERE user_id = auth.uid()
    )
  );

-- UPDATE: Users can update their own profile OR managers can update company profiles
CREATE POLICY "users_update_profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR
    (
      -- User is a manager
      EXISTS (
        SELECT 1 FROM profiles manager_profile
        WHERE manager_profile.user_id = auth.uid()
        AND manager_profile.role = 'manager'
        AND manager_profile.company_id = profiles.company_id
      )
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR
    (
      -- User is a manager in same company
      EXISTS (
        SELECT 1 FROM profiles manager_profile
        WHERE manager_profile.user_id = auth.uid()
        AND manager_profile.role = 'manager'
        AND manager_profile.company_id = profiles.company_id
      )
    )
  );

-- DELETE: Users can delete their own profile
CREATE POLICY "users_delete_own_profile"
  ON profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
