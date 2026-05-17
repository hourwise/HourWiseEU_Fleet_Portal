import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { AlertTriangle, ChevronRight, GraduationCap, Link2, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCompanyCompliance } from '../../hooks/useCompanyCompliance';

interface DriverWarning {
  driver_id: string;
  driver_name: string;
  doc_type: string;
  expiry_date: string;
  days_remaining: number;
}

export function DriverComplianceSnapshot({
  onAction,
  onReviewDriver,
}: {
  onAction: () => void;
  onReviewDriver?: (driverId: string, focusedDate?: string) => void;
}) {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [warnings, setWarnings] = useState<DriverWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const { combinedSummary } = useCompanyCompliance(profile?.company_id ?? undefined, 14);

  useEffect(() => {
    if (profile?.company_id) {
      loadDocumentWarnings(profile.company_id);
    }
  }, [profile]);

  const loadDocumentWarnings = async (companyId: string) => {
    try {
      const { data: docData, error: docError } = await supabase
        .from('driver_documents')
        .select(`
          expiry_date,
          document_type,
          user_id,
          profiles:user_id (full_name)
        `)
        .eq('company_id', companyId);

      if (docError) throw docError;

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, driving_licence_expiry, cpc_dqc_expiry')
        .eq('company_id', companyId)
        .eq('role', 'driver');

      if (profileError) throw profileError;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const newWarnings: DriverWarning[] = [];
      const processedKeys = new Set<string>();

      docData?.forEach((doc: any) => {
        if (!doc.expiry_date) return;

        const expiry = new Date(doc.expiry_date);
        const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diff <= 30) {
          const type = doc.document_type.replace('_', ' ');
          newWarnings.push({
            driver_id: doc.user_id,
            driver_name: doc.profiles?.full_name || 'Unknown Driver',
            doc_type: type,
            expiry_date: doc.expiry_date,
            days_remaining: diff
          });
          processedKeys.add(`${doc.user_id}-${type}`);
        }
      });

      profileData?.forEach((p: any) => {
        const licenceExpiry = p.driving_licence_expiry as string | null;
        if (licenceExpiry && !processedKeys.has(`${p.id}-HGV Licence`)) {
          const expiry = new Date(licenceExpiry);
          const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diff <= 30) {
            newWarnings.push({
              driver_id: p.id,
              driver_name: p.full_name,
              doc_type: 'Driving Licence',
              expiry_date: licenceExpiry,
              days_remaining: diff
            });
          }
        }

        const cpcExpiry = p.cpc_dqc_expiry as string | null;
        if (cpcExpiry && !processedKeys.has(`${p.id}-CPC Tacho`)) {
          const expiry = new Date(cpcExpiry);
          const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diff <= 30) {
            newWarnings.push({
              driver_id: p.id,
              driver_name: p.full_name,
              doc_type: 'CPC Card',
              expiry_date: cpcExpiry,
              days_remaining: diff
            });
          }
        }
      });

      setWarnings(newWarnings.sort((a, b) => a.days_remaining - b.days_remaining));
    } catch (error) {
      console.error('Error loading driver warnings:', error);
    } finally {
      setLoading(false);
    }
  };

  const tachoAlertCount = useMemo(
    () =>
      combinedSummary.filter(
        (driver) =>
          driver.tachoSummary.totalViolations > 0 ||
          driver.tachoSummary.missingMileage.length > 0 ||
          driver.tachoSummary.reconciliationSummary.totalIssues > 0
      ).length,
    [combinedSummary]
  );

  const reconciliationIssueCount = useMemo(
    () =>
      combinedSummary.reduce(
        (total, driver) => total + driver.tachoSummary.reconciliationSummary.totalIssues,
        0
      ),
    [combinedSummary]
  );

  const tachoReviewQueue = useMemo(
    () =>
      combinedSummary
        .filter(
          (driver) =>
            driver.tachoSummary.totalViolations > 0 ||
            driver.tachoSummary.missingMileage.length > 0 ||
            driver.tachoSummary.reconciliationSummary.totalIssues > 0
        )
        .sort((left, right) => {
          const rightWeight =
            right.tachoSummary.reconciliationSummary.totalIssues +
            right.tachoSummary.totalViolations +
            right.tachoSummary.missingMileage.length;
          const leftWeight =
            left.tachoSummary.reconciliationSummary.totalIssues +
            left.tachoSummary.totalViolations +
            left.tachoSummary.missingMileage.length;
          return rightWeight - leftWeight;
        })
        .slice(0, 5),
    [combinedSummary]
  );

  if (loading) return <div className="animate-pulse bg-brand-card rounded-xl h-48 border border-brand-border" />;

  return (
    <div className="bg-brand-card rounded-xl shadow-sm border border-brand-border overflow-hidden">
      <div className="p-4 border-b border-brand-border flex items-center justify-between">
        <h3 className="font-bold text-white flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-brand-accent" />
          {t('dashboard.manager.snapshots.driver')}
        </h3>
        <span className={`text-xs font-black px-2 py-1 rounded ${warnings.length > 0 ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
          {warnings.length === 1 ? t('dashboard.manager.snapshots.alertSingle') : t('dashboard.manager.snapshots.alerts', { count: warnings.length })}
        </span>
      </div>

      <div className="px-4 py-2 border-b border-brand-border/70 bg-brand-dark/30 flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
        <span className="text-slate-400">App Docs &amp; Licence Alerts</span>
        <div className="text-right">
          <span className={tachoAlertCount > 0 ? 'text-amber-400' : 'text-emerald-400'}>
            Tacho Alerts: {tachoAlertCount}
          </span>
          <p className="text-[9px] font-black text-slate-500 mt-1">Cross-check Issues: {reconciliationIssueCount}</p>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-brand-border/70 bg-brand-dark/20">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tacho Review Queue</p>
        </div>
        {tachoReviewQueue.length === 0 ? (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            No open tacho review drivers in the current manager snapshot window.
          </div>
        ) : (
          <div className="space-y-2">
            {tachoReviewQueue.map((driver) => (
              <button
                key={driver.driverId}
                onClick={() => {
                  if (onReviewDriver) {
                    onReviewDriver(
                      driver.driverId,
                      driver.tachoSummary.reviewFocus?.date
                        ?? driver.tachoSummary.recentViolations[0]?.date
                        ?? driver.tachoSummary.missingMileage[0]?.start?.slice(0, 10)
                    );
                    return;
                  }
                  onAction();
                }}
                className="w-full rounded-lg border border-brand-border bg-brand-dark/30 p-3 text-left hover:bg-brand-dark/50 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">{driver.driverName}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {driver.tachoSummary.reconciliationSummary.totalIssues} cross-check • {driver.tachoSummary.totalViolations} tacho alert
                      {driver.tachoSummary.totalViolations === 1 ? '' : 's'} • {driver.tachoSummary.missingMileage.length} missing mileage
                    </p>
                    {driver.tachoSummary.reviewFocus?.summary ? (
                      <p className="mt-1 text-[11px] text-slate-500">{driver.tachoSummary.reviewFocus.summary}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
                      driver.tachoSummary.reconciliationSummary.tachoOnlyDays > 0
                        ? 'bg-red-500/10 text-red-400'
                        : driver.tachoSummary.reconciliationSummary.totalIssues > 0
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'bg-slate-700 text-slate-300'
                    }`}>
                      {driver.tachoSummary.reconciliationSummary.tachoOnlyDays > 0 ? 'Tacho Only' : driver.tachoSummary.reconciliationSummary.totalIssues > 0 ? 'Cross-check' : 'Review'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <Link2 className="w-3 h-3" />
                      Open driver card
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-2 max-h-[300px] overflow-y-auto">
        {warnings.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-400 text-sm">{t('dashboard.manager.snapshots.noDriverAlerts')}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {warnings.map((w, idx) => (
              <button
                key={`${w.driver_id}-${w.doc_type}-${idx}`}
                onClick={onAction}
                className="w-full flex items-center justify-between p-3 hover:bg-brand-dark/50 rounded-lg transition group"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${w.days_remaining < 0 ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    <AlertTriangle size={16} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-white">{w.driver_name}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">
                      {w.doc_type}: {w.days_remaining < 0 ? t('fleet.status.overdue') : t('fleet.status.expiresIn', { days: w.days_remaining })}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white transition" />
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onAction}
        className="w-full p-3 text-[10px] font-black text-slate-400 hover:text-white hover:bg-brand-dark/50 border-t border-brand-border transition uppercase tracking-[0.2em]"
      >
        {t('dashboard.manager.snapshots.manageDocs')}
      </button>
    </div>
  );
}
