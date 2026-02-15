/*
  # Fix Profiles RLS Infinite Recursion

  This migration fixes the infinite recursion issue in the profiles table policies
  by using a security definer function to safely get the current user's company_id.

  1. Changes
    - Create a security definer function to get user's company_id without RLS
    - Drop existing problematic policies
    - Create new non-recursive policies using the helper function

  2. Security
    - Function is security definer but only returns current user's data
    - Policies remain restrictive and check proper ownership
*/

-- Create a security definer function to get current user's company_id
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  user_company_id uuid;
BEGIN
  SELECT company_id INTO user_company_id
  FROM profiles
  WHERE user_id = auth.uid();
  
  RETURN user_company_id;
END;
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "users_view_profiles" ON profiles;
DROP POLICY IF EXISTS "users_view_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_view_company_profiles" ON profiles;
DROP POLICY IF EXISTS "users_update_profiles" ON profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_insert_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_delete_own_profile" ON profiles;

-- Create new SELECT policy without recursion
CREATE POLICY "users_view_own_profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users_view_company_profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    company_id IS NOT NULL 
    AND company_id = get_user_company_id()
  );

-- Create INSERT policy
CREATE POLICY "users_insert_own_profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create UPDATE policy without recursion
CREATE POLICY "users_update_own_profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create DELETE policy
CREATE POLICY "users_delete_own_profile"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
