import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { AlertTriangle, Bell, CheckCircle, Clock } from 'lucide-react';
import { VIOLATION_DETAILS } from '../../lib/compliance';
import type { Database } from '../../lib/database.types';

type WorkSession = Database['public']['Tables']['work_sessions']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface EnrichedSession extends WorkSession {
  profiles: Profile | null;
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
      // --- Fetch Compliance Violations ---
      const compliancePromise = supabase
        .from('work_sessions')
        .select('*, profiles(full_name)')
        .eq('company_id', profile.company_id)
        .neq('compliance_violations', null)
        .order('start_time', { ascending: false })
        .limit(5);

      // --- Fetch Unusual Shifts ---
      const fifteenHoursAgo = new Date(Date.now() - 15 * 60 * 60 * 1000).toISOString();
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const unusualShiftsPromise = supabase
        .from('work_sessions')
        .select('*, profiles(full_name)')
        .eq('company_id', profile.company_id)
        .or(`(status.eq.working,start_time.lt.${twentyFourHoursAgo}),(status.eq.ended,duration_ms.gt.${15 * 60 * 60 * 1000})`)
        .order('start_time', { ascending: false })
        .limit(5);

      // --- Resolve all promises ---
      const [{ data: complianceData, error: complianceError }, { data: unusualData, error: unusualError }] = await Promise.all([compliancePromise, unusualShiftsPromise]);

      if (complianceError) throw complianceError;
      if (unusualError) throw unusualError;

      // --- Format and combine alerts ---
      const complianceAlerts: Alert[] = (complianceData || [])
        .filter(s => s.compliance_violations && s.compliance_violations.length > 0)
        .map(session => ({ id: session.id, type: 'compliance', session: session as EnrichedSession }));

      const unusualShiftAlerts: Alert[] = (unusualData || []).map(session => ({
        id: session.id,
        type: 'unusual_shift',
        session: session as EnrichedSession
      }));

      // Combine, deduplicate, and sort
      const allAlerts = [...complianceAlerts, ...unusualShiftAlerts];
      const uniqueAlerts = Array.from(new Map(allAlerts.map(alert => [alert.id, alert])).values());
      uniqueAlerts.sort((a, b) => new Date(b.session.start_time).getTime() - new Date(a.session.start_time).getTime());

      setAlerts(uniqueAlerts.slice(0, 10)); // Limit to a max of 10 total alerts

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
    if (alert.type === 'unusual_shift') {
       if (alert.session.status === 'working') {
        return { title: 'Shift still running > 24h', Icon: Clock, color: 'text-red-500' };
      }
      if (alert.session.duration_ms && alert.session.duration_ms > 15 * 60 * 60 * 1000) {
        return { title: 'Shift duration > 15h', Icon: Clock, color: 'text-blue-500' };
      }
    }
    return { title: 'General Alert', Icon: Bell, color: 'text-gray-500' };
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
          <p className="font-medium text-gray-700">No recent alerts.</p>
          <p className="text-sm text-gray-500">Your fleet is compliant and all shift data looks normal.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => {
            const { title, Icon, color } = getAlertDisplay(alert);
            return (
              <div key={alert.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                <Icon className={`w-6 h-6 flex-shrink-0 mt-1 ${color}`} />
                <div>
                  <p className="font-semibold text-gray-800">{alert.session.profiles?.full_name || 'Unknown Driver'}</p>
                  <p className="text-sm text-gray-600">{title}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Started: {new Date(alert.session.start_time).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
