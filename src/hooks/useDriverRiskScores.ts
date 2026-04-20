import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

export type RiskLabel = 'Low Risk' | 'Medium Risk' | 'High Risk' | 'Critical';
export type RiskColour = 'green' | 'amber' | 'orange' | 'red';

export interface DriverRiskFactors {
  complianceScore: number;       // 0-100 avg over last 28 days
  openInfringements: number;     // count open/debriefed
  seriousInfringements: number;  // count of serious + very_serious
  documentsExpiring: number;     // count expiring within 30 days (incl. overdue)
  incompleteTraining: number;    // assigned modules not yet complete
  openDefects: number;           // defects filed by this driver still unresolved
}

export interface DriverRiskScore {
  driverId: string;
  driverName: string;
  score: number;
  label: RiskLabel;
  colour: RiskColour;
  factors: DriverRiskFactors;
}

function computeRisk(factors: DriverRiskFactors): { score: number; label: RiskLabel; colour: RiskColour } {
  let score = factors.complianceScore;

  // Infringement penalties
  score -= factors.openInfringements * 5;
  score -= factors.seriousInfringements * 10; // extra on top for serious

  // Document penalties
  score -= factors.documentsExpiring * 8;

  // Training penalties
  score -= factors.incompleteTraining * 5;

  // Defect penalties
  score -= factors.openDefects * 5;

  score = Math.max(0, Math.min(100, Math.round(score)));

  if (score >= 85) return { score, label: 'Low Risk',    colour: 'green'  };
  if (score >= 65) return { score, label: 'Medium Risk', colour: 'amber'  };
  if (score >= 40) return { score, label: 'High Risk',   colour: 'orange' };
  return               { score, label: 'Critical',    colour: 'red'    };
}

export function useDriverRiskScores(companyId: string | undefined) {
  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState<{
    drivers: { id: string; full_name: string; driving_licence_expiry: string | null; cpc_dqc_expiry: string | null }[];
    sessions: { user_id: string; compliance_score: number | null }[];
    infringements: { driver_id: string; severity: string; status: string }[];
    training: { driver_id: string; status: string }[];
    defects: { driver_id: string }[];
    documents: { user_id: string; expiry_date: string | null }[];
  }>({ drivers: [], sessions: [], infringements: [], training: [], defects: [], documents: [] });

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
      const todayStr = new Date().toISOString().split('T')[0];

      try {
        const [
          { data: drivers },
          { data: sessions },
          { data: infringements },
          { data: training },
          { data: defects },
          { data: documents },
        ] = await Promise.all([
          supabase.from('profiles')
            .select('id, full_name, driving_licence_expiry, cpc_dqc_expiry')
            .eq('company_id', companyId).eq('role', 'driver').eq('is_active', true),

          supabase.from('work_sessions')
            .select('user_id, compliance_score')
            .in('user_id',
              (await supabase.from('profiles').select('id').eq('company_id', companyId).eq('role', 'driver')).data?.map(d => d.id) ?? []
            )
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
        ]);

        setRaw({
          drivers: drivers ?? [],
          sessions: sessions ?? [],
          infringements: infringements ?? [],
          training: training ?? [],
          defects: defects ?? [],
          documents: documents ?? [],
        });
      } catch (e) {
        console.error('useDriverRiskScores error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [companyId]);

  const riskScores = useMemo<DriverRiskScore[]>(() => {
    const today = new Date().toISOString().split('T')[0];
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

      const factors: DriverRiskFactors = {
        complianceScore, openInfringements, seriousInfringements,
        documentsExpiring, incompleteTraining, openDefects,
      };

      return {
        driverId: driver.id,
        driverName: driver.full_name,
        ...computeRisk(factors),
        factors,
      };
    }).sort((a, b) => a.score - b.score); // worst first
  }, [raw]);

  return { riskScores, loading };
}
