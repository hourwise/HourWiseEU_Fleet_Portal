import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Building2, Shield, Calendar, Copy, CheckCircle2, AlertCircle, Gauge, Edit, Save, X } from 'lucide-react';
import type { Database } from '../../lib/database.types';

type Company = Database['public']['Tables']['companies']['Row'];

export function CompanySettings() {
  const { profile } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');

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
      setEditedName(data.name);
    } catch (error) {
      console.error('Error loading company:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCompany = async () => {
    if (!company || !editedName.trim()) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({ name: editedName.trim() })
        .eq('id', company.id);

      if (error) throw error;
      setCompany({ ...company, name: editedName.trim() });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating company name:', error);
      alert('Failed to update company name.');
    } finally {
      setUpdating(false);
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

      // Attempt the update
      const { error } = await supabase
        .from('companies')
        .update({ require_vehicle_checklist: newValue })
        .eq('id', company.id);

      if (error) {
        // Show specific error to user
        alert(`Failed to update setting: ${error.message}`);
        throw error;
      }

      // Update local state only if DB update succeeded
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
          <div className="flex items-center gap-3">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 text-slate-400 hover:text-blue-600 transition"
              >
                <Edit size={18} />
              </button>
            )}
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
              isSubscribed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {isSubscribed ? 'SUBSCRIPTION ACTIVE' : 'INACTIVE'}
            </span>
          </div>
        </div>

        <div className="p-6 grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Company Name</label>
              {isEditing ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    value={editedName}
                    onChange={e => setEditedName(e.target.value)}
                  />
                  <button
                    onClick={handleUpdateCompany}
                    disabled={updating}
                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Save size={18} />
                  </button>
                  <button
                    onClick={() => { setIsEditing(false); setEditedName(company?.name || ''); }}
                    className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <p className="text-lg font-bold text-slate-900">{company?.name}</p>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Internal Reference ID</label>
              <p className="text-xs font-mono text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 truncate">{company?.id}</p>
            </div>

            <div className="pt-4 border-t border-gray-50">
              <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-2">Company Auth Code</label>
              <div className="flex items-center gap-2">
                <div className="bg-blue-50 px-4 py-2 rounded-lg font-mono font-black text-blue-700 border border-blue-100">
                  {company?.auth_code || '------'}
                </div>
                <button
                  onClick={copyAuthCode}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition border border-slate-100 shadow-sm"
                  title="Copy Code"
                >
                  {copying ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <p className="mt-2 text-[10px] text-slate-500 font-medium italic">
                Give this code to new drivers and supervisors to link them to your fleet.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    Compliance Enforcement
                  </h3>
                  <p className="text-xs text-gray-600 mt-1">
                    Enforce high safety standards across the entire fleet.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                <div>
                  <p className="font-bold text-slate-900 text-sm">Mandatory Vehicle Checks</p>
                  <p className="text-[10px] text-slate-500">Block drivers from starting shifts without a check.</p>
                </div>
                <button
                  onClick={toggleChecklistMandatory}
                  disabled={updating}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                    company?.require_vehicle_checklist ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                    company?.require_vehicle_checklist ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-100 font-medium">
                <AlertCircle size={14} className="shrink-0" />
                <span>When enabled, fleet drivers must complete a walkaround before logging hours.</span>
              </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-xl text-white space-y-4 shadow-xl">
              <h3 className="font-bold text-xs uppercase tracking-widest flex items-center gap-2 text-blue-400">
                <Gauge className="w-4 h-4" />
                Fleet Usage Metrics
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Mileage and inspection data are automatically captured. View detailed reports in the **Safety Checks** tab.
              </p>
              <div className="bg-white/10 p-3 rounded border border-white/5 text-center">
                <p className="text-[9px] text-slate-400 uppercase font-black">Data Status</p>
                <p className="text-xs font-bold mt-1">Active Monitoring Enabled</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
            FLEET REGISTERED: {company?.created_at ? new Date(company.created_at).toLocaleDateString() : 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
}
