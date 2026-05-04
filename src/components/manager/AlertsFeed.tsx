import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Bell, CheckCircle, AlertTriangle, Clock, X, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Database } from '../../lib/database.types';

type Alert = Database['public']['Tables']['alerts']['Row'];

export function AlertsFeed() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAlerts = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setAlerts(data || []);
    } catch (err) {
      console.error("Error loading alerts:", err);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  useEffect(() => {
    if (profile?.company_id) {
      loadAlerts();
    }
  }, [loadAlerts, profile?.company_id]);

  const dismissAlert = async (id: string) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ is_dismissed: true, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error("Error dismissing alert:", err);
    }
  };

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="text-red-500" size={20} />;
      case 'warning': return <Clock className="text-amber-500" size={20} />;
      default: return <Info className="text-blue-500" size={20} />;
    }
  };

  const getAlertStyles = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-50 border-red-100';
      case 'warning': return 'bg-amber-50 border-amber-100';
      default: return 'bg-blue-50 border-blue-100';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Bell className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">{t('dashboard.manager.alerts.title')}</h3>
        </div>
        {alerts.length > 0 && (
          <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
            {alerts.length} NEW
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-3">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
           <p className="text-sm text-slate-400 font-medium">{t('common.loading')}</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <div className="p-3 bg-white rounded-full w-fit mx-auto mb-3 shadow-sm">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <p className="font-bold text-slate-900">{t('dashboard.manager.alerts.allClear')}</p>
          <p className="text-sm text-slate-500 mt-1">{t('dashboard.manager.alerts.noIssues')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
             <div
               key={alert.id}
               className={`group relative p-4 rounded-xl border transition-all hover:shadow-md ${getAlertStyles(alert.severity)}`}
             >
                <div className="flex gap-4">
                  <div className="mt-0.5">{getAlertIcon(alert.severity)}</div>
                  <div className="flex-1 pr-6">
                    <p className="text-sm font-bold text-slate-900 leading-tight mb-1">
                      {alert.message}
                    </p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {new Date(alert.created_at).toLocaleDateString()} • {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => dismissAlert(alert.id)}
                  className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white/50 rounded-lg transition-colors"
                  title="Dismiss alert"
                >
                  <X size={14} />
                </button>
             </div>
          ))}
          {alerts.length > 0 && (
            <button
              onClick={loadAlerts}
              className="w-full py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors mt-2"
            >
              Refresh Feed
            </button>
          )}
        </div>
      )}
    </div>
  );
}
