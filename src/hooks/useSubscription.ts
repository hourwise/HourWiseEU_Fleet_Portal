import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface AccessStatus {
  hasAccess: boolean;
  accountType: 'solo' | 'fleet';
  subscriptionStatus: string;
  trialEndsAt?: string | null;
  subscriptionPeriodEnd?: string | null;
  companyName?: string;
  reason?: string;
  loading: boolean;
  error?: string;
}

export function useSubscription() {
  const [accessStatus, setAccessStatus] = useState<AccessStatus>({
    hasAccess: false,
    accountType: 'solo',
    subscriptionStatus: 'inactive',
    loading: true,
  });

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setAccessStatus({
          hasAccess: false,
          accountType: 'solo',
          subscriptionStatus: 'inactive',
          loading: false,
          reason: 'not_authenticated',
        });
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-access`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to check access');
      }

      const data = await response.json();

      setAccessStatus({
        ...data,
        loading: false,
      });
    } catch (error) {
      console.error('Error checking access:', error);
      setAccessStatus((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  };

  const refreshAccess = () => {
    setAccessStatus((prev) => ({ ...prev, loading: true }));
    checkAccess();
  };

  return {
    ...accessStatus,
    refreshAccess,
  };
}
