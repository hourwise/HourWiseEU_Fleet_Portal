import { useAuth } from '../../contexts/AuthContext';
import { useDriverRiskScores } from '../../hooks/useDriverRiskScores';
import type { RiskColour } from '../../hooks/useDriverRiskScores';
import { ShieldAlert, ChevronRight, AlertTriangle, Clock, GraduationCap, FileWarning, Activity, MapPin } from 'lucide-react';

const COLOUR_CLASSES: Record<RiskColour, { bar: string; badge: string; text: string; bg: string }> = {
  green:  { bar: 'bg-green-500',  badge: 'bg-green-500/10 text-green-400',   text: 'text-green-400',  bg: 'bg-green-500/5'  },
  amber:  { bar: 'bg-amber-500',  badge: 'bg-amber-500/10 text-amber-400',   text: 'text-amber-400',  bg: 'bg-amber-500/5'  },
  orange: { bar: 'bg-orange-500', badge: 'bg-orange-500/10 text-orange-400', text: 'text-orange-400', bg: 'bg-orange-500/5' },
  red:    { bar: 'bg-red-500',    badge: 'bg-red-500/10 text-red-400',       text: 'text-red-400',    bg: 'bg-red-500/5'    },
};

function FactorPill({ icon: Icon, value, label, warn }: { icon: React.ElementType; value: number; label: string; warn: boolean }) {
  if (value === 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded ${warn ? 'bg-red-500/10 text-red-400' : 'bg-slate-700 text-slate-400'}`}>
      <Icon size={9} /> {value} {label}
    </span>
  );
}

export function DriverRiskSnapshot({ onAction }: { onAction: () => void }) {
  const { profile } = useAuth();
  const { riskScores, loading } = useDriverRiskScores(profile?.company_id ?? undefined);

  const critical = riskScores.filter(r => r.colour === 'red').length;
  const highRisk  = riskScores.filter(r => r.colour === 'orange').length;
  const flagged   = critical + highRisk;

  if (loading) {
    return (
      <div className="bg-brand-card rounded-xl border border-brand-border p-6 animate-pulse">
        <div className="h-5 bg-brand-dark rounded w-40 mb-4" />
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-14 bg-brand-dark rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (riskScores.length === 0) return null;

  return (
    <div className="bg-brand-card rounded-xl border border-brand-border overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-brand-border flex items-center justify-between">
        <h3 className="font-black text-white flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-brand-accent" />
          Driver Risk Scores
        </h3>
        <div className="flex items-center gap-2">
          {flagged > 0 && (
            <span className="text-xs font-black px-2 py-1 rounded bg-red-500/10 text-red-400">
              {flagged} need attention
            </span>
          )}
          <button onClick={onAction} className="text-xs font-bold text-brand-accent hover:underline flex items-center gap-1">
            Compliance <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {/* Driver list */}
      <div className="divide-y divide-brand-border/50 max-h-80 overflow-y-auto">
        {riskScores.map(driver => {
          const cls = COLOUR_CLASSES[driver.colour];
          const f = driver.factors;
          return (
            <button
              key={driver.driverId}
              onClick={onAction}
              className="w-full flex items-center gap-4 px-5 py-3 hover:bg-brand-dark/40 transition text-left group"
            >
              {/* Score bar + number */}
              <div className="w-12 flex-shrink-0 text-center">
                <p className={`text-lg font-black leading-none ${cls.text}`}>{driver.score}</p>
                <div className="mt-1 w-full bg-brand-dark rounded-full h-1">
                  <div className={`${cls.bar} h-1 rounded-full`} style={{ width: `${driver.score}%` }} />
                </div>
              </div>

              {/* Name + label + factors */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm text-white truncate">{driver.driverName}</p>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0 ${cls.badge}`}>
                    {driver.label}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  <FactorPill icon={AlertTriangle} value={f.openInfringements}  label="infringement"   warn={f.openInfringements > 0} />
                  <FactorPill icon={Activity}      value={f.tachoViolations}    label="tacho violation" warn={f.tachoViolations > 0} />
                  <FactorPill icon={MapPin}        value={f.missingMileageCount} label="missing mileage" warn={f.missingMileageCount > 0} />
                  <FactorPill icon={AlertTriangle} value={f.appMismatchCount}   label="mismatch"        warn={f.appMismatchCount > 0} />
                  <FactorPill icon={FileWarning}   value={f.documentsExpiring}   label="doc expiring"   warn={f.documentsExpiring > 0} />
                  <FactorPill icon={GraduationCap} value={f.incompleteTraining}  label="training due"   warn={f.incompleteTraining > 0} />
                  <FactorPill icon={Clock}          value={f.openDefects}         label="open defect"    warn={f.openDefects > 0} />
                  {f.openInfringements === 0 && f.tachoViolations === 0 && f.missingMileageCount === 0 && f.appMismatchCount === 0 && f.documentsExpiring === 0 && f.incompleteTraining === 0 && f.openDefects === 0 && (
                    <span className="text-[10px] text-slate-600 italic">No active flags</span>
                  )}
                </div>
              </div>

              <ChevronRight size={14} className="text-slate-600 group-hover:text-white transition flex-shrink-0" />
            </button>
          );
        })}
      </div>

      <button
        onClick={onAction}
        className="w-full p-3 text-[10px] font-black text-slate-400 hover:text-white hover:bg-brand-dark/50 border-t border-brand-border transition uppercase tracking-[0.2em]"
      >
        Open Compliance &amp; Infringement Register
      </button>
    </div>
  );
}
