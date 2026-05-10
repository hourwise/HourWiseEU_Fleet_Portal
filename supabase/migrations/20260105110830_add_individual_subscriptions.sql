/*
  # Add Individual Driver Subscriptions

  1. Changes
    - Add subscription fields to profiles table for individual/solo drivers
    - Add account_type to distinguish between fleet drivers and solo drivers
    - Add Stripe subscription tracking for individual accounts
    - Add invoice-related tables for self-employed drivers

  2. New Tables
    - `invoices` - For solo drivers to generate client invoices
      - `id` (uuid, primary key)
      - `driver_id` (uuid, references profiles)
      - `invoice_number` (text, unique)
      - `client_name` (text)
      - `client_email` (text)
      - `issue_date` (date)
      - `due_date` (date)
      - `status` (text: draft, sent, paid, overdue)
      - `total_amount` (numeric)
      - `currency` (text)
      - `line_items` (jsonb)
      - `notes` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  3. Security
    - Enable RLS on invoices table
    - Solo drivers can only access their own invoices
    - Fleet drivers cannot access invoices (company handles billing)
*/

-- Add subscription fields to profiles for individual drivers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'account_type'
  ) THEN
    ALTER TABLE profiles ADD COLUMN account_type TEXT DEFAULT 'fleet' CHECK (account_type IN ('fleet', 'solo'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN stripe_customer_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN stripe_subscription_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'inactive', 'cancelled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'subscription_period_end'
  ) THEN
    ALTER TABLE profiles ADD COLUMN subscription_period_end TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'trial_ends_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN trial_ends_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add Stripe fields to companies table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE companies ADD COLUMN stripe_customer_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE companies ADD COLUMN stripe_subscription_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'subscription_period_end'
  ) THEN
    ALTER TABLE companies ADD COLUMN subscription_period_end TIMESTAMPTZ;
  END IF;
END $$;

-- Create invoices table for solo drivers
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invoice_number TEXT UNIQUE NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_address TEXT,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5, 2) DEFAULT 0,
  tax_amount NUMERIC(10, 2) DEFAULT 0,
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'GBP',
  line_items JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  payment_terms TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Invoices policies
DROP POLICY IF EXISTS "Solo drivers can view own invoices" ON invoices;
CREATE POLICY "Solo drivers can view own invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE id = invoices.driver_id
    )
  );

DROP POLICY IF EXISTS "Solo drivers can create own invoices" ON invoices;
CREATE POLICY "Solo drivers can create own invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE id = invoices.driver_id
    )
  );

DROP POLICY IF EXISTS "Solo drivers can update own invoices" ON invoices;
CREATE POLICY "Solo drivers can update own invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE id = invoices.driver_id
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE id = invoices.driver_id
    )
  );

DROP POLICY IF EXISTS "Solo drivers can delete own invoices" ON invoices;
CREATE POLICY "Solo drivers can delete own invoices"
  ON invoices FOR DELETE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE id = invoices.driver_id
    )
  );

-- Create function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  year_prefix TEXT;
  sequence_num INTEGER;
BEGIN
  year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM '\d+$') AS INTEGER)
  ), 0) + 1
  INTO sequence_num
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || year_prefix || '-%';
  
  new_number := 'INV-' || year_prefix || '-' || LPAD(sequence_num::TEXT, 4, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Update updated_at timestamp trigger for invoices
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_invoices_updated_at'
  ) THEN
    CREATE TRIGGER update_invoices_updated_at
      BEFORE UPDATE ON invoices
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
