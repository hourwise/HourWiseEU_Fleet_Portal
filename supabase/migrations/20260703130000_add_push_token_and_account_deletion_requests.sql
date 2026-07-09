-- Support mobile push-token registration and account deletion requests.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS expo_push_token TEXT DEFAULT NULL;
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_expo_push_token
ON public.profiles(expo_push_token)
WHERE expo_push_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_deletion_requested_at
ON public.profiles(deletion_requested_at)
WHERE deletion_requested_at IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  email TEXT,
  company_id UUID,
  role TEXT,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'requested',
  reason TEXT,
  source TEXT NOT NULL DEFAULT 'mobile_app',
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  CONSTRAINT account_deletion_requests_status_check
    CHECK (status IN ('requested', 'reviewing', 'completed', 'rejected', 'cancelled'))
);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_user_id
ON public.account_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_status_requested_at
ON public.account_deletion_requests(status, requested_at);
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own account deletion requests"
ON public.account_deletion_requests;
CREATE POLICY "Users can read own account deletion requests"
ON public.account_deletion_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own account deletion requests"
ON public.account_deletion_requests;
CREATE POLICY "Users can create own account deletion requests"
ON public.account_deletion_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
COMMENT ON COLUMN public.profiles.expo_push_token IS
'Latest Expo push token registered by the mobile app. NULL means push notifications are not currently available.';
COMMENT ON COLUMN public.profiles.deletion_requested_at IS
'Timestamp when the user requested account deletion or deactivation from the mobile app.';
COMMENT ON COLUMN public.profiles.deactivated_at IS
'Timestamp when the profile was deactivated. Deactivation does not remove statutory work, payroll, or compliance evidence.';
COMMENT ON TABLE public.account_deletion_requests IS
'Audit trail for mobile account deletion/deactivation requests. Legal retention cleanup is handled outside the mobile app.';
