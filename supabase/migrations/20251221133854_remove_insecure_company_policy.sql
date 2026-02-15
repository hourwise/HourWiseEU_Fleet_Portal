/*
  # Remove Insecure Company Viewing Policy

  ## Overview
  Removes the overly permissive "authenticated_users_view_companies" policy that allows
  all authenticated users to view all companies. This is a security issue.

  ## Changes Made
  - Drop "authenticated_users_view_companies" policy
  - Keep only "users_view_own_company" policy which properly restricts access

  ## Security Impact
  Users can now only view companies they belong to, not all companies in the system.
*/

DROP POLICY IF EXISTS "authenticated_users_view_companies" ON companies;
