import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { TachoActivity, analyzeTachoCompliance } from '../lib/compliance';
import { detectMissingMileage, MissingMileageGap } from '../lib/tachoAnalysis';

type WorkSession = Database['public']['Tables']['work_sessions']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

export interface DriverViolation {
  date: string;
  violations: string[];
  score: number;
  sessionId: string;
  source: 'app' | 'tacho';
}

export interface DriverComplianceSummary {
  driverId: string;
  driverName: string;
  averageScore: number;
  totalViolations: number;
  violations: string[]; // Unique list of all violation types
  recentViolations: DriverViolation[];
  tachoActivities: TachoActivity[];
  missingMileage: MissingMileageGap[];
}

export const useCompanyCompliance = (companyId: string | undefined, days = 7) => {
  const [data, setData] = useState<{
    profiles: Profile[],
    sessions: WorkSession[],
    tachoActivities: TachoActivity[]
  }>({ profiles: [], sessions: [], tachoActivities: [] });
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
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .eq('company_id', companyId)
          .eq('role', 'driver');
        
        if (profilesError) throw profilesError;
        if (!profiles || profiles.length === 0) {
          setData({ profiles: [], sessions: [], tachoActivities: [] });
          return;
        }

        const driverIds = profiles.map(p => p.id);

        const [sessionsRes, tachoRes] = await Promise.all([
          supabase
            .from('work_sessions')
            .select('*')
            .in('user_id', driverIds)
            .gte('date', startDateString)
            .order('date', { ascending: false }),
          supabase
            .from('tachograph_activities')
            .select('*')
            .in('driver_id', driverIds)
            .gte('start_time', startDate.toISOString())
            .order('start_time', { ascending: false })
        ]);

        if (sessionsRes.error) throw sessionsRes.error;
        if (tachoRes.error) throw tachoRes.error;

        setData({
          profiles: profiles || [],
          sessions: sessionsRes.data || [],
          tachoActivities: (tachoRes.data as any) || []
        });
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
      const driverTacho = data.tachoActivities.filter(a => a.driver_id === driver.id);

      // Analyze Tacho Compliance
      const tachoAnalysis = analyzeTachoCompliance(driverTacho);
      
      // Detect Missing Mileage
      const missingMileage = detectMissingMileage(driverTacho, driverSessions as any);

      const appViolations: DriverViolation[] = driverSessions
        .filter(s => (s.compliance_violations?.length ?? 0) > 0)
        .map(s => ({
          date: s.date,
          violations: s.compliance_violations || [],
          score: s.compliance_score ?? 100,
          sessionId: s.id,
          source: 'app'
        }));

      const tachoViolations: DriverViolation[] = tachoAnalysis.violations.map(v => ({
        date: v.date,
        violations: [v.type],
        score: tachoAnalysis.score,
        sessionId: 'tacho-' + v.date,
        source: 'tacho'
      }));

      const allRecentViolations = [...appViolations, ...tachoViolations].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      const totalViolations = allRecentViolations.length;
      const avgScore = driverSessions.length > 0
        ? Math.round(driverSessions.reduce((acc, s) => acc + (s.compliance_score ?? 100), 0) / driverSessions.length)
        : 100;

      const uniqueViolationTypes = [...new Set(allRecentViolations.flatMap(v => v.violations))];

      return {
        driverId: driver.id,
        driverName: driver.full_name || 'Unnamed Driver',
        averageScore: Math.min(avgScore, tachoAnalysis.score),
        totalViolations,
        violations: uniqueViolationTypes,
        recentViolations: allRecentViolations,
        tachoActivities: driverTacho,
        missingMileage
      };
    });
  }, [data]);

  return { complianceSummary, loading };
};
