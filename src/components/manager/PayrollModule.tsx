import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Download, ChevronsRight } from 'lucide-react';
import { calculateDailyPay } from '../../lib/payCalculations';
import type { Database } from '../../lib/database.types';
import { useTranslation } from 'react-i18next';

type Profile = Database['public']['Tables']['profiles']['Row'];
type WorkSession = Database['public']['Tables']['work_sessions']['Row'];
type PayConfiguration = Database['public']['Tables']['pay_configurations']['Row'];
type Expense = Database['public']['Tables']['expenses']['Row'];

interface DriverWithPay extends Profile {
  pay_configurations: PayConfiguration | null;
  work_sessions: WorkSession[];
  expenses: Expense[];
}

// Helper to format date to YYYY-MM-DD
const toISODateString = (date: Date) => date.toISOString().split('T')[0];

export function PayrollModule() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [drivers, setDrivers] = useState<DriverWithPay[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date>(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)); // Set to Monday
    start.setHours(0, 0, 0, 0);
    return start;
  });
  const [endDate, setEndDate] = useState<Date>(() => new Date());

  useEffect(() => {
    if (profile?.company_id) {
      loadPayrollData();
    }
  }, [profile, startDate, endDate]);

  const loadPayrollData = async () => {
    if (!startDate || !endDate || !profile?.company_id) return;
    
    setLoading(true);
    const startDateString = toISODateString(startDate);
    const endDateString = toISODateString(endDate);

    try {
      const { data: driverData, error: driverError } = await supabase
          .from('profiles')
          .select('*, pay_configurations(*)')
          .eq('company_id', profile.company_id)
          .eq('role', 'driver');
      
      if (driverError) throw driverError;

      const driverIds = driverData?.map(d => d.id) || [];
      if (driverIds.length > 0) {
          const sessionsPromise = supabase.from('work_sessions').select('*').in('user_id', driverIds).gte('date', startDateString).lte('date', endDateString);
          const expensesPromise = supabase.from('expenses').select('*').in('user_id', driverIds).gte('date', startDateString).lte('date', endDateString);
          const [{data: sessionsData}, {data: expensesData}] = await Promise.all([sessionsPromise, expensesPromise]);

          const driversWithData = driverData?.map(driver => ({
              ...driver,
              work_sessions: sessionsData?.filter(s => s.user_id === driver.id) || [],
              expenses: expensesData?.filter(e => e.user_id === driver.id) || [],
          })) as DriverWithPay[];
          setDrivers(driversWithData);
      } else {
          setDrivers([]);
      }
    } catch (err) {
      console.error("Error loading payroll data:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const payrollData = useMemo(() => {
    return drivers.map(driver => {
        let wagePay = 0;
        let normalHours = 0;
        let overtimeHours = 0;

        if (driver.pay_configurations) {
            const sessionsByDate = driver.work_sessions.reduce((acc, s) => {
                if(s.date) (acc[s.date] = acc[s.date] || []).push(s);
                return acc;
            }, {} as Record<string, WorkSession[]>);

            const dailyPayDetails = Object.values(sessionsByDate).map(daySessions => 
                calculateDailyPay(daySessions, driver.pay_configurations!)
            );
            
            wagePay = dailyPayDetails.reduce((total, day) => total + day.totalPay, 0);
            normalHours = dailyPayDetails.reduce((total, day) => total + day.normalHours, 0);
            overtimeHours = dailyPayDetails.reduce((total, day) => total + day.overtimeHours, 0);
        }
        
        const totalExpenses = driver.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const grossPay = wagePay + totalExpenses;

        return {
            driverId: driver.id,
            driverName: driver.full_name,
            payrollNumber: driver.payroll_number || 'N/A',
            normalHours: normalHours.toFixed(2),
            overtimeHours: overtimeHours.toFixed(2),
            grossPay: grossPay.toFixed(2),
            wagePay: wagePay.toFixed(2),
            totalExpenses: totalExpenses.toFixed(2),
        };
    });
  }, [drivers]);

  const handleExportPayrollCSV = () => {
    const headers = [
      t('payroll.headers.driver'),
      'Payroll Number',
      t('payroll.labels.normal'),
      t('payroll.labels.overtime'),
      `${t('maintenance.title')} (£)`,
      `${t('payroll.labels.expenses')} (£)`,
      'Gross Pay (£)'
    ];
    const rows = payrollData.map(p => 
      [p.driverName, p.payrollNumber, p.normalHours, p.overtimeHours, p.wagePay, p.totalExpenses, p.grossPay].join(',')
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `payroll_${toISODateString(startDate)}_to_${toISODateString(endDate)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleExportExpensesCSV = () => {
    alert("Expense export functionality is not yet implemented.");
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">{t('payroll.title')}</h2>
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
            <div className="flex items-center gap-4">
              <div>
                <label htmlFor="startDate" className="text-sm font-medium text-gray-700">{t('payroll.startDate')}</label>
                <input
                  type="date"
                  id="startDate"
                  value={toISODateString(startDate)}
                  onChange={(e) => setStartDate(new Date(e.target.value))}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                />
              </div>
              <div>
                <label htmlFor="endDate" className="text-sm font-medium text-gray-700">{t('payroll.endDate')}</label>
                <input
                  type="date"
                  id="endDate"
                  value={toISODateString(endDate)}
                  onChange={(e) => setEndDate(new Date(e.target.value))}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                />
              </div>
            </div>
            <div className="flex gap-2">
               <button onClick={handleExportPayrollCSV} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
                  <Download className="w-5 h-5" />
                  {t('payroll.exportPayroll')}
               </button>
               <button onClick={handleExportExpensesCSV} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                  <Download className="w-5 h-5" />
                  {t('payroll.exportExpenses')}
               </button>
            </div>
        </div>
        {loading ? (
          <div className="flex justify-center items-center h-48">{t('payroll.loading')}</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-4 font-semibold">{t('payroll.headers.driver')}</th>
                <th className="p-4 font-semibold">{t('payroll.headers.hours')}</th>
                <th className="p-4 font-semibold">{t('payroll.headers.grossPay')}</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {payrollData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">{t('payroll.noData')}</td>
                </tr>
              ) : (
                payrollData.map(row => (
                  <tr key={row.driverId} className="border-b hover:bg-gray-50">
                    <td className="p-4 font-medium">{row.driverName} <span className="text-xs text-gray-500">({row.payrollNumber})</span></td>
                    <td className="p-4">{parseFloat(row.normalHours) + parseFloat(row.overtimeHours)}h ({row.normalHours} {t('payroll.labels.normal')} / {row.overtimeHours} {t('payroll.labels.overtime')})</td>
                    <td className="p-4">
                      <div className="font-medium">£{row.grossPay}</div>
                      <div className="text-sm text-gray-500">{t('payroll.labels.wages')}: £{row.wagePay} | {t('payroll.labels.expenses')}: £{row.totalExpenses}</div>
                    </td>
                    <td className="p-4">
                      <ChevronsRight className="w-5 h-5 text-gray-400" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
