import type { ManagerAcknowledgementSummary } from '../../lib/operationalAcknowledgements';

interface OperationalAcknowledgementBadgeProps {
  summary?: ManagerAcknowledgementSummary;
  loading: boolean;
}

export function OperationalAcknowledgementBadge({ summary, loading }: OperationalAcknowledgementBadgeProps) {
  if (loading || !summary || summary.status === 'not_required') return null;

  if (summary.status === 'acknowledged') {
    const timestamp = summary.acknowledgedAt ? formatAcknowledgedAt(summary.acknowledgedAt) : '';
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-300" title={timestamp ? `Acknowledged ${timestamp}` : 'Acknowledged'}>
        Acknowledged{timestamp ? ` · ${timestamp}` : ''}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-amber-300">
      Awaiting driver acknowledgement
    </span>
  );
}

function formatAcknowledgedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
