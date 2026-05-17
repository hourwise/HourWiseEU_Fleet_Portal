import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { TachoActivity } from '../lib/compliance';
import { MissingMileageGap } from '../lib/tachoAnalysis';
import { fetchCompanyTachoSignals } from '../lib/tacho/api';
import {
  buildDriverTachoComplianceSignal,
  type NormalizedDriverTachoComplianceSignal,
} from '../lib/tacho/normalizedSignals';
import type { TachoReconciliationSummary, TachoReviewFocus } from '../lib/tacho/rules/types';

type WorkSession = Database['public']['Tables']['work_sessions']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type TachoActivityRecord = TachoActivity & { driver_id?: string | null };

const EMPTY_RECONCILIATION_SUMMARY: TachoReconciliationSummary = {
  matchedDays: 0,
  tachoOnlyDays: 0,
  appOnlyDays: 0,
  mismatchDurationDays: 0,
  mismatchActivityDays: 0,
  uncertainDays: 0,
  totalIssues: 0,
};

export interface DriverViolation {
  date: string;
  violations: string[];
  score: number;
  sessionId: string;
  source: 'app' | 'tacho';
}

export interface DriverComplianceSourceSummary {
  averageScore: number;
  totalViolations: number;
  violations: string[];
  recentViolations: DriverViolation[];
  missingMileage: MissingMileageGap[];
  reconciliationSummary: TachoReconciliationSummary;
  reviewFocus?: TachoReviewFocus;
  hasData: boolean;
}

export interface DriverComplianceSummary {
  driverId: string;
  driverName: string;
  source: 'app' | 'tacho' | 'combined';
  averageScore: number;
  totalViolations: number;
  violations: string[]; // Unique list of all violation types
  recentViolations: DriverViolation[];
  tachoActivities: TachoActivityRecord[];
  missingMileage: MissingMileageGap[];
  appSummary: DriverComplianceSourceSummary;
  tachoSummary: DriverComplianceSourceSummary;
  combinedSummary: DriverComplianceSourceSummary;
}

