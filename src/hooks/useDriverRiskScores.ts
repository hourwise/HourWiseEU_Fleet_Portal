import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { TachoActivity } from '../lib/compliance';
import { fetchCompanyTachoSignals } from '../lib/tacho/api';
import {
  buildDriverTachoComplianceSignal,
  buildDriverTachoRiskSignal,
  type NormalizedDriverTachoRiskSignal,
} from '../lib/tacho/normalizedSignals';
import type { TachoReconciliationSummary, TachoReviewFocus } from '../lib/tacho/rules/types';

export type RiskLabel = 'Low Risk' | 'Medium Risk' | 'High Risk' | 'Critical';
export type RiskColour = 'green' | 'amber' | 'orange' | 'red';
type TachoActivityRecord = TachoActivity & { driver_id?: string | null };

export interface DriverRiskFactors {
  complianceScore: number;       // 0-100 avg over last 28 days
  openInfringements: number;     // count open/debriefed
  seriousInfringements: number;  // count of serious + very_serious
  documentsExpiring: number;     // count expiring within 30 days (incl. overdue)
  incompleteTraining: number;    // assigned modules not yet complete
  openDefects: number;           // defects filed by this driver still unresolved
  tachoViolations: number;       // NEW: violations detected from .DDD files
  missingMileageCount: number;   // NEW: driving periods with no app session
  appMismatchCount: number;      // NEW: mismatch/discrepancy count from normalized tacho findings
}

export interface DriverTachoRiskSummary {
  driverId: string;
  legalComplianceScore: number;
  violationCount: number;
  missingMileageCount: number;
  appMismatchCount: number;
  reconciliationSummary?: TachoReconciliationSummary;
  reviewFocus?: TachoReviewFocus;
  source: 'raw_activity' | 'normalized_findings';
}

export interface DriverRiskSourceBreakdown {
  app: {
    complianceScore: number;
    openInfringements: number;
    seriousInfringements: number;
    documentsExpiring: number;
    incompleteTraining: number;
    openDefects: number;
  };
  tacho: DriverTachoRiskSummary;
}

export interface DriverRiskScore {
  driverId: string;
  driverName: string;
  score: number;
  label: RiskLabel;
  colour: RiskColour;
  factors: DriverRiskFactors;
  sourceBreakdown: DriverRiskSourceBreakdown;
}

function computeRisk(factors: DriverRiskFactors): { score: number; label: RiskLabel; colour: RiskColour } {
  let score = factors.complianceScore;

  // Infringement penalties
  score -= factors.openInfringements * 5;
  score -= factors.seriousInfringements * 10; // extra on top for serious
  score -= factors.tachoViolations * 12;      // Tacho violations are high priority

  // Document penalties
  score -= factors.documentsExpiring * 8;

  // Training penalties
  score -= factors.incompleteTraining * 5;

  // Defect penalties
  score -= factors.openDefects * 5;

  // Missing mileage penalties
  score -= factors.missingMileageCount * 7;

  // App/tacho reconciliation penalties
  score -= factors.appMismatchCount * 6;

  score = Math.max(0, Math.min(100, Math.round(score)));

  if (score >= 85) return { score, label: 'Low Risk',    colour: 'green'  };
  if (score >= 65) return { score, label: 'Medium Risk', colour: 'amber'  };
  if (score >= 40) return { score, label: 'High Risk',   colour: 'orange' };
  return               { score, label: 'Critical',    colour: 'red'    };
}

