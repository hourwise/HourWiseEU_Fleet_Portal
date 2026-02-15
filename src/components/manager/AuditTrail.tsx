import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Download, FileDown, Calendar, Filter } from 'lucide-react';
import type { Database } from '../../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

export function AuditTrail() {
  const { profile } = useAuth();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<string>('all');
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (profile?.company_id) {
      loadDrivers();
      setDefaultDates();
    }
  }, [profile]);

  const setDefaultDates = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const loadDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .eq('role', 'driver')
        .order('full_name');

      if (error) throw error;
      setDrivers(data || []);
    } catch (error) {
      console.error('Error loading drivers:', error);
    }
  };

  const generateAuditReport = async () => {
    setGenerating(true);

    try {
      let query = supabase
        .from('driver_logs')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .gte('start_time', new Date(startDate).toISOString())
        .lte('start_time', new Date(endDate + 'T23:59:59').toISOString())
        .order('start_time', { ascending: false });

      if (selectedDriver !== 'all') {
        query = query.eq('driver_id', selectedDriver);
      }

      const { data: logs, error } = await query;

      if (error) throw error;

      const driverIds = [...new Set(logs?.map((log) => log.driver_id) || [])];
      const { data: driverProfiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', driverIds);

      const driverMap = new Map(driverProfiles?.map((d) => [d.id, d]) || []);

      const csv = [
        [
          'Date',
          'Driver Name',
          'License Number',
          'Activity Type',
          'Start Time',
          'End Time',
          'Duration (min)',
          'Status',
          'Infraction Type',
          'Vehicle ID',
          'Location Start',
          'Location End',
          'Notes',
        ].join(','),
        ...(logs || []).map((log) => {
          const driver = driverMap.get(log.driver_id);
          return [
            new Date(log.start_time).toLocaleDateString(),
            driver?.full_name || 'Unknown',
            driver?.driver_license_number || 'N/A',
            log.activity_type,
            new Date(log.start_time).toLocaleTimeString(),
            log.end_time ? new Date(log.end_time).toLocaleTimeString() : 'Ongoing',
            log.duration_minutes || 'N/A',
            log.status_code,
            log.infraction_type || 'None',
            log.vehicle_id || 'N/A',
            log.location_start || 'N/A',
            log.location_end || 'N/A',
            log.notes || 'N/A',
          ]
            .map((field) => `"${field}"`)
            .join(',');
        }),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-trail-${startDate}-to-${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating audit report:', error);
    } finally {
      setGenerating(false);
    }
  };

  const generateComplianceReport = async () => {
    setGenerating(true);

    try {
      const { data: logs, error } = await supabase
        .from('driver_logs')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .gte('start_time', new Date(startDate).toISOString())
        .lte('start_time', new Date(endDate + 'T23:59:59').toISOString());

      if (error) throw error;

      const driverIds = [...new Set(logs?.map((log) => log.driver_id) || [])];
      const { data: driverProfiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', driverIds);

      const driverMap = new Map(driverProfiles?.map((d) => [d.id, d]) || []);

      const summary = driverIds.map((driverId) => {
        const driver = driverMap.get(driverId)!;
        const driverLogs = logs?.filter((log) => log.driver_id === driverId) || [];
        const violations = driverLogs.filter((log) => log.status_code === 'violation').length;
        const warnings = driverLogs.filter((log) => log.status_code === 'warning').length;
        const totalLogs = driverLogs.length;
        const complianceRate = totalLogs > 0
          ? (((totalLogs - violations - warnings) / totalLogs) * 100).toFixed(1)
          : '100';

        return {
          driverName: driver.full_name,
          licenseNumber: driver.driver_license_number || 'N/A',
          totalLogs,
          violations,
          warnings,
          complianceRate: `${complianceRate}%`,
        };
      });

      const csv = [
        ['Driver Name', 'License Number', 'Total Logs', 'Violations', 'Warnings', 'Compliance Rate'].join(','),
        ...summary.map((row) =>
          [
            row.driverName,
            row.licenseNumber,
            row.totalLogs,
            row.violations,
            row.warnings,
            row.complianceRate,
          ]
            .map((field) => `"${field}"`)
            .join(',')
        ),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-summary-${startDate}-to-${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating compliance report:', error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileDown className="w-8 h-8 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Audit Trail Export</h2>
          <p className="text-gray-600">Generate compliance reports for regulatory audits</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-bold text-gray-900">Report Filters</h3>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label htmlFor="driver" className="block text-sm font-medium text-gray-700 mb-2">
              Driver
            </label>
            <select
              id="driver"
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Drivers</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200">
            <div className="flex items-center gap-3 mb-4">
              <Download className="w-8 h-8 text-blue-600" />
              <div>
                <h4 className="text-lg font-bold text-gray-900">Complete Audit Trail</h4>
                <p className="text-sm text-gray-600">All driver logs with full details</p>
              </div>
            </div>

            <ul className="space-y-2 mb-6 text-sm text-gray-700">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                Driver activity logs
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                Timestamps and durations
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                Location data
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                Vehicle information
              </li>
            </ul>

            <button
              onClick={generateAuditReport}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-5 h-5" />
              {generating ? 'Generating...' : 'Download Audit Trail'}
            </button>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border-2 border-green-200">
            <div className="flex items-center gap-3 mb-4">
              <Download className="w-8 h-8 text-green-600" />
              <div>
                <h4 className="text-lg font-bold text-gray-900">Compliance Summary</h4>
                <p className="text-sm text-gray-600">Aggregated compliance metrics</p>
              </div>
            </div>

            <ul className="space-y-2 mb-6 text-sm text-gray-700">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
                Per-driver compliance rates
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
                Violation and warning counts
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
                Total activity summary
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
                Quick audit overview
              </li>
            </ul>

            <button
              onClick={generateComplianceReport}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-5 h-5" />
              {generating ? 'Generating...' : 'Download Summary'}
            </button>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-900">
            <strong>Audit Ready:</strong> These reports are formatted for regulatory compliance and can be submitted
            directly to authorities for HOS and WTD verification.
          </p>
        </div>
      </div>
    </div>
  );
}
