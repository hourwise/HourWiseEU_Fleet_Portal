import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Database } from '../../../lib/database.types';
import { Zap, Download } from 'lucide-react';

type DriverLog = Database['public']['Tables']['driver_logs']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface ReportProps {
  companyId: string;
  selectedDriver: string;
  startDate: string;
  endDate: string;
  loading: boolean;
  setLoading: (value: boolean) => void;
}

const ACTIVITY_TYPES = ['driving', 'work', 'available', 'break', 'rest'];
const PRODUCTIVE_TYPES = ['driving', 'work'];

export function EfficiencyReport({ companyId, selectedDriver, startDate, endDate, loading, setLoading }: ReportProps) {
  const [logs, setLogs] = useState<(DriverLog & { profile: Profile })[]>([]);

  const loadEfficiencyData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('driver_logs')
        .select('*, profile:driver_id(*)')
        .eq('company_id', companyId)
        .gte('start_time', startDate)
        .lte('end_time', endDate)
        .not('duration_minutes', 'is', null);

      if (selectedDriver !== 'all') {
        query = query.eq('driver_id', selectedDriver);
      }

      const { data, error } = await query;
      if (error) throw error;

      const logsWithProfile = (data || []).map((log: any) => ({
        ...log,
        profile: Array.isArray(log.profile) ? log.profile[0] : log.profile,
      }));
      setLogs(logsWithProfile.filter((l: any) => l.profile?.id));
    } catch (error) {
      console.error('Error loading efficiency data:', error);
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedDriver, startDate, endDate, setLoading]);

  useEffect(() => {
    loadEfficiencyData();
  }, [loadEfficiencyData]);

  const efficiencySummary = useMemo(() => {
    const driverMap = new Map<string, { name: string; totalMinutes: number; productiveMinutes: number; activities: Record<string, number> }>();

    logs.forEach(log => {
      const driverId = log.driver_id;
      const driverData = driverMap.get(driverId) || {
        name: log.profile?.full_name || 'Unknown',
        totalMinutes: 0,
        productiveMinutes: 0,
        activities: Object.fromEntries(ACTIVITY_TYPES.map(type => [type, 0])),
      };

      const duration = log.duration_minutes || 0;
      driverData.totalMinutes += duration;
      driverData.activities[log.activity_type] += duration;

      if (PRODUCTIVE_TYPES.includes(log.activity_type)) {
        driverData.productiveMinutes += duration;
      }

      driverMap.set(driverId, driverData);
    });

    return Array.from(driverMap.values()).map(driver => ({
      ...driver,
      productivePercentage: driver.totalMinutes > 0 ? (driver.productiveMinutes / driver.totalMinutes) * 100 : 0,
      nonProductivePercentage: driver.totalMinutes > 0 ? 100 - ((driver.productiveMinutes / driver.totalMinutes) * 100) : 0,
    }));
  }, [logs]);

  const exportCSV = () => {
    // ... CSV Export logic ...
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-900">Efficiency & "Dead Time" Analysis</h3>
        <button onClick={exportCSV} disabled={efficiencySummary.length === 0} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50">
          <Download className="w-5 h-5" />
          Export CSV
        </button>
      </div>

      {efficiencySummary.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Zap className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No activity data for the selected period.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Driver</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Productive Time</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">"Dead Time" (POA)</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Total Hours</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Efficiency</th>
              </tr>
            </thead>
            <tbody>
              {efficiencySummary.map((row, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">{row.name}</td>
                  <td className="py-3 px-4 text-right text-gray-700">{(row.productiveMinutes / 60).toFixed(2)}h</td>
                  <td className="py-3 px-4 text-right text-gray-700">{(row.activities.available / 60).toFixed(2)}h</td>
                  <td className="py-3 px-4 text-right text-gray-700 font-bold">{(row.totalMinutes / 60).toFixed(2)}h</td>
                  <td className="py-3 px-4">
                    <div className="w-full bg-red-200 rounded-full h-5">
                      <div className="bg-green-500 h-5 rounded-full flex items-center justify-center" style={{ width: `${row.productivePercentage}%` }}>
                        <span className="text-xs font-bold text-white">{row.productivePercentage.toFixed(0)}%</span>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
