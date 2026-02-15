/*
  # HourWise EU Fleet Management Schema

  ## Overview
  This migration creates the core database structure for a B2B fleet management system
  with strict company data isolation using Row Level Security.

  ## New Tables
  
  ### 1. companies
  Stores fleet company information and unique link codes for driver onboarding.
  - `id` (uuid, primary key) - Unique company identifier
  - `name` (text) - Company name
  - `auth_code` (text, unique) - 8-character alphanumeric link code for driver onboarding
  - `auth_code_expires_at` (timestamptz) - Expiration timestamp for the auth code (7 days)
  - `subscription_status` (text) - Subscription status (active, inactive, trial)
  - `max_drivers` (integer) - Maximum number of drivers allowed
  - `created_at` (timestamptz) - Company creation timestamp
  - `created_by` (uuid) - User who created the company

  ### 2. profiles
  Extends Supabase Auth users with role and company association.
  - `id` (uuid, primary key) - Links to auth.users
  - `email` (text) - User email
  - `role` (text) - User role (driver or manager)
  - `company_id` (uuid, foreign key) - Links to companies table
  - `full_name` (text) - Driver/Manager full name
  - `driver_license_number` (text) - Driver's license number (for drivers only)
  - `is_active` (boolean) - Account active status
  - `created_at` (timestamptz) - Profile creation timestamp

  ### 3. driver_logs
  Stores driver activity logs for hours of service compliance.
  - `id` (uuid, primary key) - Unique log identifier
  - `driver_id` (uuid, foreign key) - Links to profiles
  - `company_id` (uuid, foreign key) - Links to companies (for efficient querying)
  - `activity_type` (text) - Type of activity (driving, work, rest, available, break)
  - `start_time` (timestamptz) - Activity start time
  - `end_time` (timestamptz) - Activity end time (null if ongoing)
  - `duration_minutes` (integer) - Calculated duration
  - `location_start` (text) - Starting location
  - `location_end` (text) - Ending location
  - `vehicle_id` (text) - Vehicle identifier
  - `notes` (text) - Additional notes
  - `status_code` (text) - Compliance status (ok, warning, violation)
  - `infraction_type` (text) - Type of infraction if any
  - `created_at` (timestamptz) - Log creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  
  ### Row Level Security (RLS)
  All tables have RLS enabled with strict policies:
  
  #### companies table:
  - Managers can only view their own company
  - Only authenticated users can read their company data
  
  #### profiles table:
  - Users can view their own profile
  - Managers can view all profiles in their company
  - Users can update their own profile
  
  #### driver_logs table:
  - Drivers can only read/write their own logs
  - Managers can only read logs from drivers in their company
  - All operations are restricted by company_id for complete data isolation

  ## Important Notes
  1. The auth_code in companies table is unique and time-limited for security
  2. All driver_logs entries must have a company_id to ensure proper RLS enforcement
  3. The profiles table links Supabase Auth (auth.users) with company membership
  4. Indexes are created on foreign keys and frequently queried columns for performance
*/

-- Create enum types for better data integrity
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('driver', 'manager');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'inactive', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE activity_type AS ENUM ('driving', 'work', 'rest', 'available', 'break');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE status_code AS ENUM ('ok', 'warning', 'violation');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 1. Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  auth_code text UNIQUE NOT NULL,
  auth_code_expires_at timestamptz NOT NULL,
  subscription_status subscription_status DEFAULT 'trial',
  max_drivers integer DEFAULT 5,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- 2. Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role user_role NOT NULL,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  driver_license_number text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 3. Create driver_logs table
CREATE TABLE IF NOT EXISTS driver_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  activity_type activity_type NOT NULL,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  duration_minutes integer,
  location_start text,
  location_end text,
  vehicle_id text,
  notes text,
  status_code status_code DEFAULT 'ok',
  infraction_type text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_driver_logs_driver_id ON driver_logs(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_logs_company_id ON driver_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_driver_logs_start_time ON driver_logs(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_driver_logs_status_code ON driver_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_companies_auth_code ON companies(auth_code);

-- Enable Row Level Security
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for companies table
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
CREATE POLICY "Users can view their own company"
  ON companies FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers can update their own company" ON companies;
CREATE POLICY "Managers can update their own company"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role = 'manager'
    )
  )
  WITH CHECK (
    id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- RLS Policies for profiles table
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Managers can view profiles in their company" ON profiles;
CREATE POLICY "Managers can view profiles in their company"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- RLS Policies for driver_logs table
DROP POLICY IF EXISTS "Drivers can view their own logs" ON driver_logs;
CREATE POLICY "Drivers can view their own logs"
  ON driver_logs FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid());

DROP POLICY IF EXISTS "Managers can view logs in their company" ON driver_logs;
CREATE POLICY "Managers can view logs in their company"
  ON driver_logs FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

DROP POLICY IF EXISTS "Drivers can insert their own logs" ON driver_logs;
CREATE POLICY "Drivers can insert their own logs"
  ON driver_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    driver_id = auth.uid() 
    AND company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Drivers can update their own logs" ON driver_logs;
CREATE POLICY "Drivers can update their own logs"
  ON driver_logs FOR UPDATE
  TO authenticated
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

DROP POLICY IF EXISTS "Drivers can delete their own logs" ON driver_logs;
CREATE POLICY "Drivers can delete their own logs"
  ON driver_logs FOR DELETE
  TO authenticated
  USING (driver_id = auth.uid());

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for driver_logs
DROP TRIGGER IF EXISTS update_driver_logs_updated_at ON driver_logs;
CREATE TRIGGER update_driver_logs_updated_at
  BEFORE UPDATE ON driver_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to generate unique auth codes
CREATE OR REPLACE FUNCTION generate_auth_code()
RETURNS text AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create function to validate and use auth code
CREATE OR REPLACE FUNCTION validate_auth_code(code text)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;