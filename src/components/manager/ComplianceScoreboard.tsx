import { useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompanyCompliance } from '../../hooks/useCompanyCompliance';
import { supabase } from '../../lib/supabase';
import {
  Activity, Users, TrendingUp, AlertTriangle, ChevronDown, ChevronUp,
  Calendar, ShieldCheck, Plus, X, ClipboardList, Upload,
  Clock, Navigation, MapPin, AlertCircle
} from 'lucide-react';
import { TachoUploadZone } from './tachograph/TachoUploadZone';
import { TachoActivityTimeline } from './tachograph/TachoActivityTimeline';
import { useTranslation } from 'react-i18next';
import { format, startOfDay } from 'date-fns';
import type { DriverComplianceSummary, DriverComplianceSourceSummary } from '../../hooks/useCompanyCompliance';

interface ComplianceScoreboardProps {
  onViewSession?: (driverId: string, date: string) => void;
  onOpenDriverAnalysis?: (driverId: string, date?: string) => void;
}

const getScoreColor = (score: number): { text: string; bg: string; border: string; lightBg: string } => {
  if (score >= 90) return { text: 'text-emerald-700', bg: 'bg-emerald-500', border: 'border-emerald-200', lightBg: 'bg-emerald-50' };
  if (score >= 70) return { text: 'text-amber-700',   bg: 'bg-amber-500',   border: 'border-amber-200',   lightBg: 'bg-amber-50'   };
  return                  { text: 'text-rose-700',    bg: 'bg-rose-500',    border: 'border-rose-200',    lightBg: 'bg-rose-50'    };
};

const getTruthSummary = (driver: DriverComplianceSummary): DriverComplianceSourceSummary =>
  driver.tachoSummary.hasData ? driver.tachoSummary : driver.appSummary;

const getTruthSource = (driver: DriverComplianceSummary): 'tacho' | 'app' =>
  driver.tachoSummary.hasData ? 'tacho' : 'app';

// ─── Raise Infringement Modal ─────────────────────────────────────────────────

interface RaiseModalProps {
  driverId: string;
  driverName: string;
  sessionId: string;
  date: string;
  violations: string[];
  companyId: string;
  managerId: string;
  onClose: () => void;
  onRaised: () => void;
}

