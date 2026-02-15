import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Download, ChevronsRight } from 'lucide-react';
import { calculateDailyPay } from '../../lib/payCalculations';
import type { Database } from '../../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type WorkSession = Database['public']['Tables']['work_sessions']['Row'];
type PayConfiguration = Database['public']['Tables']['pay_configurations']['Row'];
type Expense = Database['public']['Tables']['expenses']['Row'];

interface DriverWithPay extends Profile {
  pay_configurations: PayConfiguration | null;
  work_sessions: WorkSession[];
  expenses: Expense[];
}

export function PayrollModule() {
  const { profile } = useAuth();
  const [drivers, setDrivers] = useState<DriverWithPay[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(new Date());

  useEffect(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)); // Set to Monday
    start.setHours(0, 0, 0, 0);
    setStartDate(start);
  }, []);

  useEffect(() => {
    if (profile?.company_id) {
      loadPayrollData();
    }
  }, [profile, startDate]);

  const loadPayrollData = async () => {
    setLoading(true);
    const endDate = new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000);
    const startDateString = startDate.toISOString().split('T')[0];
    const endDateString = endDate.toISOString().split('T')[0];

    try {
      // Corrected Supabase query with proper nested filtering
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          pay_configurations(*),
          work_sessions!inner(*),
          expenses!inner(*)
        `)
        .eq('company_id', profile!.company_id!)
        .eq('role', 'driver')
        .gte('work_sessions.date', startDateString)
        .lte('work_sessions.date', endDateString)
        .gte('expenses.date', startDateString)
        .lte('expenses.date', endDateString);

      if (error) throw error;
      setDrivers(data as DriverWithPay[] || []);
    } catch (err) {
      console.error("Error loading payroll data:", err);
      // If the above query fails (e.g., a driver has sessions but no expenses), fall back to separate queries
      if (err) {
          console.log("Fallback: Fetching payroll data in separate queries.");
          const { data: driverData, error: driverError } = await supabase
              .from('profiles')
              .select('*, pay_configurations(*)')
              .eq('company_id', profile!.company_id!)
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
      }
    } finally {
      setLoading(false);
    }
  };
  
  const payrollData = useMemo(() => {
    return drivers.map(driver => {
        let wagePay = 0;

        if (driver.pay_configurations) {
            const sessionsByDate = driver.work_sessions.reduce((acc, s) => {
                if(s.date) (acc[s.date] = acc[s.date] || []).push(s);
                return acc;
            }, {} as Record<string, WorkSession[]>);

            wagePay = Object.values(sessionsByDate).reduce((total, daySessions) => {
                return total + calculateDailyPay(daySessions, driver.pay_configurations!);
            }, 0);
        }
        
        const totalHours = driver.work_sessions.reduce((sum, s) => sum + (s.total_work_minutes || 0), 0) / 60;
        const totalExpenses = driver.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const grossPay = wagePay + totalExpenses;

        return {
            driverId: driver.id,
            driverName: driver.full_name,
            totalHours: totalHours.toFixed(2),
            grossPay: grossPay.toFixed(2),
            wagePay: wagePay.toFixed(2),
            totalExpenses: totalExpenses.toFixed(2),
        };
    });
  }, [drivers]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Payroll Summary</h2>
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
            <div/>
            <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
                <Download className="w-5 h-5" />
                Export CSV
            </button>
        </div>
        {loading ? (
          <div className="flex justify-center items-center h-48">Loading...</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-4 font-semibold">Driver</th>
                <th className="p-4 font-semibold">Total Hours</th>
                <th className="p-4 font-semibold">Gross Pay (inc. Expenses)</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {payrollData.map(row => (
                <tr key={row.driverId} className="border-b hover:bg-gray-50">
                  <td className="p-4 font-medium">{row.driverName}</td>
                  <td className="p-4">{row.totalHours}h</td>
                  <td className="p-4">
                    <div className="font-medium">£{row.grossPay}</div>
                    <div className="text-sm text-gray-500">Wages: £{row.wagePay} | Expenses: £{row.totalExpenses}</div>
                  </td>
                  <td className="p-4"><ChevronsRight className="w-5 h-5 text-gray-400" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
