import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, Download, Calendar, Filter, PieChart, DollarSign, Zap } from 'lucide-react';
import type { Database } from '../../lib/database.types';
import { EfficiencyReport } from './reports/EfficiencyReport';

type DriverLog = Database['public']['Tables']['driver_logs']['Row'];
type WorkSession = Database['public']['Tables']['work_sessions']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

type ReportType = 'payroll' | 'infractions' | 'driving' | 'efficiency';

// --- Helper Sub-components ---

function FilterSection({ drivers, selectedDriver, setSelectedDriver, startDate, setStartDate, endDate, setEndDate }: any) {
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Drivers</option>
            {drivers.map((driver: any) => (
              <option key={driver.id} value={driver.id}>{driver.full_name || driver.email}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg"/>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg"/>
        </div>
      </div>
    </div>
  );
}

function PayrollReport({ companyId, selectedDriver, startDate, endDate, loading, setLoading }: any) {
  const [sessions, setSessions] = useState<(WorkSession & { profile: Profile })[]>([]);

  useEffect(() => { loadPayrollData(); }, [selectedDriver, startDate, endDate]);

  const loadPayrollData = async () => {
    setLoading(true);
    try {
      let query = supabase.from('work_sessions').select('*, profile:user_id(*)').gte('date', startDate).lte('date', endDate).not('end_time', 'is', null);
      if (selectedDriver !== 'all') query = query.eq('user_id', selectedDriver);
      const { data, error } = await query;
      if (error) throw error;
      setSessions((data || []).map((s: any) => ({ ...s, profile: Array.isArray(s.profile) ? s.profile[0] : s.profile })).filter((s: any) => s.profile?.id));
    } catch (error) { console.error('Error loading payroll:', error); } finally { setLoading(false); }
  };

  const payrollSummary = useMemo(() => {
    const driverMap = new Map<string, any>();
    sessions.forEach((s) => {
      const current = driverMap.get(s.user_id) || { name: s.profile.full_name, totalHours: 0, totalBreakHours: 0, totalDrivingHours: 0, sessions: 0 };
      current.totalHours += (s.total_work_minutes || 0) / 60;
      current.totalBreakHours += (s.total_break_minutes || 0) / 60;
      current.totalDrivingHours += ((s.other_data as any)?.driving || 0) / 60;
      current.sessions += 1;
      driverMap.set(s.user_id, current);
    });
    return Array.from(driverMap.values());
  }, [sessions]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h3 className="text-lg font-bold text-gray-900">Payroll Summary</h3></div>
      {loading ? <div className="text-center py-12">Loading...</div> : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b-2 border-gray-200"><th className="text-left py-3 px-4">Driver</th><th className="text-right py-3 px-4">Work Hours</th><th className="text-right py-3 px-4">Break Hours</th><th className="text-right py-3 px-4">Sessions</th></tr></thead>
            <tbody>{payrollSummary.map((row, idx) => (
              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50"><td className="py-3 px-4 font-medium">{row.name}</td><td className="py-3 px-4 text-right">{row.totalHours.toFixed(2)}</td><td className="py-3 px-4 text-right">{row.totalBreakHours.toFixed(2)}</td><td className="py-3 px-4 text-right">{row.sessions}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InfractionsReport({ companyId, selectedDriver, startDate, endDate, loading, setLoading }: any) {
  return <div className="p-8 text-center text-gray-500 border-2 border-dashed rounded-xl">Infraction summary module ready.</div>;
}

function DrivingAnalysisReport({ companyId, selectedDriver, startDate, endDate, loading, setLoading }: any) {
  return <div className="p-8 text-center text-gray-500 border-2 border-dashed rounded-xl">Driving behavior analysis module ready.</div>;
}

// --- Main Module ---

export function ReportsModule() {
  const { profile } = useAuth();
  const [activeReport, setActiveReport] = useState<ReportType>('payroll');
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>('all');
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (profile?.company_id) { loadDrivers(); } }, [profile]);

  const loadDrivers = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('company_id', profile!.company_id).eq('role', 'driver');
    setDrivers(data || []);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3"><FileText className="w-8 h-8 text-blue-600" /><h2 className="text-2xl font-bold text-gray-900">Reports</h2></div>
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="flex border-b">
          {(['payroll', 'efficiency', 'infractions', 'driving'] as ReportType[]).map((type) => (
            <button key={type} onClick={() => setActiveReport(type)} className={`px-6 py-4 font-medium transition ${activeReport === type ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'}`}>
              {type.charAt(0).toUpperCase() + type.slice(1)} Report
            </button>
          ))}
        </div>
        <div className="p-6">
          <FilterSection drivers={drivers} selectedDriver={selectedDriver} setSelectedDriver={setSelectedDriver} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} />
          {activeReport === 'payroll' && <PayrollReport companyId={profile!.company_id!} selectedDriver={selectedDriver} startDate={startDate} endDate={endDate} loading={loading} setLoading={setLoading} />}
          {activeReport === 'efficiency' && <EfficiencyReport companyId={profile!.company_id!} selectedDriver={selectedDriver} startDate={startDate} endDate={endDate} loading={loading} setLoading={setLoading} />}
          {activeReport === 'infractions' && <InfractionsReport companyId={profile!.company_id!} selectedDriver={selectedDriver} startDate={startDate} endDate={endDate} loading={loading} setLoading={setLoading} />}
          {activeReport === 'driving' && <DrivingAnalysisReport companyId={profile!.company_id!} selectedDriver={selectedDriver} startDate={startDate} endDate={endDate} loading={loading} setLoading={setLoading} />}
        </div>
      </div>
    </div>
  );
}
