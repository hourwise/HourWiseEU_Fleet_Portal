import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompanyCompliance } from '../../hooks/useCompanyCompliance';
import { supabase } from '../../lib/supabase';
import {
  Activity, Users, TrendingUp, AlertTriangle, ChevronDown, ChevronUp,
  Calendar, ExternalLink, ShieldCheck, Plus, X, ClipboardList,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ComplianceScoreboardProps {
  onViewSession?: (driverId: string, date: string) => void;
}

const getScoreColor = (score: number): { text: string; bg: string; border: string; lightBg: string } => {
  if (score >= 90) return { text: 'text-emerald-700', bg: 'bg-emerald-500', border: 'border-emerald-200', lightBg: 'bg-emerald-50' };
  if (score >= 70) return { text: 'text-amber-700',   bg: 'bg-amber-500',   border: 'border-amber-200',   lightBg: 'bg-amber-50'   };
  return                  { text: 'text-rose-700',    bg: 'bg-rose-500',    border: 'border-rose-200',    lightBg: 'bg-rose-50'    };
};

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

export function ComplianceScoreboard({ onViewSession }: ComplianceScoreboardProps) {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const { complianceSummary, loading } = useCompanyCompliance(profile?.company_id, 14);
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);
  const [raiseTarget, setRaiseTarget] = useState<{
    driverId: string; driverName: string; sessionId: string; date: string; violations: string[];
  } | null>(null);
  const [raisedSessions, setRaisedSessions] = useState<Set<string>>(new Set());

  const overallStats = React.useMemo(() => {
    const totalDrivers = complianceSummary.length;
    if (totalDrivers === 0) return { avgScore: 100, totalViolations: 0, driversInViolation: 0 };
    const totalScore = complianceSummary.reduce((sum, d) => sum + d.averageScore, 0);
    const totalViolations = complianceSummary.reduce((sum, d) => sum + d.totalViolations, 0);
    const driversInViolation = complianceSummary.filter(d => d.averageScore < 95).length;
    return { avgScore: Math.round(totalScore / totalDrivers), totalViolations, driversInViolation };
  }, [complianceSummary]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-50 rounded-lg">
          <Activity className="w-8 h-8 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('compliance.title')}</h2>
          <p className="text-slate-500 font-medium">{t('compliance.subtitle', 'Monitor driver performance and EU regulation compliance')}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 rounded-lg"><TrendingUp className="w-6 h-6 text-blue-600" /></div>
            <span className={`text-3xl font-black ${getScoreColor(overallStats.avgScore).text}`}>{overallStats.avgScore}%</span>
          </div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('compliance.stats.avgScore')}</p>
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
      </div>

      {/* Driver breakdown */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-900">{t('compliance.details.title', 'Driver Breakdown')}</h3>
        </div>

        {complianceSummary.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">{t('compliance.details.noDrivers')}</h3>
            <p className="text-slate-500">{t('compliance.details.noDriversSubtitle')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {complianceSummary.map(driver => {
              const isExpanded = expandedDriver === driver.driverId;
              const colors = getScoreColor(driver.averageScore);

              return (
                <div key={driver.driverId} className="transition-colors hover:bg-slate-50/30">
                  <button
                    onClick={() => setExpandedDriver(isExpanded ? null : driver.driverId)}
                    className="w-full flex items-center justify-between p-6 text-left"
                  >
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <div>
                        <p className="font-bold text-slate-900 text-lg">{driver.driverName}</p>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-tighter">
                          {driver.recentViolations.length > 0
                            ? t('compliance.status.actionNeeded', 'Action Required')
                            : t('compliance.status.compliant', 'Compliant')}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex justify-between items-end mb-1">
                            <span className={`text-sm font-black ${colors.text}`}>{driver.averageScore}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2">
                            <div className={`${colors.bg} h-2 rounded-full transition-all duration-500`} style={{ width: `${driver.averageScore}%` }} />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between md:justify-end gap-8">
                        <div className="text-center md:text-right">
                          <p className={`text-xl font-black ${driver.totalViolations > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {driver.totalViolations}
                          </p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t('compliance.details.headers.infringements')}</p>
                        </div>
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-6 pb-6 bg-slate-50/50 animate-in slide-in-from-top duration-200">
                      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                          <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest">
                            {t('compliance.recentActivity', 'Recent Infringements (14 Days)')}
                          </h4>
                        </div>

                        {driver.recentViolations.length === 0 ? (
                          <div className="p-8 text-center">
                            <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-50" />
                            <p className="text-slate-500 font-medium">{t('compliance.noRecentViolations', 'No recorded infringements in the last 14 days.')}</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {driver.recentViolations.map((v, idx) => {
                              const alreadyRaised = raisedSessions.has(v.sessionId);
                              return (
                                <div key={`${v.sessionId}-${idx}`} className="p-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                                  <div className="flex items-center gap-4">
                                    <div className="p-2 bg-rose-50 rounded-lg">
                                      <Calendar className="w-4 h-4 text-rose-600" />
                                    </div>
                                    <div>
                                      <p className="font-bold text-slate-800">
                                        {new Date(v.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
                                      </p>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {v.violations.map((vText, i) => (
                                          <span key={i} className="text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded uppercase tracking-tighter">
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
                                    {/* Raise infringement button */}
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        setRaiseTarget({ driverId: driver.driverId, driverName: driver.driverName, sessionId: v.sessionId, date: v.date, violations: v.violations });
                                      }}
                                      disabled={alreadyRaised}
                                      title={alreadyRaised ? 'Infringement already raised for this session' : 'Raise as formal infringement'}
                                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black border transition ${
                                        alreadyRaised
                                          ? 'bg-green-50 border-green-200 text-green-600 cursor-default'
                                          : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                                      }`}
                                    >
                                      {alreadyRaised ? <><ShieldCheck size={11} /> Raised</> : <><Plus size={11} /> Raise</>}
                                    </button>
                                    <button
                                      onClick={() => onViewSession?.(driver.driverId, v.date)}
                                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                      title={t('compliance.viewSession', 'View Session')}
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
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
