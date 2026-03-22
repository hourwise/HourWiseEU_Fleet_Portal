import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompanyCompliance } from '../../hooks/useCompanyCompliance';
import { Activity, Users, TrendingUp, AlertTriangle, ChevronDown, ChevronUp, Calendar, ExternalLink, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const getScoreColor = (score: number): { text: string; bg: string; border: string; lightBg: string } => {
  if (score >= 90) return { text: 'text-emerald-700', bg: 'bg-emerald-500', border: 'border-emerald-200', lightBg: 'bg-emerald-50' };
  if (score >= 70) return { text: 'text-amber-700', bg: 'bg-amber-500', border: 'border-amber-200', lightBg: 'bg-amber-50' };
  return { text: 'text-rose-700', bg: 'bg-rose-500', border: 'border-rose-200', lightBg: 'bg-rose-50' };
};

export function ComplianceScoreboard() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  // Fetch data for the last 14 days to provide more context on violations
  const { complianceSummary, loading } = useCompanyCompliance(profile?.company_id, 14);
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);

  const overallStats = React.useMemo(() => {
    const totalDrivers = complianceSummary.length;
    if (totalDrivers === 0) return { avgScore: 100, totalViolations: 0, driversInViolation: 0 };

    const totalScore = complianceSummary.reduce((sum, driver) => sum + driver.averageScore, 0);
    const totalViolations = complianceSummary.reduce((sum, driver) => sum + driver.totalViolations, 0);
    const driversInViolation = complianceSummary.filter(d => d.averageScore < 95).length;

    return {
      avgScore: Math.round(totalScore / totalDrivers),
      totalViolations,
      driversInViolation,
    };
  }, [complianceSummary]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
      
      {/* Overall Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
                <span className={`text-3xl font-black ${getScoreColor(overallStats.avgScore).text}`}>{overallStats.avgScore}%</span>
            </div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('compliance.stats.avgScore')}</p>
          </div>

           <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-rose-50 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-rose-600" />
                </div>
                <span className="text-3xl font-black text-rose-700">{overallStats.totalViolations}</span>
            </div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('compliance.stats.totalInfringements')}</p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-amber-50 rounded-lg">
                  <Users className="w-6 h-6 text-amber-600" />
                </div>
                <span className="text-3xl font-black text-amber-700">{overallStats.driversInViolation}</span>
            </div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('compliance.stats.driversInViolation')}</p>
          </div>
      </div>

      {/* Driver List with Expansion for Details */}
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
            {complianceSummary.map((driver) => {
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
                          {driver.recentViolations.length > 0 ? t('compliance.status.actionNeeded', 'Action Required') : t('compliance.status.compliant', 'Compliant')}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex justify-between items-end mb-1">
                            <span className={`text-sm font-black ${colors.text}`}>{driver.averageScore}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2">
                            <div className={`${colors.bg} h-2 rounded-full transition-all duration-500`} style={{ width: `${driver.averageScore}%` }}></div>
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
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                          <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest">{t('compliance.recentActivity', 'Recent Infringements (14 Days)')}</h4>
                        </div>

                        {driver.recentViolations.length === 0 ? (
                          <div className="p-8 text-center">
                            <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-50" />
                            <p className="text-slate-500 font-medium">{t('compliance.noRecentViolations', 'No recorded infringements in the last 14 days.')}</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {driver.recentViolations.map((v, idx) => (
                              <div key={`${v.sessionId}-${idx}`} className="p-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                                <div className="flex items-center gap-4">
                                  <div className="p-2 bg-rose-50 rounded-lg">
                                    <Calendar className="w-4 h-4 text-rose-600" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-800">{new Date(v.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {v.violations.map((vText, i) => (
                                        <span key={i} className="text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded uppercase tracking-tighter">
                                          {vText}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right hidden sm:block">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('compliance.dayScore', 'Day Score')}</p>
                                    <p className={`font-bold ${getScoreColor(v.score).text}`}>{v.score}%</p>
                                  </div>
                                  <a
                                    href={`/manager/work-logs?driver=${driver.driverId}&date=${v.date}`}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                    title={t('compliance.viewSession', 'View Session')}
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                </div>
                              </div>
                            ))}
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
    </div>
  );
}
