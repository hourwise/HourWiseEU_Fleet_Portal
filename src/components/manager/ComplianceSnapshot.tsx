import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompanyCompliance } from '../../hooks/useCompanyCompliance';
import { Activity, TrendingUp, AlertTriangle, ChevronRight } from 'lucide-react';

const getScoreColor = (score: number) => {
  if (score >= 90) return 'text-green-500';
  if (score >= 70) return 'text-amber-500';
  return 'text-red-500';
};

export function ComplianceSnapshot({ onAction }: { onAction: () => void }) {
  const { profile } = useAuth();
  const { complianceSummary, loading } = useCompanyCompliance(profile?.company_id, 7);

  const stats = React.useMemo(() => {
    if (complianceSummary.length === 0) return { avgScore: 100, totalViolations: 0 };
    const totalScore = complianceSummary.reduce((sum, d) => sum + d.averageScore, 0);
    const totalViolations = complianceSummary.reduce((sum, d) => sum + d.totalViolations, 0);
    return {
      avgScore: Math.round(totalScore / complianceSummary.length),
      totalViolations
    };
  }, [complianceSummary]);

  if (loading) return <div className="animate-pulse bg-brand-card rounded-xl h-32 border border-brand-border" />;

  return (
    <div className="bg-brand-card rounded-xl shadow-sm border border-brand-border overflow-hidden">
      <div className="p-4 border-b border-brand-border flex items-center justify-between">
        <h3 className="font-bold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-brand-accent" />
          Fleet Compliance Score
        </h3>
        <button onClick={onAction} className="text-xs font-bold text-brand-accent hover:underline">
          View All
        </button>
      </div>

      <div className="p-6 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Average Score</p>
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-black ${getScoreColor(stats.avgScore)}`}>{stats.avgScore}%</span>
            <TrendingUp size={16} className="text-green-500" />
          </div>
        </div>

        <div className="text-right space-y-1">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">7-Day Infringements</p>
          <div className="flex items-center justify-end gap-2 text-red-500 font-black text-2xl">
            <AlertTriangle size={20} />
            {stats.totalViolations}
          </div>
        </div>
      </div>

      <button
        onClick={onAction}
        className="w-full p-3 text-[10px] font-black text-slate-400 hover:text-white hover:bg-brand-dark/50 border-t border-brand-border transition uppercase tracking-[0.2em] flex items-center justify-center gap-2"
      >
        Open Compliance Board <ChevronRight size={12} />
      </button>
    </div>
  );
}
