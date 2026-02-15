/*
  # Comprehensive Security Fixes for HourWise EU

  ## Overview
  This migration addresses multiple security and performance issues identified by Supabase security advisor.

  ## Changes Made

  ### 1. Add Missing Indexes on Foreign Keys
  Performance optimization for foreign key lookups:
  - `companies.created_by` - Index for created_by foreign key
  - `pay_configurations.user_id` - Index for user_id foreign key  
  - `work_sessions.user_id` - Index for user_id foreign key

  ### 2. Fix RLS Policy Performance
  Wrapped all `auth.uid()` calls with `(select auth.uid())` to prevent re-evaluation per row.
  This significantly improves query performance at scale by evaluating the auth function once.

  ### 3. Remove Duplicate Permissive Policies
  Consolidated duplicate policies on:
  - `pay_configurations` - Removed old individual CRUD policies, kept consolidated policy
  - `work_sessions` - Removed old individual CRUD policies, kept consolidated policy
  - `profiles` - Kept both necessary SELECT policies (own + company)

  ### 4. Fix Function Search Path
  Updated `validate_auth_code` function to use immutable search path with STABLE and SET search_path.

  ## Security Notes
  - All RLS policies are now optimized for performance
  - No duplicate policies remain that could cause confusion
  - All foreign keys are properly indexed
  - Function security is hardened with immutable search path
*/

-- ============================================================================
-- 1. ADD MISSING INDEXES ON FOREIGN KEYS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_companies_created_by ON companies(created_by);
CREATE INDEX IF NOT EXISTS idx_pay_configurations_user_id ON pay_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_user_id ON work_sessions(user_id);

-- ============================================================================
-- 2. FIX FUNCTION SEARCH PATH FOR validate_auth_code
-- ============================================================================

DROP FUNCTION IF EXISTS validate_auth_code(text);

CREATE FUNCTION validate_auth_code(code text)
RETURNS uuid AS $$
DECLARE
  company_record RECORD;
BEGIN
  SELECT id, auth_code_expires_at, max_drivers
  INTO company_record
  FROM companies
  WHERE auth_code = code
    AND auth_code_expires_at > now()
    AND subscription_status IN ('trial', 'active');
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired auth code';
  END IF;
  
  -- Check if company has reached max drivers
  IF (SELECT COUNT(*) FROM profiles WHERE company_id = company_record.id AND role = 'driver') >= company_record.max_drivers THEN
    RAISE EXCEPTION 'Company has reached maximum number of drivers';
  END IF;
  
  RETURN company_record.id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================================
-- 3. FIX PAY_CONFIGURATIONS POLICIES
-- Remove duplicate policies and recreate with optimized auth checks
-- ============================================================================

-- Drop all old policies
DROP POLICY IF EXISTS "Users can view own pay config" ON pay_configurations;
DROP POLICY IF EXISTS "Users can insert own pay config" ON pay_configurations;
DROP POLICY IF EXISTS "Users can update own pay config" ON pay_configurations;
DROP POLICY IF EXISTS "Users can delete own pay config" ON pay_configurations;
DROP POLICY IF EXISTS "Users can manage their own pay settings" ON pay_configurations;

-- Create single optimized policy for all operations
CREATE POLICY "Users can manage their own pay settings"
  ON pay_configurations
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================================================
-- 4. FIX WORK_SESSIONS POLICIES
-- Remove duplicate policies and recreate with optimized auth checks
-- ============================================================================

-- Drop all old policies
DROP POLICY IF EXISTS "Users can view own sessions" ON work_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON work_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON work_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON work_sessions;
DROP POLICY IF EXISTS "Drivers can manage their own work sessions" ON work_sessions;

-- Create single optimized policy for all operations
CREATE POLICY "Drivers can manage their own work sessions"
  ON work_sessions
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================================================
-- 5. FIX PROFILES POLICIES
-- Update existing policies with optimized auth checks
-- ============================================================================

-- Drop and recreate with optimized auth checks
DROP POLICY IF EXISTS "users_view_own_profile" ON profiles;
CREATE POLICY "users_view_own_profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "users_view_company_profiles" ON profiles;
CREATE POLICY "users_view_company_profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM profiles 
      WHERE user_id = (select auth.uid()) AND role = 'manager'
    )
  );

DROP POLICY IF EXISTS "users_insert_own_profile" ON profiles;
CREATE POLICY "users_insert_own_profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
CREATE POLICY "users_update_own_profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "users_delete_own_profile" ON profiles;
CREATE POLICY "users_delete_own_profile"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- 6. FIX COMPANIES POLICIES
-- Update existing policies with optimized auth checks
-- ============================================================================

DROP POLICY IF EXISTS "authenticated_users_insert_company" ON companies;
CREATE POLICY "authenticated_users_insert_company"
  ON companies
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "creator_updates_company" ON companies;
CREATE POLICY "creator_updates_company"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (created_by = (select auth.uid()))
  WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "users_view_own_company" ON companies;
CREATE POLICY "users_view_own_company"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT company_id 
      FROM profiles 
      WHERE user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- 7. FIX BUSINESS_PROFILES POLICIES
-- Update existing policies with optimized auth checks
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert, view, update, and delete their own business p" ON business_profiles;
CREATE POLICY "Users can manage their own business profile"
  ON business_profiles
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));
