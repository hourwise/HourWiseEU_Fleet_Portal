import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CreditCard, Loader2, Check, Shield, Truck, Users } from 'lucide-react';
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
          .select('*')
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

  const handleStartSubscription = async (tier: 'base' | 'pro') => {
    setIsRedirecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-fleet-checkout', {
        body: { tier }
      });
      if (error) throw error;
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    } catch (error: any) {
      alert(error.message);
      setIsRedirecting(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsRedirecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session');
      if (error) throw error;
      if (data.portalUrl) window.location.href = data.portalUrl;
    } catch (error: any) {
      alert(error.message);
      setIsRedirecting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-brand-card rounded-xl p-12 flex flex-col items-center justify-center border border-brand-border animate-pulse">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Syncing Billing Data...</p>
      </div>
    );
  }

  const isSubscribed = company?.subscription_status === 'active' || company?.subscription_status === 'trialing';

  return (
    <div className="space-y-6">
      <div className="bg-brand-card rounded-2xl shadow-sm border border-brand-border overflow-hidden">
        <div className="p-6 border-b border-brand-border flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600/10 rounded-xl">
              <CreditCard className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Billing & Subscription</h3>
              <p className="text-sm text-slate-400">Manage your fleet plan and invoices</p>
            </div>
          </div>
          {isSubscribed && (
            <span className="bg-green-500/10 text-green-500 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border border-green-500/20">
              {company?.subscription_status}
            </span>
          )}
        </div>

        <div className="p-8">
          {!isSubscribed ? (
            <div className="space-y-8">
              <div className="text-center max-w-2xl mx-auto space-y-2">
                <h4 className="text-2xl font-black text-white">Choose your fleet's path</h4>
                <p className="text-slate-400">Professional tools to keep your fleet safe and compliant.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Base Tier */}
                <div className="bg-brand-dark/50 border border-brand-border rounded-2xl p-6 space-y-6 hover:border-blue-500/50 transition-colors">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-blue-400">
                      <Truck size={20} />
                      <span className="text-xs font-black uppercase tracking-widest">Base Fleet</span>
                    </div>
                    <h5 className="text-3xl font-black text-white">Compliance Only</h5>
                    <p className="text-xs text-slate-500">Perfect for managing vehicles and audit readiness without driver app tracking.</p>
                  </div>

                  <ul className="space-y-3">
                    {['Vehicle Master File', 'VOR & Defect Tracking', 'Maintenance Audit Trail', 'Tacho Training Engine'].map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                        <Check size={14} className="text-green-500" /> {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleStartSubscription('base')}
                    disabled={isRedirecting}
                    className="w-full py-4 bg-white text-slate-900 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-50 transition-all shadow-lg shadow-white/5"
                  >
                    Select Base Plan
                  </button>
                </div>

                {/* Pro Tier */}
                <div className="bg-slate-900 border-2 border-blue-600 rounded-2xl p-6 space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-blue-600 text-white px-4 py-1 rounded-bl-xl text-[10px] font-black uppercase tracking-widest">Recommended</div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-blue-400">
                      <Users size={20} />
                      <span className="text-xs font-black uppercase tracking-widest">Pro Fleet</span>
                    </div>
                    <h5 className="text-3xl font-black text-white">Full Integration</h5>
                    <p className="text-xs text-slate-500">Total visibility with real-time driver tracking and payroll automation.</p>
                  </div>

                  <ul className="space-y-3">
                    {['Everything in Base', 'Unlimited Driver Seats', 'Real-Time Infringements', 'Automated Payroll Reports'].map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm text-white">
                        <Check size={14} className="text-blue-500" /> {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleStartSubscription('pro')}
                    disabled={isRedirecting}
                    className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20"
                  >
                    Get Full Access
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row items-center gap-8 justify-between">
              <div className="space-y-4 max-w-lg">
                <div className="flex items-center gap-3 text-green-500 font-black uppercase tracking-widest text-xs">
                  <Shield size={18} />
                  <span>Subscription Active</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Your fleet is currently covered. All maintenance logs, driver documents, and compliance tools are available. Billing is processed automatically each month.
                </p>
              </div>

              <button
                onClick={handleManageSubscription}
                disabled={isRedirecting}
                className="w-full md:w-auto px-8 py-4 bg-slate-800 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-slate-700 transition border border-brand-border flex items-center justify-center gap-2"
              >
                {isRedirecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard size={16} />}
                Manage Invoices & Payments
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-6 flex items-start gap-4">
        <Shield className="text-blue-500 shrink-0 mt-1" size={20} />
        <div>
          <h4 className="text-blue-100 font-bold text-sm">Secure Payments by Stripe</h4>
          <p className="text-xs text-blue-300/70 mt-1 leading-relaxed">
            All credit card data is handled securely by Stripe. HourWise EU does not store your payment information on our servers.
          </p>
        </div>
      </div>
    </div>
  );
}
