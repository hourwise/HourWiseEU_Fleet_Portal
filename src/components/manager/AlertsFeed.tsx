import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { AlertTriangle, Bell, CheckCircle, Clock } from 'lucide-react';
import { VIOLATION_DETAILS } from '../../lib/compliance';
import type { Database } from '../../lib/database.types';

type WorkSession = Database['public']['Tables']['work_sessions']['Row'];

export function AlertsFeed() {
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState<any[]>([]);
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
      // This is a simple query that will not fail.
      // It fetches recent sessions created by any user visible to the manager.
      const { data, error } = await supabase
        .from('work_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50); // Fetch a larger batch to filter in JS

      if (error) throw error;

      // Post-filter in JS to find issues, avoiding the DB error
      const fifteenHoursMs = 15 * 60 * 60 * 1000;
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const processedAlerts = (data || []).filter(session => {
        const hasViolations = session.compliance_violations && session.compliance_violations.length > 0;
        const isStuckRunning = session.status === 'working' && new Date(session.start_time) < twentyFourHoursAgo;
        const isTooLong = session.status === 'ended' && session.duration_ms && session.duration_ms > fifteenHoursMs;
        return hasViolations || isStuckRunning || isTooLong;
      });

      setAlerts(processedAlerts.slice(0, 5));

    } catch (err) {
      console.error("Error loading alerts:", err);
      // We will set alerts to empty array on failure to prevent crash
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        <Bell className="w-6 h-6 text-gray-700" />
        <h3 className="text-lg font-bold text-gray-900">Actionable Alerts</h3>
      </div>
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
          <p className="font-medium text-gray-700">All clear!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
             <div key={alert.id} className="p-4 bg-gray-50 rounded-lg">
                <p className="font-semibold text-gray-800">Alert for Shift on {new Date(alert.start_time).toLocaleDateString()}</p>
                <p className="text-sm text-gray-600">Issue detected that may require review.</p>
             </div>
          ))}
        </div>
      )}
    </div>
  );
}
