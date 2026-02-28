import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, Download, Calendar, Filter, PieChart, DollarSign, Zap } from 'lucide-react'; // Added Zap icon
import type { Database } from '../../lib/database.types';
import { EfficiencyReport } from './reports/EfficiencyReport'; // Import the new report component

type DriverLog = Database['public']['Tables']['driver_logs']['Row'];
type WorkSession = Database['public']['Tables']['work_sessions']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

type ReportType = 'payroll' | 'infractions' | 'driving' | 'efficiency'; // Added 'efficiency'

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
              activeReport === 'payroll' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <DollarSign className="w-5 h-5" />
            Payroll Report
          </button>
          <button
            onClick={() => setActiveReport('efficiency')}
            className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition whitespace-nowrap ${
              activeReport === 'efficiency' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Zap className="w-5 h-5" />
            Efficiency Report
          </button>
          <button
            onClick={() => setActiveReport('infractions')}
            className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition whitespace-nowrap ${
              activeReport === 'infractions' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <FileText className="w-5 h-5" />
            Infraction Report
          </button>
          <button
            onClick={() => setActiveReport('driving')}
            className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition whitespace-nowrap ${
              activeReport === 'driving' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
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

          {activeReport === 'payroll' && <PayrollReport companyId={profile!.company_id!} selectedDriver={selectedDriver} startDate={startDate} endDate={endDate} loading={loading} setLoading={setLoading} />}
          {activeReport === 'efficiency' && <EfficiencyReport companyId={profile!.company_id!} selectedDriver={selectedDriver} startDate={startDate} endDate={endDate} loading={loading} setLoading={setLoading} />}
          {activeReport === 'infractions' && <InfractionsReport companyId={profile!.company_id!} selectedDriver={selectedDriver} startDate={startDate} endDate={endDate} loading={loading} setLoading={setLoading} />}
          {activeReport === 'driving' && <DrivingAnalysisReport companyId={profile!.company_id!} selectedDriver={selectedDriver} startDate={startDate} endDate={endDate} loading={loading} setLoading={setLoading} />}
        </div>
      </div>
    </div>
  );
}

// ... (The rest of the file remains the same)
// FilterSection, PayrollReport, etc.
