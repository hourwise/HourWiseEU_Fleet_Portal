import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, Download, PieChart, DollarSign, Zap, ShieldCheck, CheckCircle, AlertTriangle } from 'lucide-react';
import type { Database } from '../../lib/database.types';
import { EfficiencyReport } from './reports/EfficiencyReport';
import { useTranslation } from 'react-i18next';

type ReportType = 'payroll' | 'efficiency' | 'vehicle_checks' | 'infractions' | 'driving';
type Profile = Database['public']['Tables']['profiles']['Row'];
type WorkSession = Database['public']['Tables']['work_sessions']['Row'];

interface PayrollReportRow {
  name: string;
  totalHours: number;
  totalBreakHours: number;
  totalDrivingHours: number;
  sessions: number;
}

interface VehicleCheck {
  id: string;
  created_at: string;
  reg_number: string;
  vehicle_type: string;
  check_status: 'pass' | 'defect';
  defect_details: string | null;
  driver_id: string;
  profiles: {
    full_name: string;
  };
}

interface ReportComponentProps {
  companyId: string;
  selectedDriver: string;
  startDate: string;
  endDate: string;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

function PayrollReport({ companyId, selectedDriver, startDate, endDate, loading, setLoading }: ReportComponentProps) {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<(WorkSession & { profile: Profile })[]>([]);

  const loadPayrollData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from('work_sessions').select('*, profile:user_id(*)').gte('date', startDate).lte('date', endDate).not('end_time', 'is', null);
      if (selectedDriver !== 'all') query = query.eq('user_id', selectedDriver);
      const { data, error } = await query;
      if (error) throw error;
      setSessions((data || []).map((s: WorkSession & { profile: Profile | Profile[] }) => ({ ...s, profile: Array.isArray(s.profile) ? s.profile[0] : s.profile })).filter((s: WorkSession & { profile: Profile | undefined }) => s.profile?.id));
    } catch (error) { console.error('Error loading payroll:', error); } finally { setLoading(false); }
  }, [selectedDriver, startDate, endDate, setLoading]);

  useEffect(() => { loadPayrollData(); }, [loadPayrollData]);

  const payrollSummary = useMemo(() => {
    const driverMap = new Map<string, PayrollReportRow>();
    sessions.forEach((s) => {
      const current = driverMap.get(s.user_id) || { name: s.profile.full_name, totalHours: 0, totalBreakHours: 0, totalDrivingHours: 0, sessions: 0 };
      current.totalHours += (s.total_work_minutes || 0) / 60;
      current.totalBreakHours += (s.total_break_minutes || 0) / 60;
      current.totalDrivingHours += ((s.other_data as { driving?: number } | null)?.driving || 0) / 60;
      current.sessions += 1;
      driverMap.set(s.user_id, current);
    });
    return Array.from(driverMap.values());
  }, [sessions]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h3 className="text-lg font-bold text-gray-900">{t('reports.payroll.title')}</h3></div>
      {loading ? <div className="text-center py-12">{t('common.loading')}</div> : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b-2 border-gray-200">
              <th className="text-left py-3 px-4">{t('reports.payroll.headers.driver')}</th>
              <th className="text-right py-3 px-4">{t('reports.payroll.headers.workHours')}</th>
              <th className="text-right py-3 px-4">{t('reports.payroll.headers.breakHours')}</th>
              <th className="text-right py-3 px-4">{t('reports.payroll.headers.sessions')}</th>
            </tr></thead>
            <tbody>{payrollSummary.map((row, idx) => (
              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50"><td className="py-3 px-4 font-medium">{row.name}</td><td className="py-3 px-4 text-right">{row.totalHours.toFixed(2)}</td><td className="py-3 px-4 text-right">{row.totalBreakHours.toFixed(2)}</td><td className="py-3 px-4 text-right">{row.sessions}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VehicleChecksReport({ companyId, selectedDriver, startDate, endDate, loading, setLoading }: ReportComponentProps) {
  const { t } = useTranslation();
  const [checks, setChecks] = useState<VehicleCheck[]>([]);

  const loadChecks = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from('vehicle_checks').select('*, profiles:driver_id(full_name)').gte('created_at', startDate).lte('created_at', endDate + 'T23:59:59');
      if (selectedDriver !== 'all') query = query.eq('driver_id', selectedDriver);
      const { data, error } = await query;
      if (error) throw error;
      setChecks((data as VehicleCheck[]) || []);
    } catch (error) { console.error('Error loading checks:', error); } finally { setLoading(false); }
  }, [selectedDriver, startDate, endDate, setLoading]);

  useEffect(() => { loadChecks(); }, [loadChecks]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h3 className="text-lg font-bold text-gray-900">{t('reports.vehicleChecks.title')}</h3></div>
      {loading ? <div className="text-center py-12">{t('common.loading')}</div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="py-3 px-4">{t('reports.vehicleChecks.headers.dateTime')}</th>
                <th className="py-3 px-4">{t('reports.vehicleChecks.headers.inspector')}</th>
                <th className="py-3 px-4">{t('reports.vehicleChecks.headers.vehicle')}</th>
                <th className="py-3 px-4">{t('reports.vehicleChecks.headers.status')}</th>
                <th className="py-3 px-4">{t('reports.vehicleChecks.headers.defects')}</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((check, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm">{new Date(check.created_at).toLocaleString()}</td>
                  <td className="py-3 px-4 font-medium">{check.profiles.full_name}</td>
                  <td className="py-3 px-4">
                    <span className="font-bold">{check.reg_number}</span>
                    <span className="text-xs text-gray-500 ml-2">({check.vehicle_type})</span>
                  </td>
                  <td className="py-3 px-4">
                    {check.check_status === 'pass' ? (
                      <span className="text-green-600 bg-green-50 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 w-fit">
                        <CheckCircle size={12} /> {t('reports.vehicleChecks.status.pass')}
                      </span>
                    ) : (
                      <span className="text-red-600 bg-red-50 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 w-fit">
                        <AlertTriangle size={12} /> {t('reports.vehicleChecks.status.defect')}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600 italic">
                    {check.defect_details || t('reports.vehicleChecks.noneReported')}
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

function InfractionsReport({ companyId, selectedDriver, startDate, endDate, loading, setLoading }: any) {
  const { t } = useTranslation();
  return <div className="p-8 text-center text-gray-500 border-2 border-dashed rounded-xl">{t('reports.infractions.moduleReady')}</div>;
}

function DrivingAnalysisReport({ companyId, selectedDriver, startDate, endDate, loading, setLoading }: any) {
  const { t } = useTranslation();
  return <div className="p-8 text-center text-gray-500 border-2 border-dashed rounded-xl">{t('reports.driving.moduleReady')}</div>;
}

// --- Main Module ---

export function ReportsModule() {
  const { t } = useTranslation();
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

  const reportTabs: { id: ReportType; label: string; icon: any }[] = [
    { id: 'payroll', label: t('reports.tabs.payroll'), icon: DollarSign },
    { id: 'efficiency', label: t('reports.tabs.efficiency'), icon: Zap },
    { id: 'vehicle_checks', label: t('reports.tabs.vehicleChecks'), icon: ShieldCheck },
    { id: 'infractions', label: t('reports.tabs.infractions'), icon: AlertTriangle },
    { id: 'driving', label: t('reports.tabs.driving'), icon: PieChart },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-8 h-8 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">{t('reports.title')}</h2>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
        >
          <Download size={16} /> {t('reports.exportPdf')}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="flex border-b overflow-x-auto bg-slate-50">
          {reportTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveReport(tab.id)}
                className={`px-6 py-4 font-bold text-sm transition flex items-center gap-2 whitespace-nowrap ${
                  activeReport === tab.id
                    ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="p-6">
          <FilterSection drivers={drivers} selectedDriver={selectedDriver} setSelectedDriver={setSelectedDriver} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} />

          <div className="bg-white border rounded-xl p-6 shadow-sm min-h-[400px]">
            {activeReport === 'payroll' && <PayrollReport companyId={profile!.company_id!} selectedDriver={selectedDriver} startDate={startDate} endDate={endDate} loading={loading} setLoading={setLoading} />}
            {activeReport === 'efficiency' && <EfficiencyReport companyId={profile!.company_id!} selectedDriver={selectedDriver} startDate={startDate} endDate={endDate} loading={loading} setLoading={setLoading} />}
            {activeReport === 'vehicle_checks' && <VehicleChecksReport companyId={profile!.company_id!} selectedDriver={selectedDriver} startDate={startDate} endDate={endDate} loading={loading} setLoading={setLoading} />}
            {activeReport === 'infractions' && <InfractionsReport companyId={profile!.company_id!} selectedDriver={selectedDriver} startDate={startDate} endDate={endDate} loading={loading} setLoading={setLoading} />}
            {activeReport === 'driving' && <DrivingAnalysisReport companyId={profile!.company_id!} selectedDriver={selectedDriver} startDate={startDate} endDate={endDate} loading={loading} setLoading={setLoading} />}
          </div>
        </div>
      </div>
    </div>
  );
}
