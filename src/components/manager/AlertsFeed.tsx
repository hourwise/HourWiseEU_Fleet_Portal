import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { AlertTriangle, Bell, CheckCircle } from 'lucide-react';
import { VIOLATION_DETAILS } from '../../lib/compliance';
import type { Database } from '../../lib/database.types';

type WorkSession = Database['public']['Tables']['work_sessions']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface Alert extends WorkSession {
  profiles: Profile | null;
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
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('work_sessions')
        .select('*, profiles(full_name)')
        .eq('company_id', profile!.company_id!)
        .neq('compliance_violations', null) // Check that violations are not null
        .order('date', { ascending: false })
        .limit(5);

      if (error) throw error;
      
      // Filter out sessions where compliance_violations is an empty array
      const validAlerts = (data || []).filter(session => 
          session.compliance_violations && session.compliance_violations.length > 0
      );
      setAlerts(validAlerts as Alert[]);

    } catch (err) {
      console.error("Error loading alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  const getViolationDisplay = (violations: string[]) => {
    if (!violations || violations.length === 0) return { title: 'No Violations', Icon: CheckCircle, color: 'text-green-500' };
    const firstKey = violations[0];
    const detail = VIOLATION_DETAILS[firstKey] || VIOLATION_DETAILS.default;
    return { title: detail.title, Icon: AlertTriangle, color: 'text-amber-500' };
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        <Bell className="w-6 h-6 text-gray-700" />
        <h3 className="text-lg font-bold text-gray-900">Recent Compliance Alerts</h3>
      </div>
      {loading ? (
        <div className="text-center py-8">Loading alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
          <p className="font-medium text-gray-700">No compliance alerts in the last 7 days.</p>
          <p className="text-sm text-gray-500">Your fleet is fully compliant.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => {
            const { title, Icon, color } = getViolationDisplay(alert.compliance_violations as string[]);
            return (
              <div key={alert.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                <Icon className={`w-6 h-6 flex-shrink-0 mt-1 ${color}`} />
                <div>
                  <p className="font-semibold text-gray-800">{alert.profiles?.full_name || 'Unknown Driver'}</p>
                  <p className="text-sm text-gray-600">{title}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(alert.date!).toLocaleDateString()}
                    {alert.compliance_violations && alert.compliance_violations.length > 1 && ` (+${alert.compliance_violations.length - 1} more)`}
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
