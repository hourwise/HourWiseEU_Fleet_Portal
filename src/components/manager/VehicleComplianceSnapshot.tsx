import { useState, useEffect, useCallback, useMemo } from 'react';
import { subDays } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Truck, AlertTriangle, ChevronRight, ShieldAlert, Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface VehicleWarning {
  id: string;
  reg_number: string;
  type: 'MOT' | 'PMI' | 'TACHO' | 'VOR';
  due_date?: string;
  days_remaining?: number;
}

interface VehicleTachoReviewItem {
  vehicleId: string;
  regNumber: string;
  totalIssues: number;
  highSeverityIssues: number;
  unassignedMotionCount: number;
  driverMismatchCount: number;
  cardGapCount: number;
  technicalHighSeverityCount: number;
  latestIssueAt?: string;
  worstStatus: 'unassigned_motion' | 'card_gap' | 'driver_mismatch' | 'needs_review' | 'high_severity_vu' | 'none';
  latestSummary?: string;
}

const REVIEW_WINDOW_DAYS = 30;

export function VehicleComplianceSnapshot({
  onAction,
  onReviewVehicle,
}: {
  onAction: () => void;
  onReviewVehicle?: (vehicleId: string, focusedDate?: string) => void;
}) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [warnings, setWarnings] = useState<VehicleWarning[]>([]);
  const [tachoReviews, setTachoReviews] = useState<VehicleTachoReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWarnings = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('company_id', profile.company_id);

      if (error) throw error;

      const vehicleData = data || [];
      const newWarnings: VehicleWarning[] = [];
      const today = new Date();
      const reviewStart = subDays(today, REVIEW_WINDOW_DAYS).toISOString();

      vehicleData.forEach((v) => {
        if (v.is_vor) {
          newWarnings.push({
            id: v.id,
            reg_number: v.reg_number,
            type: 'VOR',
          });
        }

        if (v.mot_due_date) {
          const motDate = new Date(v.mot_due_date);
          const diff = Math.ceil((motDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diff < 14) {
            newWarnings.push({
              id: v.id,
              reg_number: v.reg_number,
              type: 'MOT',
              due_date: v.mot_due_date,
              days_remaining: diff,
            });
          }
        }

        if (v.pmi_due_date) {
          const pmiDate = new Date(v.pmi_due_date);
          const diff = Math.ceil((pmiDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diff < 14) {
            newWarnings.push({
              id: v.id,
              reg_number: v.reg_number,
              type: 'PMI',
              due_date: v.pmi_due_date,
              days_remaining: diff,
            });
          }
        }

        if (v.tacho_calibration_due) {
          const tachoDate = new Date(v.tacho_calibration_due);
          const diff = Math.ceil((tachoDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diff < 14) {
            newWarnings.push({
              id: v.id,
              reg_number: v.reg_number,
              type: 'TACHO',
              due_date: v.tacho_calibration_due,
              days_remaining: diff,
            });
          }
        }
      });

      const regByVehicleId = new Map(vehicleData.map((vehicle) => [vehicle.id, vehicle.reg_number]));
      const reviewMap = new Map<string, VehicleTachoReviewItem>();

      const { data: discrepancyRows, error: discrepancyError } = await supabase
        .from('tachograph_vehicle_motion_discrepancies' as any)
        .select('vehicle_id, discrepancy_date, severity, status, summary')
        .eq('company_id', profile.company_id)
        .gte('start_time', reviewStart)
        .order('start_time', { ascending: false });

      if (discrepancyError) throw discrepancyError;

      const { data: technicalEventRows, error: technicalEventError } = await supabase
        .from('tachograph_technical_events' as any)
        .select('vehicle_id, occurred_at, severity, rule_code, summary')
        .eq('company_id', profile.company_id)
        .gte('occurred_at', reviewStart)
        .in('severity', ['high', 'critical'])
        .order('occurred_at', { ascending: false });

      if (technicalEventError) throw technicalEventError;

      const ensureReview = (vehicleId: string | null | undefined) => {
        if (!vehicleId) return null;
        const existing = reviewMap.get(vehicleId);
        if (existing) return existing;

        const created: VehicleTachoReviewItem = {
          vehicleId,
          regNumber: regByVehicleId.get(vehicleId) ?? 'Unknown Vehicle',
          totalIssues: 0,
          highSeverityIssues: 0,
          unassignedMotionCount: 0,
          driverMismatchCount: 0,
          cardGapCount: 0,
          technicalHighSeverityCount: 0,
          worstStatus: 'none',
        };
        reviewMap.set(vehicleId, created);
        return created;
      };

      for (const row of (discrepancyRows as any[] | null) ?? []) {
        const review = ensureReview(row.vehicle_id);
        if (!review) continue;

        review.totalIssues += 1;
        if (row.severity === 'high' || row.severity === 'critical') review.highSeverityIssues += 1;
        if (row.status === 'unassigned_motion') review.unassignedMotionCount += 1;
        if (row.status === 'driver_mismatch') review.driverMismatchCount += 1;
        if (row.status === 'card_gap') review.cardGapCount += 1;
        if (!review.latestIssueAt || row.discrepancy_date > review.latestIssueAt) review.latestIssueAt = row.discrepancy_date;
        if (!review.latestSummary) review.latestSummary = row.summary;
        review.worstStatus = pickWorseStatus(review.worstStatus, row.status);
      }

      for (const row of (technicalEventRows as any[] | null) ?? []) {
        const review = ensureReview(row.vehicle_id);
        if (!review) continue;

        review.totalIssues += 1;
        review.highSeverityIssues += 1;
        review.technicalHighSeverityCount += 1;
        if (!review.latestIssueAt || row.occurred_at > review.latestIssueAt) review.latestIssueAt = row.occurred_at;
        if (!review.latestSummary) review.latestSummary = row.summary;
        review.worstStatus = pickWorseStatus(review.worstStatus, 'high_severity_vu');
      }

      setWarnings(newWarnings.sort((a, b) => (a.days_remaining || 0) - (b.days_remaining || 0)));
      setTachoReviews(
        Array.from(reviewMap.values()).sort((left, right) => {
          if (right.highSeverityIssues !== left.highSeverityIssues) return right.highSeverityIssues - left.highSeverityIssues;
          if (right.unassignedMotionCount !== left.unassignedMotionCount) return right.unassignedMotionCount - left.unassignedMotionCount;
          return right.totalIssues - left.totalIssues;
        })
      );
    } catch (loadError) {
      console.error('Error loading vehicle warnings:', loadError);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  useEffect(() => {
    if (profile?.company_id) {
      loadWarnings();
    }
  }, [loadWarnings, profile?.company_id]);

  const tachoTotals = useMemo(
    () => ({
      reviewVehicles: tachoReviews.length,
      unassignedMotion: tachoReviews.reduce((sum, item) => sum + item.unassignedMotionCount, 0),
      highSeverity: tachoReviews.reduce((sum, item) => sum + item.highSeverityIssues, 0),
    }),
    [tachoReviews]
  );

  if (loading) return <div className="animate-pulse bg-brand-card rounded-xl h-48 border border-brand-border" />;

  return (
    <div className="bg-brand-card rounded-xl shadow-sm border border-brand-border overflow-hidden">
      <div className="p-4 border-b border-brand-border flex items-center justify-between gap-3">
        <h3 className="font-bold text-white flex items-center gap-2">
          <Truck className="w-5 h-5 text-brand-accent" />
          {t('vehicleCompliance.title')}
        </h3>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="bg-red-500/10 text-red-500 text-xs font-black px-2 py-1 rounded">
            {t('vehicleCompliance.urgent', { count: warnings.length })}
          </span>
          <span className="bg-amber-500/10 text-amber-400 text-xs font-black px-2 py-1 rounded">
            {tachoTotals.reviewVehicles} Tacho Review
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <FleetReviewStat label="Vehicles" value={tachoTotals.reviewVehicles} tone="warning" />
          <FleetReviewStat label="Unassigned" value={tachoTotals.unassignedMotion} tone="danger" />
          <FleetReviewStat label="High Severity" value={tachoTotals.highSeverity} tone="danger" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Vehicle Compliance Alerts</p>
          </div>
          {warnings.length === 0 ? (
            <div className="rounded-lg border border-brand-border bg-brand-dark/30 p-4 text-sm text-slate-400">
              {t('vehicleCompliance.noAlerts')}
            </div>
          ) : (
            <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1">
              {warnings.slice(0, 5).map((w, idx) => (
                <button
                  key={`${w.id}-${w.type}-${idx}`}
                  onClick={onAction}
                  className="w-full flex items-center justify-between p-3 hover:bg-brand-dark/50 rounded-lg transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${w.type === 'VOR' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                      <AlertTriangle size={16} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-white">{w.reg_number}</p>
                      <p className="text-xs text-slate-400">
                        {w.type === 'VOR'
                          ? t('vehicleCompliance.offRoad')
                          : w.days_remaining! < 0
                          ? t('vehicleCompliance.dueOverdue', { type: w.type })
                          : t('vehicleCompliance.dueInDays', { type: w.type, days: w.days_remaining })}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white transition" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Tacho Review Queue</p>
          </div>
          {tachoReviews.length === 0 ? (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
              No recent unassigned motion or high-severity VU review items in the last {REVIEW_WINDOW_DAYS} days.
            </div>
          ) : (
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {tachoReviews.slice(0, 5).map((item) => (
                <button
                  key={item.vehicleId}
                  onClick={() => {
                    if (onReviewVehicle) {
                      onReviewVehicle(item.vehicleId, item.latestIssueAt?.slice(0, 10));
                      return;
                    }
                    onAction();
                  }}
                  className="w-full rounded-lg border border-brand-border bg-brand-dark/30 p-3 text-left hover:bg-brand-dark/50 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">{item.regNumber}</p>
                      <p className="mt-1 text-xs text-slate-400">{item.latestSummary ?? 'Vehicle movement and VU review items need checking.'}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.unassignedMotionCount > 0 ? (
                          <span className="rounded-full bg-red-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-red-400">
                            Unassigned {item.unassignedMotionCount}
                          </span>
                        ) : null}
                        {item.cardGapCount > 0 ? (
                          <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-amber-400">
                            Card Gap {item.cardGapCount}
                          </span>
                        ) : null}
                        {item.driverMismatchCount > 0 ? (
                          <span className="rounded-full bg-slate-500/20 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300">
                            Driver Mismatch {item.driverMismatchCount}
                          </span>
                        ) : null}
                        {item.technicalHighSeverityCount > 0 ? (
                          <span className="rounded-full bg-rose-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-rose-300">
                            High Severity VU {item.technicalHighSeverityCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${reviewTone(item.worstStatus)}`}>
                        {reviewLabel(item.worstStatus)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        <Link2 className="w-3 h-3" />
                        {item.totalIssues} issues
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={onAction}
        className="w-full p-3 text-xs font-bold text-slate-400 hover:text-white hover:bg-brand-dark/50 border-t border-brand-border transition uppercase tracking-widest"
      >
        {t('vehicleCompliance.viewFullList')}
      </button>
    </div>
  );
}

function FleetReviewStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'warning' | 'danger';
}) {
  const styles =
    tone === 'danger'
      ? 'border-red-500/20 bg-red-500/10 text-red-300'
      : 'border-amber-500/20 bg-amber-500/10 text-amber-300';

  return (
    <div className={`rounded-lg border p-3 ${styles}`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function pickWorseStatus(
  current: VehicleTachoReviewItem['worstStatus'],
  next: VehicleTachoReviewItem['worstStatus']
) {
  const rank: Record<VehicleTachoReviewItem['worstStatus'], number> = {
    unassigned_motion: 5,
    card_gap: 4,
    high_severity_vu: 3,
    driver_mismatch: 2,
    needs_review: 1,
    none: 0,
  };

  return rank[next] > rank[current] ? next : current;
}

function reviewTone(status: VehicleTachoReviewItem['worstStatus']) {
  switch (status) {
    case 'unassigned_motion':
      return 'bg-red-500/10 text-red-400';
    case 'card_gap':
    case 'high_severity_vu':
      return 'bg-amber-500/10 text-amber-400';
    case 'driver_mismatch':
      return 'bg-slate-500/20 text-slate-300';
    case 'needs_review':
      return 'bg-blue-500/10 text-blue-300';
    default:
      return 'bg-emerald-500/10 text-emerald-300';
  }
}

function reviewLabel(status: VehicleTachoReviewItem['worstStatus']) {
  switch (status) {
    case 'high_severity_vu':
      return 'High Severity VU';
    case 'none':
      return 'No Review Issues';
    default:
      return status.split('_').join(' ');
  }
}
