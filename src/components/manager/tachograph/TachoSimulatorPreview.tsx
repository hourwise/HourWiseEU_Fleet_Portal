import { useEffect, useMemo, useState } from 'react';
import { Braces, ClipboardList, FlaskConical, Route, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { TachoActivityTimeline } from './TachoActivityTimeline';
import { TachoDayDetailDrawer } from './TachoDayDetailDrawer';
import { VehicleHistoryLedger } from './VehicleHistoryLedger';
import { evaluateTachoSimulationScenario } from '../../../lib/tacho/simulator/scenarioCompiler';
import { TACHO_SIMULATION_SCENARIOS } from '../../../lib/tacho/simulator/scenarioLibrary';
import type {
  TachoDaySummary,
  TachoFinding,
  TachoReconciliationItem,
  VehicleMotionDiscrepancy,
} from '../../../lib/tacho/rules/types';

const EMPTY_FINDINGS: TachoFinding[] = [];
const EMPTY_RECONCILIATION: TachoReconciliationItem[] = [];
const EMPTY_DAY_SUMMARIES: TachoDaySummary[] = [];
const EMPTY_DISCREPANCIES: VehicleMotionDiscrepancy[] = [];
const EMPTY_DRIVER_NAMES: Record<string, string> = {};

function minsToHours(mins: number) {
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function getInitialDay(
  days: TachoDaySummary[],
  reconciliation: TachoReconciliationItem[],
  technicalEvents: TachoFinding[],
  discrepancies: VehicleMotionDiscrepancy[]
) {
  return (
    days.find(
      (day) =>
        day.findingsCount > 0 ||
        reconciliation.some((item) => item.date === day.date && item.status !== 'matched') ||
        technicalEvents.some((event) => event.periodStart.slice(0, 10) <= day.date && event.periodEnd.slice(0, 10) >= day.date) ||
        discrepancies.some((item) => item.date === day.date)
    ) ??
    days[0] ??
    null
  );
}

export function TachoSimulatorPreview() {
  const [scenarioId, setScenarioId] = useState(TACHO_SIMULATION_SCENARIOS[0]?.id ?? '');
  const [selectedDay, setSelectedDay] = useState<TachoDaySummary | null>(null);

  const scenario = useMemo(
    () => TACHO_SIMULATION_SCENARIOS.find((item) => item.id === scenarioId) ?? TACHO_SIMULATION_SCENARIOS[0],
    [scenarioId]
  );

  const previewState = useMemo(() => {
    if (!scenario) {
      return { preview: null, error: null };
    }

    try {
      return { preview: evaluateTachoSimulationScenario(scenario), error: null };
    } catch (error) {
      return {
        preview: null,
        error: error instanceof Error ? error.message : 'Unknown simulator error.',
      };
    }
  }, [scenario]);

  const preview = previewState.preview;
  const previewError = previewState.error;

  const reconciliation = preview?.result.reconciliationItems ?? EMPTY_RECONCILIATION;
  const findings = preview?.result.combinedFindings ?? EMPTY_FINDINGS;
  const daySummaries = preview?.result.daySummaries ?? EMPTY_DAY_SUMMARIES;
  const technicalEvents = preview?.technicalEvents ?? EMPTY_FINDINGS;
  const discrepancies = preview?.discrepancies ?? EMPTY_DISCREPANCIES;
  const driverNameById = useMemo(
    () =>
      scenario
        ? {
            ...(scenario.driverLabels ?? {}),
            [scenario.driverId]: scenario.driverLabels?.[scenario.driverId] ?? scenario.driverId,
          }
        : EMPTY_DRIVER_NAMES,
    [scenario]
  );

  useEffect(() => {
    if (previewError) {
      setSelectedDay(null);
      return;
    }

    setSelectedDay(getInitialDay(daySummaries, reconciliation, technicalEvents, discrepancies));
  }, [daySummaries, discrepancies, previewError, reconciliation, scenarioId, technicalEvents]);

  const timelineDays = useMemo(
    () =>
      daySummaries.map((day) => ({
        date: new Date(`${day.date}T12:00:00Z`),
        activities: day.activities,
        markers:
          day.findingsCount +
          reconciliation.filter((item) => item.date === day.date && item.status !== 'matched').length +
          technicalEvents.filter((event) => event.periodStart.slice(0, 10) <= day.date && event.periodEnd.slice(0, 10) >= day.date).length +
          discrepancies.filter((item) => item.date === day.date).length,
        markerGroups: [
          { label: 'Findings', count: day.findingsCount, tone: 'danger' as const },
          {
            label: 'Cross-check',
            count: reconciliation.filter((item) => item.date === day.date && item.status !== 'matched').length,
            tone: 'warning' as const,
          },
          {
            label: 'Technical',
            count: technicalEvents.filter((event) => event.periodStart.slice(0, 10) <= day.date && event.periodEnd.slice(0, 10) >= day.date).length,
            tone: 'warning' as const,
          },
          {
            label: 'Motion',
            count: discrepancies.filter((item) => item.date === day.date).length,
            tone: 'danger' as const,
          },
        ],
      })),
    [daySummaries, discrepancies, reconciliation, technicalEvents]
  );

  if (!scenario) {
    return null;
  }

  if (previewError || !preview) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-6 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-violet-700">Dev Only</p>
              <h2 className="mt-1 text-3xl font-black text-slate-900">Tachograph Simulator Preview</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                This workspace renders the simulator scenarios through the same timeline and day-detail components used by the live tachograph analysis screens.
              </p>
            </div>
            <div className="rounded-xl border border-violet-200 bg-white px-4 py-3 text-xs font-medium text-slate-600">
              {TACHO_SIMULATION_SCENARIOS.length} in-repo scenarios
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4">
            {TACHO_SIMULATION_SCENARIOS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setScenarioId(item.id)}
                className={`rounded-2xl border p-4 text-left transition ${
                  item.id === scenario.id
                    ? 'border-violet-300 bg-violet-100/70 shadow-sm'
                    : 'border-violet-100 bg-white hover:border-violet-200 hover:bg-violet-50/50'
                }`}
              >
                <p className="text-sm font-black text-slate-900">{item.title}</p>
                <p className="mt-2 text-xs text-slate-500">{item.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr,1.2fr]">
          <InfoPanel title="Scenario Context" icon={<FlaskConical className="h-5 w-5 text-violet-600" />}>
            <StatList
              items={[
                `Driver: ${scenario.driverId}`,
                `Vehicle: ${scenario.vehicleId ?? 'None'}`,
                `Source: ${scenario.source ?? 'driver_card'}`,
                `Activities defined: ${scenario.activities.length}`,
              ]}
            />
          </InfoPanel>

          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-700">Compile Error</p>
            <h3 className="mt-1 text-lg font-black text-slate-900">{scenario.title}</h3>
            <p className="mt-3 text-sm text-slate-700">{previewError ?? 'Unknown simulator error.'}</p>
            <p className="mt-4 text-xs text-slate-500">
              This scenario is intentionally malformed so parser-like bad-data cases can be exercised without crashing the preview workspace.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const triggeredRules = [...new Set([...findings, ...technicalEvents].map((finding) => finding.ruleCode))];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-violet-700">Dev Only</p>
            <h2 className="mt-1 text-3xl font-black text-slate-900">Tachograph Simulator Preview</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              This workspace renders the simulator scenarios through the same timeline and day-detail components used by the live tachograph analysis screens.
            </p>
          </div>
          <div className="rounded-xl border border-violet-200 bg-white px-4 py-3 text-xs font-medium text-slate-600">
            {TACHO_SIMULATION_SCENARIOS.length} in-repo scenarios
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4">
          {TACHO_SIMULATION_SCENARIOS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setScenarioId(item.id)}
              className={`rounded-2xl border p-4 text-left transition ${
                item.id === scenario.id
                  ? 'border-violet-300 bg-violet-100/70 shadow-sm'
                  : 'border-violet-100 bg-white hover:border-violet-200 hover:bg-violet-50/50'
              }`}
            >
              <p className="text-sm font-black text-slate-900">{item.title}</p>
              <p className="mt-2 text-xs text-slate-500">{item.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricTile label="Activity Blocks" value={String(preview.activities.length)} tone="neutral" />
        <MetricTile label="Duty Windows" value={String(preview.result.dutyWindows.length)} tone="neutral" />
        <MetricTile label="Findings" value={String(preview.result.findings.length)} tone={preview.result.findings.length > 0 ? 'danger' : 'good'} />
        <MetricTile label="Technical Events" value={String(technicalEvents.length)} tone={technicalEvents.length > 0 ? 'warning' : 'good'} />
        <MetricTile label="Motion Issues" value={String(discrepancies.length)} tone={discrepancies.length > 0 ? 'danger' : 'good'} />
        <MetricTile
          label="Cross-check Issues"
          value={String(reconciliation.filter((item) => item.status !== 'matched').length)}
          tone={reconciliation.some((item) => item.status !== 'matched') ? 'warning' : 'good'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2.2fr,1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Preview Timeline</p>
              <h3 className="mt-1 text-lg font-black text-slate-900">{scenario.title}</h3>
              <p className="text-sm text-slate-500">Scroll the simulated day strip, then open a day exactly as the live review screens do.</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDay(getInitialDay(daySummaries, reconciliation, technicalEvents, discrepancies))}
              className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700 transition hover:bg-slate-200"
            >
              Focus first issue
            </button>
          </div>

          <div className="mt-4">
            <TachoActivityTimeline
              days={timelineDays}
              selectedDate={selectedDay ? new Date(`${selectedDay.date}T12:00:00Z`) : undefined}
              onSelectDate={(date) => setSelectedDay(daySummaries.find((day) => day.date === date.toISOString().slice(0, 10)) ?? null)}
            />
          </div>
        </div>

        <div className="space-y-6">
          <InfoPanel title="Scenario Context" icon={<FlaskConical className="h-5 w-5 text-violet-600" />}>
            <StatList
              items={[
                `Driver: ${scenario.driverId}`,
                `Vehicle: ${scenario.vehicleId ?? 'None'}`,
                `Source: ${scenario.source ?? 'driver_card'}`,
                `Anchor start: ${format(new Date(scenario.anchorStart), 'dd MMM yyyy HH:mm')}`,
              ]}
            />
          </InfoPanel>

          <InfoPanel title="Selected Day Overview" icon={<Route className="h-5 w-5 text-blue-600" />}>
            {selectedDay ? (
              <StatList
                items={[
                  `Driving: ${minsToHours(selectedDay.drivingMins)}`,
                  `Work: ${minsToHours(selectedDay.workMins)}`,
                  `POA: ${minsToHours(selectedDay.poaMins)}`,
                  `Rest: ${minsToHours(selectedDay.restMins)}`,
                  `Technical events: ${technicalEvents.filter((event) => event.periodStart.slice(0, 10) <= selectedDay.date && event.periodEnd.slice(0, 10) >= selectedDay.date).length}`,
                  `Motion review rows: ${discrepancies.filter((item) => item.date === selectedDay.date).length}`,
                ]}
              />
            ) : (
              <p className="text-sm text-slate-500">Select a day in the timeline to inspect the simulated review surface.</p>
            )}
          </InfoPanel>

          <InfoPanel title="Triggered Rules" icon={<ShieldAlert className="h-5 w-5 text-rose-600" />}>
            {triggeredRules.length === 0 ? (
              <p className="text-sm text-slate-500">No findings were triggered for this scenario.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {triggeredRules.map((ruleCode) => (
                  <span
                    key={ruleCode}
                    className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-rose-700"
                  >
                    {ruleCode}
                  </span>
                ))}
              </div>
            )}
          </InfoPanel>

          <InfoPanel title="Compiled Inputs" icon={<Braces className="h-5 w-5 text-emerald-600" />}>
            <StatList
              items={[
                `Compiled activities: ${preview.activities.length}`,
                `Work sessions: ${preview.workSessions.length}`,
                `Combined findings: ${findings.length}`,
                `Technical events: ${technicalEvents.length}`,
                `Motion issues: ${discrepancies.length}`,
                `Violation titles: ${preview.result.violationTitles.length}`,
              ]}
            />
          </InfoPanel>

          <InfoPanel title="Reconciliation Output" icon={<ClipboardList className="h-5 w-5 text-amber-600" />}>
            {reconciliation.length === 0 ? (
              <p className="text-sm text-slate-500">This scenario does not define any app-side work-session inputs.</p>
            ) : (
              <div className="space-y-2">
                {reconciliation.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-sm font-bold text-slate-900">{item.summary}</p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {item.date} • {item.status.replace('_', ' ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </InfoPanel>
        </div>
      </div>

      {scenario.source === 'vehicle_unit' ? (
        <VehicleHistoryLedger
          range="30d"
          days={daySummaries}
          activitySegments={preview.activities.map((activity) => ({
            ...activity,
            source: 'vehicle_unit',
            activityType: activity.activityType === 'rest' ? 'break_rest' : activity.activityType,
            durationMins: Math.max(
              0,
              Math.round((new Date(activity.endTime).getTime() - new Date(activity.startTime).getTime()) / 60000)
            ),
          }))}
          technicalEvents={technicalEvents}
          discrepancies={discrepancies}
          driverNameById={driverNameById}
          selectedDate={selectedDay?.date ?? null}
          onSelectDate={(date) => setSelectedDay(daySummaries.find((day) => day.date === date) ?? null)}
        />
      ) : null}

      <TachoDayDetailDrawer
        day={selectedDay}
        findings={findings}
        technicalEvents={technicalEvents}
        reconciliation={reconciliation}
        discrepancies={discrepancies}
        onClose={() => setSelectedDay(null)}
        selectedReason={`Opened from the simulator scenario '${scenario.title}'.`}
      />
    </div>
  );
}

function MetricTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'neutral' | 'good' | 'warning' | 'danger';
}) {
  const styles = {
    neutral: 'border-slate-200 bg-white text-slate-700',
    good: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-100 bg-amber-50 text-amber-700',
    danger: 'border-rose-100 bg-rose-50 text-rose-700',
  }[tone];

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${styles}`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function InfoPanel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function StatList({ items }: { items: string[] }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          {item}
        </div>
      ))}
    </div>
  );
}
