import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Building2, Calendar, Copy, CheckCircle2, Gauge, Edit, Save, X, RefreshCw, Lock, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Database } from '../../lib/database.types';

type Company = Database['public']['Tables']['companies']['Row'];

export function CompanySettings() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');

  const loadCompany = useCallback(async () => {
    if (!profile?.company_id) return;
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .single();

      if (error) throw error;
      setCompany(data);
      setEditedName(data.name);
    } catch (error) {
      console.error('Error loading company:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  useEffect(() => {
    if (profile?.company_id) {
      loadCompany();
    }
  }, [loadCompany, profile?.company_id]);

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
      alert(t('settings.company.errors.updateFailed'));
    } finally {
      setUpdating(false);
    }
  };

  const regenerateAuthCode = async () => {
    if (!company || !window.confirm('Are you sure? Drivers or Supervisors currently trying to join with the old code will be blocked.')) return;
    setRegenerating(true);
    try {
      // Generate a secure 8-character random code
      const newCode = Math.random().toString(36).substring(2, 10).toUpperCase();

      const { error } = await supabase
        .from('companies')
        .update({ auth_code: newCode })
        .eq('id', company.id);

      if (error) throw error;
      setCompany({ ...company, auth_code: newCode });
    } catch (error) {
      console.error('Error regenerating code:', error);
      alert('Failed to regenerate code.');
    } finally {
      setRegenerating(false);
    }
  };

  const copyAuthCode = async () => {
    if (!company?.auth_code) return;
    await navigator.clipboard.writeText(company.auth_code);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Security Check: Only the primary manager (creator) can edit company settings
  const isPrimaryManager = profile?.id === company?.created_by;

  if (!isPrimaryManager) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
        <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="text-red-600 w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Access Restricted</h2>
        <p className="text-slate-500 max-w-sm mx-auto">
          Only the primary fleet administrator can modify company settings or view the secure authorization code.
        </p>
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
            <h2 className="text-xl font-bold text-gray-900">{t('settings.company.title')}</h2>
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
              {isSubscribed ? t('settings.company.subscriptionActive') : t('settings.company.inactive')}
            </span>
          </div>
        </div>

        <div className="p-6 grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{t('settings.company.nameLabel')}</label>
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
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{t('settings.company.refIdLabel')}</label>
              <p className="text-xs font-mono text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 truncate">{company?.id}</p>
            </div>

            <div className="pt-4 border-t border-gray-50">
              <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-2">{t('settings.company.authCodeLabel')}</label>
              <div className="flex items-center gap-2">
                <div className="bg-blue-50 px-4 py-2 rounded-lg font-mono font-black text-blue-700 border border-blue-100 flex items-center gap-2">
                  <Lock size={12} className="opacity-40" />
                  {company?.auth_code || '------'}
                </div>
                <button
                  onClick={copyAuthCode}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition border border-slate-100 shadow-sm"
                  title={t('common.details')}
                >
                  {copying ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                </button>
                <button
                  onClick={regenerateAuthCode}
                  disabled={regenerating}
                  className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition border border-slate-100 shadow-sm ml-auto"
                  title="Regenerate Code"
                >
                  <RefreshCw className={`w-5 h-5 ${regenerating ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <p className="mt-2 text-[10px] text-slate-500 font-medium italic">
                {t('settings.company.authCodeFootnote')}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900 p-6 rounded-xl text-white space-y-4 shadow-xl">
              <h3 className="font-bold text-xs uppercase tracking-widest flex items-center gap-2 text-blue-400">
                <Gauge className="w-4 h-4" />
                {t('settings.company.usageMetrics')}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {t('settings.company.usageMetricsSubtitle')}
              </p>
              <div className="bg-white/10 p-3 rounded border border-white/5 text-center">
                <p className="text-[9px] text-slate-400 uppercase font-black">{t('settings.company.dataStatus')}</p>
                <p className="text-xs font-bold mt-1">{t('settings.company.activeMonitoring')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
            {t('settings.company.fleetRegistered', { date: company?.created_at ? new Date(company.created_at).toLocaleDateString() : 'N/A' })}
          </span>
        </div>
      </div>
    </div>
  );
}
