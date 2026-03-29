import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Bell, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Database } from '../../lib/database.types';

type WorkSession = Database['public']['Tables']['work_sessions']['Row'];

export function AlertsFeed() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAlerts = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const { data: drivers, error: driversError } = await supabase
        .from('profiles')
        .select('id')
        .eq('company_id', profile.company_id);

      if (driversError) throw driversError;
      const driverIds = drivers.map(d => d.id);

      const { data: sessions, error: sessionsError } = await supabase
        .from('work_sessions')
        .select('*')
        .in('user_id', driverIds)
        .order('created_at', { ascending: false })
        .limit(50);

      if (sessionsError) throw sessionsError;

      const fifteenHoursMs = 15 * 60 * 60 * 1000;
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const processedAlerts = (sessions || []).filter(session => {
        const hasViolations = session.compliance_violations && session.compliance_violations.length > 0;
        const isStuckRunning = session.status === 'working' && new Date(session.start_time) < twentyFourHoursAgo;
        const isTooLong = session.status === 'ended' && session.duration_ms && session.duration_ms > fifteenHoursMs;
        return hasViolations || isStuckRunning || isTooLong;
      });

      setAlerts(processedAlerts.slice(0, 5));

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

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        <Bell className="w-6 h-6 text-gray-700" />
        <h3 className="text-lg font-bold text-gray-900">{t('dashboard.manager.alerts.title')}</h3>
      </div>
      {loading ? (
        <div className="text-center py-8">{t('common.loading')}</div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
          <p className="font-medium text-gray-700">{t('dashboard.manager.alerts.allClear')}</p>
          <p className="text-sm text-gray-500">{t('dashboard.manager.alerts.noIssues')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
             <div key={alert.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="font-semibold text-gray-800">{t('dashboard.manager.alerts.shiftAlert', { date: new Date(alert.start_time).toLocaleDateString() })}</p>
                <p className="text-sm text-gray-600">{t('dashboard.manager.alerts.issueDetected')}</p>
             </div>
          ))}
        </div>
      )}
    </div>
  );
}
