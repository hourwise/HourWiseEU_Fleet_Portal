/*
  # Fix RLS policies for driver_documents and vehicle_documents

  ## Problem
  Both tables were created via the Supabase dashboard with RLS enabled but
  without any permissive policies. Postgres denies every operation by default
  when RLS is enabled and no matching policy exists.

  ## Fix
  Add full CRUD policies so that:

  ### driver_documents
  - Drivers   → SELECT their own documents (user_id = auth.uid())
  - Managers  → SELECT / INSERT / UPDATE / DELETE documents that belong to
                drivers in their company (company_id match + manager role)

  ### vehicle_documents
  - Managers  → SELECT / INSERT / UPDATE / DELETE documents that belong to
                vehicles in their company (company_id match + manager role)

  ### Storage buckets (driver-documents, vehicle-documents)
  - Managers can upload, download, and delete objects scoped to their company_id
    prefix path: {company_id}/{driver_or_vehicle_id}/{filename}
*/

-- ============================================================================
-- DRIVER DOCUMENTS
-- ============================================================================

-- Ensure RLS is enabled (safe to run even if already enabled)
ALTER TABLE driver_documents ENABLE ROW LEVEL SECURITY;

-- Drop any old policies to avoid conflicts
DROP POLICY IF EXISTS "Drivers can view own documents"           ON driver_documents;
DROP POLICY IF EXISTS "Managers can view company documents"      ON driver_documents;
DROP POLICY IF EXISTS "Managers can insert company documents"    ON driver_documents;
DROP POLICY IF EXISTS "Managers can update company documents"    ON driver_documents;
DROP POLICY IF EXISTS "Managers can delete company documents"    ON driver_documents;

-- Drivers: view their own documents
CREATE POLICY "Drivers can view own documents"
  ON driver_documents FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Managers: view all documents for drivers in their company
CREATE POLICY "Managers can view company documents"
  ON driver_documents FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'manager'
    )
  );

-- Managers: insert documents for drivers in their company
CREATE POLICY "Managers can insert company documents"
  ON driver_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'manager'
    )
  );

-- Managers: update documents for drivers in their company
CREATE POLICY "Managers can update company documents"
  ON driver_documents FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'manager'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'manager'
    )
  );

-- Managers: delete documents for drivers in their company
CREATE POLICY "Managers can delete company documents"
  ON driver_documents FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'manager'
    )
  );

-- ============================================================================
-- VEHICLE DOCUMENTS
-- ============================================================================

ALTER TABLE vehicle_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can view vehicle documents"      ON vehicle_documents;
DROP POLICY IF EXISTS "Managers can insert vehicle documents"    ON vehicle_documents;
DROP POLICY IF EXISTS "Managers can update vehicle documents"    ON vehicle_documents;
DROP POLICY IF EXISTS "Managers can delete vehicle documents"    ON vehicle_documents;

-- Managers: view vehicle documents in their company
CREATE POLICY "Managers can view vehicle documents"
  ON vehicle_documents FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'manager'
    )
  );

-- Managers: insert vehicle documents in their company
CREATE POLICY "Managers can insert vehicle documents"
  ON vehicle_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'manager'
    )
  );

-- Managers: update vehicle documents in their company
CREATE POLICY "Managers can update vehicle documents"
  ON vehicle_documents FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'manager'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'manager'
    )
  );

-- Managers: delete vehicle documents in their company
CREATE POLICY "Managers can delete vehicle documents"
  ON vehicle_documents FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'manager'
    )
  );

-- ============================================================================
-- STORAGE BUCKET POLICIES
-- ============================================================================
-- Paths are structured as:  {company_id}/{subject_id}/{type}_{timestamp}
-- Managers may only access objects whose path starts with their company_id.

-- Driver documents bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-documents', 'driver-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Managers can upload driver documents"     ON storage.objects;
DROP POLICY IF EXISTS "Managers can download driver documents"   ON storage.objects;
DROP POLICY IF EXISTS "Managers can delete driver documents"     ON storage.objects;

CREATE POLICY "Managers can upload driver documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'driver-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'manager'
    )
  );

CREATE POLICY "Managers can download driver documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'driver-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'manager'
    )
  );

CREATE POLICY "Managers can delete driver documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'driver-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'manager'
    )
  );

-- Vehicle documents bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-documents', 'vehicle-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Managers can upload vehicle documents"    ON storage.objects;
DROP POLICY IF EXISTS "Managers can download vehicle documents"  ON storage.objects;
DROP POLICY IF EXISTS "Managers can delete vehicle documents"    ON storage.objects;

CREATE POLICY "Managers can upload vehicle documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vehicle-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'manager'
    )
  );

CREATE POLICY "Managers can download vehicle documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'vehicle-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'manager'
    )
  );

CREATE POLICY "Managers can delete vehicle documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vehicle-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'manager'
    )
  );
