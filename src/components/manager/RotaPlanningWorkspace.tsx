import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import {
  AlertTriangle,
  Briefcase,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Copy,
  LayoutGrid,
  Plus,
  RefreshCw,
  Route,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import {
  assessCandidate,
  availabilityForDate,
  availabilityLabel,
  buildCoverageRows,
  formatDuration,
  plannedMinutesForDriver,
  planningDates,
  type PlanningAssignment,
  type PlanningAvailability,
  type PlanningRegime,
  type PlanningSlot,
} from "../../lib/planningWorkspace";
import {
  buildRotaTemplateCreateArgs,
  ROTA_TEMPLATE_SAVE_TIMEOUT_MS,
  submitRotaTemplate,
  type RotaTemplateRequirementDraft,
} from "../../lib/rotaTemplateSave";
import {
  buildBulkAssignmentPreview,
  loadPlanningDomains,
  type BulkCandidate,
} from "../../lib/planningBoard";
import { ShiftPlanner } from "./ShiftPlanner";
import {
  entitlementCoversVehicleClass,
  licenceEntitlementLabel,
  licenceEntitlements,
  planningVehicleClassLabel,
  planningVehicleClasses,
  type LicenceEntitlement,
  type PlanningVehicleClass,
} from "../../lib/planningVehicleClasses";

type PlannerView = "coverage" | "drivers" | "runs";
type Driver = { id: string; full_name: string | null };
type Vehicle = {
  id: string;
  reg_number: string;
  vehicle_class: string | null;
  vehicle_type: string | null;
  planning_vehicle_class: PlanningVehicleClass | null;
};
type Job = {
  id: string;
  reference: string;
  title: string;
  job_type: string;
  address_text: string;
  customer_name: string | null;
};
type RotaTemplate = {
  id: string;
  name: string;
  description: string | null;
  cycle_length_days: number;
};
type TemplateSlot = {
  id: string;
  template_id: string;
  cycle_day: number;
  role_label: string;
  start_time: string;
  end_time: string;
  required_headcount: number;
  required_skill: string | null;
  required_vehicle_class: PlanningVehicleClass | null;
  sort_order: number;
};
type PlannedRun = {
  id: string;
  rota_slot_id: string | null;
  rota_slot_assignment_id: string | null;
  run_date: string;
  run_label: string;
  start_time: string;
  end_time: string;
  status: string;
};
type PlannedRunJob = {
  id: string;
  planned_run_id: string;
  job_id: string;
  sequence: number;
  status: string;
  projected_job_assignment_id: string | null;
};
type LeavePolicy = {
  id: string;
  role_label: string;
  availability_type: string;
  maximum_simultaneous: number;
  handling: "warn" | "block";
};
type DriverPlanningProfile = {
  driver_id: string;
  regulatory_regime: PlanningRegime;
};
type DriverVehicleQualification = {
  driver_id: string;
  vehicle_class: LicenceEntitlement;
};
type WorkSession = {
  user_id: string;
  date: string;
  total_work_minutes: number | null;
  start_time: string;
  end_time: string | null;
};
type Snapshot = {
  templates: RotaTemplate[];
  template_slots: TemplateSlot[];
  slots: PlanningSlot[];
  assignments: PlanningAssignment[];
  availability: PlanningAvailability[];
  runs: PlannedRun[];
  run_jobs: PlannedRunJob[];
  leave_policies: LeavePolicy[];
  driver_planning_profiles: DriverPlanningProfile[];
  driver_vehicle_qualifications: DriverVehicleQualification[];
};
type RequirementDraft = RotaTemplateRequirementDraft;

const planningRpc: typeof supabase.rpc = supabase.rpc.bind(supabase);
const PLANNING_REQUEST_TIMEOUT_MS = ROTA_TEMPLATE_SAVE_TIMEOUT_MS;
const emptySnapshot: Snapshot = {
  templates: [],
  template_slots: [],
  slots: [],
  assignments: [],
  availability: [],
  runs: [],
  run_jobs: [],
  leave_policies: [],
  driver_planning_profiles: [],
  driver_vehicle_qualifications: [],
};
const views: Array<{ id: PlannerView; label: string }> = [
  { id: "coverage", label: "Coverage" },
  { id: "drivers", label: "Drivers" },
  { id: "runs", label: "Runs" },
];

export function RotaPlanningWorkspace({
  onOpenJobPlanner,
}: {
  onOpenJobPlanner?: (shiftId: string) => void;
}) {
  const { profile } = useAuth();
  const initialMonday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const [fromDate, setFromDate] = useState(format(initialMonday, "yyyy-MM-dd"));
  const toDate = useMemo(
    () => format(addDays(parseISO(fromDate), 6), "yyyy-MM-dd"),
    [fromDate],
  );
  const dates = useMemo(
    () => planningDates(fromDate, toDate),
    [fromDate, toDate],
  );
  const [activeView, setActiveView] = useState<PlannerView>("coverage");
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workSessions, setWorkSessions] = useState<WorkSession[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [showApplyPreview, setShowApplyPreview] = useState(false);
  const [applyPreview, setApplyPreview] = useState<Record<
    string,
    number
  > | null>(null);
  const [showLeaveEditor, setShowLeaveEditor] = useState(false);
  const [showLeaveOverview, setShowLeaveOverview] = useState(false);
  const [showJobEditor, setShowJobEditor] = useState(false);
  const [showRunEditor, setShowRunEditor] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showPatternManager, setShowPatternManager] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<RotaTemplate | null>(
    null,
  );
  const [showJobTray, setShowJobTray] = useState(true);
  const [showDutyRegister, setShowDutyRegister] = useState(false);
  const [bulkSlots, setBulkSlots] = useState<PlanningSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [coreError, setCoreError] = useState<string | null>(null);
  const [driversError, setDriversError] = useState<string | null>(null);
  const [vehiclesError, setVehiclesError] = useState<string | null>(null);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [hoursError, setHoursError] = useState<string | null>(null);

  const loadPlanning = useCallback(async () => {
    if (!profile?.company_id) return null;
    const companyId = profile.company_id;
    setLoading(true);
    try {
      const result = await loadPlanningDomains({
        core: async () => {
          const response = await planningRpc(
            "get_planning_workspace_snapshot",
            { p_from: fromDate, p_to: toDate },
          ).abortSignal(AbortSignal.timeout(PLANNING_REQUEST_TIMEOUT_MS));
          return {
            data: (response.data as Snapshot | null) ?? emptySnapshot,
            error: response.error ? new Error(response.error.message) : null,
          };
        },
        drivers: async () => {
          const response = await supabase
            .from("profiles")
            .select("id, full_name")
            .eq("company_id", companyId)
            .eq("role", "driver")
            .order("full_name")
            .abortSignal(AbortSignal.timeout(PLANNING_REQUEST_TIMEOUT_MS));
          return {
            data: (response.data ?? []) as Driver[],
            error: response.error ? new Error(response.error.message) : null,
          };
        },
        vehicles: async () => {
          const response = await supabase
            .from("vehicles")
            .select(
              "id, reg_number, vehicle_class, vehicle_type, planning_vehicle_class",
            )
            .eq("company_id", companyId)
            .order("reg_number")
            .abortSignal(AbortSignal.timeout(PLANNING_REQUEST_TIMEOUT_MS));
          return {
            data: (response.data ?? []) as Vehicle[],
            error: response.error ? new Error(response.error.message) : null,
          };
        },
        jobs: async () => {
          const response = await supabase
            .from("jobs")
            .select(
              "id, reference, title, job_type, address_text, customer_name",
            )
            .eq("company_id", companyId)
            .order("created_at", { ascending: false })
            .limit(250)
            .abortSignal(AbortSignal.timeout(PLANNING_REQUEST_TIMEOUT_MS));
          return {
            data: (response.data ?? []) as Job[],
            error: response.error ? new Error(response.error.message) : null,
          };
        },
        recordedHours: async () => {
          const response = await planningRpc(
            "get_planning_recorded_work_summary",
            { p_from: fromDate, p_to: toDate },
          ).abortSignal(AbortSignal.timeout(PLANNING_REQUEST_TIMEOUT_MS));
          return {
            data: (response.data ?? []) as WorkSession[],
            error: response.error ? new Error(response.error.message) : null,
          };
        },
      });
      if (result.core.error) {
        console.error("Core planning refresh failed", result.core.error);
        setCoreError("We couldn't load this week's plan.");
        return null;
      }
      const refreshedSnapshot = result.core.data;
      setSnapshot(refreshedSnapshot);
      setCoreError(null);
      setMessage((current) => (current?.kind === "error" ? null : current));
      if (result.drivers.error) {
        console.error("Planning drivers refresh failed", result.drivers.error);
        setDriversError("Drivers couldn't be loaded.");
      } else {
        setDrivers(result.drivers.data);
        setDriversError(null);
      }
      if (result.vehicles.error) {
        console.error(
          "Planning vehicles refresh failed",
          result.vehicles.error,
        );
        setVehiclesError("Vehicle availability couldn't be loaded.");
      } else {
        setVehicles(result.vehicles.data);
        setVehiclesError(null);
      }
      if (result.jobs.error) {
        console.error("Planning jobs refresh failed", result.jobs.error);
        setJobsError("Jobs couldn't be loaded.");
      } else {
        setJobs(result.jobs.data);
        setJobsError(null);
      }
      if (result.recordedHours.error) {
        console.error(
          "Planning recorded hours refresh failed",
          result.recordedHours.error,
        );
        setHoursError(
          "Recorded hours are temporarily unavailable. Rest and working-time checks may be incomplete.",
        );
      } else {
        setWorkSessions(result.recordedHours.data);
        setHoursError(null);
      }
      return refreshedSnapshot;
    } catch (error) {
      console.error("Planning workspace transport failed", error);
      setCoreError(
        "We couldn't load this week's plan. Check your connection and try again.",
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, [fromDate, profile?.company_id, toDate]);

  useEffect(() => {
    void loadPlanning();
  }, [loadPlanning]);
  useEffect(() => {
    if (!selectedTemplateId && snapshot.templates[0])
      setSelectedTemplateId(snapshot.templates[0].id);
  }, [selectedTemplateId, snapshot.templates]);

  const coverageRows = useMemo(
    () => buildCoverageRows(snapshot.slots, snapshot.assignments, dates),
    [dates, snapshot.assignments, snapshot.slots],
  );
  const selectedSlot =
    snapshot.slots.find((slot) => slot.id === selectedSlotId) ?? null;
  const trailers = useMemo(
    () =>
      vehicles.filter(
        (vehicle) =>
          vehicle.vehicle_class === "trailer" ||
          vehicle.vehicle_type === "trailer",
      ),
    [vehicles],
  );
  const poweredVehicles = useMemo(
    () =>
      vehicles.filter(
        (vehicle) => !trailers.some((trailer) => trailer.id === vehicle.id),
      ),
    [trailers, vehicles],
  );
  const unallocatedJobs = useMemo(() => {
    const allocated = new Set(
      snapshot.run_jobs
        .filter((relation) => relation.status !== "cancelled")
        .map((relation) => relation.job_id),
    );
    return jobs.filter((job) => !allocated.has(job.id));
  }, [jobs, snapshot.run_jobs]);
  const review = useMemo(() => buildReview(snapshot), [snapshot]);
  const moveWeek = (amount: number) =>
    setFromDate(format(addDays(parseISO(fromDate), amount * 7), "yyyy-MM-dd"));
  const today = () =>
    setFromDate(
      format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
    );
  const deleteTemplate = async () => {
    if (!templateToDelete) return;
    setBusy(true);
    try {
      const { data, error } = await planningRpc("delete_rota_template", {
        p_template_id: templateToDelete.id,
      }).abortSignal(AbortSignal.timeout(PLANNING_REQUEST_TIMEOUT_MS));
      if (error) {
        console.error("Rota template deletion failed", error);
        return setMessage({
          kind: "error",
          text: "We couldn't delete this staffing pattern. Try again.",
        });
      }
      const result = data as {
        name?: string;
        dated_requirements_preserved?: number;
      } | null;
      if (selectedTemplateId === templateToDelete.id) setSelectedTemplateId("");
      setTemplateToDelete(null);
      setMessage({
        kind: "success",
        text: `${result?.name ?? "Staffing pattern"} deleted. ${result?.dated_requirements_preserved ?? 0} dated requirements were kept.`,
      });
      await loadPlanning();
    } catch (error) {
      console.error("Rota template deletion transport failed", error);
      setMessage({
        kind: "error",
        text: "We couldn't confirm deletion. Refresh patterns before trying again.",
      });
    } finally {
      setBusy(false);
    }
  };

  const previewTemplate = async () => {
    if (!selectedTemplateId) return;
    setBusy(true);
    try {
      const { data, error } = await planningRpc("preview_rota_template", {
        p_template_id: selectedTemplateId,
        p_from: fromDate,
        p_to: toDate,
      }).abortSignal(AbortSignal.timeout(PLANNING_REQUEST_TIMEOUT_MS));
      if (error) {
        console.error("Rota template preview failed", error);
        return setMessage({
          kind: "error",
          text: "We couldn't preview this pattern. Try again.",
        });
      }
      setApplyPreview((data as Record<string, number>) ?? null);
      setShowApplyPreview(true);
    } catch (error) {
      console.error("Rota template preview transport failed", error);
      setMessage({
        kind: "error",
        text: "We couldn't preview this pattern. Check your connection and try again.",
      });
    } finally {
      setBusy(false);
    }
  };
  const applyTemplate = async () => {
    if (!selectedTemplateId) return;
    setBusy(true);
    try {
      const { data, error } = await planningRpc("apply_cyclic_rota_template", {
        p_template_id: selectedTemplateId,
        p_name: "",
        p_from: fromDate,
        p_to: toDate,
        p_request_key: crypto.randomUUID(),
      }).abortSignal(AbortSignal.timeout(PLANNING_REQUEST_TIMEOUT_MS));
      if (error) {
        console.error("Rota template apply failed", error);
        return setMessage({
          kind: "error",
          text: "We couldn't apply this pattern. Nothing was changed. Try again.",
        });
      }
      const result = data as { created?: number; skipped?: number } | null;
      setShowApplyPreview(false);
      setMessage({
        kind: "success",
        text: `Cover created: ${result?.created ?? 0} requirements added, ${result?.skipped ?? 0} already present.`,
      });
      void loadPlanning();
    } catch (error) {
      console.error("Rota template apply transport failed", error);
      setMessage({
        kind: "error",
        text: "We couldn't confirm whether the pattern was applied. Refresh planning before trying again.",
      });
    } finally {
      setBusy(false);
    }
  };
  const publishReady = async () => {
    const shiftIds = snapshot.assignments
      .map((assignment) => assignment.shift_id)
      .filter((id): id is string => Boolean(id));
    if (shiftIds.length === 0) return;
    setBusy(true);
    try {
      let published = 0;
      let skipped = 0;
      for (const shiftId of shiftIds) {
        const assessment = await planningRpc(
          "get_shift_publication_assessment",
          { p_shift_id: shiftId },
        ).abortSignal(AbortSignal.timeout(PLANNING_REQUEST_TIMEOUT_MS));
        if (
          assessment.error ||
          (assessment.data as { status?: string } | null)?.status !== "ready"
        ) {
          skipped += 1;
          continue;
        }
        const result = await planningRpc("publish_shift_with_event", {
          p_shift_id: shiftId,
          p_requires_ack: true,
        }).abortSignal(AbortSignal.timeout(PLANNING_REQUEST_TIMEOUT_MS));
        if (result.error) skipped += 1;
        else published += 1;
      }
      setShowReview(false);
      setMessage({
        kind: "success",
        text: `${published} duties published after fresh checks. ${skipped} need attention.`,
      });
      void loadPlanning();
    } catch (error) {
      console.error("Duty publication transport failed", error);
      setMessage({
        kind: "error",
        text: "We couldn't complete publication. Refresh planning to confirm the latest duty status.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-w-0 space-y-4 pb-20">
      <header className="sticky top-0 z-30 overflow-hidden rounded-2xl border border-brand-border bg-brand-card/95 shadow-xl backdrop-blur">
        <div className="flex flex-wrap items-center gap-3 border-b border-brand-border px-4 py-3">
          <div className="mr-auto min-w-[210px]">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-accent">
              Weekly planning board
            </p>
            <h1 className="text-xl font-black text-white">
              Workforce & dispatch
            </h1>
          </div>
          <div className="flex items-center rounded-xl border border-brand-border bg-brand-dark/60 p-1">
            <button
              type="button"
              onClick={() => moveWeek(-1)}
              aria-label="Previous week"
              className="rounded-lg p-2 text-slate-300 hover:bg-white/5"
            >
              <ChevronLeft size={17} />
            </button>
            <div className="min-w-[160px] px-2 text-center text-xs font-black text-white">
              {format(parseISO(fromDate), "d MMM")}–
              {format(parseISO(toDate), "d MMM yyyy")}
            </div>
            <button
              type="button"
              onClick={() => moveWeek(1)}
              aria-label="Next week"
              className="rounded-lg p-2 text-slate-300 hover:bg-white/5"
            >
              <ChevronRight size={17} />
            </button>
          </div>
          <button
            type="button"
            onClick={today}
            className="rounded-lg border border-brand-border px-3 py-2 text-xs font-bold text-slate-200"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedDriverId(null);
              setSelectedSlotId(null);
              setShowLeaveOverview(true);
            }}
            className="rounded-lg border border-brand-border px-3 py-2 text-xs font-bold text-slate-200"
          >
            Leave
          </button>
          <button
            type="button"
            onClick={() => setShowLeaveEditor(true)}
            className="rounded-lg border border-brand-border px-3 py-2 text-xs font-bold text-slate-200"
          >
            Add leave
          </button>
          <button
            type="button"
            onClick={() => setShowReview(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-3 py-2 text-xs font-black text-white"
          >
            <ClipboardCheck size={15} />
            Review & publish
          </button>
          <button
            type="button"
            onClick={() => void loadPlanning()}
            aria-label="Refresh planning"
            className="rounded-lg border border-brand-border p-2 text-slate-300"
          >
            <RefreshCw size={16} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Pattern
          </span>
          <select
            aria-label="Rota pattern"
            value={selectedTemplateId}
            onChange={(event) => setSelectedTemplateId(event.target.value)}
            className="input max-w-[220px]"
          >
            <option value="">Choose pattern</option>
            {snapshot.templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void previewTemplate()}
            disabled={!selectedTemplateId || busy}
            className="rounded-lg border border-brand-accent/50 px-3 py-2 text-xs font-black text-brand-accent disabled:opacity-40"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedDriverId(null);
              setSelectedSlotId(null);
              setShowPatternManager(true);
            }}
            className="rounded-lg px-2 py-2 text-xs font-bold text-slate-300 hover:text-white"
          >
            Manage patterns
          </button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              View by
            </span>
            <nav
              aria-label="Board view"
              className="flex rounded-xl border border-brand-border bg-brand-dark/60 p-1"
            >
              {views.map((view) => {
                const Icon =
                  view.id === "coverage"
                    ? LayoutGrid
                    : view.id === "drivers"
                      ? Users
                      : Route;
                return (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => setActiveView(view.id)}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-black ${activeView === view.id ? "bg-white/10 text-white shadow" : "text-slate-500 hover:text-slate-300"}`}
                  >
                    <Icon size={14} />
                    {view.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>
      {message ? (
        <div
          role={message.kind === "error" ? "alert" : "status"}
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-bold ${message.kind === "error" ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}
        >
          <span>{message.text}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      ) : null}
      {hoursError ? <LocalWarning text={hoursError} /> : null}
      {driversError && activeView === "drivers" ? (
        <LocalWarning text={driversError} />
      ) : null}
      {vehiclesError && (selectedSlot || activeView === "runs") ? (
        <LocalWarning text={vehiclesError} />
      ) : null}
      {coreError ? (
        <BoardFailure text={coreError} onRetry={() => void loadPlanning()} />
      ) : (
        <>
          {activeView === "coverage" ? (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setBulkSlots(
                      snapshot.slots.filter(
                        (slot) => slot.status !== "cancelled",
                      ),
                    )
                  }
                  disabled={snapshot.slots.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg border border-brand-accent/50 px-3 py-2 text-xs font-black text-brand-accent disabled:opacity-40"
                >
                  <UserPlus size={14} />
                  Fill vacancies across week
                </button>
              </div>
              <CoverageView
                rows={coverageRows}
                dates={dates}
                loading={loading}
                availability={snapshot.availability}
                onSelectSlot={setSelectedSlotId}
              />
            </div>
          ) : null}
          {activeView === "drivers" ? (
            <PeopleView
              drivers={drivers}
              dates={dates}
              slots={snapshot.slots}
              assignments={snapshot.assignments}
              availability={snapshot.availability}
              onSelectDriver={setSelectedDriverId}
            />
          ) : null}
          {activeView === "runs" ? (
            <DispatchView
              jobs={jobs}
              unallocatedJobs={unallocatedJobs}
              runs={snapshot.runs}
              runJobs={snapshot.run_jobs}
              onNewJob={() => setShowJobEditor(true)}
              onNewRun={() => setShowRunEditor(true)}
              onChanged={loadPlanning}
              setMessage={setMessage}
            />
          ) : null}
        </>
      )}
      <JobTray
        open={showJobTray}
        jobs={jobs}
        unallocatedJobs={unallocatedJobs}
        runs={snapshot.runs}
        jobsError={jobsError}
        onToggle={() => setShowJobTray((value) => !value)}
        onNewJob={() => setShowJobEditor(true)}
        onChanged={loadPlanning}
        setMessage={setMessage}
      />
      {selectedSlot ? (
        <VacancyDrawer
          slot={selectedSlot}
          drivers={drivers}
          vehicles={poweredVehicles}
          trailers={trailers}
          slots={snapshot.slots}
          assignments={snapshot.assignments}
          availability={snapshot.availability}
          regimes={snapshot.driver_planning_profiles}
          qualifications={snapshot.driver_vehicle_qualifications}
          onClose={() => setSelectedSlotId(null)}
          onChanged={loadPlanning}
          setMessage={setMessage}
        />
      ) : null}
      {selectedDriverId && !showLeaveEditor ? (
        <DriverDrawer
          driver={
            drivers.find((entry) => entry.id === selectedDriverId) ?? null
          }
          slots={snapshot.slots}
          assignments={snapshot.assignments}
          availability={snapshot.availability}
          workSessions={workSessions}
          regime={
            snapshot.driver_planning_profiles.find(
              (entry) => entry.driver_id === selectedDriverId,
            )?.regulatory_regime ?? "unknown"
          }
          qualifications={snapshot.driver_vehicle_qualifications
            .filter((entry) => entry.driver_id === selectedDriverId)
            .map((entry) => entry.vehicle_class)}
          onClose={() => setSelectedDriverId(null)}
          onChanged={loadPlanning}
          setMessage={setMessage}
        />
      ) : null}
      {showLeaveEditor ? (
        <LeaveDrawer
          drivers={drivers}
          selectedDriverId={selectedDriverId ?? ""}
          fromDate={fromDate}
          policies={snapshot.leave_policies}
          onClose={() => {
            setShowLeaveEditor(false);
            setSelectedDriverId(null);
          }}
          onChanged={loadPlanning}
          setMessage={setMessage}
        />
      ) : null}
      {showLeaveOverview ? (
        <Drawer
          wide
          title="Leave this week"
          subtitle="Holiday and absence already appear on the Coverage and Drivers boards."
          onClose={() => setShowLeaveOverview(false)}
        >
          <LeaveView
            drivers={drivers}
            dates={dates}
            availability={snapshot.availability}
            policies={snapshot.leave_policies}
            onAdd={(driverId) => {
              setShowLeaveOverview(false);
              setSelectedDriverId(driverId);
              setShowLeaveEditor(true);
            }}
          />
        </Drawer>
      ) : null}
      {showJobEditor ? (
        <JobDrawer
          onClose={() => setShowJobEditor(false)}
          onChanged={loadPlanning}
          setMessage={setMessage}
        />
      ) : null}
      {showRunEditor ? (
        <RunDrawer
          fromDate={fromDate}
          slots={snapshot.slots}
          onClose={() => setShowRunEditor(false)}
          onChanged={loadPlanning}
          setMessage={setMessage}
        />
      ) : null}
      {showTemplateEditor ? (
        <TemplateDrawer
          onClose={() => setShowTemplateEditor(false)}
          refreshAndSelect={async (templateId) => {
            const refreshed = await loadPlanning();
            const persisted =
              refreshed?.templates.some(
                (template) => template.id === templateId,
              ) ?? false;
            if (persisted) setSelectedTemplateId(templateId);
            return persisted;
          }}
          setMessage={setMessage}
        />
      ) : null}
      {showApplyPreview ? (
        <ApplyPreviewDialog
          preview={applyPreview}
          busy={busy}
          onCancel={() => setShowApplyPreview(false)}
          onConfirm={() => void applyTemplate()}
        />
      ) : null}
      {showReview ? (
        <ReviewDialog
          review={review}
          busy={busy}
          onCancel={() => setShowReview(false)}
          onPublish={() => void publishReady()}
          onInspectDuties={() => {
            setShowReview(false);
            setShowDutyRegister(true);
          }}
        />
      ) : null}
      {bulkSlots.length ? (
        <BulkFillDrawer
          slots={bulkSlots}
          drivers={drivers}
          allSlots={snapshot.slots}
          assignments={snapshot.assignments}
          availability={snapshot.availability}
          regimes={snapshot.driver_planning_profiles}
          qualifications={snapshot.driver_vehicle_qualifications}
          onClose={() => setBulkSlots([])}
          onChanged={loadPlanning}
          setMessage={setMessage}
        />
      ) : null}
      {showPatternManager ? (
        <PatternManagerDrawer
          templates={snapshot.templates}
          slots={snapshot.template_slots}
          onDelete={setTemplateToDelete}
          onNew={() => {
            setShowPatternManager(false);
            setShowTemplateEditor(true);
          }}
          onClose={() => setShowPatternManager(false)}
        />
      ) : null}
      {templateToDelete ? (
        <DeletePatternDialog
          template={templateToDelete}
          busy={busy}
          onCancel={() => setTemplateToDelete(null)}
          onConfirm={() => void deleteTemplate()}
        />
      ) : null}
      {showDutyRegister ? (
        <Drawer
          wide
          title="Duty register"
          subtitle="View and manage duties already assigned to drivers."
          onClose={() => setShowDutyRegister(false)}
        >
          <ShiftPlanner onOpenJobPlanner={onOpenJobPlanner} />
        </Drawer>
      ) : null}
      <button
        type="button"
        onClick={() => setShowDutyRegister(true)}
        className="text-xs font-bold text-slate-500 hover:text-slate-300"
      >
        Open duty register
      </button>
    </div>
  );
}

function CoverageView({
  rows,
  dates,
  loading,
  availability,
  onSelectSlot,
}: {
  rows: ReturnType<typeof buildCoverageRows>;
  dates: string[];
  loading: boolean;
  availability: PlanningAvailability[];
  onSelectSlot: (id: string) => void;
}) {
  const gaps = rows.reduce(
    (total, row) =>
      total + dates.reduce((sum, date) => sum + row.cells[date].vacancies, 0),
    0,
  );
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-card">
      <div className="flex items-center justify-between border-b border-brand-border px-5 py-4">
        <div>
          <h2 className="text-lg font-black text-white">Staffing coverage</h2>
          <p className="text-xs text-slate-400">
            Select a filled/required count to inspect people and fill vacancies.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-black ${gaps ? "bg-amber-500/15 text-amber-200" : "bg-emerald-500/15 text-emerald-200"}`}
        >
          {gaps ? `${gaps} vacancies` : "Fully covered"}
        </span>
      </div>
      <div className="max-h-[calc(100vh-275px)] overflow-auto">
        <table className="w-full min-w-[980px] border-collapse">
          <thead className="sticky top-0 z-20 bg-brand-dark">
            <tr>
              <th className="sticky left-0 z-30 min-w-[190px] border-b border-r border-brand-border bg-brand-dark p-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
                Requirement
              </th>
              {dates.map((date) => (
                <th
                  key={date}
                  className="min-w-[125px] border-b border-brand-border p-3 text-center"
                >
                  <span className="block text-[10px] font-black uppercase text-slate-500">
                    {format(parseISO(date), "EEE")}
                  </span>
                  <span className="text-sm font-black text-white">
                    {format(parseISO(date), "d MMM")}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {loading ? (
              <tr>
                <td
                  colSpan={8}
                  className="p-12 text-center text-sm text-slate-400"
                >
                  Loading coverage…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="p-12 text-center text-sm text-slate-400"
                >
                  No staffing demand yet. Choose a pattern and apply it to this
                  week.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key}>
                  <th className="sticky left-0 z-10 border-r border-brand-border bg-brand-card p-3 text-left">
                    <span className="block text-sm font-bold text-white">
                      {row.roleLabel}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {row.startTime.slice(0, 5)}–{row.endTime.slice(0, 5)} · {planningVehicleClassLabel(row.requiredVehicleClass)}
                    </span>
                  </th>
                  {dates.map((date) => {
                    const cell = row.cells[date];
                    const leaveCount = availability.filter(
                      (entry) =>
                        entry.starts_on <= date && entry.ends_on >= date,
                    ).length;
                    return (
                      <td key={date} className="p-2 text-center">
                        {cell.slot ? (
                          <button
                            type="button"
                            onClick={() => onSelectSlot(cell.slot!.id)}
                            className={`w-full rounded-xl border px-3 py-3 text-left transition hover:-translate-y-0.5 ${cell.vacancies ? "border-amber-500/30 bg-amber-500/10" : "border-emerald-500/20 bg-emerald-500/5"}`}
                          >
                            <span className="block text-lg font-black text-white">
                              {cell.filled}/{cell.required}
                            </span>
                            <span
                              className={`text-[10px] font-bold ${cell.vacancies ? "text-amber-200" : "text-emerald-200"}`}
                            >
                              {cell.vacancies
                                ? `${cell.vacancies} open`
                                : "Covered"}
                            </span>
                            {leaveCount ? (
                              <span className="mt-1 block text-[9px] text-slate-500">
                                {leaveCount} away
                              </span>
                            ) : null}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-700">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PeopleView({
  drivers,
  dates,
  slots,
  assignments,
  availability,
  onSelectDriver,
}: {
  drivers: Driver[];
  dates: string[];
  slots: PlanningSlot[];
  assignments: PlanningAssignment[];
  availability: PlanningAvailability[];
  onSelectDriver: (id: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-card">
      <div className="border-b border-brand-border px-5 py-4">
        <h2 className="text-lg font-black text-white">People at a glance</h2>
        <p className="text-xs text-slate-400">
          Duty, rest, leave and conflicts across the selected week.
        </p>
      </div>
      <div className="max-h-[calc(100vh-275px)] overflow-auto">
        <table className="w-full min-w-[980px]">
          <thead className="sticky top-0 z-20 bg-brand-dark">
            <tr>
              <th className="sticky left-0 z-30 min-w-[200px] border-b border-r border-brand-border bg-brand-dark p-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
                Driver
              </th>
              {dates.map((date) => (
                <th
                  key={date}
                  className="min-w-[120px] border-b border-brand-border p-3 text-center text-xs font-black text-white"
                >
                  {format(parseISO(date), "EEE d")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {drivers.map((driver) => (
              <tr key={driver.id}>
                <th className="sticky left-0 z-10 border-r border-brand-border bg-brand-card p-3 text-left">
                  <button
                    type="button"
                    onClick={() => onSelectDriver(driver.id)}
                    className="text-sm font-bold text-white hover:text-brand-accent"
                  >
                    {driver.full_name ?? "Unnamed driver"}
                  </button>
                </th>
                {dates.map((date) => {
                  const away = availabilityForDate(
                    availability,
                    driver.id,
                    date,
                  );
                  const duties = assignments
                    .filter(
                      (entry) =>
                        entry.driver_id === driver.id &&
                        slots.find((slot) => slot.id === entry.slot_id)
                          ?.slot_date === date,
                    )
                    .map((entry) =>
                      slots.find((slot) => slot.id === entry.slot_id),
                    )
                    .filter((slot): slot is PlanningSlot => Boolean(slot));
                  const conflict = duties.length > 1;
                  const label = away
                    ? availabilityLabel(away.availability_type)
                    : conflict
                      ? "Conflict"
                      : (duties[0]?.role_label ?? "Rest");
                  return (
                    <td key={date} className="p-2">
                      <button
                        type="button"
                        onClick={() => onSelectDriver(driver.id)}
                        className={`w-full rounded-lg border px-2 py-3 text-xs font-black ${away ? "border-violet-500/30 bg-violet-500/10 text-violet-200" : conflict ? "border-red-500/30 bg-red-500/10 text-red-200" : duties[0] ? "border-sky-500/30 bg-sky-500/10 text-sky-200" : "border-white/5 bg-white/[0.02] text-slate-500"}`}
                      >
                        {label}
                        <span className="mt-1 block text-[9px] font-medium opacity-75">
                          {duties[0]
                            ? `${duties[0].start_time.slice(0, 5)}–${duties[0].end_time.slice(0, 5)}`
                            : (away?.note ?? "No duty")}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DispatchView({
  jobs,
  unallocatedJobs,
  runs,
  runJobs,
  onNewJob,
  onNewRun,
  onChanged,
  setMessage,
}: {
  jobs: Job[];
  unallocatedJobs: Job[];
  runs: PlannedRun[];
  runJobs: PlannedRunJob[];
  onNewJob: () => void;
  onNewRun: () => void;
  onChanged: () => void;
  setMessage: (message: { kind: "success" | "error"; text: string }) => void;
}) {
  const [search, setSearch] = useState("");
  const [placing, setPlacing] = useState<string | null>(null);
  const visible = unallocatedJobs.filter((job) =>
    `${job.reference} ${job.title} ${job.customer_name ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const place = async (runId: string, jobId: string) => {
    if (!jobId) return;
    setPlacing(runId);
    try {
      const { error } = await planningRpc("place_job_on_planned_run", {
        p_job_id: jobId,
        p_planned_run_id: runId,
        p_sequence: undefined,
      }).abortSignal(AbortSignal.timeout(PLANNING_REQUEST_TIMEOUT_MS));
      if (error) {
        console.error("Job placement failed", error);
        setMessage({
          kind: "error",
          text: "We couldn't add this job to the run. Try again.",
        });
      } else {
        setMessage({ kind: "success", text: "Job added to the run." });
        onChanged();
      }
    } catch (error) {
      console.error("Job placement transport failed", error);
      setMessage({
        kind: "error",
        text: "We couldn't confirm whether the job was added. Refresh planning before trying again.",
      });
    } finally {
      setPlacing(null);
    }
  };
  return (
    <section className="grid min-h-[560px] gap-4 xl:grid-cols-[340px_1fr]">
      <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-black text-white">
              Jobs waiting to be allocated
            </h2>
            <p className="text-xs text-slate-500">
              {unallocatedJobs.length} unallocated
            </p>
          </div>
          <button
            type="button"
            onClick={onNewJob}
            className="rounded-lg bg-brand-accent p-2 text-white"
            aria-label="Add job"
          >
            <Plus size={16} />
          </button>
        </div>
        <label className="mt-3 flex items-center gap-2 rounded-lg border border-brand-border bg-brand-dark px-3">
          <Search size={14} className="text-slate-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search jobs"
            className="min-w-0 flex-1 bg-transparent py-2 text-xs text-white outline-none"
          />
        </label>
        <div className="mt-3 max-h-[480px] space-y-2 overflow-auto">
          {visible.map((job) => (
            <div
              key={job.id}
              className="rounded-xl border border-brand-border bg-brand-dark/40 p-3"
            >
              <p className="text-xs font-black text-white">
                {job.reference} · {job.title}
              </p>
              <p className="mt-1 line-clamp-2 text-[10px] text-slate-500">
                {job.customer_name ?? "Customer not named"} · {job.address_text}
              </p>
              <span className="mt-2 inline-block rounded bg-white/5 px-2 py-1 text-[9px] font-bold text-slate-400">
                {job.job_type}
              </span>
            </div>
          ))}
          {visible.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">
              No matching unallocated jobs.
            </p>
          ) : null}
        </div>
      </div>
      <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-black text-white">Runs</h2>
            <p className="text-xs text-slate-500">
              Order work before choosing a driver.
            </p>
          </div>
          <button
            type="button"
            onClick={onNewRun}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-3 py-2 text-xs font-black text-white"
          >
            <Plus size={14} />
            New run
          </button>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {runs.map((run) => {
            const relations = runJobs
              .filter((entry) => entry.planned_run_id === run.id)
              .sort((a, b) => a.sequence - b.sequence);
            return (
              <article
                key={run.id}
                className="rounded-xl border border-brand-border bg-brand-dark/35 p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-black text-white">{run.run_label}</p>
                    <p className="text-[10px] text-slate-500">
                      {format(parseISO(run.run_date), "EEE d MMM")} ·{" "}
                      {run.start_time.slice(0, 5)}–{run.end_time.slice(0, 5)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[9px] font-black ${run.rota_slot_assignment_id ? "bg-emerald-500/15 text-emerald-200" : "bg-amber-500/15 text-amber-200"}`}
                  >
                    {run.rota_slot_assignment_id
                      ? "Staffed"
                      : "Driver unassigned"}
                  </span>
                </div>
                <ol className="mt-3 space-y-2">
                  {relations.map((relation) => {
                    const job = jobs.find(
                      (entry) => entry.id === relation.job_id,
                    );
                    return (
                      <li
                        key={relation.id}
                        className="flex gap-2 rounded-lg bg-white/[0.03] p-2 text-xs"
                      >
                        <span className="font-black text-brand-accent">
                          {relation.sequence}
                        </span>
                        <span className="text-slate-300">
                          {job
                            ? `${job.reference} · ${job.title}`
                            : "Job unavailable"}
                        </span>
                      </li>
                    );
                  })}
                </ol>
                <select
                  disabled={placing === run.id || visible.length === 0}
                  defaultValue=""
                  onChange={(event) => {
                    void place(run.id, event.target.value);
                    event.currentTarget.value = "";
                  }}
                  className="input mt-3 w-full"
                >
                  <option value="">Add an unallocated job…</option>
                  {visible.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.reference} · {job.title}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-[9px] text-slate-500">
                  Driving-time check pending · Road driving duration is not
                  available yet.
                </p>
              </article>
            );
          })}
          {runs.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-brand-border p-10 text-center text-sm text-slate-500">
              No runs in this week. Create one without selecting a driver.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function LeaveView({
  drivers,
  dates,
  availability,
  policies,
  onAdd,
}: {
  drivers: Driver[];
  dates: string[];
  availability: PlanningAvailability[];
  policies: LeavePolicy[];
  onAdd: (driverId: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-card">
      <div className="flex items-center justify-between border-b border-brand-border px-5 py-4">
        <div>
          <h2 className="text-lg font-black text-white">
            Leave & availability
          </h2>
          <p className="text-xs text-slate-400">
            Select a driver to record a date range. Company capacity rules are
            planning policy.
          </p>
        </div>
        <span className="text-xs text-slate-500">
          {policies.length
            ? `${policies.length} capacity policies`
            : "Capacity policy not configured"}
        </span>
      </div>
      <div className="max-h-[calc(100vh-275px)] overflow-auto">
        <table className="w-full min-w-[980px]">
          <thead className="sticky top-0 z-20 bg-brand-dark">
            <tr>
              <th className="sticky left-0 z-30 min-w-[200px] border-b border-r border-brand-border bg-brand-dark p-3 text-left text-[10px] font-black uppercase text-slate-500">
                Driver
              </th>
              {dates.map((date) => (
                <th
                  key={date}
                  className="border-b border-brand-border p-3 text-xs font-black text-white"
                >
                  {format(parseISO(date), "EEE d")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {drivers.map((driver) => (
              <tr key={driver.id}>
                <th className="sticky left-0 z-10 border-r border-brand-border bg-brand-card p-3 text-left">
                  <button
                    type="button"
                    onClick={() => onAdd(driver.id)}
                    className="text-sm font-bold text-white hover:text-brand-accent"
                  >
                    {driver.full_name ?? "Unnamed driver"}{" "}
                    <Plus size={12} className="inline" />
                  </button>
                </th>
                {dates.map((date) => {
                  const entry = availabilityForDate(
                    availability,
                    driver.id,
                    date,
                  );
                  return (
                    <td key={date} className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => onAdd(driver.id)}
                        className={`w-full rounded-lg border px-2 py-3 text-[10px] font-black ${entry ? "border-violet-500/30 bg-violet-500/10 text-violet-200" : "border-white/5 text-slate-700 hover:text-slate-400"}`}
                      >
                        {entry
                          ? availabilityLabel(entry.availability_type)
                          : "Available"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TemplatesView({
  templates,
  slots,
  onNew,
  onDelete,
}: {
  templates: RotaTemplate[];
  slots: TemplateSlot[];
  onNew: () => void;
  onDelete: (template: RotaTemplate) => void;
}) {
  return (
    <section className="rounded-2xl border border-brand-border bg-brand-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-white">Staffing patterns</h2>
          <p className="text-xs text-slate-400">
            Save your usual staffing pattern and reuse it each week.
          </p>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-3 py-2 text-xs font-black text-white"
        >
          <Plus size={14} />
          New pattern
        </button>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {templates.map((template) => {
          const lines = slots.filter(
            (slot) => slot.template_id === template.id,
          );
          return (
            <article
              key={template.id}
              className="rounded-xl border border-brand-border bg-brand-dark/35 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-white">{template.name}</h3>
                  <p className="text-xs text-slate-500">
                    {template.description ?? "Reusable staffing pattern"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-brand-accent/10 px-2 py-1 text-[10px] font-black text-brand-accent">{template.cycle_length_days} days</span>
                  <button type="button" onClick={() => onDelete(template)} aria-label={`Delete ${template.name}`} className="rounded-lg border border-red-500/25 p-2 text-red-300 hover:bg-red-500/10"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="mt-3 max-h-64 overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[9px] uppercase text-slate-500">
                      <th className="py-1">Day</th>
                      <th>Requirement</th>
                      <th>Time</th>
                      <th className="text-right">People</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {lines.map((line) => (
                      <tr key={line.id}>
                        <td className="py-2 font-black text-brand-accent">
                          {cycleDayLabel(
                            line.cycle_day,
                            template.cycle_length_days,
                          )}
                        </td>
                        <td className="text-white">{line.role_label}<span className="block text-[9px] text-slate-500">{planningVehicleClassLabel(line.required_vehicle_class)}</span></td>
                        <td className="text-slate-400">
                          {line.start_time.slice(0, 5)}–
                          {line.end_time.slice(0, 5)}
                        </td>
                        <td className="text-right font-black text-white">
                          {line.required_headcount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          );
        })}
        {templates.length === 0 ? (
          <p className="col-span-full rounded-xl border border-dashed border-brand-border p-10 text-center text-sm text-slate-500">
            Create a reusable week or rotating staffing pattern.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function VacancyDrawer({
  slot,
  drivers,
  vehicles,
  trailers,
  slots,
  assignments,
  availability,
  regimes,
  qualifications,
  onClose,
  onChanged,
  setMessage,
}: {
  slot: PlanningSlot;
  drivers: Driver[];
  vehicles: Vehicle[];
  trailers: Vehicle[];
  slots: PlanningSlot[];
  assignments: PlanningAssignment[];
  availability: PlanningAvailability[];
  regimes: DriverPlanningProfile[];
  qualifications: DriverVehicleQualification[];
  onClose: () => void;
  onChanged: () => void;
  setMessage: (message: { kind: "success" | "error"; text: string }) => void;
}) {
  const [assetChoice, setAssetChoice] = useState<
    Record<string, { vehicle: string; trailer: string }>
  >({});
  const [busyDriver, setBusyDriver] = useState<string | null>(null);
  const assigned = assignments.filter(
    (entry) => entry.slot_id === slot.id && entry.status !== "cancelled",
  );
  const eligibleVehicles = vehicles.filter((vehicle) => !slot.required_vehicle_class || vehicle.planning_vehicle_class === slot.required_vehicle_class);
  const candidates = drivers
    .map((driver) => {
      const entitlements = qualifications.filter((entry) => entry.driver_id === driver.id).map((entry) => entry.vehicle_class);
      const assessment = entitlementCoversVehicleClass(entitlements, slot.required_vehicle_class)
        ? assessCandidate({
        driverId: driver.id,
        slot,
        allSlots: slots,
        assignments,
        availability,
        regime:
          regimes.find((entry) => entry.driver_id === driver.id)
            ?.regulatory_regime ?? "unknown",
      })
        : { group: "unavailable" as const, label: "Licence not covered", reason: `Needs entitlement for ${planningVehicleClassLabel(slot.required_vehicle_class)}`, restMinutes: null };
      return { driver, assessment };
    })
    .sort(
      (left, right) =>
        groupOrder(left.assessment.group) -
          groupOrder(right.assessment.group) ||
        (left.driver.full_name ?? "").localeCompare(
          right.driver.full_name ?? "",
        ),
    );
  const assign = async (driverId: string) => {
    const assets = assetChoice[driverId] ?? { vehicle: "", trailer: "" };
    setBusyDriver(driverId);
    try {
      const { error } = await planningRpc("assign_rota_position", {
        p_slot_id: slot.id,
        p_driver_id: driverId,
        p_vehicle_id: assets.vehicle || undefined,
        p_trailer_id: assets.trailer || undefined,
        p_expected_slot_updated_at: slot.updated_at,
      }).abortSignal(AbortSignal.timeout(PLANNING_REQUEST_TIMEOUT_MS));
      if (error) {
        console.error("Rota position assignment failed", error);
        setMessage({
          kind: "error",
          text: "We couldn't assign this driver. Refresh the vacancy and try again.",
        });
      } else {
        setMessage({
          kind: "success",
          text: "Driver and individual fleet allocation added as a draft duty.",
        });
        onChanged();
      }
    } catch (error) {
      console.error("Rota position assignment transport failed", error);
      setMessage({
        kind: "error",
        text: "We couldn't confirm the assignment. Refresh planning before trying again.",
      });
    } finally {
      setBusyDriver(null);
    }
  };
  return (
    <Drawer
      title={`${format(parseISO(slot.slot_date), "EEEE d MMMM")} · ${slot.role_label}`}
      subtitle={`${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)} · ${planningVehicleClassLabel(slot.required_vehicle_class)} · ${assigned.length}/${slot.required_headcount} assigned`}
      onClose={onClose}
    >
      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
        Assigned
      </h3>
      <div className="mt-2 space-y-2">
        {assigned.map((entry) => (
          <div
            key={entry.id}
            className="rounded-lg border border-brand-border bg-white/[0.03] p-3 text-xs"
          >
            <p className="font-bold text-white">
              {drivers.find((driver) => driver.id === entry.driver_id)
                ?.full_name ?? "Unnamed driver"}
            </p>
            <p className="mt-1 text-slate-500">
              {vehicles.find((vehicle) => vehicle.id === entry.vehicle_id)
                ?.reg_number ?? "Vehicle unassigned"}{" "}
              ·{" "}
              {trailers.find((trailer) => trailer.id === entry.trailer_id)
                ?.reg_number ?? "No trailer"}
            </p>
          </div>
        ))}
      </div>
      <h3 className="mt-5 text-[10px] font-black uppercase tracking-widest text-slate-500">
        Available drivers
      </h3>
      <div className="mt-2 space-y-3">
        {candidates.map(({ driver, assessment }) => {
          const already = assigned.some(
            (entry) => entry.driver_id === driver.id,
          );
          return (
            <article
              key={driver.id}
              className={`rounded-xl border p-3 ${assessment.group === "available" ? "border-emerald-500/25 bg-emerald-500/5" : assessment.group === "needs_review" ? "border-amber-500/25 bg-amber-500/5" : "border-red-500/20 bg-red-500/5 opacity-75"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-white">
                    {driver.full_name ?? "Unnamed driver"}
                  </p>
                  <p
                    className={`text-[10px] font-black ${assessment.group === "available" ? "text-emerald-200" : assessment.group === "needs_review" ? "text-amber-200" : "text-red-200"}`}
                  >
                    {assessment.label}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {assessment.reason} ·{" "}
                    {formatDuration(
                      plannedMinutesForDriver(driver.id, slots, assignments),
                    )}{" "}
                    planned
                  </p>
                </div>
                {assessment.group !== "unavailable" && !already ? (
                  <button
                    type="button"
                    onClick={() => void assign(driver.id)}
                    disabled={
                      busyDriver !== null ||
                      assigned.length >= slot.required_headcount
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-brand-accent px-2 py-1.5 text-[10px] font-black text-white disabled:opacity-40"
                  >
                    <UserPlus size={12} />
                    {busyDriver === driver.id ? "Adding…" : "Assign"}
                  </button>
                ) : (
                  <span className="text-[9px] font-black text-slate-500">
                    {already ? "Assigned" : "Unavailable"}
                  </span>
                )}
              </div>
              {assessment.group !== "unavailable" && !already ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <select
                    aria-label={`Vehicle for ${driver.full_name ?? "driver"}`}
                    value={assetChoice[driver.id]?.vehicle ?? ""}
                    onChange={(event) =>
                      setAssetChoice((current) => ({
                        ...current,
                        [driver.id]: {
                          vehicle: event.target.value,
                          trailer: current[driver.id]?.trailer ?? "",
                        },
                      }))
                    }
                    className="input"
                  >
                    <option value="">Vehicle later</option>
                    {eligibleVehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.reg_number} · {planningVehicleClassLabel(vehicle.planning_vehicle_class)}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`Trailer for ${driver.full_name ?? "driver"}`}
                    value={assetChoice[driver.id]?.trailer ?? ""}
                    onChange={(event) =>
                      setAssetChoice((current) => ({
                        ...current,
                        [driver.id]: {
                          vehicle: current[driver.id]?.vehicle ?? "",
                          trailer: event.target.value,
                        },
                      }))
                    }
                    className="input"
                  >
                    <option value="">No trailer</option>
                    {trailers.map((trailer) => (
                      <option key={trailer.id} value={trailer.id}>
                        {trailer.reg_number}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </Drawer>
  );
}

function DriverDrawer({
  driver,
  slots,
  assignments,
  availability,
  workSessions,
  regime,
  qualifications,
  onClose,
  onChanged,
  setMessage,
}: {
  driver: Driver | null;
  slots: PlanningSlot[];
  assignments: PlanningAssignment[];
  availability: PlanningAvailability[];
  workSessions: WorkSession[];
  regime: PlanningRegime;
  qualifications: LicenceEntitlement[];
  onClose: () => void;
  onChanged: () => void;
  setMessage: (message: { kind: "success" | "error"; text: string }) => void;
}) {
  const [selectedEntitlements, setSelectedEntitlements] = useState<LicenceEntitlement[]>(qualifications);
  const [savingEntitlements, setSavingEntitlements] = useState(false);
  if (!driver) return null;
  const saveEntitlements = async () => {
    setSavingEntitlements(true);
    try {
      const { error } = await planningRpc("set_driver_vehicle_qualifications", { p_driver_id: driver.id, p_vehicle_classes: selectedEntitlements }).abortSignal(AbortSignal.timeout(PLANNING_REQUEST_TIMEOUT_MS));
      if (error) { console.error("Driver entitlement save failed", error); return setMessage({ kind: "error", text: "We couldn't save these licence entitlements. Try again." }); }
      setMessage({ kind: "success", text: "Driver licence entitlements updated for rota planning." });
      await onChanged();
    } catch (error) {
      console.error("Driver entitlement transport failed", error);
      setMessage({ kind: "error", text: "We couldn't confirm the entitlement update. Refresh planning before trying again." });
    } finally { setSavingEntitlements(false); }
  };
  const duties = assignments
    .filter((entry) => entry.driver_id === driver.id)
    .map((entry) => slots.find((slot) => slot.id === entry.slot_id))
    .filter((slot): slot is PlanningSlot => Boolean(slot))
    .sort((a, b) =>
      `${a.slot_date}${a.start_time}`.localeCompare(
        `${b.slot_date}${b.start_time}`,
      ),
    );
  const actual = workSessions
    .filter((entry) => entry.user_id === driver.id)
    .reduce((total, entry) => total + (entry.total_work_minutes ?? 0), 0);
  return (
    <Drawer
      title={driver.full_name ?? "Unnamed driver"}
      subtitle="Driver planning summary"
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-3">
        <Metric label="Recorded" value={formatDuration(actual)} />
        <Metric
          label="Planned duty"
          value={formatDuration(
            plannedMinutesForDriver(driver.id, slots, assignments),
          )}
        />
      </div>
      <section className="mt-4 rounded-xl border border-brand-border bg-white/[0.03] p-3">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black text-white">UK licence entitlements</p><p className="mt-1 text-[10px] text-slate-400">Used to match 3.5t, 7.5t, Class 2 and Class 1 rota requirements. Continue to verify licence documents separately.</p></div><button type="button" onClick={() => void saveEntitlements()} disabled={savingEntitlements} className="rounded-lg bg-brand-accent px-3 py-2 text-[10px] font-black text-white disabled:opacity-50">{savingEntitlements ? "Saving…" : "Save"}</button></div>
        <div className="mt-3 flex flex-wrap gap-2">{licenceEntitlements.map((entitlement) => <label key={entitlement} className={`rounded-lg border px-3 py-2 text-xs font-black ${selectedEntitlements.includes(entitlement) ? "border-brand-accent bg-brand-accent/10 text-white" : "border-brand-border text-slate-500"}`}><input type="checkbox" className="sr-only" checked={selectedEntitlements.includes(entitlement)} onChange={() => setSelectedEntitlements((current) => current.includes(entitlement) ? current.filter((entry) => entry !== entitlement) : [...current, entitlement])} />{licenceEntitlementLabel(entitlement)}</label>)}</div>
      </section>
      <div
        className={`mt-4 rounded-xl border p-3 ${regime === "unknown" ? "border-amber-500/30 bg-amber-500/10" : "border-brand-border bg-white/[0.03]"}`}
      >
        <p className="text-xs font-black text-white">{regimeLabel(regime)}</p>
        <p className="mt-1 text-[10px] text-slate-400">
          Recorded, planned and unknown information remain separate. Duty time
          is not treated as driving time.
        </p>
      </div>
      <h3 className="mt-5 text-[10px] font-black uppercase text-slate-500">
        Assigned duties
      </h3>
      <div className="mt-2 space-y-2">
        {duties.map((duty) => (
          <div
            key={duty.id}
            className="rounded-lg border border-brand-border p-3"
          >
            <p className="text-xs font-bold text-white">
              {format(parseISO(duty.slot_date), "EEE d MMM")} ·{" "}
              {duty.role_label}
            </p>
            <p className="text-[10px] text-slate-500">
              {duty.start_time.slice(0, 5)}–{duty.end_time.slice(0, 5)}
            </p>
          </div>
        ))}
      </div>
      <h3 className="mt-5 text-[10px] font-black uppercase text-slate-500">
        Upcoming leave
      </h3>
      {availability
        .filter((entry) => entry.driver_id === driver.id)
        .map((entry) => (
          <p
            key={entry.id}
            className="mt-2 rounded-lg bg-violet-500/10 p-3 text-xs text-violet-200"
          >
            {availabilityLabel(entry.availability_type)} · {entry.starts_on}–
            {entry.ends_on}
          </p>
        ))}
    </Drawer>
  );
}

function LeaveDrawer({
  drivers,
  selectedDriverId,
  fromDate,
  policies,
  onClose,
  onChanged,
  setMessage,
}: {
  drivers: Driver[];
  selectedDriverId: string;
  fromDate: string;
  policies: LeavePolicy[];
  onClose: () => void;
  onChanged: () => void;
  setMessage: (message: { kind: "success" | "error"; text: string }) => void;
}) {
  const [driverId, setDriverId] = useState(selectedDriverId);
  const [type, setType] =
    useState<PlanningAvailability["availability_type"]>("annual_leave");
  const [start, setStart] = useState(fromDate);
  const [end, setEnd] = useState(fromDate);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const policy = policies.find((entry) => entry.availability_type === type);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await planningRpc("record_staff_availability", {
        p_driver_id: driverId,
        p_availability_type: type,
        p_starts_on: start,
        p_ends_on: end,
        p_note: note || undefined,
        p_role_label: policy?.role_label ?? "Driver",
      }).abortSignal(AbortSignal.timeout(PLANNING_REQUEST_TIMEOUT_MS));
      if (error) {
        console.error("Availability save failed", error);
        return setMessage({
          kind: "error",
          text: "We couldn't save this availability. Nothing was saved. Try again.",
        });
      }
      const result = data as {
        capacity_status?: string;
        booked?: number;
        maximum?: number;
      } | null;
      setMessage({
        kind: "success",
        text:
          result?.capacity_status === "reached"
            ? `Availability saved. Holiday capacity reached (${result.booked}/${result.maximum}).`
            : "Availability saved.",
      });
      onClose();
      onChanged();
    } catch (error) {
      console.error("Availability save transport failed", error);
      setMessage({
        kind: "error",
        text: "We couldn't confirm whether availability was saved. Refresh planning before trying again.",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Drawer
      title="Record leave or availability"
      subtitle="The selected period appears across People and Leave."
      onClose={onClose}
    >
      <form onSubmit={save} className="space-y-3">
        <label>
          <span className="hw-field-label">Driver</span>
          <select
            required
            value={driverId}
            onChange={(event) => setDriverId(event.target.value)}
            className="input"
          >
            <option value="">Choose driver</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.full_name ?? "Unnamed driver"}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="hw-field-label">Availability type</span>
          <select
            value={type}
            onChange={(event) =>
              setType(
                event.target.value as PlanningAvailability["availability_type"],
              )
            }
            className="input"
          >
            <option value="annual_leave">Annual leave</option>
            <option value="sickness">Sickness</option>
            <option value="training">Training</option>
            <option value="unavailable">Unavailable</option>
            <option value="other">Other</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="hw-field-label">Starts</span>
            <input
              type="date"
              required
              value={start}
              onChange={(event) => setStart(event.target.value)}
              className="input"
            />
          </label>
          <label>
            <span className="hw-field-label">Ends</span>
            <input
              type="date"
              required
              min={start}
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              className="input"
            />
          </label>
        </div>
        <label>
          <span className="hw-field-label">Note</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional context"
            className="input min-h-24"
          />
        </label>
        {policy ? (
          <p className="rounded-lg border border-brand-border p-3 text-xs text-slate-400">
            {policy.role_label}: maximum {policy.maximum_simultaneous}{" "}
            simultaneous ·{" "}
            {policy.handling === "block" ? "block when full" : "warn when full"}
          </p>
        ) : (
          <p className="text-xs text-amber-200">
            No company capacity rule is configured for this leave type.
          </p>
        )}
        <button
          disabled={busy || !driverId}
          className="w-full rounded-lg bg-brand-accent px-4 py-3 text-xs font-black text-white disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save availability"}
        </button>
      </form>
    </Drawer>
  );
}

function JobDrawer({
  onClose,
  onChanged,
  setMessage,
}: {
  onClose: () => void;
  onChanged: () => void;
  setMessage: (message: { kind: "success" | "error"; text: string }) => void;
}) {
  const [form, setForm] = useState({
    reference: "",
    title: "",
    type: "delivery",
    address: "",
    customer: "",
  });
  const [busy, setBusy] = useState(false);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await planningRpc("create_planned_job", {
        p_reference: form.reference,
        p_title: form.title,
        p_job_type: form.type,
        p_address_text: form.address,
        p_customer_name: form.customer || undefined,
        p_instructions: undefined,
        p_manager_notes: undefined,
      }).abortSignal(AbortSignal.timeout(PLANNING_REQUEST_TIMEOUT_MS));
      if (error) {
        console.error("Planned job creation failed", error);
        return setMessage({
          kind: "error",
          text: "We couldn't create this job. Nothing was saved. Try again.",
        });
      }
      setMessage({
        kind: "success",
        text: "Job added to the allocation pool.",
      });
      onClose();
      onChanged();
    } catch (error) {
      console.error("Planned job creation transport failed", error);
      setMessage({
        kind: "error",
        text: "We couldn't confirm whether the job was created. Refresh planning before trying again.",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Drawer
      title="Add job"
      subtitle="Jobs can exist before a run, driver or shift."
      onClose={onClose}
    >
      <form onSubmit={save} className="space-y-3">
        <label>
          <span className="hw-field-label">Job reference</span>
          <input
            required
            value={form.reference}
            onChange={(event) =>
              setForm({ ...form, reference: event.target.value })
            }
            className="input"
          />
        </label>
        <label>
          <span className="hw-field-label">Job title</span>
          <input
            required
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
            className="input"
          />
        </label>
        <label>
          <span className="hw-field-label">Customer</span>
          <input
            value={form.customer}
            onChange={(event) =>
              setForm({ ...form, customer: event.target.value })
            }
            placeholder="Optional"
            className="input"
          />
        </label>
        <label>
          <span className="hw-field-label">Address or location</span>
          <input
            required
            value={form.address}
            onChange={(event) =>
              setForm({ ...form, address: event.target.value })
            }
            className="input"
          />
        </label>
        <label>
          <span className="hw-field-label">Job type</span>
          <select
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value })}
            className="input"
          >
            <option value="delivery">Delivery</option>
            <option value="collection">Collection</option>
            <option value="service">Service</option>
            <option value="other">Other</option>
          </select>
        </label>
        <button
          disabled={busy}
          className="w-full rounded-lg bg-brand-accent px-4 py-3 text-xs font-black text-white"
        >
          {busy ? "Adding…" : "Add to job pool"}
        </button>
      </form>
    </Drawer>
  );
}

function RunDrawer({
  fromDate,
  slots,
  onClose,
  onChanged,
  setMessage,
}: {
  fromDate: string;
  slots: PlanningSlot[];
  onClose: () => void;
  onChanged: () => void;
  setMessage: (message: { kind: "success" | "error"; text: string }) => void;
}) {
  const [form, setForm] = useState({
    date: fromDate,
    label: "Run 01",
    start: "06:00",
    end: "15:00",
    slotId: "",
  });
  const [busy, setBusy] = useState(false);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await planningRpc("create_planned_run", {
        p_run_date: form.date,
        p_run_label: form.label,
        p_start_time: form.start,
        p_end_time: form.end,
        p_rota_slot_id: form.slotId || undefined,
      }).abortSignal(AbortSignal.timeout(PLANNING_REQUEST_TIMEOUT_MS));
      if (error) {
        console.error("Planned run creation failed", error);
        return setMessage({
          kind: "error",
          text: "We couldn't create this run. Nothing was saved. Try again.",
        });
      }
      setMessage({ kind: "success", text: "Unstaffed run created." });
      onClose();
      onChanged();
    } catch (error) {
      console.error("Planned run creation transport failed", error);
      setMessage({
        kind: "error",
        text: "We couldn't confirm whether the run was created. Refresh planning before trying again.",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Drawer
      title="New run"
      subtitle="A run can be ordered before a driver is selected."
      onClose={onClose}
    >
      <form onSubmit={save} className="space-y-3">
        <label>
          <span className="hw-field-label">Run date</span>
          <input
            type="date"
            required
            value={form.date}
            onChange={(event) => setForm({ ...form, date: event.target.value })}
            className="input"
          />
        </label>
        <label>
          <span className="hw-field-label">Run name</span>
          <input
            required
            value={form.label}
            onChange={(event) =>
              setForm({ ...form, label: event.target.value })
            }
            className="input"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="hw-field-label">Starts</span>
            <input
              type="time"
              required
              value={form.start}
              onChange={(event) =>
                setForm({ ...form, start: event.target.value })
              }
              className="input"
            />
          </label>
          <label>
            <span className="hw-field-label">Ends</span>
            <input
              type="time"
              required
              value={form.end}
              onChange={(event) =>
                setForm({ ...form, end: event.target.value })
              }
              className="input"
            />
          </label>
        </div>
        <label>
          <span className="hw-field-label">Staffing requirement</span>
          <select
            value={form.slotId}
            onChange={(event) =>
              setForm({ ...form, slotId: event.target.value })
            }
            className="input"
          >
            <option value="">Assign later</option>
            {slots
              .filter((slot) => slot.slot_date === form.date)
              .map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.role_label} · {slot.start_time.slice(0, 5)}
                </option>
              ))}
          </select>
        </label>
        <button
          disabled={busy}
          className="w-full rounded-lg bg-brand-accent px-4 py-3 text-xs font-black text-white"
        >
          {busy ? "Creating…" : "Create run"}
        </button>
      </form>
    </Drawer>
  );
}

function TemplateDrawer({
  onClose,
  refreshAndSelect,
  setMessage,
}: {
  onClose: () => void;
  refreshAndSelect: (templateId: string) => Promise<boolean>;
  setMessage: (message: { kind: "success" | "error"; text: string }) => void;
}) {
  const [name, setName] = useState("Regular Week");
  const [cycleLength, setCycleLength] = useState(7);
  const [requirements, setRequirements] = useState<RequirementDraft[]>([
    {
      id: crypto.randomUUID(),
      cycleDay: 1,
      roleLabel: "Day Driver",
      startTime: "06:00",
      endTime: "15:00",
      headcount: 12,
      vehicleClass: "3_5t",
    },
  ]);
  const [busy, setBusy] = useState(false);
  const [requestKey] = useState(() => crypto.randomUUID());
  const update = (id: string, change: Partial<RequirementDraft>) =>
    setRequirements((current) =>
      current.map((entry) =>
        entry.id === id ? { ...entry, ...change } : entry,
      ),
    );
  const copyDay = () => {
    const source = requirements.filter((entry) => entry.cycleDay === 1);
    const copies = Array.from(
      { length: Math.min(cycleLength, 5) - 1 },
      (_, index) =>
        source.map((entry) => ({
          ...entry,
          id: crypto.randomUUID(),
          cycleDay: index + 2,
        })),
    ).flat();
    setRequirements((current) => [
      ...current.filter((entry) => entry.cycleDay === 1 || entry.cycleDay > 5),
      ...copies,
    ]);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    let args: ReturnType<typeof buildRotaTemplateCreateArgs>;
    try {
      args = buildRotaTemplateCreateArgs({
        name,
        cycleLength,
        requirements,
        requestKey,
      });
    } catch (error) {
      setMessage({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Check the staffing pattern and try again.",
      });
      return;
    }
    const result = await submitRotaTemplate(args, {
      rpc: (payload, signal) =>
        supabase
          .rpc("create_cyclic_rota_template", payload)
          .abortSignal(signal),
      refreshAndSelect,
      setBusy,
      onConfirmed: onClose,
      reportTechnicalError: (error) =>
        console.error("Rota template save failed", error),
    });
    setMessage(
      result.status === "confirmed"
        ? { kind: "success", text: `${result.name} saved.` }
        : { kind: "error", text: result.message },
    );
  };
  return (
    <Drawer
      wide
      title="New staffing pattern"
      subtitle="Add many requirements across a repeating staffing-demand cycle."
      onClose={onClose}
    >
      <form onSubmit={save}>
        <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
          <label>
            <span className="hw-field-label">Pattern name</span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="input"
            />
          </label>
          <label>
            <span className="hw-field-label">Cycle length</span>
            <select
              value={cycleLength}
              onChange={(event) => setCycleLength(Number(event.target.value))}
              className="input"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={28}>28 days</option>
              <option value={8}>8 days (custom)</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setRequirements((current) => [
                ...current,
                {
                  id: crypto.randomUUID(),
                  cycleDay: 1,
                  roleLabel: "Driver",
                  startTime: "06:00",
                  endTime: "15:00",
                  headcount: 1,
                  vehicleClass: "3_5t",
                },
              ])
            }
            className="inline-flex items-center gap-1 rounded-lg border border-brand-border px-3 py-2 text-xs font-bold text-white"
          >
            <Plus size={13} />
            Requirement
          </button>
          <button
            type="button"
            onClick={copyDay}
            className="inline-flex items-center gap-1 rounded-lg border border-brand-border px-3 py-2 text-xs font-bold text-white"
          >
            <Copy size={13} />
            Copy day 1 to days 2–5
          </button>
        </div>
        <div
          className="mt-3 hidden grid-cols-[90px_1fr_125px_105px_105px_90px_34px] gap-2 px-3 sm:grid"
          aria-hidden="true"
        >
          <span className="hw-field-label mb-0">Cycle day</span>
          <span className="hw-field-label mb-0">Role</span>
          <span className="hw-field-label mb-0">Vehicle type</span>
          <span className="hw-field-label mb-0">Start</span>
          <span className="hw-field-label mb-0">Finish</span>
          <span className="hw-field-label mb-0">People</span>
          <span />
        </div>
        <div className="mt-2 max-h-[55vh] space-y-2 overflow-auto">
          {requirements.map((entry) => (
            <div
              key={entry.id}
              className="grid gap-2 rounded-xl border border-brand-border bg-white/[0.02] p-3 sm:grid-cols-[90px_1fr_125px_105px_105px_90px_34px]"
            >
              <select
                aria-label="Cycle day"
                value={entry.cycleDay}
                onChange={(event) =>
                  update(entry.id, { cycleDay: Number(event.target.value) })
                }
                className="input"
              >
                {Array.from({ length: cycleLength }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    {cycleDayLabel(index + 1, cycleLength)}
                  </option>
                ))}
              </select>
              <input
                aria-label="Role"
                required
                value={entry.roleLabel}
                onChange={(event) =>
                  update(entry.id, { roleLabel: event.target.value })
                }
                className="input"
              />
              <select aria-label="Vehicle type" value={entry.vehicleClass} onChange={(event) => update(entry.id, { vehicleClass: event.target.value as PlanningVehicleClass | "" })} className="input">
                <option value="">Any type</option>
                {planningVehicleClasses.map((value) => <option key={value} value={value}>{planningVehicleClassLabel(value)}</option>)}
              </select>
              <input
                aria-label="Start time"
                type="time"
                required
                value={entry.startTime}
                onChange={(event) =>
                  update(entry.id, { startTime: event.target.value })
                }
                className="input"
              />
              <input
                aria-label="Finish time"
                type="time"
                required
                value={entry.endTime}
                onChange={(event) =>
                  update(entry.id, { endTime: event.target.value })
                }
                className="input"
              />
              <input
                aria-label="People required"
                type="number"
                min="1"
                max="50"
                required
                value={entry.headcount}
                onChange={(event) =>
                  update(entry.id, { headcount: Number(event.target.value) })
                }
                className="input"
              />
              <button
                type="button"
                onClick={() =>
                  setRequirements((current) =>
                    current.filter((item) => item.id !== entry.id),
                  )
                }
                aria-label="Delete requirement"
                className="text-red-300"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
        <button
          disabled={busy || requirements.length === 0}
          className="mt-4 w-full rounded-lg bg-brand-accent px-4 py-3 text-xs font-black text-white disabled:opacity-40"
        >
          {busy ? "Saving…" : `Save ${requirements.length} requirements`}
        </button>
      </form>
    </Drawer>
  );
}

function ApplyPreviewDialog({
  preview,
  busy,
  onCancel,
  onConfirm,
}: {
  preview: Record<string, number> | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog title="Apply staffing pattern" onClose={onCancel}>
      <p className="text-sm text-slate-400">
        Review the bounded change before any dated requirements are created.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Metric
          label="Days covered"
          value={String(preview?.days_covered ?? 0)}
        />
        <Metric
          label="Requirements"
          value={String(preview?.requirements ?? 0)}
        />
        <Metric
          label="Total positions"
          value={String(preview?.total_positions ?? 0)}
        />
        <Metric
          label="Existing draft rows"
          value={String(preview?.existing_draft_requirements ?? 0)}
        />
        <Metric
          label="Leave records"
          value={String(preview?.leave_records_in_period ?? 0)}
        />
        <Metric
          label="Cycle"
          value={`${preview?.cycle_length_days ?? 0} days`}
        />
      </div>
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-brand-border py-3 text-xs font-black text-slate-300"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="flex-1 rounded-lg bg-brand-accent py-3 text-xs font-black text-white disabled:opacity-50"
        >
          {busy ? "Applying…" : "Confirm cover"}
        </button>
      </div>
    </Dialog>
  );
}

function DeletePatternDialog({ template, busy, onCancel, onConfirm }: { template: RotaTemplate; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <Dialog title="Delete staffing pattern" onClose={onCancel}><p className="mt-3 text-sm text-slate-300">Delete <strong className="text-white">{template.name}</strong>?</p><p className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-100">The reusable pattern will be removed. Weeks already created from it, including their staffing and assignments, will stay in place.</p><div className="mt-5 flex gap-3"><button type="button" onClick={onCancel} disabled={busy} className="flex-1 rounded-lg border border-brand-border py-3 text-xs font-black text-slate-300">Keep pattern</button><button type="button" onClick={onConfirm} disabled={busy} className="flex-1 rounded-lg bg-red-600 py-3 text-xs font-black text-white disabled:opacity-50">{busy ? "Deleting…" : "Delete pattern"}</button></div></Dialog>;
}
function ReviewDialog({
  review,
  busy,
  onCancel,
  onPublish,
  onInspectDuties,
}: {
  review: ReturnType<typeof buildReview>;
  busy: boolean;
  onCancel: () => void;
  onPublish: () => void;
  onInspectDuties: () => void;
}) {
  return (
    <Dialog title="Publish week" onClose={onCancel}>
      <p className="text-sm text-slate-400">
        Every duty is checked again against current operational data immediately
        before publication.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Metric
          label="Draft duties"
          value={String(review.duties)}
          tone="good"
        />
        <Metric
          label="Unfilled vacancies"
          value={String(review.vacancies)}
          tone={review.vacancies ? "warning" : "good"}
        />
        <Metric
          label="Missing vehicle"
          value={String(review.missingVehicles)}
          tone={review.missingVehicles ? "warning" : "good"}
        />
        <Metric
          label="Availability conflicts"
          value={String(review.availabilityConflicts)}
          tone={review.availabilityConflicts ? "danger" : "good"}
        />
        <Metric
          label="Unstaffed runs"
          value={String(review.unstaffedRuns)}
          tone={review.unstaffedRuns ? "warning" : "good"}
        />
        <Metric
          label="Jobs waiting"
          value={String(review.unallocatedRunJobs)}
          tone={review.unallocatedRunJobs ? "warning" : "good"}
        />
      </div>
      {review.vacancies ? (
        <p className="mt-4 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
          <AlertTriangle size={15} className="shrink-0" />
          Unfilled requirements remain in planning and are never represented by
          driverless shifts.
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onInspectDuties}
          className="flex-1 rounded-lg border border-brand-border py-3 text-xs font-black text-slate-300"
        >
          Inspect assigned duties
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={busy || review.duties === 0}
          className="flex-1 rounded-lg bg-brand-accent py-3 text-xs font-black text-white disabled:opacity-50"
        >
          {busy ? "Checking…" : "Publish ready duties"}
        </button>
      </div>
    </Dialog>
  );
}

function LocalWarning({ text }: { text: string }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100"
    >
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}
function BoardFailure({
  text,
  onRetry,
}: {
  text: string;
  onRetry: () => void;
}) {
  return (
    <section
      role="alert"
      className="rounded-2xl border border-red-500/30 bg-brand-card p-10 text-center"
    >
      <AlertTriangle className="mx-auto text-red-300" size={28} />
      <h2 className="mt-3 font-black text-white">
        This week's plan is unavailable
      </h2>
      <p className="mt-1 text-sm text-red-200">{text}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-lg bg-brand-accent px-4 py-2 text-xs font-black text-white"
      >
        Try again
      </button>
    </section>
  );
}

function PatternManagerDrawer({
  templates,
  slots,
  onDelete,
  onNew,
  onClose,
}: {
  templates: RotaTemplate[];
  slots: TemplateSlot[];
  onDelete: (template: RotaTemplate) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  return (
    <Drawer
      title="Staffing patterns"
      subtitle="Save your usual staffing pattern and reuse it each week."
      onClose={onClose}
    >
      <TemplatesView templates={templates} slots={slots} onNew={onNew} onDelete={onDelete} />
    </Drawer>
  );
}

function JobTray({
  open,
  jobs,
  unallocatedJobs,
  runs,
  jobsError,
  onToggle,
  onNewJob,
  onChanged,
  setMessage,
}: {
  open: boolean;
  jobs: Job[];
  unallocatedJobs: Job[];
  runs: PlannedRun[];
  jobsError: string | null;
  onToggle: () => void;
  onNewJob: () => void;
  onChanged: () => void;
  setMessage: (message: { kind: "success" | "error"; text: string }) => void;
}) {
  const [search, setSearch] = useState("");
  const [moving, setMoving] = useState<string | null>(null);
  const visible = unallocatedJobs
    .filter((job) =>
      `${job.reference} ${job.title} ${job.customer_name ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .slice(0, 40);
  const move = async (jobId: string, runId: string) => {
    if (!runId) return;
    setMoving(jobId);
    try {
      const { error } = await planningRpc("place_job_on_planned_run", {
        p_job_id: jobId,
        p_planned_run_id: runId,
        p_sequence: undefined,
      }).abortSignal(AbortSignal.timeout(PLANNING_REQUEST_TIMEOUT_MS));
      if (error) {
        console.error("Job tray placement failed", error);
        setMessage({
          kind: "error",
          text: "We couldn't move this job. Try again.",
        });
      } else {
        setMessage({ kind: "success", text: "Job moved to the run." });
        onChanged();
      }
    } catch (error) {
      console.error("Job tray transport failed", error);
      setMessage({
        kind: "error",
        text: "We couldn't confirm the move. Refresh planning before trying again.",
      });
    } finally {
      setMoving(null);
    }
  };
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-card shadow-lg">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <Briefcase size={16} className="text-brand-accent" />
        <span className="font-black text-white">Jobs waiting</span>
        <span className="rounded-full bg-brand-accent/15 px-2 py-1 text-[10px] font-black text-brand-accent">
          {unallocatedJobs.length}
        </span>
        <span className="ml-auto text-xs text-slate-500">
          Available throughout this week
        </span>
        <ChevronDown
          size={16}
          className={`text-slate-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="border-t border-brand-border p-4">
          {jobsError ? (
            <LocalWarning text={jobsError} />
          ) : (
            <>
              <div className="flex gap-2">
                <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-brand-border bg-brand-dark px-3">
                  <Search size={14} className="text-slate-500" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search waiting jobs"
                    className="min-w-0 flex-1 bg-transparent py-2 text-xs text-white outline-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={onNewJob}
                  className="rounded-lg bg-brand-accent px-3 text-xs font-black text-white"
                >
                  + Add job
                </button>
              </div>
              <div className="mt-3 grid max-h-52 gap-2 overflow-auto md:grid-cols-2 xl:grid-cols-3">
                {visible.map((job) => (
                  <article
                    key={job.id}
                    className="rounded-xl border border-brand-border bg-brand-dark/35 p-3"
                  >
                    <p className="text-xs font-black text-white">
                      {job.reference} · {job.title}
                    </p>
                    <p className="mt-1 line-clamp-1 text-[10px] text-slate-500">
                      {job.customer_name ?? job.address_text}
                    </p>
                    <select
                      aria-label={`Move ${job.reference} to run`}
                      disabled={moving === job.id || runs.length === 0}
                      defaultValue=""
                      onChange={(event) => {
                        void move(job.id, event.target.value);
                        event.currentTarget.value = "";
                      }}
                      className="input mt-2 w-full"
                    >
                      <option value="">Move to run…</option>
                      {runs.map((run) => (
                        <option key={run.id} value={run.id}>
                          {format(parseISO(run.run_date), "EEE")} ·{" "}
                          {run.run_label}
                        </option>
                      ))}
                    </select>
                  </article>
                ))}
              </div>
              {jobs.length === 0 ? (
                <p className="py-5 text-center text-xs text-slate-500">
                  No jobs have been entered yet.
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}

function BulkFillDrawer({
  slots,
  drivers,
  allSlots,
  assignments,
  availability,
  regimes,
  qualifications,
  onClose,
  onChanged,
  setMessage,
}: {
  slots: PlanningSlot[];
  drivers: Driver[];
  allSlots: PlanningSlot[];
  assignments: PlanningAssignment[];
  availability: PlanningAvailability[];
  regimes: DriverPlanningProfile[];
  qualifications: DriverVehicleQualification[];
  onClose: () => void;
  onChanged: () => void;
  setMessage: (message: { kind: "success" | "error"; text: string }) => void;
}) {
  const availableDates = [
    ...new Set(slots.map((slot) => slot.slot_date)),
  ].sort();
  const [driverIds, setDriverIds] = useState<string[]>([]);
  const [dates, setDates] = useState<string[]>(availableDates);
  const [busy, setBusy] = useState(false);
  const [requestKey] = useState(() => crypto.randomUUID());
  const [serverItems, setServerItems] = useState<BulkCandidate[] | null>(null);
  const chosenSlots = slots.filter((slot) => dates.includes(slot.slot_date));
  const regimeMap = Object.fromEntries(
    regimes.map((entry) => [entry.driver_id, entry.regulatory_regime]),
  );
  const entitlementMap = Object.fromEntries(drivers.map((driver) => [driver.id, qualifications.filter((entry) => entry.driver_id === driver.id).map((entry) => entry.vehicle_class)]));
  const preview = useMemo(
    () =>
      buildBulkAssignmentPreview({
        driverIds,
        slotIds: chosenSlots.map((slot) => slot.id),
        slots: allSlots,
        assignments,
        availability,
        regimes: regimeMap,
        entitlements: entitlementMap,
      }),
    [allSlots, assignments, availability, chosenSlots, driverIds, entitlementMap, regimeMap],
  );
  const shown = serverItems ?? preview;
  const ready = preview.filter(
    (item) => item.status === "READY" || item.status === "NEEDS_REVIEW",
  );
  const toggle = (
    values: string[],
    value: string,
    setter: (next: string[]) => void,
  ) =>
    setter(
      values.includes(value)
        ? values.filter((entry) => entry !== value)
        : [...values, value],
    );
  const confirm = async () => {
    if (ready.length === 0) return;
    setBusy(true);
    try {
      const { data, error } = await planningRpc("bulk_assign_rota_positions", {
        p_items: ready.map((item) => ({
          slot_id: item.slotId,
          driver_id: item.driverId,
        })),
        p_request_key: requestKey,
        p_commit: true,
      }).abortSignal(AbortSignal.timeout(PLANNING_REQUEST_TIMEOUT_MS));
      if (error) {
        console.error("Bulk staffing failed", error);
        return setMessage({
          kind: "error",
          text: "We couldn't fill these vacancies. Nothing was changed. Try again.",
        });
      }
      const result = data as {
        items?: Array<{
          slot_id: string;
          driver_id: string;
          status: BulkCandidate["status"];
          reason: string;
        }>;
      } | null;
      const items = (result?.items ?? []).map((item) => ({
        driverId: item.driver_id,
        slotId: item.slot_id,
        date:
          allSlots.find((slot) => slot.id === item.slot_id)?.slot_date ?? "",
        status: item.status,
        reason: item.reason,
      }));
      setServerItems(items);
      const committed = items.filter(
        (item) => item.status === "READY" || item.status === "NEEDS_REVIEW",
      ).length;
      setMessage({
        kind: "success",
        text: `${committed} assignments added. ${items.length - committed} need attention.`,
      });
      await onChanged();
    } catch (error) {
      console.error("Bulk staffing transport failed", error);
      setMessage({
        kind: "error",
        text: "We couldn't confirm the bulk assignment. Refresh planning before trying again.",
      });
    } finally {
      setBusy(false);
    }
  };
  const counts = (status: BulkCandidate["status"]) =>
    shown.filter((item) => item.status === status).length;
  return (
    <Drawer
      wide
      title="Fill vacancies"
      subtitle="Choose drivers and days once, review every result, then confirm together."
      onClose={onClose}
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <section>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
              Available drivers
            </h3>
            <button
              type="button"
              onClick={() => setDriverIds(drivers.map((driver) => driver.id))}
              className="text-xs font-bold text-brand-accent"
            >
              Select all
            </button>
          </div>
          <div className="mt-2 max-h-72 space-y-1 overflow-auto">
            {drivers.map((driver) => {
              const awayDays = availableDates.filter((date) =>
                availability.some(
                  (entry) =>
                    entry.driver_id === driver.id &&
                    entry.starts_on <= date &&
                    entry.ends_on >= date,
                ),
              );
              return (
                <label
                  key={driver.id}
                  className="flex items-center gap-3 rounded-lg border border-brand-border px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={driverIds.includes(driver.id)}
                    onChange={() => toggle(driverIds, driver.id, setDriverIds)}
                  />
                  <span className="min-w-0 flex-1 text-xs font-bold text-white">
                    {driver.full_name ?? "Unnamed driver"}
                  </span>
                  <span
                    className={`text-[9px] ${awayDays.length ? "text-violet-200" : "text-emerald-200"}`}
                  >
                    {awayDays.length ? `${awayDays.length} away` : "Available"}
                  </span>
                </label>
              );
            })}
          </div>
          <h3 className="mt-5 text-xs font-black uppercase tracking-widest text-slate-400">
            Apply to days
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {availableDates.map((date) => (
              <label
                key={date}
                className={`rounded-lg border px-3 py-2 text-xs font-black ${dates.includes(date) ? "border-brand-accent bg-brand-accent/10 text-white" : "border-brand-border text-slate-500"}`}
              >
                <input
                  className="sr-only"
                  type="checkbox"
                  checked={dates.includes(date)}
                  onChange={() => toggle(dates, date, setDates)}
                />
                {format(parseISO(date), "EEE d")}
              </label>
            ))}
          </div>
        </section>
        <section>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
            Preview
          </h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Metric label="Ready" value={String(counts("READY"))} tone="good" />
            <Metric
              label="Needs review"
              value={String(counts("NEEDS_REVIEW"))}
              tone="warning"
            />
            <Metric
              label="Unavailable"
              value={String(counts("UNAVAILABLE"))}
              tone="danger"
            />
            <Metric
              label="Already assigned / conflict"
              value={String(counts("CONFLICT"))}
              tone="warning"
            />
          </div>
          <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-brand-border">
            <table className="w-full text-left text-[10px]">
              <tbody className="divide-y divide-brand-border">
                {shown.map((item) => (
                  <tr key={`${item.slotId}:${item.driverId}`}>
                    <td className="p-2 font-bold text-white">
                      {drivers.find((driver) => driver.id === item.driverId)
                        ?.full_name ?? "Driver"}
                    </td>
                    <td className="p-2 text-slate-400">
                      {format(parseISO(item.date), "EEE d")}
                    </td>
                    <td className="p-2 font-black text-slate-200">
                      {item.status === "CONFLICT" &&
                      item.reason === "Already assigned"
                        ? "Already assigned"
                        : item.status.replace("_", " ")}
                    </td>
                    <td className="p-2 text-slate-500">{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={busy || ready.length === 0 || Boolean(serverItems)}
            className="mt-4 w-full rounded-lg bg-brand-accent px-4 py-3 text-xs font-black text-white disabled:opacity-40"
          >
            {busy
              ? "Assigning…"
              : serverItems
                ? "Assignments added"
                : `Confirm ${ready.length} assignments`}
          </button>
        </section>
      </div>
    </Drawer>
  );
}

function Drawer({
  title,
  subtitle,
  onClose,
  wide = false,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const displaySubtitle =
    title === "New staffing pattern"
      ? "Add the people you usually need on each day."
      : subtitle;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/55"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute inset-y-0 right-0 overflow-auto border-l border-brand-border bg-brand-card p-5 shadow-2xl ${wide ? "w-full max-w-3xl" : "w-full max-w-lg"}`}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-white">{title}</h2>
            <p className="mt-1 text-xs text-slate-400">{displaySubtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg border border-brand-border p-2 text-slate-400"
          >
            <X size={17} />
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}
function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-xl rounded-2xl border border-brand-border bg-brand-card p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warning" | "danger";
}) {
  const color =
    tone === "good"
      ? "text-emerald-200"
      : tone === "warning"
        ? "text-amber-200"
        : tone === "danger"
          ? "text-red-200"
          : "text-white";
  return (
    <div className="rounded-xl border border-brand-border bg-brand-dark/40 p-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-lg font-black ${color}`}>{value}</p>
    </div>
  );
}
function groupOrder(group: "available" | "needs_review" | "unavailable") {
  return group === "available" ? 0 : group === "needs_review" ? 1 : 2;
}
function cycleDayLabel(day: number, length: number) {
  return length === 7
    ? (["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day - 1] ??
        `Day ${day}`)
    : `Day ${day}`;
}
function regimeLabel(regime: PlanningRegime) {
  return regime === "assimilated_aetr"
    ? "Assimilated / AETR planning profile"
    : regime === "gb_domestic"
      ? "GB domestic planning profile"
      : regime === "other_not_applicable"
        ? "Other / not applicable"
        : "Rules need confirming";
}
function buildReview(snapshot: Snapshot) {
  const active = snapshot.assignments.filter(
    (entry) => entry.status !== "cancelled",
  );
  return {
    duties: active.length,
    vacancies: snapshot.slots.reduce(
      (total, slot) =>
        total +
        Math.max(
          slot.required_headcount -
            active.filter((entry) => entry.slot_id === slot.id).length,
          0,
        ),
      0,
    ),
    missingVehicles: active.filter((entry) => !entry.vehicle_id).length,
    availabilityConflicts: active.filter((entry) => {
      const slot = snapshot.slots.find((item) => item.id === entry.slot_id);
      return Boolean(
        slot &&
          availabilityForDate(
            snapshot.availability,
            entry.driver_id,
            slot.slot_date,
          ),
      );
    }).length,
    unstaffedRuns: snapshot.runs.filter((run) => !run.rota_slot_assignment_id)
      .length,
    unallocatedRunJobs: snapshot.run_jobs.filter(
      (entry) => !entry.projected_job_assignment_id,
    ).length,
  };
}
