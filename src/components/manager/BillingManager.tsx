// File: src/components/manager/BillingManager.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CreditCard, Loader2 } from 'lucide-react';
import type { Database } from '../../lib/database.types';

type Company = Database['public']['Tables']['companies']['Row'];

export function BillingManager() {
  const { profile } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    const fetchCompanySubscription = async () => {
      if (!profile?.company_id) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('subscription_status, stripe_customer_id')
          .eq('id', profile.company_id)
          .single();

        if (error) throw error;
        setCompany(data);
      } catch (error) {
        console.error('Error fetching company subscription:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanySubscription();
  }, [profile]);

  const handleManageSubscription = async () => {
    setIsRedirecting(true);
    try {
      // This function creates a Stripe Portal session and returns the URL
      const { data, error } = await supabase.functions.invoke('create-portal-session');
      if (error) throw new Error(`Failed to create portal session: ${error.message}`);
      
      if (data.portalUrl) {
        window.location.href = data.portalUrl;
      } else {
        throw new Error('No portal URL was returned.');
      }
    } catch (error) {
      alert((error as Error).message);
      setIsRedirecting(false);
    }
  };

  if (loading) {
    return <div className="p-6 bg-brand-card-light rounded-lg text-center">Loading billing status...</div>;
  }

  const isSubscribed = company?.subscription_status === 'active' || company?.subscription_status === 'trialing';

  return (
    <div className="bg-brand-card-light border border-brand-border rounded-lg shadow-sm p-6">
      <div className="flex items-center gap-4 mb-4">
        <CreditCard className="w-8 h-8 text-brand-accent"/>
        <div>
          <h3 className="text-xl font-bold text-white">Billing & Subscription</h3>
          <p className="text-slate-400">Manage your fleet's subscription plan.</p>
        </div>
      </div>
      
      {isSubscribed ? (
        <div>
          <p className="text-lg text-slate-300">
            Your subscription is currently <span className="font-semibold text-green-400 capitalize">{company?.subscription_status}</span>.
          </p>
          <p className="text-slate-400 my-4">
            To manage your subscription, view invoices, or update payment methods, use the secure Stripe customer portal.
          </p>
          <button
            onClick={handleManageSubscription}
            disabled={isRedirecting}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-brand-accent text-white font-semibold rounded-lg hover:bg-brand-accent-dark transition disabled:bg-slate-500"
          >
            {isRedirecting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Redirecting...
              </>
            ) : (
              'Manage Billing'
            )}
          </button>
        </div>
      ) : (
        <div>
          <p className="text-lg text-slate-300">
            Your fleet is not yet subscribed. The subscription will be automatically created when you invite your first driver.
          </p>
        </div>
      )}
    </div>
  );
}
