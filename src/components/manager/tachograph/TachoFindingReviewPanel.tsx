import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import type {
  TachoCorrectiveActionType,
  TachoFinding,
  TachoFindingReview,
  TachoFindingReviewStatus,
} from '../../../lib/tacho/rules/types';

export interface TachoFindingReviewValues {
  status: TachoFindingReviewStatus;
  managerNote: string;
  correctiveActionType: TachoCorrectiveActionType | '';
}

export function TachoFindingReviewPanel({
  findings,
  reviewsByFindingId,
  pendingFindingId,
  error,
  selectedDay,
  title = 'Finding Review / Sign-off',
  emptyMessage = 'No tachograph findings are available to review for this selection.',
  onSave,
}: {
  findings: TachoFinding[];
  reviewsByFindingId: Record<string, TachoFindingReview>;
  pendingFindingId: string | null;
  error: string | null;
  selectedDay: string | null;
  title?: string;
  emptyMessage?: string;
  onSave: (finding: TachoFinding, values: TachoFindingReviewValues) => Promise<void>;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="mb-4 flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{title}</h3>
      </div>
      <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-600">
        {selectedDay
          ? `Showing findings for ${format(new Date(`${selectedDay}T12:00:00`), 'dd MMM yyyy')}.`
          : 'No day selected. Showing the latest findings in this range.'}
        {' '}Saved reviews are stored separately from generated parser findings and appear in driver-file tacho actions when linked to a driver.
      </div>
      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
      {findings.length === 0 ? (
        <p className="text-sm font-medium text-slate-500">{emptyMessage}</p>
      ) : (
        <div className="space-y-3">
          {findings.map((finding) => (
            <TachoFindingReviewCard
              key={finding.id}
              finding={finding}
              review={reviewsByFindingId[finding.id]}
              pending={pendingFindingId === finding.id}
              onSave={onSave}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TachoFindingReviewCard({
  finding,
  review,
  pending,
  onSave,
}: {
  finding: TachoFinding;
  review?: TachoFindingReview;
  pending: boolean;
  onSave: (finding: TachoFinding, values: TachoFindingReviewValues) => Promise<void>;
}) {
  const [status, setStatus] = useState<TachoFindingReviewStatus>(review?.status ?? 'open');
  const [managerNote, setManagerNote] = useState(review?.managerNote ?? '');
  const [correctiveActionType, setCorrectiveActionType] = useState<TachoCorrectiveActionType | ''>(review?.correctiveActionType ?? '');

  useEffect(() => {
    setStatus(review?.status ?? 'open');
    setManagerNote(review?.managerNote ?? '');
    setCorrectiveActionType(review?.correctiveActionType ?? '');
  }, [review?.correctiveActionType, review?.managerNote, review?.status]);

  const statusTone = {
    open: 'border-slate-200 bg-white text-slate-700',
    reviewed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    action_required: 'border-amber-200 bg-amber-50 text-amber-800',
    closed: 'border-blue-200 bg-blue-50 text-blue-700',
  }[status];

  return (
    <div className={`rounded-2xl border p-4 ${statusTone}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest">{finding.severity}</span>
            <span className="text-[10px] font-black uppercase tracking-widest opacity-80">{finding.ruleCode}</span>
            <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest">{finding.source.replace('_', ' ')}</span>
            {review?.driverAcknowledgedAt ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                Driver acknowledged
              </span>
            ) : null}
          </div>
          <h4 className="mt-2 text-sm font-black text-slate-950">{finding.title}</h4>
          <p className="mt-1 text-xs font-medium text-slate-600">{finding.summary}</p>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
            {format(new Date(finding.periodStart), 'dd MMM HH:mm')} - {format(new Date(finding.periodEnd), 'dd MMM HH:mm')}
          </p>
          {review?.updatedAt ? <p className="mt-2 text-[11px] font-semibold text-slate-500">Last saved {format(new Date(review.updatedAt), 'dd MMM HH:mm')}</p> : null}
          {review?.driverAcknowledgedAt ? <p className="mt-1 text-[11px] font-semibold text-emerald-700">Acknowledged {format(new Date(review.driverAcknowledgedAt), 'dd MMM HH:mm')}</p> : null}
        </div>
        <div className="grid min-w-full gap-2 lg:min-w-[28rem]">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <label className="text-xs font-bold text-slate-600">
              Review status
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as TachoFindingReviewStatus)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
              >
                <option value="open">Open</option>
                <option value="reviewed">Reviewed</option>
                <option value="action_required">Action required</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <label className="text-xs font-bold text-slate-600">
              Corrective action
              <select
                value={correctiveActionType}
                onChange={(event) => {
                  const nextAction = event.target.value as TachoCorrectiveActionType | '';
                  setCorrectiveActionType(nextAction);
                  if (nextAction && status === 'open') setStatus('action_required');
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
              >
                <option value="">None yet</option>
                <option value="training">Training</option>
                <option value="manager_debrief">Manager debrief</option>
                <option value="manual_entry">Manual entry correction</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
          <label className="text-xs font-bold text-slate-600">
            Manager note
            <textarea
              value={managerNote}
              onChange={(event) => setManagerNote(event.target.value)}
              rows={2}
              placeholder="Record review decision, debrief note, or corrective action context."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800"
            />
          </label>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void onSave(finding, { status, managerNote, correctiveActionType })}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {pending ? 'Saving' : 'Save Review'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
