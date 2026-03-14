import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Building2, Shield, Calendar, Copy, CheckCircle2, AlertCircle, Gauge } from 'lucide-react';
import type { Database } from '../../lib/database.types';

type Company = Database['public']['Tables']['companies']['Row'];

export function CompanySettings() {
  const { profile } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (profile?.company_id) {
      loadCompany();
    }
  }, [profile]);

  const loadCompany = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile!.company_id!)
        .single();

      if (error) throw error;
      setCompany(data);
    } catch (error) {
      console.error('Error loading company:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyAuthCode = async () => {
    if (!company?.auth_code) return;
    await navigator.clipboard.writeText(company.auth_code);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  const toggleChecklistMandatory = async () => {
    if (!company) return;
    setUpdating(true);
    try {
      const newValue = !company.require_vehicle_checklist;
      const { error } = await supabase
        .from('companies')
        .update({ require_vehicle_checklist: newValue })
        .eq('id', company.id);

      if (error) throw error;
      setCompany({ ...company, require_vehicle_checklist: newValue });
    } catch (error) {
      console.error('Error updating settings:', error);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const status = company?.subscription_status;
  const isSubscribed = status === 'active' || status === 'trialing';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Company Identity</h2>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
            isSubscribed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {isSubscribed ? 'SUBSCRIPTION ACTIVE' : 'INACTIVE'}
          </span>
        </div>

        <div className="p-6 grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Company Name</label>
              <p className="text-lg font-semibold text-gray-900">{company?.name}</p>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Company ID</label>
              <p className="text-sm font-mono text-gray-600">{company?.id}</p>
            </div>

            <div className="pt-4 border-t border-gray-50">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Company Auth Code</label>
              <div className="flex items-center gap-2">
                <div className="bg-blue-50 px-4 py-2 rounded-lg font-mono font-bold text-blue-700 border border-blue-100">
                  {company?.auth_code || '------'}
                </div>
                <button
                  onClick={copyAuthCode}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  title="Copy Code"
                >
                  {copying ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Give this code to new drivers and supervisors so they can join your company during signup.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    Compliance Settings
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Enforce fleet safety standards across all drivers.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
                <div>
                  <p className="font-semibold text-gray-900">Mandatory Vehicle Checks</p>
                  <p className="text-xs text-gray-500">Drivers must complete a checklist before starting hours.</p>
                </div>
                <button
                  onClick={toggleChecklistMandatory}
                  disabled={updating}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    company?.require_vehicle_checklist ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    company?.require_vehicle_checklist ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-100">
                <AlertCircle size={14} />
                <span>When enabled, fleet drivers will be blocked from starting shifts without a check.</span>
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 space-y-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Gauge className="w-5 h-5 text-blue-600" />
                Fleet Odometer Tracking
              </h3>
              <p className="text-sm text-gray-600">
                Mileage data is captured during daily vehicle safety checks for maintenance tracking.
              </p>
              <div className="bg-white p-4 rounded-lg border border-gray-200 text-center">
                <p className="text-xs text-gray-500 uppercase font-bold">Latest Data Capture</p>
                <p className="text-sm font-medium text-gray-900 mt-1">Active for all vehicle checks</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-500">
            Company Registered: {company?.created_at ? new Date(company.created_at).toLocaleDateString() : 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
}
