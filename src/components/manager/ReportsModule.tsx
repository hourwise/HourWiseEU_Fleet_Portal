import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, Download, Calendar, Filter, PieChart, DollarSign } from 'lucide-react';
import type { Database } from '../../lib/database.types';

type DriverLog = Database['public']['Tables']['driver_logs']['Row'];
type WorkSession = Database['public']['Tables']['work_sessions']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

type ReportType = 'payroll' | 'infractions' | 'driving';

export function ReportsModule() {
  const { profile } = useAuth();
  const [activeReport, setActiveReport] = useState<ReportType>('payroll');
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);

    if (profile?.company_id) {
      loadDrivers();
    }
  }, [profile]);

  const loadDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .eq('role', 'driver')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      setDrivers(data || []);
    } catch (error) {
      console.error('Error loading drivers:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="w-8 h-8 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reports</h2>
          <p className="text-gray-600">Generate detailed fleet reports</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="flex overflow-x-auto border-b border-gray-200">
          <button
            onClick={() => setActiveReport('payroll')}
            className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition whitespace-nowrap ${
              activeReport === 'payroll'
                ? 'border-blue-600 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <DollarSign className="w-5 h-5" />
            Payroll Report
          </button>
          <button
            onClick={() => setActiveReport('infractions')}
            className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition whitespace-nowrap ${
              activeReport === 'infractions'
                ? 'border-blue-600 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <FileText className="w-5 h-5" />
            Infraction Report
          </button>
          <button
            onClick={() => setActiveReport('driving')}
            className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition whitespace-nowrap ${
              activeReport === 'driving'
                ? 'border-blue-600 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <PieChart className="w-5 h-5" />
            Driving Analysis
          </button>
        </div>

        <div className="p-6">
          <FilterSection
            drivers={drivers}
            selectedDriver={selectedDriver}
            setSelectedDriver={setSelectedDriver}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
          />

          {activeReport === 'payroll' && (
            <PayrollReport
              companyId={profile!.company_id!}
              selectedDriver={selectedDriver}
              startDate={startDate}
              endDate={endDate}
              loading={loading}
              setLoading={setLoading}
            />
          )}

          {activeReport === 'infractions' && (
            <InfractionsReport
              companyId={profile!.company_id!}
              selectedDriver={selectedDriver}
              startDate={startDate}
              endDate={endDate}
              loading={loading}
              setLoading={setLoading}
            />
          )}

          {activeReport === 'driving' && (
            <DrivingAnalysisReport
              companyId={profile!.company_id!}
              selectedDriver={selectedDriver}
              startDate={startDate}
              endDate={endDate}
              loading={loading}
              setLoading={setLoading}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface FilterSectionProps {
  drivers: Profile[];
  selectedDriver: string;
  setSelectedDriver: (value: string) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
}

function FilterSection({
  drivers,
  selectedDriver,
  setSelectedDriver,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: FilterSectionProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-5 h-5 text-gray-600" />
        <h3 className="font-semibold text-gray-900">Filters</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Driver</label>
          <select
            value={selectedDriver}
            onChange={(e) => setSelectedDriver(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Drivers</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.full_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="w-4 h-4 inline mr-1" />
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="w-4 h-4 inline mr-1" />
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );
}

interface ReportProps {
  companyId: string;
  selectedDriver: string;
  startDate: string;
  endDate: string;
  loading: boolean;
  setLoading: (value: boolean) => void;
}

function PayrollReport({ companyId, selectedDriver, startDate, endDate, loading, setLoading }: ReportProps) {
  const [sessions, setSessions] = useState<(WorkSession & { profile: Profile })[]>([]);

  useEffect(() => {
    loadPayrollData();
  }, [selectedDriver, startDate, endDate]);

  const loadPayrollData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('work_sessions')
        .select('*, profile:user_id(*)')
        .gte('date', startDate)
        .lte('date', endDate)
        .not('end_time', 'is', null);

      if (selectedDriver !== 'all') {
        query = query.eq('user_id', selectedDriver);
      }

      const { data, error } = await query;

      if (error) throw error;

      const sessionsWithProfile = (data || []).map((session: any) => ({
        ...session,
        profile: Array.isArray(session.profile) ? session.profile[0] : session.profile,
      }));

      setSessions(sessionsWithProfile.filter((s: any) => s.profile?.id));
    } catch (error) {
      console.error('Error loading payroll data:', error);
    } finally {
      setLoading(false);
    }
  };

  const payrollSummary = useMemo(() => {
    const driverMap = new Map<string, {
      name: string;
      totalHours: number;
      totalBreakHours: number;
      totalDrivingHours: number;
      sessions: number;
    }>();

    sessions.forEach((session) => {
      if (!session.profile) return;

      const driverId = session.user_id;
      const current = driverMap.get(driverId) || {
        name: session.profile.full_name,
        totalHours: 0,
        totalBreakHours: 0,
        totalDrivingHours: 0,
        sessions: 0,
      };

      current.totalHours += (session.total_work_minutes || 0) / 60;
      current.totalBreakHours += (session.total_break_minutes || 0) / 60;
      current.totalDrivingHours += ((session.other_data as any)?.driving || 0) / 60;
      current.sessions += 1;

      driverMap.set(driverId, current);
    });

    return Array.from(driverMap.values());
  }, [sessions]);

  const exportCSV = () => {
    const csv = [
      ['Driver Name', 'Total Work Hours', 'Total Break Hours', 'Total Driving Hours', 'Sessions Count'].join(','),
      ...payrollSummary.map((row) =>
        [
          row.name,
          row.totalHours.toFixed(2),
          row.totalBreakHours.toFixed(2),
          row.totalDrivingHours.toFixed(2),
          row.sessions,
        ]
          .map((field) => `"${field}"`)
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-report-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
        <h3 className="text-lg font-bold text-gray-900">Payroll Summary</h3>
        <button
          onClick={exportCSV}
          disabled={payrollSummary.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-5 h-5" />
          Export CSV
        </button>
      </div>

      {payrollSummary.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No data for selected period</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Driver Name</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Work Hours</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Break Hours</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Driving Hours</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Sessions</th>
              </tr>
            </thead>
            <tbody>
              {payrollSummary.map((row, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">{row.name}</td>
                  <td className="py-3 px-4 text-right text-gray-700">{row.totalHours.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right text-gray-700">{row.totalBreakHours.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right text-gray-700">{row.totalDrivingHours.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right text-gray-700">{row.sessions}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 font-bold bg-gray-50">
                <td className="py-3 px-4">TOTAL</td>
                <td className="py-3 px-4 text-right">
                  {payrollSummary.reduce((sum, row) => sum + row.totalHours, 0).toFixed(2)}
                </td>
                <td className="py-3 px-4 text-right">
                  {payrollSummary.reduce((sum, row) => sum + row.totalBreakHours, 0).toFixed(2)}
                </td>
                <td className="py-3 px-4 text-right">
                  {payrollSummary.reduce((sum, row) => sum + row.totalDrivingHours, 0).toFixed(2)}
                </td>
                <td className="py-3 px-4 text-right">
                  {payrollSummary.reduce((sum, row) => sum + row.sessions, 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function InfractionsReport({ companyId, selectedDriver, startDate, endDate, loading, setLoading }: ReportProps) {
  const [infractions, setInfractions] = useState<(DriverLog & { profile: Profile })[]>([]);

  useEffect(() => {
    loadInfractions();
  }, [selectedDriver, startDate, endDate]);

  const loadInfractions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('driver_logs')
        .select('*, profile:driver_id(*)')
        .eq('company_id', companyId)
        .in('status_code', ['warning', 'violation'])
        .gte('start_time', startDate)
        .lte('start_time', endDate)
        .order('start_time', { ascending: false });

      if (selectedDriver !== 'all') {
        query = query.eq('driver_id', selectedDriver);
      }

      const { data, error } = await query;

      if (error) throw error;

      const infractionsWithProfile = (data || []).map((infraction: any) => ({
        ...infraction,
        profile: Array.isArray(infraction.profile) ? infraction.profile[0] : infraction.profile,
      }));

      setInfractions(infractionsWithProfile.filter((i: any) => i.profile?.id));
    } catch (error) {
      console.error('Error loading infractions:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = () => {
    alert('PDF export functionality requires a PDF library like jsPDF or react-pdf. This is a placeholder implementation.');
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
        <h3 className="text-lg font-bold text-gray-900">Infractions Report</h3>
        <button
          onClick={exportPDF}
          disabled={infractions.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-5 h-5" />
          Export PDF
        </button>
      </div>

      {infractions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No infractions for selected period</p>
        </div>
      ) : (
        <div className="space-y-3">
          {infractions.map((infraction) => (
            <div
              key={infraction.id}
              className={`border-2 rounded-lg p-4 ${
                infraction.status_code === 'violation'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-yellow-50 border-yellow-200'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-bold text-gray-900">
                    {infraction.infraction_type || 'Compliance Issue'}
                  </h4>
                  <p className="text-sm text-gray-600">{infraction.profile?.full_name}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    infraction.status_code === 'violation'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {infraction.status_code.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">Date:</span>
                  <p className="font-medium text-gray-900">
                    {new Date(infraction.start_time).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">Time:</span>
                  <p className="font-medium text-gray-900">
                    {new Date(infraction.start_time).toLocaleTimeString()}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">Activity:</span>
                  <p className="font-medium text-gray-900 capitalize">{infraction.activity_type}</p>
                </div>
                <div>
                  <span className="text-gray-600">Duration:</span>
                  <p className="font-medium text-gray-900">
                    {infraction.duration_minutes ? `${infraction.duration_minutes} min` : 'N/A'}
                  </p>
                </div>
              </div>

              {infraction.notes && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-sm text-gray-700">{infraction.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DrivingAnalysisReport({ companyId, selectedDriver, startDate, endDate, loading, setLoading }: ReportProps) {
  const [logs, setLogs] = useState<DriverLog[]>([]);

  useEffect(() => {
    loadDrivingData();
  }, [selectedDriver, startDate, endDate]);

  const loadDrivingData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('driver_logs')
        .select('*')
        .eq('company_id', companyId)
        .gte('start_time', startDate)
        .lte('start_time', endDate)
        .not('end_time', 'is', null);

      if (selectedDriver !== 'all') {
        query = query.eq('driver_id', selectedDriver);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading driving data:', error);
    } finally {
      setLoading(false);
    }
  };

  const analysisData = useMemo(() => {
    const totals = {
      driving: 0,
      work: 0,
      rest: 0,
      break: 0,
      available: 0,
    };

    logs.forEach((log) => {
      if (log.duration_minutes) {
        totals[log.activity_type] += log.duration_minutes;
      }
    });

    const totalMinutes = Object.values(totals).reduce((sum, val) => sum + val, 0);

    return Object.entries(totals).map(([type, minutes]) => ({
      type,
      minutes,
      hours: minutes / 60,
      percentage: totalMinutes > 0 ? (minutes / totalMinutes) * 100 : 0,
    }));
  }, [logs]);

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'driving':
        return 'bg-blue-600';
      case 'work':
        return 'bg-green-600';
      case 'rest':
        return 'bg-gray-600';
      case 'break':
        return 'bg-yellow-600';
      case 'available':
        return 'bg-purple-600';
      default:
        return 'bg-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const totalHours = analysisData.reduce((sum, item) => sum + item.hours, 0);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-gray-900">Driving Time Analysis</h3>

      {totalHours === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <PieChart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No activity data for selected period</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Activity Type</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-900">Total Hours</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-900">Percentage</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {analysisData
                  .filter((item) => item.hours > 0)
                  .map((item) => (
                    <tr key={item.type} className="border-b border-gray-100">
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-900 capitalize">{item.type}</span>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700">{item.hours.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-gray-700">{item.percentage.toFixed(1)}%</td>
                      <td className="py-3 px-4">
                        <div className="w-full bg-gray-200 rounded-full h-4">
                          <div
                            className={`${getActivityColor(item.type)} h-4 rounded-full`}
                            style={{ width: `${item.percentage}%` }}
                          ></div>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="bg-gray-50 rounded-lg p-6">
            <h4 className="font-semibold text-gray-900 mb-4">Visual Distribution</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {analysisData
                .filter((item) => item.hours > 0)
                .map((item) => (
                  <div key={item.type} className="text-center">
                    <div
                      className={`${getActivityColor(item.type)} w-20 h-20 rounded-full mx-auto mb-2 flex items-center justify-center`}
                    >
                      <span className="text-white font-bold text-lg">{item.percentage.toFixed(0)}%</span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 capitalize">{item.type}</p>
                    <p className="text-xs text-gray-600">{item.hours.toFixed(1)}h</p>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
