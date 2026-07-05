import { AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react';
import { format } from 'date-fns';
import type { TachoTimelineComparison } from '../../../lib/tacho/rules/types';

type TimelineComparisonTone = 'good' | 'warning' | 'neutral';

interface TimelineComparisonStatusProps {
  comparison?: TachoTimelineComparison;
  variant?: 'badge' | 'panel';
  contextLabel?: string;
}

function countAligned(comparison: TachoTimelineComparison) {
  return comparison.eventCountMatches && comparison.gapCountMatches && comparison.daySummaryCountMatches;
}

function hasTimelineFallback(comparison: TachoTimelineComparison) {
  return (
    comparison.available &&
    comparison.tachographActivityCount === 0 &&
    comparison.timelineEventCount > 0
  );
}

function getTone(comparison?: TachoTimelineComparison): TimelineComparisonTone {
  if (!comparison) return 'neutral';
  if (comparison.available && countAligned(comparison)) return 'good';
  return 'warning';
}

export function getTimelineComparisonLabel(comparison?: TachoTimelineComparison) {
  if (!comparison) return 'Timeline unchecked';
  if (!comparison.available) return 'Timeline missing';
  if (hasTimelineFallback(comparison)) return 'Timeline fallback active';
  if (countAligned(comparison)) return 'Timeline aligned';
  return 'Timeline mismatch';
}

function badgeStyles(tone: TimelineComparisonTone) {
  return {
    good: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    neutral: 'bg-slate-100 text-slate-600',
  }[tone];
}

function panelStyles(tone: TimelineComparisonTone) {
  return {
    good: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  }[tone];
}

function Icon({ tone }: { tone: TimelineComparisonTone }) {
  if (tone === 'good') return <CheckCircle2 className="h-4 w-4" />;
  if (tone === 'warning') return <AlertTriangle className="h-4 w-4" />;
  return <Clock3 className="h-4 w-4" />;
}

function formatCheckedAt(value?: string) {
  if (!value) return 'Not checked';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Checked';
  return `Checked ${format(date, 'dd MMM HH:mm')}`;
}

export function TimelineComparisonStatus({
  comparison,
  variant = 'panel',
  contextLabel = 'Timeline generation',
}: TimelineComparisonStatusProps) {
  const tone = getTone(comparison);
  const label = getTimelineComparisonLabel(comparison);

  if (variant === 'badge') {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${badgeStyles(tone)}`}>
        <Icon tone={tone} />
        {label}
      </span>
    );
  }

  return (
    <div className={`rounded-xl border p-4 text-sm ${panelStyles(tone)}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest opacity-75">{contextLabel}</p>
          <div className="mt-1 flex items-center gap-2">
            <Icon tone={tone} />
            <p className="font-black">{label}</p>
          </div>
          <p className="mt-2 text-xs font-semibold opacity-80">
            {comparison
              ? formatCheckedAt(comparison.checkedAt)
              : 'The legacy tachograph bundle loaded, but no timeline comparison has been attached yet.'}
          </p>
        </div>
        {comparison?.timelineGenerationId ? (
          <p className="break-all rounded-lg bg-white/70 px-3 py-2 text-[10px] font-black uppercase tracking-widest opacity-80">
            Generation {comparison.timelineGenerationId}
          </p>
        ) : null}
      </div>

      {comparison ? (
        <div className="mt-4 grid grid-cols-1 gap-2 text-xs font-semibold sm:grid-cols-3">
          <ComparisonCount
            label="Events"
            left={comparison.tachographActivityCount}
            right={comparison.timelineEventCount}
            aligned={comparison.eventCountMatches}
            fallback={hasTimelineFallback(comparison)}
          />
          <ComparisonCount
            label="Gaps"
            left={comparison.tachographGapCount}
            right={comparison.timelineGapCount}
            aligned={comparison.gapCountMatches}
          />
          <ComparisonCount
            label="Day summaries"
            left={comparison.tachographDaySummaryCount}
            right={comparison.timelineDailySummaryCount}
            aligned={comparison.daySummaryCountMatches}
          />
        </div>
      ) : null}

      {comparison?.warnings?.length ? (
        <div className="mt-3 space-y-1 text-xs font-semibold">
          {comparison.warnings.slice(0, 2).map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ComparisonCount({
  label,
  left,
  right,
  aligned,
  fallback = false,
}: {
  label: string;
  left: number;
  right: number;
  aligned: boolean;
  fallback?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/60 bg-white/70 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</p>
      <p className="mt-1">
        Tachograph {left} / timeline {right}
        <span className={`ml-2 font-black ${aligned ? 'text-emerald-700' : 'text-amber-800'}`}>
          {fallback ? 'fallback' : aligned ? 'aligned' : 'check'}
        </span>
      </p>
    </div>
  );
}