export function useDriverRiskScores(
  companyId: string | undefined,
  options?: {
    tachoSignals?: NormalizedDriverTachoRiskSignal[];
    normalizedFetch?: { enabled?: boolean };
  }
) {
  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState<{
    drivers: { id: string; full_name: string; driving_licence_expiry: string | null; cpc_dqc_expiry: string | null }[];
    sessions: { user_id: string; compliance_score: number | null; start_time: string; end_time: string | null }[];
    infringements: { driver_id: string; severity: string; status: string }[];
    training: { driver_id: string; status: string }[];
    defects: { driver_id: string }[];
    documents: { user_id: string; expiry_date: string | null }[];
    tachoActivities: TachoActivityRecord[];
    normalizedSignals: NormalizedDriverTachoRiskSignal[];
  }>({ drivers: [], sessions: [], infringements: [], training: [], defects: [], documents: [], tachoActivities: [], normalizedSignals: [] });

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }

    const fetch = async () => {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - 28);
      const sinceStr = since.toISOString().split('T')[0];
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 30);
      const horizonStr = horizon.toISOString().split('T')[0];

      try {
        const { data: profiles } = await supabase.from('profiles')
          .select('id, full_name, driving_licence_expiry, cpc_dqc_expiry')
          .eq('company_id', companyId).eq('role', 'driver').eq('is_active', true);

        if (!profiles) return;
        const driverIds = profiles.map(p => p.id);

        const normalizedSignalsPromise = options?.normalizedFetch?.enabled
          ? fetchCompanyTachoSignals(companyId, 28)
              .then((result) => result.riskSignals)
              .catch((error) => {
                console.error('Error fetching normalized tacho risk signals:', error);
                return [] as NormalizedDriverTachoRiskSignal[];
              })
          : Promise.resolve([] as NormalizedDriverTachoRiskSignal[]);

        const [
          { data: sessions },
          { data: infringements },
          { data: training },
          { data: defects },
          { data: documents },
          { data: tacho },
          normalizedSignals,
        ] = await Promise.all([
          supabase.from('work_sessions')
            .select('user_id, compliance_score, start_time, end_time')
            .in('user_id', driverIds)
            .gte('date', sinceStr),

          supabase.from('infringements')
            .select('driver_id, severity, status')
            .eq('company_id', companyId)
            .in('status', ['open', 'debriefed']),

          supabase.from('training_records')
            .select('driver_id, status')
            .eq('company_id', companyId)
            .in('status', ['assigned', 'in_progress']),

          supabase.from('vehicle_checks')
            .select('driver_id')
            .eq('company_id', companyId)
            .eq('check_status', 'defect')
            .neq('defect_lifecycle_status', 'fixed'),

          supabase.from('driver_documents')
            .select('user_id, expiry_date')
            .eq('company_id', companyId)
            .not('expiry_date', 'is', null)
            .lte('expiry_date', horizonStr),

          supabase.from('tachograph_activities')
            .select('*')
            .in('driver_id', driverIds)
            .gte('start_time', sinceStr),
          normalizedSignalsPromise,
        ]);

        setRaw({
          drivers: profiles ?? [],
          sessions: (sessions as any) ?? [],
          infringements: infringements ?? [],
          training: training ?? [],
          defects: defects ?? [],
          documents: documents ?? [],
          tachoActivities: (tacho as any) ?? [],
          normalizedSignals,
        });
      } catch (e) {
        console.error('useDriverRiskScores error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [companyId, options?.normalizedFetch?.enabled]);

  const riskScores = useMemo<DriverRiskScore[]>(() => {
    const horizon30 = new Date(); horizon30.setDate(horizon30.getDate() + 30);

    return raw.drivers.map(driver => {
      // Compliance score — average of last 28 days sessions (default 100 if none)
      const dSessions = raw.sessions.filter(s => s.user_id === driver.id);
      const complianceScore = dSessions.length
        ? Math.round(dSessions.reduce((s, x) => s + (x.compliance_score ?? 100), 0) / dSessions.length)
        : 100;

      // Infringements
      const dInfringements = raw.infringements.filter(i => i.driver_id === driver.id);
      const openInfringements = dInfringements.length;
      const seriousInfringements = dInfringements.filter(i => i.severity === 'serious' || i.severity === 'very_serious').length;

      // Documents expiring within 30 days (including overdue)
      const dDocs = raw.documents.filter(d => d.user_id === driver.id);
      let documentsExpiring = dDocs.length;
      // Also check profile-level licence/DQC expiry
      if (driver.driving_licence_expiry && driver.driving_licence_expiry <= horizon30.toISOString().split('T')[0]) documentsExpiring++;
      if (driver.cpc_dqc_expiry && driver.cpc_dqc_expiry <= horizon30.toISOString().split('T')[0]) documentsExpiring++;

      // Incomplete training
      const incompleteTraining = raw.training.filter(t => t.driver_id === driver.id).length;

      // Open defects
      const openDefects = raw.defects.filter(d => d.driver_id === driver.id).length;

      const dTacho = raw.tachoActivities.filter(a => a.driver_id === driver.id);
      const normalizedTacho =
        options?.tachoSignals?.find(signal => signal.driverId === driver.id) ??
        raw.normalizedSignals.find(signal => signal.driverId === driver.id);
      const tachoSignals: DriverTachoRiskSummary =
        normalizedTacho ??
        buildDriverTachoRiskSignal(
          buildDriverTachoComplianceSignal({
            driverId: driver.id,
            activities: dTacho,
            workSessions: dSessions as any,
          })
        );

      const factors: DriverRiskFactors = {
        complianceScore, openInfringements, seriousInfringements,
        documentsExpiring, incompleteTraining, openDefects,
        tachoViolations: tachoSignals.violationCount,
        missingMileageCount: tachoSignals.missingMileageCount,
        appMismatchCount: tachoSignals.appMismatchCount,
      };

      const sourceBreakdown: DriverRiskSourceBreakdown = {
        app: {
          complianceScore,
          openInfringements,
          seriousInfringements,
          documentsExpiring,
          incompleteTraining,
          openDefects,
        },
        tacho: tachoSignals,
      };

      return {
        driverId: driver.id,
        driverName: driver.full_name,
        ...computeRisk(factors),
        factors,
        sourceBreakdown,
      };
    }).sort((a, b) => a.score - b.score); // worst first
  }, [options?.tachoSignals, raw]);

  return { riskScores, loading };
}
