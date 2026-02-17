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
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    const fetchCompanySubscription = async () => {
      if (!profile?.company_id) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('subscription_status, stripe_customer_id, stripe_subscription_id')
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

  const handleSubscribeClick = async () => {
    setIsSubscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-fleet-checkout');

      if (error) {
        throw new Error(`Failed to create checkout session: ${error.message}`);
      }
      
      // Redirect to Stripe Checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('No checkout URL returned from the function.');
      }

    } catch (error) {
      alert((error as Error).message);
      setIsSubscribing(false);
    }
  };

  if (loading) {
    return <div className="p-6 bg-brand-card-light rounded-lg text-center">Loading billing status...</div>;
  }

  const isSubscribed = company?.subscription_status === 'active';

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
            Your subscription is currently <span className="font-semibold text-green-400 capitalize">Active</span>.
          </p>
          <p className="text-slate-400 mt-2">
            To manage your subscription, view invoices, or update payment methods, please contact support.
            {/* Future: Add a button here to redirect to the Stripe Customer Portal */}
          </p>
        </div>
      ) : (
        <div>
          <p className="text-lg text-slate-300 mb-4">
            Activate your fleet by subscribing for just £4.99 per driver, per month. Your account is free until you add your first driver.
          </p>
          <button
            onClick={handleSubscribeClick}
            disabled={isSubscribing}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-brand-accent text-white font-semibold rounded-lg hover:bg-brand-accent-dark transition disabled:bg-slate-500"
          >
            {isSubscribing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Redirecting to Checkout...
              </>
            ) : (
              'Activate Subscription'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