export const useCompanyCompliance = (
  companyId: string | undefined,
  days = 7,
  options?: {
    tachoSignals?: NormalizedDriverTachoComplianceSignal[];
    normalizedFetch?: { enabled?: boolean };
  }
) => {
  const [data, setData] = useState<{
    profiles: Profile[],
    sessions: WorkSession[],
    tachoActivities: TachoActivityRecord[],
    normalizedSignals: NormalizedDriverTachoComplianceSignal[]
  }>({ profiles: [], sessions: [], tachoActivities: [], normalizedSignals: [] });
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
          setData({ profiles: [], sessions: [], tachoActivities: [], normalizedSignals: [] });
          return;
        }

        const driverIds = profiles.map(p => p.id);

        const normalizedSignalsPromise = options?.normalizedFetch?.enabled
          ? fetchCompanyTachoSignals(companyId, days)
              .then((result) => result.complianceSignals)
              .catch((error) => {
                console.error('Error fetching normalized tacho compliance signals:', error);
                return [] as NormalizedDriverTachoComplianceSignal[];
              })
          : Promise.resolve([] as NormalizedDriverTachoComplianceSignal[]);

        const [sessionsRes, tachoRes, normalizedSignals] = await Promise.all([
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
            .order('start_time', { ascending: false }),
          normalizedSignalsPromise,
        ]);

        if (sessionsRes.error) throw sessionsRes.error;
        if (tachoRes.error) throw tachoRes.error;

        setData({
          profiles: profiles || [],
          sessions: sessionsRes.data || [],
          tachoActivities: (tachoRes.data as any) || [],
          normalizedSignals,
        });
      } catch (error) {
        console.error('Error fetching company compliance data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [companyId, days, options?.normalizedFetch?.enabled]);

  const combinedSummary = useMemo<DriverComplianceSummary[]>(() => {
    if (!data.profiles.length) return [];

    return data.profiles.map(driver => {
      const driverSessions = data.sessions.filter(s => s.user_id === driver.id);
      const driverTacho = data.tachoActivities.filter(a => a.driver_id === driver.id);
      const tachoSignal =
        options?.tachoSignals?.find((signal) => signal.driverId === driver.id) ??
        data.normalizedSignals.find((signal) => signal.driverId === driver.id) ??
        buildDriverTachoComplianceSignal({
          driverId: driver.id,
          activities: driverTacho,
          workSessions: driverSessions as any,
        });
      const missingMileage = tachoSignal.missingMileage;

      const appViolations: DriverViolation[] = driverSessions
        .filter(s => (s.compliance_violations?.length ?? 0) > 0)
        .map(s => ({
          date: s.date,
          violations: s.compliance_violations || [],
          score: s.compliance_score ?? 100,
          sessionId: s.id,
          source: 'app'
        }));

      const tachoViolations: DriverViolation[] = tachoSignal.recentViolations;

      const allRecentViolations = [...appViolations, ...tachoViolations].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      const appAverageScore = driverSessions.length > 0
        ? Math.round(driverSessions.reduce((acc, s) => acc + (s.compliance_score ?? 100), 0) / driverSessions.length)
        : 100;
      const tachoAverageScore = tachoSignal.averageScore;

      const appSummary: DriverComplianceSourceSummary = {
        averageScore: appAverageScore,
        totalViolations: appViolations.length,
        violations: [...new Set(appViolations.flatMap(v => v.violations))],
        recentViolations: appViolations,
        missingMileage: [],
        reconciliationSummary: EMPTY_RECONCILIATION_SUMMARY,
        reviewFocus: undefined,
        hasData: driverSessions.length > 0,
      };

      const tachoSummary: DriverComplianceSourceSummary = {
        averageScore: tachoAverageScore,
        totalViolations: tachoViolations.length,
        violations: tachoSignal.violations,
        recentViolations: tachoViolations,
        missingMileage,
        reconciliationSummary: tachoSignal.reconciliationSummary ?? EMPTY_RECONCILIATION_SUMMARY,
        reviewFocus: tachoSignal.reviewFocus,
        hasData: tachoSignal.hasData,
      };

      const combinedSourceSummary: DriverComplianceSourceSummary = {
        averageScore: tachoSummary.hasData ? Math.min(appSummary.averageScore, tachoSummary.averageScore) : appSummary.averageScore,
        totalViolations: allRecentViolations.length,
        violations: [...new Set(allRecentViolations.flatMap(v => v.violations))],
        recentViolations: allRecentViolations,
        missingMileage,
        reconciliationSummary: tachoSummary.reconciliationSummary,
        reviewFocus: tachoSummary.reviewFocus,
        hasData: appSummary.hasData || tachoSummary.hasData,
      };

      return {
        driverId: driver.id,
        driverName: driver.full_name || 'Unnamed Driver',
        source: tachoSummary.hasData && !appSummary.hasData ? 'tacho' : tachoSummary.hasData ? 'combined' : 'app',
        averageScore: combinedSourceSummary.averageScore,
        totalViolations: combinedSourceSummary.totalViolations,
        violations: combinedSourceSummary.violations,
        recentViolations: combinedSourceSummary.recentViolations,
        tachoActivities: driverTacho,
        missingMileage,
        appSummary,
        tachoSummary,
        combinedSummary: combinedSourceSummary,
      };
    });
  }, [data, options?.tachoSignals]);

  const appSummary = useMemo<DriverComplianceSummary[]>(
    () =>
      combinedSummary.map((driver) => ({
        ...driver,
        source: 'app',
        averageScore: driver.appSummary.averageScore,
        totalViolations: driver.appSummary.totalViolations,
        violations: driver.appSummary.violations,
        recentViolations: driver.appSummary.recentViolations,
        missingMileage: [],
      })),
    [combinedSummary]
  );

  const tachoSummary = useMemo<DriverComplianceSummary[]>(
    () =>
      combinedSummary.map((driver) => ({
        ...driver,
        source: 'tacho',
        averageScore: driver.tachoSummary.averageScore,
        totalViolations: driver.tachoSummary.totalViolations,
        violations: driver.tachoSummary.violations,
        recentViolations: driver.tachoSummary.recentViolations,
        missingMileage: driver.tachoSummary.missingMileage,
      })),
    [combinedSummary]
  );

  return {
    appSummary,
    tachoSummary,
    combinedSummary,
    complianceSummary: combinedSummary,
    loading,
  };
};
