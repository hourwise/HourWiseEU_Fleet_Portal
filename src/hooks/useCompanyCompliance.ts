import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type WorkSession = Database['public']['Tables']['work_sessions']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface DriverComplianceSummary {
  driverId: string;
  driverName: string;
  averageScore: number;
  totalViolations: number;
  violations: string[];
}

// This hook now fetches data for all drivers in a company and calculates compliance.
export const useCompanyCompliance = (companyId: string | undefined, days = 7) => {
  const [data, setData] = useState<{ profiles: Profile[], sessions: WorkSession[] }>({ profiles: [], sessions: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      const today = new Date();
      const startDate = new Date();
      startDate.setDate(today.getDate() - days);
      const startDateString = startDate.toISOString().split('T')[0];

      try {
        // First, get all drivers for the company
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('company_id', companyId)
          .eq('role', 'driver');
        
        if (profilesError) throw profilesError;
        if (!profiles || profiles.length === 0) {
          setData({ profiles: [], sessions: [] });
          return;
        }

        const driverIds = profiles.map(p => p.id);

        // Then, get all relevant sessions for those drivers
        const { data: sessions, error: sessionsError } = await supabase
          .from('work_sessions')
          .select('user_id, compliance_score, compliance_violations')
          .in('user_id', driverIds) // Correctly filter by user IDs
          .gte('date', startDateString);

        if (sessionsError) throw sessionsError;

        setData({ profiles: profiles || [], sessions: sessions || [] });
      } catch (error) {
        console.error('Error fetching company compliance data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [companyId, days]);

  const complianceSummary = useMemo<DriverComplianceSummary[]>(() => {
    if (!data.profiles.length) return [];

    return data.profiles.map(driver => {
      const driverSessions = data.sessions.filter(s => s.user_id === driver.id);
      
      if (!driverSessions.length) {
        return {
          driverId: driver.id,
          driverName: driver.full_name,
          averageScore: 100,
          totalViolations: 0,
          violations: [],
        };
      }

      const totalScore = driverSessions.reduce((acc, s) => acc + (s.compliance_score ?? 100), 0);
      const averageScore = Math.round(totalScore / driverSessions.length);
      
      const allViolations = driverSessions.flatMap(s => s.compliance_violations || []);
      const uniqueViolations = [...new Set(allViolations)];

      return {
        driverId: driver.id,
        driverName: driver.full_name || 'Unnamed Driver',
        averageScore,
        totalViolations: allViolations.length,
        violations: uniqueViolations,
      };
    });
  }, [data]);

  return { complianceSummary, loading };
};