function RaiseInfringementModal({
  driverId, driverName, sessionId, date, violations,
  companyId, managerId, onClose, onRaised,
}: RaiseModalProps) {
  const [violationType, setViolationType] = useState(violations[0] ?? '');
  const [regulation, setRegulation] = useState<'REG_561' | 'WTD' | 'DOMESTIC' | 'OTHER'>('REG_561');
  const [severity, setSeverity] = useState<'minor' | 'serious' | 'very_serious'>('minor');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleRaise = async () => {
    if (!violationType.trim()) { setError('Violation type is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const { error: err } = await supabase.from('infringements').insert({
        company_id: companyId,
        driver_id: driverId,
        session_id: sessionId,
        violation_type: violationType,
        regulation,
        severity,
        occurred_at: date,
        status: 'open',
        manager_notes: notes || null,
        created_by: managerId,
      });
      if (err) throw err;
      onRaised();
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Failed to raise infringement.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h3 className="font-black text-slate-900 flex items-center gap-2">
              <ClipboardList size={16} className="text-rose-600" /> Raise Infringement
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{driverName} · {new Date(date).toLocaleDateString('en-GB')}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Violation type — pre-populated from session, editable */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Violation</label>
            {violations.length > 1 ? (
              <select
                value={violationType}
                onChange={e => setViolationType(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-rose-500"
              >
                {violations.map((v, i) => <option key={i} value={v}>{v}</option>)}
                <option value="__custom">Other (type below)…</option>
              </select>
            ) : (
              <input
                type="text"
                value={violationType}
                onChange={e => setViolationType(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-rose-500"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Regulation */}
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Regulation</label>
              <select
                value={regulation}
                onChange={e => setRegulation(e.target.value as typeof regulation)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-rose-500"
              >
                <option value="REG_561">EU Reg 561</option>
                <option value="WTD">WTD</option>
                <option value="DOMESTIC">Domestic</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {/* Severity */}
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Severity</label>
              <select
                value={severity}
                onChange={e => setSeverity(e.target.value as typeof severity)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-rose-500"
              >
                <option value="minor">Minor</option>
                <option value="serious">Serious</option>
                <option value="very_serious">Very Serious</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Initial Notes <span className="text-slate-400 normal-case font-normal">(optional)</span></label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Initial manager observations…"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-rose-500 resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="p-5 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-800 transition">Cancel</button>
          <button
            onClick={handleRaise}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-black transition disabled:opacity-50"
          >
            <Plus size={14} /> {saving ? 'Raising…' : 'Raise Infringement'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main scoreboard ──────────────────────────────────────────────────────────

export function ComplianceScoreboard({ onViewSession, onOpenDriverAnalysis }: ComplianceScoreboardProps) {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const { appSummary, tachoSummary, combinedSummary, loading } = useCompanyCompliance(profile?.company_id ?? undefined, 14);
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);
  const [raiseTarget, setRaiseTarget] = useState<{
    driverId: string; driverName: string; sessionId: string; date: string; violations: string[];
  } | null>(null);
  const [raisedSessions, setRaisedSessions] = useState<Set<string>>(new Set());

  const [showUpload, setShowUpload] = useState(false);

  const driverRows = useMemo(() => {
    return combinedSummary.map((driver) => {
      const truthSummary = getTruthSummary(driver);
      const truthSource = getTruthSource(driver);
      return {
        ...driver,
        truthSummary,
        truthSource,
        truthScore: truthSummary.averageScore,
        truthViolations: truthSummary.totalViolations,
        truthRecentViolations: truthSummary.recentViolations,
      };
    });
  }, [combinedSummary]);

  const overallStats = useMemo(() => {
    const totalDrivers = driverRows.length;
    if (totalDrivers === 0) return { avgScore: 100, totalViolations: 0, driversInViolation: 0 };
    const totalScore = driverRows.reduce((sum, d) => sum + d.truthScore, 0);
    const totalViolations = driverRows.reduce((sum, d) => sum + d.truthViolations, 0);
    const driversInViolation = driverRows.filter(d => d.truthScore < 95).length;
    return { avgScore: Math.round(totalScore / totalDrivers), totalViolations, driversInViolation };
  }, [driverRows]);

  const sourceStats = useMemo(() => {
    const verifiedDrivers = tachoSummary.filter((driver) => driver.tachoSummary.hasData).length;
    const appOnlyDrivers = driverRows.filter((driver) => driver.truthSource === 'app').length;
    const appCrossCheckAlerts = combinedSummary.filter(
      (driver) =>
        driver.tachoSummary.hasData &&
        (
          driver.tachoSummary.reconciliationSummary.totalIssues > 0 ||
          driver.appSummary.totalViolations > 0 ||
          driver.tachoSummary.missingMileage.length > 0
        )
    ).length;
    const reconciliationTotals = combinedSummary.reduce(
      (totals, driver) => {
        const summary = driver.tachoSummary.reconciliationSummary;
        totals.tachoOnlyDays += summary.tachoOnlyDays;
        totals.appOnlyDays += summary.appOnlyDays;
        totals.mismatchDurationDays += summary.mismatchDurationDays;
        totals.totalIssues += summary.totalIssues;
        return totals;
      },
      { tachoOnlyDays: 0, appOnlyDays: 0, mismatchDurationDays: 0, totalIssues: 0 }
    );

    return { verifiedDrivers, appOnlyDrivers, appCrossCheckAlerts, reconciliationTotals };
  }, [combinedSummary, driverRows, tachoSummary]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Activity className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t('compliance.title')}</h2>
            <p className="text-slate-500 font-medium">{t('compliance.subtitle', 'Monitor driver performance and EU regulation compliance')}</p>
          </div>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all ${
            showUpload
              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-200'
          }`}
        >
          {showUpload ? <X size={18} /> : <Upload size={18} />}
          {showUpload ? 'Close Upload' : 'Import Tacho Data'}
        </button>
      </div>

      {showUpload && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
          <TachoUploadZone />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 rounded-lg"><TrendingUp className="w-6 h-6 text-blue-600" /></div>
            <span className={`text-3xl font-black ${getScoreColor(overallStats.avgScore).text}`}>{overallStats.avgScore}%</span>
          </div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Truth Score</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-rose-50 rounded-lg"><AlertTriangle className="w-6 h-6 text-rose-600" /></div>
            <span className="text-3xl font-black text-rose-700">{overallStats.totalViolations}</span>
          </div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('compliance.stats.totalInfringements')}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-50 rounded-lg"><Users className="w-6 h-6 text-amber-600" /></div>
            <span className="text-3xl font-black text-amber-700">{overallStats.driversInViolation}</span>
          </div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('compliance.stats.driversInViolation')}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-50 rounded-lg"><ShieldCheck className="w-6 h-6 text-emerald-600" /></div>
            <span className="text-3xl font-black text-emerald-700">{sourceStats.verifiedDrivers}</span>
          </div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Verified Tacho Drivers</p>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{sourceStats.appOnlyDrivers} app-only fallback</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Source Precedence</p>
          <p className="text-sm text-blue-900 font-medium mt-1">
            Verified tachograph card / VU data is the compliance source of truth. App data remains visible as the clock-in, clock-out, rest, and manual-entry support layer.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Cross-check alerts</p>
          <p className="text-2xl font-black text-blue-900">{sourceStats.appCrossCheckAlerts}</p>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-2">
            {sourceStats.reconciliationTotals.tachoOnlyDays} tacho-only · {sourceStats.reconciliationTotals.appOnlyDays} app-only · {sourceStats.reconciliationTotals.mismatchDurationDays} duration mismatch
          </p>
        </div>
      </div>

      {/* Driver breakdown */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-900">{t('compliance.details.title', 'Driver Breakdown')}</h3>
        </div>

        {driverRows.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">{t('compliance.details.noDrivers')}</h3>
            <p className="text-slate-500">{t('compliance.details.noDriversSubtitle')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {driverRows.map(driver => {
              const isExpanded = expandedDriver === driver.driverId;
              const colors = getScoreColor(driver.truthScore);
              const appDriver = appSummary.find((entry) => entry.driverId === driver.driverId);
              const tachoDriver = tachoSummary.find((entry) => entry.driverId === driver.driverId);
              const latestTachoReviewDate =
                driver.tachoSummary.reviewFocus?.date ??
                driver.tachoSummary.recentViolations[0]?.date ??
                driver.missingMileage[0]?.start?.slice(0, 10);

              return (
                <div key={driver.driverId} className="transition-colors hover:bg-slate-50/30">
                  <button
                    onClick={() => setExpandedDriver(isExpanded ? null : driver.driverId)}
                    className="w-full flex items-center justify-between p-6 text-left"
                  >
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <div>
                        <p className="font-bold text-slate-900 text-lg">{driver.driverName}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <p className="text-xs font-black text-slate-400 uppercase tracking-tighter">
                            {driver.truthRecentViolations.length > 0
                            ? t('compliance.status.actionNeeded', 'Action Required')
                            : t('compliance.status.compliant', 'Compliant')}
                          </p>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${
                            driver.truthSource === 'tacho' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {driver.truthSource === 'tacho' ? 'Tacho Truth' : 'App Snapshot'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex justify-between items-end mb-1">
                            <span className={`text-sm font-black ${colors.text}`}>{driver.truthScore}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2">
                            <div className={`${colors.bg} h-2 rounded-full transition-all duration-500`} style={{ width: `${driver.truthScore}%` }} />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between md:justify-end gap-8">
                        <div className="text-center md:text-right">
                          <p className={`text-xl font-black ${driver.truthViolations > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {driver.truthViolations}
                          </p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t('compliance.details.headers.infringements')}</p>
                        </div>
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-6 pb-6 bg-slate-50/50 animate-in slide-in-from-top duration-200">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Column 1: Infringements */}
                        <div className="space-y-4">
                          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                              <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest">
                                {driver.truthSource === 'tacho' ? 'Verified Tacho Findings (14 Days)' : t('compliance.recentActivity', 'Recent App Findings (14 Days)')}
                              </h4>
                              <div className="flex items-center gap-2">
                                {driver.truthSource === 'tacho' && (
                                  <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded uppercase tracking-tighter">Source Of Truth</span>
                                )}
                                {driver.truthSource === 'tacho' && onOpenDriverAnalysis && latestTachoReviewDate && (
                                  <button
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onOpenDriverAnalysis(driver.driverId, latestTachoReviewDate);
                                    }}
                                    className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800"
                                  >
                                    Open Tacho Day
                                  </button>
                                )}
                              </div>
                            </div>
                            {driver.tachoSummary.reviewFocus?.summary && (
                              <div className="px-4 py-2 border-b border-slate-100 bg-blue-50/60 text-[11px] text-blue-900 font-medium">
                                Review focus: {driver.tachoSummary.reviewFocus.summary}
                              </div>
                            )}

                            {driver.truthRecentViolations.length === 0 ? (
                              <div className="p-8 text-center">
                                <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-50" />
                                <p className="text-slate-500 font-medium">{t('compliance.noRecentViolations', 'No recorded infringements in the last 14 days.')}</p>
                              </div>
                            ) : (
                              <div className="divide-y divide-slate-100">
                                {driver.truthRecentViolations.map((v, idx) => {
                                  const alreadyRaised = raisedSessions.has(v.sessionId);
                                  return (
                                    <div key={`${v.sessionId}-${idx}`} className="p-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                                      <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-lg ${v.source === 'tacho' ? 'bg-blue-50' : 'bg-rose-50'}`}>
                                          <Calendar className={`w-4 h-4 ${v.source === 'tacho' ? 'text-blue-600' : 'text-rose-600'}`} />
                                        </div>
                                        <div>
                                          <p className="font-bold text-slate-800">
                                            {new Date(v.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
                                          </p>
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {v.violations.map((vText, i) => (
                                              <span key={i} className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${
                                                v.source === 'tacho' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'
                                              }`}>
                                                {vText}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <div className="text-right hidden sm:block">
                                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('compliance.dayScore', 'Day Score')}</p>
                                          <p className={`font-bold ${getScoreColor(v.score).text}`}>{v.score}%</p>
                                        </div>
                                        {v.source === 'tacho' && onOpenDriverAnalysis && (
                                          <button
                                            onClick={event => {
                                              event.stopPropagation();
                                              onOpenDriverAnalysis(driver.driverId, v.date);
                                            }}
                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                                          >
                                            <Clock size={11} /> Open Day
                                          </button>
                                        )}
                                        <button
                                          onClick={e => {
                                            e.stopPropagation();
                                            setRaiseTarget({ driverId: driver.driverId, driverName: driver.driverName, sessionId: v.sessionId, date: v.date, violations: v.violations });
                                          }}
                                          disabled={alreadyRaised}
                                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black border transition ${
                                            alreadyRaised
                                              ? 'bg-green-50 border-green-200 text-green-600 cursor-default'
                                              : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                                          }`}
                                        >
                                          {alreadyRaised ? <><ShieldCheck size={11} /> Raised</> : <><Plus size={11} /> Raise</>}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="bg-slate-900 rounded-lg p-4 text-white">
                            <div className="flex items-center justify-between gap-3 mb-3">
                              <h4 className="text-xs font-black uppercase tracking-widest">App Clocking Snapshot</h4>
                              {onViewSession && appDriver && appDriver.appSummary.recentViolations[0] && (
                                <button
                                  onClick={() => onViewSession(driver.driverId, appDriver.appSummary.recentViolations[0].date)}
                                  className="text-[10px] font-black uppercase tracking-widest text-blue-300 hover:text-white"
                                >
                                  Open App Day
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-3 mb-3">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">App Score</p>
                                <p className="text-lg font-black">{appDriver?.appSummary.averageScore ?? driver.appSummary.averageScore}%</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">App Findings</p>
                                <p className="text-lg font-black">{appDriver?.appSummary.totalViolations ?? driver.appSummary.totalViolations}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Manual Entry Aid</p>
                                <p className="text-lg font-black">{driver.truthSource === 'tacho' ? 'Yes' : 'Primary'}</p>
                              </div>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              The mobile app remains the operational clocking record for previous clock-out, current clock-in, and daily rest guidance so the driver can complete head-unit manual entries correctly.
                            </p>
                          </div>

                          {driver.tachoSummary.reconciliationSummary.totalIssues > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                              <div className="flex items-center justify-between gap-3 mb-3">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                                  <h4 className="text-sm font-black text-amber-900 uppercase tracking-widest">App / Tacho Cross-check</h4>
                                </div>
                                {onOpenDriverAnalysis && latestTachoReviewDate && (
                                  <button
                                    onClick={() => onOpenDriverAnalysis(driver.driverId, latestTachoReviewDate)}
                                    className="text-[10px] font-black uppercase tracking-widest text-amber-700 hover:text-amber-900"
                                  >
                                    Review In Driver Card
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                <div className="bg-white/80 rounded p-3 border border-amber-100">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Tacho Only</p>
                                  <p className="text-lg font-black text-slate-900">{driver.tachoSummary.reconciliationSummary.tachoOnlyDays}</p>
                                </div>
                                <div className="bg-white/80 rounded p-3 border border-amber-100">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">App Only</p>
                                  <p className="text-lg font-black text-slate-900">{driver.tachoSummary.reconciliationSummary.appOnlyDays}</p>
                                </div>
                                <div className="bg-white/80 rounded p-3 border border-amber-100">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Duration Delta</p>
                                  <p className="text-lg font-black text-slate-900">{driver.tachoSummary.reconciliationSummary.mismatchDurationDays}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Missing Mileage Alerts */}
                          {driver.missingMileage && driver.missingMileage.length > 0 && (
                            <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <AlertCircle className="w-5 h-5 text-rose-600" />
                                <h4 className="text-sm font-black text-rose-900 uppercase tracking-widest">Missing Mileage Alerts</h4>
                              </div>
                              <div className="space-y-2">
                                {driver.missingMileage.map((gap, i) => (
                                  <div key={i} className="bg-white/80 rounded p-2 flex items-center justify-between gap-3 border border-rose-100">
                                    <div className="flex items-center gap-3">
                                      <Navigation className="w-4 h-4 text-rose-500" />
                                      <div>
                                        <p className="text-[11px] font-bold text-slate-800">
                                          {format(new Date(gap.start), 'HH:mm')} - {format(new Date(gap.end), 'HH:mm')}
                                        </p>
                                        <p className="text-[10px] text-slate-500">{gap.durationMins} mins · {gap.distanceKm} km</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {onOpenDriverAnalysis && (
                                        <button
                                          onClick={() => onOpenDriverAnalysis(driver.driverId, gap.start.slice(0, 10))}
                                          className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800"
                                        >
                                          Open Day
                                        </button>
                                      )}
                                      <span className="text-[10px] font-black text-rose-600 uppercase tracking-tighter">No App Session</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Column 2: Tacho Timeline */}
                        <div className="space-y-4">
                          <div className="bg-white rounded-lg border border-slate-200 p-4">
                            <div className="flex items-center gap-2 mb-4">
                              <Clock className="w-5 h-5 text-blue-600" />
                              <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Digital Tachograph View</h4>
                            </div>

                            {tachoDriver?.tachoActivities && tachoDriver.tachoActivities.length > 0 ? (
                              <div className="space-y-6">
                                {/* Only show most recent day with data for now */}
                                {(() => {
                                  const lastActivity = tachoDriver.tachoActivities[0];
                                  const lastDate = startOfDay(new Date(lastActivity.start_time));
                                  const dayActivities = tachoDriver.tachoActivities.filter(a =>
                                    startOfDay(new Date(a.start_time)).getTime() === lastDate.getTime()
                                  );
                                  return (
                                    <TachoActivityTimeline
                                      activities={dayActivities}
                                      date={lastDate}
                                    />
                                  );
                                })()}

                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <MapPin size={14} className="text-slate-400" />
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Tacho Source: Verified card / VU import</span>
                                  </div>
                                  <button
                                    onClick={() => {
                                      if (onOpenDriverAnalysis && latestTachoReviewDate) {
                                        onOpenDriverAnalysis(driver.driverId, latestTachoReviewDate);
                                      }
                                    }}
                                    className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                                  >
                                    View Full 28-Day Analysis
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-lg">
                                <Upload className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                                <p className="text-slate-400 text-xs font-medium">No tachograph data available.<br/>Upload files to see analysis.</p>
                              </div>
                            )}
                          </div>

                          <div className="bg-blue-600 rounded-lg p-4 text-white shadow-sm shadow-blue-200">
                            <h4 className="text-xs font-black uppercase tracking-widest mb-1 opacity-80">Manual Entry Guidance</h4>
                            <p className="text-xs font-medium leading-relaxed">
                              Use the app’s previous clock-out, current clock-in, and daily rest snapshot to guide driver manual entries, but always treat the verified tachograph record as the compliance truth.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Raise modal */}
      {raiseTarget && profile?.company_id && profile?.id && (
        <RaiseInfringementModal
          {...raiseTarget}
          companyId={profile.company_id}
          managerId={profile.id}
          onClose={() => setRaiseTarget(null)}
          onRaised={() => {
            setRaisedSessions(prev => new Set([...prev, raiseTarget.sessionId]));
            setRaiseTarget(null);
          }}
        />
      )}
    </div>
  );
}
