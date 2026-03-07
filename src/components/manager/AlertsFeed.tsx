import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { AlertTriangle, Bell, CheckCircle, Clock } from 'lucide-react';
import { VIOLATION_DETAILS } from '../../lib/compliance';
import type { Database } from '../../lib/database.types';

type WorkSession = Database['public']['Tables']['work_sessions']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface EnrichedSession extends WorkSession {
  profile: { full_name: string | null } | null;
}

type AlertType = 'compliance' | 'unusual_shift';
interface Alert {
  id: string;
  type: AlertType;
  session: EnrichedSession;
}

export function AlertsFeed() {
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.company_id) {
      loadAlerts();
    }
  }, [profile]);

  const loadAlerts = async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      // 1. Fetch sessions with potential issues
      // We'll filter them in JS to avoid complex PostgREST syntax errors
      const { data, error } = await supabase
        .from('work_sessions')
        .select('*, profile:user_id(full_name)')
        .eq('company_id', profile.company_id)
        .order('start_time', { ascending: false })
        .limit(20);

      if (error) throw error;

      const fifteenHoursMs = 15 * 60 * 60 * 1000;
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const processedAlerts: Alert[] = [];

      (data || []).forEach((s: any) => {
        const session = s as EnrichedSession;

        // Check for Compliance Violations
        if (session.compliance_violations && session.compliance_violations.length > 0) {
          processedAlerts.push({ id: `comp-${session.id}`, type: 'compliance', session });
        }
        // Check for Unusual Shifts (Still running > 24h)
        else if (session.status === 'working' && new Date(session.start_time) < twentyFourHoursAgo) {
          processedAlerts.push({ id: `run-${session.id}`, type: 'unusual_shift', session });
        }
        // Check for Unusual Shifts (Finished but > 15h)
        else if (session.status === 'ended' && session.duration_ms && session.duration_ms > fifteenHoursMs) {
          processedAlerts.push({ id: `long-${session.id}`, type: 'unusual_shift', session });
        }
      });

      setAlerts(processedAlerts.slice(0, 10));
    } catch (err) {
      console.error("Error loading alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  const getAlertDisplay = (alert: Alert) => {
    if (alert.type === 'compliance') {
      const violations = alert.session.compliance_violations as string[];
      const firstKey = violations[0];
      const detail = VIOLATION_DETAILS[firstKey] || VIOLATION_DETAILS.default;
      return { title: detail.title, Icon: AlertTriangle, color: 'text-amber-500' };
    }
    if (alert.session.status === 'working') {
      return { title: 'Shift running > 24h', Icon: Clock, color: 'text-red-500' };
    }
    return { title: 'Shift duration > 15h', Icon: Clock, color: 'text-blue-500' };
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        <Bell className="w-6 h-6 text-gray-700" />
        <h3 className="text-lg font-bold text-gray-900">Actionable Alerts</h3>
      </div>
      {loading ? (
        <div className="text-center py-8">Loading alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
          <p className="font-medium text-gray-700">All clear!</p>
          <p className="text-sm text-gray-500">No issues detected.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => {
            const { title, Icon, color } = getAlertDisplay(alert);
            return (
              <div key={alert.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                <Icon className={`w-6 h-6 flex-shrink-0 mt-1 ${color}`} />
                <div>
                  <p className="font-semibold text-gray-800">{alert.session.profile?.full_name || 'Unknown Driver'}</p>
                  <p className="text-sm text-gray-600">{title}</p>
                  <p className="text-xs text-gray-400 mt-1">Started: {new Date(alert.session.start_time).toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
