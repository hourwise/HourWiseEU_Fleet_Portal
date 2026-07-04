import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import readesm from "https://esm.sh/readesm@1.0.17";
import { TACHO_RULE_LEGAL_BASIS, TACHO_RULE_TITLES } from "../../../shared/tachoRuleCore.ts";
import {
  buildSharedDaySummaries,
  buildSharedDutyWindows,
  mergeAdjacentNormalizedActivities,
  type SharedDutyWindow,
  type SharedNormalizedActivity,
} from "../../../shared/tachoNormalization.ts";
import { evaluateSharedRuleFindings } from "../../../shared/tachoRuleEvaluation.ts";
import {
  buildSharedAppTachoReconciliationItems,
  summarizeSharedReconciliation,
} from "../../../shared/tachoReconciliation.ts";

const PARSER_VERSION = "readesm@1.0.17";
const HOURWISE_READ_ONLY_CAPTURE_SCHEMA = "hourwise.tachograph.driver-card.read-only-capture.v1";
const HOURWISE_READ_ONLY_CAPTURE_EXPORT_FORMAT = "hourwise_read_only_capture_v1";
const HOURWISE_READ_ONLY_CAPTURE_PARSER_VERSION = "hourwise-read-only-capture@1";
const HOURWISE_READ_ONLY_CAPTURE_SIGNAL_SOURCE = "hourwise_read_only_capture";
const TIMELINE_GENERATION_VERSION = "timeline-mvp@1";
const SIGNAL_PERIODS = [7, 14, 28, 30, 90, 180];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-tacho-trigger-token",
};

type ImportRecord = {
  id: string;
  company_id: string | null;
  driver_id: string | null;
  vehicle_id?: string | null;
  file_path: string;
  file_type?: string | null;
  filename?: string | null;
  metadata?: Record<string, unknown> | null;
  source_type?: string | null;
};

type TachographFileSupersedeCandidate = {
  id: string;
  driver_id: string | null;
  external_card_number: string | null;
  metadata: Record<string, unknown> | null;
};

type HourWiseReadOnlyCaptureFile = {
  fileId?: unknown;
  name?: unknown;
  selected?: unknown;
  readSuccess?: unknown;
  bytesRead?: unknown;
  truncated?: unknown;
  sha256?: unknown;
  statusWord?: unknown;
  statusMeaning?: unknown;
  dataBase64?: unknown;
};

type HourWiseReadOnlyCapture = {
  schema?: unknown;
  warning?: unknown;
  readSessionId?: unknown;
  helperVersion?: unknown;
  sourceType?: unknown;
  exportedAt?: unknown;
  readerName?: unknown;
  activeProtocol?: unknown;
  atr?: unknown;
  applicationAid?: unknown;
  maxBytesPerFile?: unknown;
  readOnlyApduAllowlist?: unknown;
  files?: unknown;
};

type HourWiseDriverCardIdentity = {
  cardNumber: string;
  cardIssuingMemberState: number | null;
  cardIssuingAuthorityName: string | null;
  cardIssueDate: string | null;
  cardValidityBegin: string | null;
  cardExpiryDate: string | null;
  cardHolderSurname: string | null;
  cardHolderFirstNames: string | null;
  driverName: string | null;
  cardHolderPreferredLanguage: string | null;
};

type HourWiseActivityParseResult = {
  rawActivities: RawActivityRow[];
  dayCount: number;
  changeCount: number;
  firstActivityDate: string | null;
  lastActivityDate: string | null;
  warning: string | null;
};

type HourWiseReadOnlyCaptureProcessingResult = {
  status: "processed" | "partial";
  normalizedSegments: number;
  findingsCount: number;
  reconciliationIssueCount: number;
  activityDayCount: number;
  activityChangeCount: number;
};

type RawActivityRow = {
  file_id: string;
  driver_id: string | null;
  start_time: string;
  end_time: string;
  activity_type: "driving" | "work" | "poa" | "rest";
  slot: number;
  is_manual_entry: boolean;
  distance_km: number | null;
};

type NormalizedActivityRow = {
  import_id: string;
  company_id: string | null;
  driver_id: string | null;
  vehicle_id: string | null;
  source: "driver_card" | "vehicle_unit";
  activity_type: "driving" | "work" | "poa" | "break_rest";
  start_time: string;
  end_time: string;
  duration_mins: number;
  distance_km: number | null;
  confidence: "high";
  label: string | null;
};

type DaySummaryRow = {
  import_id: string;
  company_id: string | null;
  driver_id: string | null;
  vehicle_id: string | null;
  summary_date: string;
  driving_mins: number;
  work_mins: number;
  poa_mins: number;
  rest_mins: number;
  app_driving_mins: number | null;
  findings_count: number;
  vu_event_count: number;
};

type FindingRow = {
  import_id: string;
  company_id: string | null;
  driver_id: string | null;
  vehicle_id: string | null;
  source: "driver_card" | "vehicle_unit";
  severity: "high" | "medium";
  status: "breach" | "warning";
  rule_code: string;
  title: string;
  summary: string;
  legal_basis: string | null;
  occurred_at: string;
  period_start: string;
  period_end: string;
  evidence_refs: Array<{ kind: string; refId: string; label?: string }>;
  metadata: Record<string, string | number | boolean | null>;
};

type TechnicalEventRow = {
  import_id: string;
  company_id: string | null;
  driver_id: string | null;
  vehicle_id: string | null;
  source: "vehicle_unit";
  severity: "high" | "medium";
  status: "warning";
  rule_code: string;
  title: string;
  summary: string;
  occurred_at: string;
  period_start: string;
  period_end: string;
  evidence_refs: Array<{ kind: string; refId: string; label?: string }>;
  metadata: Record<string, string | number | boolean | null>;
};

type VehicleMotionDiscrepancyRow = {
  import_id: string;
  company_id: string | null;
  driver_id: string | null;
  vehicle_id: string | null;
  discrepancy_date: string;
  start_time: string;
  end_time: string;
  duration_mins: number;
  severity: "high" | "medium";
  status: "unassigned_motion" | "card_gap" | "driver_mismatch" | "needs_review";
  summary: string;
  linked_driver_name: string | null;
  evidence_refs: Array<{ kind: string; refId: string; label?: string }>;
  metadata: Record<string, string | number | boolean | null>;
};

type ReconciliationRow = {
  import_id: string;
  company_id: string | null;
  driver_id: string | null;
  vehicle_id: string | null;
  recon_date: string;
  status: "matched" | "tacho_only" | "app_only" | "mismatch_activity" | "mismatch_duration" | "uncertain";
  app_label: string;
  tacho_label: string;
  summary: string;
  app_driving_mins: number;
  tacho_driving_mins: number;
  metadata: Record<string, string | number | boolean | null>;
};

type WorkSessionRow = {
  start_time: string;
  other_data: { driving?: number } | null;
};

type ExtractedVuEvent = {
  timestamp: string;
  endTimestamp: string;
  ruleCode:
    | "VU_MOTION_CONFLICT"
    | "VU_POWER_INTERRUPTION"
    | "VU_DRIVING_WITHOUT_CARD"
    | "VU_CARD_INSERTION_WHILE_DRIVING"
    | "VU_CARD_CONFLICT"
    | "VU_SENSOR_FAULT"
    | "VU_SECURITY_FAULT"
    | "VU_CALIBRATION_EVENT";
  summary: string;
  evidenceLabel: string;
  severity: "high" | "medium";
  metadata: Record<string, string | number | boolean | null>;
};

type DutyWindow = SharedDutyWindow & {
  activities: NormalizedActivityRow[];
};

type AuthorizedImportActor =
  | { kind: "trigger" }
  | {
      kind: "user";
      userId: string;
      companyId: string | null;
      role: "driver" | "manager" | null;
    };

type ParserRunLifecycleContext = {
  id: string;
  startedAt: string;
  parserName: string;
  parserVersion: string;
  source: string;
  actorKind: AuthorizedImportActor["kind"];
  actorUserId: string | null;
  supersedesParserRunId: string | null;
};

type ParserRunLifecycleStatus =
  | "running"
  | "completed"
  | "completed_with_warnings"
  | "failed"
  | "unsupported";

function unauthorizedResponse(message: string, status = 401) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function authorizeImportRequest(
  req: Request,
  record: ImportRecord
): Promise<AuthorizedImportActor | Response> {
  const triggerToken = req.headers.get("x-tacho-trigger-token");
  const configuredTriggerToken = Deno.env.get("PROCESS_TACHO_TRIGGER_TOKEN");

  if (configuredTriggerToken && triggerToken === configuredTriggerToken) {
    return { kind: "trigger" };
  }

  const authorization = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!authorization || !supabaseUrl || !anonKey) {
    return unauthorizedResponse("Missing authorized processing context.");
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return unauthorizedResponse("Unable to verify the processing user.");
  }

  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return unauthorizedResponse("Unable to load the processing user profile.");
  }

  if (profile.role !== "manager") {
    return unauthorizedResponse("Only manager users can process tachograph imports.", 403);
  }

  if (record.company_id && profile.company_id !== record.company_id) {
    return unauthorizedResponse("Import company does not match the authenticated manager.", 403);
  }

  return {
    kind: "user",
    userId: user.id,
    companyId: profile.company_id ?? null,
    role: profile.role ?? null,
  };
}

async function createParserRun(
  supabaseAdmin: ReturnType<typeof createClient>,
  record: ImportRecord,
  actor: AuthorizedImportActor
): Promise<ParserRunLifecycleContext> {
  const startedAt = new Date().toISOString();
  const isHourWiseCapture = isHourWiseReadOnlyCaptureMetadata(record.metadata);
  const parserName = isHourWiseCapture ? "hourwise_read_only_capture" : "readesm";
  const parserVersion = isHourWiseCapture ? HOURWISE_READ_ONLY_CAPTURE_PARSER_VERSION : PARSER_VERSION;
  const source = isHourWiseCapture ? "hourwise_read_only_capture" : "normalized_findings";
  const { data: currentRuns, error: currentRunError } = await supabaseAdmin
    .from("tachograph_processing_runs")
    .select("id")
    .eq("import_id", record.id)
    .eq("is_current", true)
    .order("processed_at", { ascending: false })
    .limit(1);

  if (currentRunError) throw currentRunError;

  const supersedesParserRunId = currentRuns?.[0]?.id ?? null;
  const { data: insertedRun, error: insertError } = await supabaseAdmin
    .from("tachograph_processing_runs")
    .insert({
      import_id: record.id,
      company_id: record.company_id ?? null,
      parser_name: parserName,
      parser_version: parserVersion,
      parser_config_json: {
        source_type: record.source_type ?? null,
        file_type: record.file_type ?? null,
      },
      source,
      status: "running",
      started_at: startedAt,
      warnings: [],
      errors: [],
      processed_at: startedAt,
      triggered_by: actor.kind === "user" ? "manager" : "trigger",
      supersedes_parser_run_id: supersedesParserRunId,
      is_current: true,
      metadata: {
        actor_kind: actor.kind,
        actor_user_id: actor.kind === "user" ? actor.userId : null,
        supersedes_parser_run_id: supersedesParserRunId,
        parse_002_lifecycle: true,
      },
    })
    .select("id, started_at, parser_name, parser_version, source")
    .single();

  if (insertError) throw insertError;

  const { error: supersedeError } = await supabaseAdmin
    .from("tachograph_processing_runs")
    .update({ is_current: false })
    .eq("import_id", record.id)
    .eq("is_current", true)
    .neq("id", insertedRun.id);

  if (supersedeError) throw supersedeError;

  return {
    id: insertedRun.id,
    startedAt: insertedRun.started_at ?? startedAt,
    parserName: insertedRun.parser_name ?? parserName,
    parserVersion: insertedRun.parser_version ?? parserVersion,
    source: insertedRun.source ?? source,
    actorKind: actor.kind,
    actorUserId: actor.kind === "user" ? actor.userId : null,
    supersedesParserRunId,
  };
}

async function completeParserRun(
  supabaseAdmin: ReturnType<typeof createClient>,
  parserRun: ParserRunLifecycleContext,
  input: {
    record: ImportRecord;
    status: ParserRunLifecycleStatus;
    warnings?: string[];
    errors?: string[];
    errorSummary?: string | null;
    completedAt?: string;
    processedAt?: string;
    parserName?: string;
    parserVersion?: string;
    source?: string;
    outputType?: string;
    outputPayload?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }
) {
  const completedAt = input.completedAt ?? new Date().toISOString();
  const processedAt = input.processedAt ?? completedAt;
  const durationMs = Math.max(0, new Date(completedAt).getTime() - new Date(parserRun.startedAt).getTime());
  const warnings = input.warnings ?? [];
  const errors = input.errors ?? [];
  const { error: updateError } = await supabaseAdmin
    .from("tachograph_processing_runs")
    .update({
      parser_name: input.parserName ?? parserRun.parserName,
      parser_version: input.parserVersion ?? parserRun.parserVersion,
      source: input.source ?? parserRun.source,
      status: input.status,
      completed_at: completedAt,
      duration_ms: durationMs,
      warnings,
      errors,
      error_summary: input.errorSummary ?? errors[0] ?? null,
      processed_at: processedAt,
      metadata: {
        actor_kind: parserRun.actorKind,
        actor_user_id: parserRun.actorUserId,
        supersedes_parser_run_id: parserRun.supersedesParserRunId,
        parse_002_lifecycle: true,
        ...(input.metadata ?? {}),
        parse_002_completed: input.status !== "running",
      },
    })
    .eq("id", parserRun.id);

  if (updateError) throw updateError;

  if (input.outputType) {
    const { error: outputError } = await supabaseAdmin.from("tachograph_parser_outputs").insert({
      parser_run_id: parserRun.id,
      import_id: input.record.id,
      company_id: input.record.company_id ?? null,
      output_type: input.outputType,
      payload: input.outputPayload ?? {},
    });
    if (outputError) throw outputError;
  }

  if (errors.length > 0) {
    const { error: parserErrorInsertError } = await supabaseAdmin.from("tachograph_parser_errors").insert(
      errors.map((message) => ({
        parser_run_id: parserRun.id,
        import_id: input.record.id,
        company_id: input.record.company_id ?? null,
        severity: input.status === "failed" ? "error" : "warning",
        error_code: input.status === "failed" ? "parser_failed" : "parser_warning",
        message,
        details_json: input.metadata ?? {},
      }))
    );
    if (parserErrorInsertError) throw parserErrorInsertError;
  }
}

function withParserRunId<T extends object>(rows: T[], parserRunId: string): Array<T & { parser_run_id: string }> {
  return rows.map((row) => ({ ...row, parser_run_id: parserRunId }));
}

type TimelineGenerationResult = {
  generationId: string | null;
  eventCount: number;
  gapCount: number;
  dailySummaryCount: number;
  skippedReason: string | null;
};

async function generateImportTimeline(
  supabaseAdmin: ReturnType<typeof createClient>,
  record: ImportRecord,
  parserRun: ParserRunLifecycleContext,
  input: {
    driverId: string | null;
    vehicleId: string | null;
    rangeStart: string | null;
    rangeEnd: string | null;
  }
): Promise<TimelineGenerationResult> {
  if (!record.company_id) {
    return {
      generationId: null,
      eventCount: 0,
      gapCount: 0,
      dailySummaryCount: 0,
      skippedReason: "missing_company_id",
    };
  }

  const [
    { data: activities, error: activitiesError },
    { data: technicalEvents, error: technicalEventsError },
    { data: discrepancies, error: discrepanciesError },
    { data: reconciliationRows, error: reconciliationError },
    { data: daySummaries, error: daySummariesError },
  ] = await Promise.all([
    supabaseAdmin
      .from("tachograph_activity_segments")
      .select("id, import_id, company_id, driver_id, vehicle_id, source, activity_type, start_time, end_time, duration_mins, confidence, label, parser_run_id")
      .eq("import_id", record.id)
      .eq("parser_run_id", parserRun.id)
      .order("start_time", { ascending: true }),
    supabaseAdmin
      .from("tachograph_technical_events")
      .select("id, import_id, company_id, driver_id, vehicle_id, source, rule_code, title, summary, occurred_at, period_start, period_end, severity, parser_run_id")
      .eq("import_id", record.id)
      .eq("parser_run_id", parserRun.id)
      .order("occurred_at", { ascending: true }),
    supabaseAdmin
      .from("tachograph_vehicle_motion_discrepancies")
      .select("id, import_id, company_id, driver_id, vehicle_id, discrepancy_date, start_time, end_time, duration_mins, severity, status, summary, parser_run_id")
      .eq("import_id", record.id)
      .eq("parser_run_id", parserRun.id)
      .order("start_time", { ascending: true }),
    supabaseAdmin
      .from("tachograph_reconciliation_items")
      .select("id, import_id, company_id, driver_id, vehicle_id, recon_date, status, app_label, tacho_label, summary, app_driving_mins, tacho_driving_mins, parser_run_id")
      .eq("import_id", record.id)
      .eq("parser_run_id", parserRun.id)
      .neq("status", "matched")
      .order("recon_date", { ascending: true }),
    supabaseAdmin
      .from("tachograph_day_summaries")
      .select("id, import_id, company_id, driver_id, vehicle_id, summary_date, driving_mins, work_mins, poa_mins, rest_mins, findings_count, parser_run_id")
      .eq("import_id", record.id)
      .eq("parser_run_id", parserRun.id)
      .order("summary_date", { ascending: true }),
  ]);

  if (activitiesError) throw activitiesError;
  if (technicalEventsError) throw technicalEventsError;
  if (discrepanciesError) throw discrepanciesError;
  if (reconciliationError) throw reconciliationError;
  if (daySummariesError) throw daySummariesError;

  const range = resolveTimelineRange({
    explicitStart: input.rangeStart,
    explicitEnd: input.rangeEnd,
    activities: activities ?? [],
    technicalEvents: technicalEvents ?? [],
    discrepancies: discrepancies ?? [],
  });

  if (!range) {
    return {
      generationId: null,
      eventCount: 0,
      gapCount: 0,
      dailySummaryCount: 0,
      skippedReason: "no_timeline_range",
    };
  }

  const { data: currentGenerations, error: currentGenerationError } = await supabaseAdmin
    .from("timeline_generations")
    .select("id")
    .eq("company_id", record.company_id)
    .eq("source_import_id", record.id)
    .eq("is_current", true)
    .order("started_at", { ascending: false })
    .limit(1);
  if (currentGenerationError) throw currentGenerationError;

  const supersedesGenerationId = currentGenerations?.[0]?.id ?? null;
  const startedAt = new Date().toISOString();
  const { data: generation, error: generationInsertError } = await supabaseAdmin
    .from("timeline_generations")
    .insert({
      company_id: record.company_id,
      driver_id: input.driverId,
      vehicle_id: input.vehicleId,
      scope_type: "import",
      scope_id: record.id,
      range_start: range.start,
      range_end: range.end,
      generation_version: TIMELINE_GENERATION_VERSION,
      status: "running",
      is_current: false,
      generated_by: parserRun.actorUserId,
      generated_by_kind: parserRun.actorKind === "user" ? "manager" : "trigger",
      generated_reason: supersedesGenerationId ? "reprocess" : "initial_import",
      source_import_id: record.id,
      parser_run_id: parserRun.id,
      supersedes_generation_id: supersedesGenerationId,
      started_at: startedAt,
      metadata: {
        parser_run_id: parserRun.id,
        source_type: record.source_type ?? null,
        activity_source_count: activities?.length ?? 0,
        technical_event_source_count: technicalEvents?.length ?? 0,
        discrepancy_source_count: discrepancies?.length ?? 0,
        reconciliation_gap_source_count: reconciliationRows?.length ?? 0,
      },
    })
    .select("id")
    .single();
  if (generationInsertError) throw generationInsertError;

  try {
    const eventRows = buildTimelineEventRows({
      generationId: generation.id,
      companyId: record.company_id,
      parserRunId: parserRun.id,
      importId: record.id,
      activities: activities ?? [],
      technicalEvents: technicalEvents ?? [],
    });
    let insertedEvents: Array<{ id: string; source_table: string | null; source_id: string | null; parser_run_id: string | null; import_file_id: string | null }> = [];
    if (eventRows.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("timeline_events")
        .insert(eventRows)
        .select("id, source_table, source_id, parser_run_id, import_file_id");
      if (error) throw error;
      insertedEvents = data ?? [];
    }

    const eventSourceRows = insertedEvents
      .filter((event) => event.source_table && event.source_id)
      .map((event) => ({
        company_id: record.company_id,
        timeline_event_id: event.id,
        timeline_generation_id: generation.id,
        source_type: timelineSourceTypeForTable(event.source_table),
        source_id: event.source_id,
        parser_run_id: event.parser_run_id ?? parserRun.id,
        import_file_id: event.import_file_id ?? record.id,
        source_reference_json: {
          source_table: event.source_table,
          source_id: event.source_id,
        },
      }));
    if (eventSourceRows.length > 0) {
      const { error } = await supabaseAdmin.from("timeline_event_sources").insert(eventSourceRows);
      if (error) throw error;
    }

    const gapRows = buildTimelineGapRows({
      generationId: generation.id,
      companyId: record.company_id,
      discrepancies: discrepancies ?? [],
      reconciliationRows: reconciliationRows ?? [],
    });
    if (gapRows.length > 0) {
      const { error } = await supabaseAdmin.from("timeline_gaps").insert(gapRows);
      if (error) throw error;
    }

    const dailySummaryRows = buildDailyTimelineSummaryRows({
      generationId: generation.id,
      companyId: record.company_id,
      daySummaries: daySummaries ?? [],
      gapRows,
    });
    if (dailySummaryRows.length > 0) {
      const { error } = await supabaseAdmin.from("daily_timeline_summaries").insert(dailySummaryRows);
      if (error) throw error;
    }

    const completedAt = new Date().toISOString();
    if (supersedesGenerationId) {
      const { error } = await supabaseAdmin
        .from("timeline_generations")
        .update({
          status: "superseded",
          is_current: false,
          superseded_by_generation_id: generation.id,
          superseded_at: completedAt,
        })
        .eq("id", supersedesGenerationId);
      if (error) throw error;
    }

    const { error: completeGenerationError } = await supabaseAdmin
      .from("timeline_generations")
      .update({
        status: gapRows.length > 0 ? "completed_with_warnings" : "completed",
        is_current: true,
        completed_at: completedAt,
        metadata: {
          parser_run_id: parserRun.id,
          event_count: insertedEvents.length,
          gap_count: gapRows.length,
          daily_summary_count: dailySummaryRows.length,
          source_import_id: record.id,
        },
      })
      .eq("id", generation.id);
    if (completeGenerationError) throw completeGenerationError;

    return {
      generationId: generation.id,
      eventCount: insertedEvents.length,
      gapCount: gapRows.length,
      dailySummaryCount: dailySummaryRows.length,
      skippedReason: null,
    };
  } catch (error) {
    await supabaseAdmin
      .from("timeline_generations")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        metadata: {
          parser_run_id: parserRun.id,
          error: errorToMessage(error),
        },
      })
      .eq("id", generation.id);
    throw error;
  }
}

function buildTimelineEventRows(input: {
  generationId: string;
  companyId: string;
  parserRunId: string;
  importId: string;
  activities: any[];
  technicalEvents: any[];
}) {
  const activityEvents = input.activities.map((activity) => ({
    company_id: input.companyId,
    timeline_generation_id: input.generationId,
    driver_id: activity.driver_id ?? null,
    vehicle_id: activity.vehicle_id ?? null,
    event_type: timelineEventTypeForActivity(activity.activity_type),
    started_at: activity.start_time,
    ended_at: activity.end_time,
    duration_seconds: Math.max(0, Number(activity.duration_mins ?? 0) * 60),
    timezone: "UTC",
    confidence_state: confidenceStateForTachoConfidence(activity.confidence),
    source_summary: activity.label ?? `Tachograph ${activity.activity_type} activity`,
    status: "current",
    is_current: true,
    parser_run_id: input.parserRunId,
    import_file_id: input.importId,
    source_table: "tachograph_activity_segments",
    source_id: activity.id,
    metadata: {
      tachograph_source: activity.source ?? null,
      activity_type: activity.activity_type ?? null,
    },
  }));

  const technicalEventRows = input.technicalEvents.map((event) => ({
    company_id: input.companyId,
    timeline_generation_id: input.generationId,
    driver_id: event.driver_id ?? null,
    vehicle_id: event.vehicle_id ?? null,
    event_type: timelineEventTypeForTechnicalEvent(event.rule_code),
    started_at: event.period_start ?? event.occurred_at,
    ended_at: event.period_end ?? event.occurred_at,
    duration_seconds: secondsBetween(event.period_start ?? event.occurred_at, event.period_end ?? event.occurred_at),
    timezone: "UTC",
    confidence_state: "confirmed",
    source_summary: event.summary ?? event.title ?? "Tachograph technical event",
    status: "current",
    is_current: true,
    parser_run_id: input.parserRunId,
    import_file_id: input.importId,
    source_table: "tachograph_technical_events",
    source_id: event.id,
    metadata: {
      rule_code: event.rule_code ?? null,
      severity: event.severity ?? null,
      title: event.title ?? null,
    },
  }));

  return [...activityEvents, ...technicalEventRows];
}

function buildTimelineGapRows(input: {
  generationId: string;
  companyId: string;
  discrepancies: any[];
  reconciliationRows: any[];
}) {
  const discrepancyGaps = input.discrepancies.map((row) => ({
    company_id: input.companyId,
    timeline_generation_id: input.generationId,
    driver_id: row.driver_id ?? null,
    vehicle_id: row.vehicle_id ?? null,
    started_at: row.start_time,
    ended_at: row.end_time,
    duration_seconds: Math.max(0, Number(row.duration_mins ?? 0) * 60),
    gap_type: gapTypeForDiscrepancy(row.status),
    severity: row.severity ?? "medium",
    reason: row.summary ?? "Vehicle motion discrepancy requires review.",
    status: "open",
    metadata: {
      source_table: "tachograph_vehicle_motion_discrepancies",
      source_id: row.id,
      import_id: row.import_id,
      parser_run_id: row.parser_run_id,
      discrepancy_status: row.status,
    },
  }));

  const reconciliationGaps = input.reconciliationRows.map((row) => {
    const start = `${row.recon_date}T00:00:00.000Z`;
    const end = addDaysIso(start, 1);
    return {
      company_id: input.companyId,
      timeline_generation_id: input.generationId,
      driver_id: row.driver_id ?? null,
      vehicle_id: row.vehicle_id ?? null,
      started_at: start,
      ended_at: end,
      duration_seconds: 24 * 60 * 60,
      gap_type: "app_tacho_mismatch",
      severity: row.status === "uncertain" ? "low" : "medium",
      reason: row.summary ?? "App and tachograph activity do not match.",
      status: "open",
      metadata: {
        source_table: "tachograph_reconciliation_items",
        source_id: row.id,
        import_id: row.import_id,
        parser_run_id: row.parser_run_id,
        reconciliation_status: row.status,
        app_label: row.app_label,
        tacho_label: row.tacho_label,
      },
    };
  });

  return [...discrepancyGaps, ...reconciliationGaps];
}

function buildDailyTimelineSummaryRows(input: {
  generationId: string;
  companyId: string;
  daySummaries: any[];
  gapRows: Array<{ started_at: string }>;
}) {
  return input.daySummaries.map((summary) => {
    const gapCount = input.gapRows.filter((gap) => gap.started_at.slice(0, 10) === summary.summary_date).length;
    return {
      company_id: input.companyId,
      timeline_generation_id: input.generationId,
      driver_id: summary.driver_id ?? null,
      vehicle_id: summary.vehicle_id ?? null,
      summary_date: summary.summary_date,
      driving_seconds: Math.max(0, Number(summary.driving_mins ?? 0) * 60),
      work_seconds: Math.max(0, Number(summary.work_mins ?? 0) * 60),
      availability_seconds: Math.max(0, Number(summary.poa_mins ?? 0) * 60),
      rest_seconds: Math.max(0, Number(summary.rest_mins ?? 0) * 60),
      break_seconds: 0,
      unknown_seconds: 0,
      duty_start: null,
      duty_end: null,
      gap_count: gapCount,
      finding_count: Math.max(0, Number(summary.findings_count ?? 0)),
      confidence_state: "confirmed",
      metadata: {
        source_table: "tachograph_day_summaries",
        source_id: summary.id,
        import_id: summary.import_id,
        parser_run_id: summary.parser_run_id,
      },
    };
  });
}

function resolveTimelineRange(input: {
  explicitStart: string | null;
  explicitEnd: string | null;
  activities: any[];
  technicalEvents: any[];
  discrepancies: any[];
}) {
  const starts = [
    input.explicitStart,
    ...input.activities.map((row) => row.start_time),
    ...input.technicalEvents.map((row) => row.period_start ?? row.occurred_at),
    ...input.discrepancies.map((row) => row.start_time),
  ].filter((value): value is string => Boolean(value));
  const ends = [
    input.explicitEnd,
    ...input.activities.map((row) => row.end_time),
    ...input.technicalEvents.map((row) => row.period_end ?? row.occurred_at),
    ...input.discrepancies.map((row) => row.end_time),
  ].filter((value): value is string => Boolean(value));
  if (starts.length === 0 || ends.length === 0) return null;

  const start = starts.reduce((earliest, value) => new Date(value).getTime() < new Date(earliest).getTime() ? value : earliest);
  const end = ends.reduce((latest, value) => new Date(value).getTime() > new Date(latest).getTime() ? value : latest);
  if (new Date(end).getTime() <= new Date(start).getTime()) return null;
  return { start, end };
}

function timelineEventTypeForActivity(activityType: string | null | undefined) {
  switch (activityType) {
    case "driving":
      return "driving";
    case "work":
      return "other_work";
    case "poa":
      return "availability";
    case "break_rest":
      return "rest";
    default:
      return "unknown";
  }
}

function timelineEventTypeForTechnicalEvent(ruleCode: string | null | undefined) {
  switch (ruleCode) {
    case "VU_DRIVING_WITHOUT_CARD":
      return "movement_without_card";
    case "VU_OVERSPEED":
      return "overspeed";
    default:
      return "technical_event";
  }
}

function timelineSourceTypeForTable(sourceTable: string | null) {
  switch (sourceTable) {
    case "tachograph_activity_segments":
      return "tachograph_activity_segment";
    case "tachograph_technical_events":
      return "tachograph_technical_event";
    default:
      return "manual_entry";
  }
}

function confidenceStateForTachoConfidence(confidence: string | null | undefined) {
  switch (confidence) {
    case "high":
      return "confirmed";
    case "medium":
      return "likely";
    case "low":
      return "possible";
    default:
      return "uncertain";
  }
}

function gapTypeForDiscrepancy(status: string | null | undefined) {
  switch (status) {
    case "unassigned_motion":
      return "unknown_driver";
    case "card_gap":
      return "missing_driver_card_data";
    case "driver_mismatch":
      return "app_tacho_mismatch";
    default:
      return "manual_review_required";
  }
}

function secondsBetween(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return 0;
  return Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000));
}

function addDaysIso(value: string, days: number) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  let record: ImportRecord | null = null;
  let parserRun: ParserRunLifecycleContext | null = null;

  try {
    const body = await req.json();
    record = body.record as ImportRecord;

    if (!record?.id || !record.file_path) {
      throw new Error("Missing tachograph file payload.");
    }

    const authorizedActor = await authorizeImportRequest(req, record);
    if (authorizedActor instanceof Response) {
      return authorizedActor;
    }

    parserRun = await createParserRun(supabaseAdmin, record, authorizedActor);

    await supabaseAdmin
      .from("tachograph_files")
      .update({ status: "processing" })
      .eq("id", record.id);

    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from("tachograph-files")
      .download(record.file_path);

    if (downloadError) throw downloadError;

    const buffer = await fileData.arrayBuffer();
    const hourWiseCapture =
      parseHourWiseReadOnlyCapture(buffer) ??
      (isHourWiseReadOnlyCaptureMetadata(record.metadata) ? buildMetadataOnlyHourWiseCapture(record) : null);
    if (hourWiseCapture) {
      const captureSummary = summarizeHourWiseCapture(hourWiseCapture);
      const captureResult = await handleHourWiseReadOnlyCapture(
        supabaseAdmin,
        record,
        hourWiseCapture,
        captureSummary,
        parserRun
      );
      return jsonResponse({
        success: true,
        source_type: "driver_card",
        status: captureResult.status,
        parser_version: HOURWISE_READ_ONLY_CAPTURE_PARSER_VERSION,
        capture_schema: HOURWISE_READ_ONLY_CAPTURE_SCHEMA,
        selected_file_count: captureSummary.selectedFileCount,
        captured_bytes: captureSummary.capturedBytes,
        normalized_segments: captureResult.normalizedSegments,
        findings_count: captureResult.findingsCount,
        reconciliation_issue_count: captureResult.reconciliationIssueCount,
        activity_day_count: captureResult.activityDayCount,
        activity_change_count: captureResult.activityChangeCount,
      });
    }

    const parsed = readesm.parse(new Uint8Array(buffer));

    const cardNumber = firstString(
      parsed?.driverCard?.cardNumber,
      parsed?.cardNumber,
      parsed?.driverCardNumber
    );
    const driverName = joinName(
      parsed?.driverCard?.holderName,
      parsed?.driver?.name,
      parsed?.holderName
    );
    const issuingCountry = firstString(
      parsed?.driverCard?.issuingCountry,
      parsed?.issuingCountry
    );
    const cardExpiry = toDateOnly(
      parsed?.driverCard?.expiryDate,
      parsed?.driverCard?.validUntil
    );
    const regNumber = normalizeReg(firstString(
      parsed?.vehicleRegistrationNumber,
      parsed?.vehicle?.registrationNumber,
      parsed?.registrationNumber,
      parsed?.registration,
      parsed?.vuData?.vehicleRegistrationNumber
    ));
    const vuSerial = firstString(
      parsed?.vuSerialNumber,
      parsed?.vehicleUnit?.serialNumber,
      parsed?.vuData?.serialNumber
    );
    const calibrationDue = toDateOnly(
      parsed?.vehicleUnit?.calibrationDue,
      parsed?.vuData?.calibrationDue
    );
    const sourceType = inferSourceType(record, cardNumber, vuSerial);

    let driverId = record.driver_id ?? null;
    if (cardNumber && !driverId && record.company_id) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("company_id", record.company_id)
        .eq("tacho_card_number", cardNumber)
        .maybeSingle();

      if (profile?.id) driverId = profile.id;
    }

    let vehicleId = record.vehicle_id ?? null;
    if (regNumber && !vehicleId && record.company_id) {
      const { data: vehicle } = await supabaseAdmin
        .from("vehicles")
        .select("id")
        .eq("company_id", record.company_id)
        .eq("reg_number", regNumber)
        .maybeSingle();

      if (vehicle?.id) vehicleId = vehicle.id;
    }

    const rawActivities = extractRawActivities(parsed, {
      importId: record.id,
      driverId,
    });
    const normalizedActivities = fromSharedNormalizedActivities(
      mergeAdjacentNormalizedActivities(
        toSharedNormalizedActivities(rawActivities.map((activity, index) => ({
          id: `${activity.activity_type}-${activity.start_time}-${index}`,
          import_id: record.id,
          company_id: record.company_id ?? null,
          driver_id: driverId,
          vehicle_id: vehicleId,
          source: sourceType,
          activity_type: mapNormalizedActivityType(activity.activity_type),
          start_time: activity.start_time,
          end_time: activity.end_time,
          duration_mins: minutesBetween(activity.start_time, activity.end_time),
          distance_km: activity.distance_km,
          confidence: "high" as const,
          label: activity.is_manual_entry ? "Manual entry" : null,
        })))
      ).map(({ id: _ignoredId, ...activity }) => activity)
      ,
      {
        importId: record.id,
        companyId: record.company_id ?? null,
        driverId,
        vehicleId,
        sourceType,
      }
    );
    const speedLogs = extractSpeedLogs(parsed, record.id);
    const vuEvents = extractVuEvents(parsed);

    const summaryWindow = resolvePeriodBounds(normalizedActivities);
    const downloadedAt = summaryWindow.endTime ?? new Date().toISOString();
    const dutyWindows = buildDutyWindows(normalizedActivities);
    const daySummaries = buildDaySummaries({
      importId: record.id,
      companyId: record.company_id ?? null,
      driverId,
      vehicleId,
      dutyWindows,
      speedLogsCountByDate: countByDate(speedLogs.map((log) => log.timestamp)),
    });
    const findings = buildFindings({
      importId: record.id,
      companyId: record.company_id ?? null,
      driverId,
      vehicleId,
      sourceType,
      dutyWindows,
      daySummaries,
      activities: normalizedActivities,
    });
    const workSessions =
      driverId && summaryWindow.startTime && summaryWindow.endTime
        ? await fetchWorkSessionsForRange(supabaseAdmin, {
            driverId,
            startDate: summaryWindow.startTime.slice(0, 10),
            endDate: summaryWindow.endTime.slice(0, 10),
          })
        : [];
    const reconciliationRows = buildReconciliationRows({
      importId: record.id,
      companyId: record.company_id ?? null,
      driverId,
      vehicleId,
      activities: normalizedActivities,
      workSessions,
    });
    for (const summary of daySummaries) {
      const matchingReconciliation = reconciliationRows.find((row) => row.recon_date === summary.summary_date);
      summary.app_driving_mins = matchingReconciliation?.app_driving_mins ?? null;
    }
    const technicalEvents = buildTechnicalEvents({
      importId: record.id,
      companyId: record.company_id ?? null,
      driverId,
      vehicleId,
      speedLogs,
      vuEvents,
    });
    const vehicleMotionDiscrepancies = buildVehicleMotionDiscrepancies({
      importId: record.id,
      companyId: record.company_id ?? null,
      driverId,
      driverName,
      vehicleId,
      technicalEvents,
      findings,
    });

    await clearImportData(supabaseAdmin, record.id);

    if (rawActivities.length > 0) {
      const { error } = await supabaseAdmin.from("tachograph_activities").insert(rawActivities);
      if (error) throw error;
    }

    if (speedLogs.length > 0) {
      const { error } = await supabaseAdmin.from("tachograph_speed_logs").insert(speedLogs);
      if (error) throw error;
    }

    if (normalizedActivities.length > 0) {
      const { error } = await supabaseAdmin.from("tachograph_activity_segments").insert(withParserRunId(normalizedActivities, parserRun.id));
      if (error) throw error;
    }

    if (daySummaries.length > 0) {
      const { error } = await supabaseAdmin.from("tachograph_day_summaries").insert(withParserRunId(daySummaries, parserRun.id));
      if (error) throw error;
    }

    if (findings.length > 0) {
      const { error } = await supabaseAdmin.from("tachograph_findings").insert(withParserRunId(findings, parserRun.id));
      if (error) throw error;
    }

    if (technicalEvents.length > 0) {
      const { error } = await supabaseAdmin.from("tachograph_technical_events").insert(withParserRunId(technicalEvents, parserRun.id));
      if (error) throw error;
    }

    if (vehicleMotionDiscrepancies.length > 0) {
      const { error } = await supabaseAdmin
        .from("tachograph_vehicle_motion_discrepancies")
        .insert(withParserRunId(vehicleMotionDiscrepancies, parserRun.id));
      if (error) throw error;
    }

    if (reconciliationRows.length > 0) {
      const { error } = await supabaseAdmin.from("tachograph_reconciliation_items").insert(withParserRunId(reconciliationRows, parserRun.id));
      if (error) throw error;
    }

    if (cardNumber && summaryWindow.startTime && summaryWindow.endTime) {
      const { error } = await supabaseAdmin.from("driver_card_downloads").insert({
        import_id: record.id,
        company_id: record.company_id ?? null,
        driver_id: driverId,
        driver_name: driverName,
        card_number: cardNumber,
        card_expiry: cardExpiry,
        issuing_country: issuingCountry,
        downloaded_at: downloadedAt,
        period_start: summaryWindow.startTime,
        period_end: summaryWindow.endTime,
        download_status: "ok",
        parser_run_id: parserRun.id,
      });
      if (error) throw error;
    }

    if ((vuSerial || regNumber) && summaryWindow.startTime && summaryWindow.endTime) {
      const { error } = await supabaseAdmin.from("vehicle_unit_downloads").insert({
        import_id: record.id,
        company_id: record.company_id ?? null,
        vehicle_id: vehicleId,
        reg_number: regNumber,
        vu_serial: vuSerial ?? `${record.id}-vu`,
        calibration_due: calibrationDue,
        downloaded_at: downloadedAt,
        period_start: summaryWindow.startTime,
        period_end: summaryWindow.endTime,
        download_status: "ok",
        parser_run_id: parserRun.id,
      });
      if (error) throw error;
    }

    if (driverId) {
      const complianceSignals = buildComplianceSignals({
        companyId: record.company_id ?? null,
        driverId,
        findings,
        reconciliationRows,
        generatedAt: downloadedAt,
      });
      const riskSignals = buildRiskSignals({
        companyId: record.company_id ?? null,
        driverId,
        complianceSignals,
        reconciliationRows,
        generatedAt: downloadedAt,
      });

      if (complianceSignals.length > 0) {
        const { error } = await supabaseAdmin.from("driver_tacho_compliance_signals").insert(complianceSignals);
        if (error) throw error;
      }

      if (riskSignals.length > 0) {
        const { error } = await supabaseAdmin.from("driver_tacho_risk_signals").insert(riskSignals);
        if (error) throw error;
      }
    }

    const finalStatus = normalizedActivities.length > 0 ? "processed" : "partial";
    const parserWarnings = normalizedActivities.length > 0
      ? []
      : ["No normalized tachograph activity segments were extracted from the uploaded file."];
    const mergedMetadata = mergeMetadata(record.metadata, {
      parser_version: PARSER_VERSION,
      driver_name: driverName,
      vehicle_reg: regNumber,
      summary: buildImportSummary(normalizedActivities.length, findings.length, technicalEvents.length),
      normalized_segments: normalizedActivities.length,
      findings_count: findings.length,
      technical_event_count: technicalEvents.length,
      discrepancy_count: vehicleMotionDiscrepancies.length,
      reconciliation_issue_count: reconciliationRows.filter((row) => row.status !== "matched").length,
    });

    await supabaseAdmin
      .from("tachograph_files")
      .update({
        status: finalStatus,
        processed_at: new Date().toISOString(),
        external_card_number: cardNumber,
        driver_id: driverId,
        vehicle_id: vehicleId,
        source_type: sourceType,
        metadata: mergedMetadata,
      })
      .eq("id", record.id);

    const timelineGeneration = await generateImportTimeline(supabaseAdmin, record, parserRun, {
      driverId,
      vehicleId,
      rangeStart: summaryWindow.startTime,
      rangeEnd: summaryWindow.endTime,
    });

    await completeParserRun(supabaseAdmin, parserRun, {
      record,
      status: parserWarnings.length > 0 ? "completed_with_warnings" : "completed",
      warnings: parserWarnings,
      processedAt: downloadedAt,
      outputType: "standard_parse_summary",
      outputPayload: {
        source_type: sourceType,
        activities_count: rawActivities.length,
        normalized_segments: normalizedActivities.length,
        findings_count: findings.length,
        technical_event_count: technicalEvents.length,
        discrepancy_count: vehicleMotionDiscrepancies.length,
        reconciliation_issue_count: reconciliationRows.filter((row) => row.status !== "matched").length,
        timeline_generation_id: timelineGeneration.generationId,
        timeline_event_count: timelineGeneration.eventCount,
        timeline_gap_count: timelineGeneration.gapCount,
        timeline_daily_summary_count: timelineGeneration.dailySummaryCount,
        timeline_skipped_reason: timelineGeneration.skippedReason,
      },
      metadata: {
        final_import_status: finalStatus,
        timeline_generation_id: timelineGeneration.generationId,
      },
    });

    return jsonResponse({
      success: true,
      source_type: sourceType,
      activities_count: rawActivities.length,
      normalized_segments: normalizedActivities.length,
      findings_count: findings.length,
      technical_event_count: technicalEvents.length,
      discrepancy_count: vehicleMotionDiscrepancies.length,
      reconciliation_issue_count: reconciliationRows.filter((row) => row.status !== "matched").length,
    });
  } catch (error) {
    console.error("Tacho processing error:", error);

    if (record?.id) {
      const message = errorToMessage(error);
      if (parserRun) {
        try {
          await completeParserRun(supabaseAdmin, parserRun, {
            record,
            status: "failed",
            errors: [message],
            errorSummary: message,
            metadata: {
              failed_stage: "process_tacho",
            },
          });
        } catch (parserRunError) {
          console.error("Unable to mark parser run as failed:", parserRunError);
        }
      }

      await supabaseAdmin
        .from("tachograph_files")
        .update({
          status: "error",
          processed_at: new Date().toISOString(),
          metadata: mergeMetadata(record.metadata, { processing_error: message }),
        })
        .eq("id", record.id);
    }

    return jsonResponse(
      { error: errorToMessage(error) },
      400
    );
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorToMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown processing error";
  }
}

function parseHourWiseReadOnlyCapture(buffer: ArrayBuffer): HourWiseReadOnlyCapture | null {
  let text: string;
  try {
    text = new TextDecoder().decode(buffer);
  } catch {
    return null;
  }

  const markerIndex = Math.max(
    text.indexOf(HOURWISE_READ_ONLY_CAPTURE_SCHEMA),
    text.indexOf(HOURWISE_READ_ONLY_CAPTURE_EXPORT_FORMAT)
  );
  if (markerIndex < 0) {
    return null;
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    const parsed = JSON.parse(text.slice(firstBrace, lastBrace + 1)) as HourWiseReadOnlyCapture & {
      exportFormat?: string;
      export_format?: string;
    };
    const schema = stringOrNull(parsed?.schema);
    const exportFormat = stringOrNull(parsed?.exportFormat) ?? stringOrNull(parsed?.export_format);
    return schema === HOURWISE_READ_ONLY_CAPTURE_SCHEMA || exportFormat === HOURWISE_READ_ONLY_CAPTURE_EXPORT_FORMAT
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function isHourWiseReadOnlyCaptureMetadata(metadata: Record<string, unknown> | null | undefined) {
  const exportFormat =
    stringOrNull(metadata?.export_format) ??
    stringOrNull(metadata?.exportFormat) ??
    stringOrNull(metadata?.helper_capture_export_format);
  const schema = stringOrNull(metadata?.helper_capture_schema);
  return exportFormat === HOURWISE_READ_ONLY_CAPTURE_EXPORT_FORMAT || schema === HOURWISE_READ_ONLY_CAPTURE_SCHEMA;
}

function buildMetadataOnlyHourWiseCapture(record: ImportRecord): HourWiseReadOnlyCapture {
  return {
    schema: HOURWISE_READ_ONLY_CAPTURE_SCHEMA,
    warning: "HourWise read-only capture metadata was present, but the stored file body could not be decoded as the expected JSON container.",
    readSessionId: stringOrNull(record.metadata?.read_session_id) ?? stringOrNull(record.metadata?.helper_capture_read_session_id),
    helperVersion: stringOrNull(record.metadata?.helper_version) ?? stringOrNull(record.metadata?.helper_capture_helper_version),
    sourceType: record.source_type ?? "driver_card",
    exportedAt: stringOrNull(record.metadata?.helper_capture_exported_at),
    files: [],
  };
}

async function handleHourWiseReadOnlyCapture(
  supabaseAdmin: ReturnType<typeof createClient>,
  record: ImportRecord,
  capture: HourWiseReadOnlyCapture,
  summary: ReturnType<typeof summarizeHourWiseCapture>,
  parserRun: ParserRunLifecycleContext
): Promise<HourWiseReadOnlyCaptureProcessingResult> {
  const processedAt = new Date().toISOString();
  await clearImportData(supabaseAdmin, record.id);
  const cardIdentity = parseHourWiseDriverCardIdentity(capture);
  const activityParse = parseHourWiseDriverCardActivities(capture, {
    importId: record.id,
    driverId: null,
  });
  const downloadedAt = stringOrNull(capture.exportedAt) ?? processedAt;

  let driverId = record.driver_id ?? null;
  if (cardIdentity?.cardNumber && !driverId && record.company_id) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("company_id", record.company_id)
      .eq("tacho_card_number", cardIdentity.cardNumber)
      .maybeSingle();

    if (profile?.id) driverId = profile.id;
  }

  const warning =
    activityParse.rawActivities.length > 0
      ? "HourWise read-only card capture was decoded from EF 0504 into provisional activity segments. Certified C1B/DDD export is still not implemented for this container."
      : "HourWise read-only card capture was received and preserved as partial metadata. Certified C1B decoding is not implemented for this container yet.";
  const captureWarning = stringOrNull(capture.warning);
  const processingWarnings = [warning, activityParse.warning, captureWarning].filter((item): item is string => Boolean(item));
  let rawActivityInsertWarning: string | null = null;

  const rawActivities = activityParse.rawActivities.map((activity) => ({
    ...activity,
    driver_id: driverId,
  }));
  const normalizedActivities = fromSharedNormalizedActivities(
    mergeAdjacentNormalizedActivities(
      toSharedNormalizedActivities(rawActivities.map((activity, index) => ({
        id: `${activity.activity_type}-${activity.start_time}-${index}`,
        import_id: record.id,
        company_id: record.company_id ?? null,
        driver_id: driverId,
        vehicle_id: null,
        source: "driver_card" as const,
        activity_type: mapNormalizedActivityType(activity.activity_type),
        start_time: activity.start_time,
        end_time: activity.end_time,
        duration_mins: minutesBetween(activity.start_time, activity.end_time),
        distance_km: activity.distance_km,
        confidence: "high" as const,
        label: activity.is_manual_entry ? "Manual entry" : "EF 0504 read-only capture",
      })))
    ),
    {
      importId: record.id,
      companyId: record.company_id ?? null,
      driverId,
      vehicleId: null,
      sourceType: "driver_card",
    }
  );
  const summaryWindow = resolvePeriodBounds(normalizedActivities);
  const finalStatus = normalizedActivities.length > 0 ? "processed" : "partial";
  const dutyWindows = buildDutyWindows(normalizedActivities);
  const daySummaries = buildDaySummaries({
    importId: record.id,
    companyId: record.company_id ?? null,
    driverId,
    vehicleId: null,
    dutyWindows,
    speedLogsCountByDate: {},
  });
  const findings = buildFindings({
    importId: record.id,
    companyId: record.company_id ?? null,
    driverId,
    vehicleId: null,
    sourceType: "driver_card",
    dutyWindows,
    daySummaries,
    activities: normalizedActivities,
  });
  const workSessions =
    driverId && summaryWindow.startTime && summaryWindow.endTime
      ? await fetchWorkSessionsForRange(supabaseAdmin, {
          driverId,
          startDate: summaryWindow.startTime.slice(0, 10),
          endDate: summaryWindow.endTime.slice(0, 10),
        })
      : [];
  const reconciliationRows = buildReconciliationRows({
    importId: record.id,
    companyId: record.company_id ?? null,
    driverId,
    vehicleId: null,
    activities: normalizedActivities,
    workSessions,
  });
  for (const summaryRow of daySummaries) {
    const matchingReconciliation = reconciliationRows.find((row) => row.recon_date === summaryRow.summary_date);
    summaryRow.app_driving_mins = matchingReconciliation?.app_driving_mins ?? null;
  }

  const supersededImportIds = await supersedePreviousHourWiseDriverCardReads(supabaseAdmin, {
    companyId: record.company_id ?? null,
    currentImportId: record.id,
    driverId,
    cardNumber: cardIdentity?.cardNumber ?? null,
    supersededByProcessedAt: processedAt,
  });

  if (rawActivities.length > 0) {
    const { error } = await supabaseAdmin.from("tachograph_activities").insert(rawActivities);
    if (error) {
      rawActivityInsertWarning = `Raw tachograph activity compatibility insert skipped: ${error.message}`;
      processingWarnings.push(rawActivityInsertWarning);
    }
  }

  if (normalizedActivities.length > 0) {
    const { error } = await supabaseAdmin.from("tachograph_activity_segments").insert(withParserRunId(normalizedActivities, parserRun.id));
    if (error) throw error;
  }

  if (daySummaries.length > 0) {
    const { error } = await supabaseAdmin.from("tachograph_day_summaries").insert(withParserRunId(daySummaries, parserRun.id));
    if (error) throw error;
  }

  if (findings.length > 0) {
    const { error } = await supabaseAdmin.from("tachograph_findings").insert(withParserRunId(findings, parserRun.id));
    if (error) throw error;
  }

  if (reconciliationRows.length > 0) {
    const { error } = await supabaseAdmin.from("tachograph_reconciliation_items").insert(withParserRunId(reconciliationRows, parserRun.id));
    if (error) throw error;
  }

  if (driverId && normalizedActivities.length > 0) {
    const generatedAt = summaryWindow.endTime ?? downloadedAt;
      const complianceSignals = buildComplianceSignals({
        companyId: record.company_id ?? null,
        driverId,
        findings,
        reconciliationRows,
        generatedAt,
        source: HOURWISE_READ_ONLY_CAPTURE_SIGNAL_SOURCE,
      });
      const riskSignals = buildRiskSignals({
        companyId: record.company_id ?? null,
        driverId,
        complianceSignals,
        reconciliationRows,
        generatedAt,
        source: HOURWISE_READ_ONLY_CAPTURE_SIGNAL_SOURCE,
      });

    if (complianceSignals.length > 0) {
      const { error } = await supabaseAdmin.from("driver_tacho_compliance_signals").insert(complianceSignals);
      if (error) throw error;
    }

    if (riskSignals.length > 0) {
      const { error } = await supabaseAdmin.from("driver_tacho_risk_signals").insert(riskSignals);
      if (error) throw error;
    }
  }

  const metadata = mergeMetadata(record.metadata, {
    parser_version: HOURWISE_READ_ONLY_CAPTURE_PARSER_VERSION,
    parser_status: finalStatus === "processed" ? "processed_helper_capture" : "partial_helper_capture",
    helper_capture_schema: HOURWISE_READ_ONLY_CAPTURE_SCHEMA,
    helper_capture_warning: warning,
    helper_capture_container_warning: captureWarning,
    helper_capture_read_session_id: stringOrNull(capture.readSessionId),
    helper_capture_helper_version: stringOrNull(capture.helperVersion),
    helper_capture_exported_at: stringOrNull(capture.exportedAt),
    helper_capture_reader_name: stringOrNull(capture.readerName),
    helper_capture_active_protocol: stringOrNull(capture.activeProtocol),
    helper_capture_application_aid: stringOrNull(capture.applicationAid),
    helper_capture_max_bytes_per_file: numberOrNull(capture.maxBytesPerFile),
    helper_capture_file_count: summary.fileCount,
    helper_capture_selected_file_count: summary.selectedFileCount,
    helper_capture_read_success_count: summary.readSuccessCount,
    helper_capture_truncated_file_count: summary.truncatedFileCount,
    helper_capture_captured_bytes: summary.capturedBytes,
    helper_capture_files: summary.files,
    helper_capture_identity_decoded: Boolean(cardIdentity),
    helper_capture_card_issuing_member_state: cardIdentity?.cardIssuingMemberState ?? null,
    helper_capture_card_issuing_authority_name: cardIdentity?.cardIssuingAuthorityName ?? null,
    helper_capture_card_issue_date: cardIdentity?.cardIssueDate ?? null,
    helper_capture_card_validity_begin: cardIdentity?.cardValidityBegin ?? null,
    helper_capture_card_expiry_date: cardIdentity?.cardExpiryDate ?? null,
    helper_capture_card_holder_preferred_language: cardIdentity?.cardHolderPreferredLanguage ?? null,
    helper_capture_activity_day_count: activityParse.dayCount,
    helper_capture_activity_change_count: activityParse.changeCount,
    helper_capture_first_activity_date: activityParse.firstActivityDate,
    helper_capture_last_activity_date: activityParse.lastActivityDate,
    helper_capture_activity_warning: activityParse.warning,
    helper_capture_raw_activity_insert_warning: rawActivityInsertWarning,
    helper_capture_superseded_import_count: supersededImportIds.length,
    helper_capture_superseded_import_ids: supersededImportIds.slice(0, 25),
    driver_name: cardIdentity?.driverName ?? record.metadata?.driver_name ?? null,
    driver_card_number_hint: cardIdentity?.cardNumber ?? record.metadata?.driver_card_number_hint ?? null,
    summary: normalizedActivities.length > 0
      ? `Read-only helper capture decoded ${normalizedActivities.length} provisional EF 0504 activity segment${normalizedActivities.length === 1 ? "" : "s"} across ${activityParse.dayCount} day${activityParse.dayCount === 1 ? "" : "s"}${activityParse.firstActivityDate && activityParse.lastActivityDate ? ` (${activityParse.firstActivityDate} to ${activityParse.lastActivityDate})` : ""}.`
      : `Read-only helper capture received: ${summary.selectedFileCount} EF files selected, ${summary.capturedBytes} bytes captured. Parser conversion is pending.`,
    normalized_segments: normalizedActivities.length,
    findings_count: findings.length,
    technical_event_count: 0,
    discrepancy_count: 0,
    reconciliation_issue_count: reconciliationRows.filter((row) => row.status !== "matched").length,
  });

  if (cardIdentity?.cardNumber) {
    const { error: downloadError } = await supabaseAdmin.from("driver_card_downloads").insert({
      import_id: record.id,
      company_id: record.company_id ?? null,
      driver_id: driverId,
      driver_name: cardIdentity.driverName,
      card_number: cardIdentity.cardNumber,
      card_expiry: cardIdentity.cardExpiryDate,
      issuing_country: cardIdentity.cardIssuingMemberState === null ? null : String(cardIdentity.cardIssuingMemberState),
      downloaded_at: summaryWindow.endTime ?? downloadedAt,
      period_start: summaryWindow.startTime ?? downloadedAt,
      period_end: summaryWindow.endTime ?? downloadedAt,
      download_status: normalizedActivities.length > 0 ? "ok" : "partial_identity",
      parser_run_id: parserRun.id,
    });
    if (downloadError) throw downloadError;
  }

  await supabaseAdmin
    .from("tachograph_files")
    .update({
      status: finalStatus,
      processed_at: processedAt,
      external_card_number: cardIdentity?.cardNumber ?? null,
      driver_id: driverId,
      source_type: "driver_card",
      metadata,
    })
    .eq("id", record.id);

  const timelineGeneration = await generateImportTimeline(supabaseAdmin, record, parserRun, {
    driverId,
    vehicleId: null,
    rangeStart: summaryWindow.startTime,
    rangeEnd: summaryWindow.endTime,
  });

  await completeParserRun(supabaseAdmin, parserRun, {
    record,
    status: processingWarnings.length > 0 ? "completed_with_warnings" : "completed",
    warnings: processingWarnings,
    processedAt: summaryWindow.endTime ?? processedAt,
    parserName: "hourwise_read_only_capture",
    parserVersion: HOURWISE_READ_ONLY_CAPTURE_PARSER_VERSION,
    source: "hourwise_read_only_capture",
    outputType: "hourwise_helper_capture_summary",
    outputPayload: {
      selected_file_count: summary.selectedFileCount,
      captured_bytes: summary.capturedBytes,
      normalized_segments: normalizedActivities.length,
      findings_count: findings.length,
      reconciliation_issue_count: reconciliationRows.filter((row) => row.status !== "matched").length,
      activity_day_count: activityParse.dayCount,
      activity_change_count: activityParse.changeCount,
      superseded_import_ids: supersededImportIds,
      timeline_generation_id: timelineGeneration.generationId,
      timeline_event_count: timelineGeneration.eventCount,
      timeline_gap_count: timelineGeneration.gapCount,
      timeline_daily_summary_count: timelineGeneration.dailySummaryCount,
      timeline_skipped_reason: timelineGeneration.skippedReason,
    },
    metadata: {
      final_import_status: finalStatus,
      capture_schema: HOURWISE_READ_ONLY_CAPTURE_SCHEMA,
      timeline_generation_id: timelineGeneration.generationId,
    },
  });

  return {
    status: finalStatus,
    normalizedSegments: normalizedActivities.length,
    findingsCount: findings.length,
    reconciliationIssueCount: reconciliationRows.filter((row) => row.status !== "matched").length,
    activityDayCount: activityParse.dayCount,
    activityChangeCount: activityParse.changeCount,
  };
}

function summarizeHourWiseCapture(capture: HourWiseReadOnlyCapture) {
  const files = Array.isArray(capture.files) ? capture.files as HourWiseReadOnlyCaptureFile[] : [];
  const summaries = files.map((file) => ({
    fileId: stringOrNull(file.fileId),
    name: stringOrNull(file.name),
    selected: Boolean(file.selected),
    readSuccess: Boolean(file.readSuccess),
    bytesRead: numberOrNull(file.bytesRead) ?? 0,
    truncated: Boolean(file.truncated),
    sha256: stringOrNull(file.sha256),
    statusWord: stringOrNull(file.statusWord),
    statusMeaning: stringOrNull(file.statusMeaning),
  }));

  return {
    fileCount: summaries.length,
    selectedFileCount: summaries.filter((file) => file.selected).length,
    readSuccessCount: summaries.filter((file) => file.readSuccess).length,
    truncatedFileCount: summaries.filter((file) => file.truncated).length,
    capturedBytes: summaries.reduce((total, file) => total + file.bytesRead, 0),
    files: summaries,
  };
}

function parseHourWiseDriverCardIdentity(capture: HourWiseReadOnlyCapture): HourWiseDriverCardIdentity | null {
  const file = findHourWiseCaptureFile(capture, "0520");
  if (!file || !file.readSuccess) return null;
  const bytes = decodeBase64Bytes(stringOrNull(file.dataBase64));
  if (!bytes || bytes.length < 143) return null;

  const cardNumber = readAscii(bytes, 1, 16);
  if (!cardNumber) return null;

  const cardHolderSurname = readCodePageString(bytes, 65, 36);
  const cardHolderFirstNames = readCodePageString(bytes, 101, 36);
  const driverName = [cardHolderFirstNames, cardHolderSurname].filter(Boolean).join(" ").trim() || null;

  return {
    cardNumber,
    cardIssuingMemberState: bytes[0] ?? null,
    cardIssuingAuthorityName: readCodePageString(bytes, 17, 36),
    cardIssueDate: readTimeReal(bytes, 53),
    cardValidityBegin: readTimeReal(bytes, 57),
    cardExpiryDate: readTimeReal(bytes, 61)?.slice(0, 10) ?? null,
    cardHolderSurname,
    cardHolderFirstNames,
    driverName,
    cardHolderPreferredLanguage: readAscii(bytes, 141, 2),
  };
}

function parseHourWiseDriverCardActivities(
  capture: HourWiseReadOnlyCapture,
  context: { importId: string; driverId: string | null }
): HourWiseActivityParseResult {
  const file = findHourWiseCaptureFile(capture, "0504");
  if (!file || !file.readSuccess) {
    return {
      rawActivities: [],
      dayCount: 0,
      changeCount: 0,
      firstActivityDate: null,
      lastActivityDate: null,
      warning: "EF 0504 driver activity file was not captured successfully.",
    };
  }

  const bytes = decodeBase64Bytes(stringOrNull(file.dataBase64));
  if (!bytes || bytes.length < 16) {
    return {
      rawActivities: [],
      dayCount: 0,
      changeCount: 0,
      firstActivityDate: null,
      lastActivityDate: null,
      warning: "EF 0504 driver activity file was empty or too short to decode.",
    };
  }

  const parsedRecords = parseActivityDailyRecords(bytes);
  const parsedDates = parsedRecords.map((record) => record.date).sort();
  const rawActivities = parsedRecords.flatMap((record) =>
    record.segments.map((segment, index) => ({
      file_id: context.importId,
      driver_id: context.driverId,
      start_time: segment.startTime,
      end_time: segment.endTime,
      activity_type: segment.activityType,
      slot: index + 1,
      is_manual_entry: false,
      distance_km: null,
    }))
  );

  const warningParts = [
    file.truncated ? "EF 0504 capture was truncated by the helper read limit." : null,
    rawActivities.length === 0 ? "EF 0504 was captured but no sane activity intervals could be decoded." : null,
  ].filter(Boolean);

  return {
    rawActivities,
    dayCount: parsedRecords.length,
    changeCount: parsedRecords.reduce((total, record) => total + record.changeCount, 0),
    firstActivityDate: parsedDates[0] ?? null,
    lastActivityDate: parsedDates[parsedDates.length - 1] ?? null,
    warning: warningParts.length > 0 ? warningParts.join(" ") : null,
  };
}

function parseActivityDailyRecords(bytes: Uint8Array) {
  const candidateRecords = [...parseActivityDailyRecordsFromOffset(bytes, 4)];

  for (let offset = 0; offset + 12 <= bytes.length; offset += 1) {
    if (offset === 4) continue;
    const run = parseActivityDailyRecordsFromOffset(bytes, offset);
    if (run.length < 2) continue;
    candidateRecords.push(...run);
  }

  return dedupeActivityDailyRecords(candidateRecords);
}

function parseActivityDailyRecordsFromOffset(bytes: Uint8Array, startOffset: number) {
  const records: NonNullable<ReturnType<typeof parseActivityDailyRecordAt>>[] = [];
  let offset = startOffset;

  while (offset + 12 <= bytes.length) {
    const record = parseActivityDailyRecordAt(bytes, offset);
    if (!record) break;
    records.push(record);
    offset += record.length;
  }

  return records;
}

function dedupeActivityDailyRecords(records: NonNullable<ReturnType<typeof parseActivityDailyRecordAt>>[]) {
  const byDate = new Map<string, NonNullable<ReturnType<typeof parseActivityDailyRecordAt>>>();

  for (const record of records) {
    const current = byDate.get(record.date);
    if (!current || isBetterActivityDailyRecord(record, current)) {
      byDate.set(record.date, record);
    }
  }

  return Array.from(byDate.values()).sort((left, right) => left.date.localeCompare(right.date));
}

function isBetterActivityDailyRecord(
  candidate: NonNullable<ReturnType<typeof parseActivityDailyRecordAt>>,
  current: NonNullable<ReturnType<typeof parseActivityDailyRecordAt>>
) {
  if (candidate.changeCount !== current.changeCount) return candidate.changeCount > current.changeCount;
  if (candidate.length !== current.length) return candidate.length > current.length;
  return candidate.offset < current.offset;
}

function parseActivityDailyRecordAt(bytes: Uint8Array, offset: number) {
  if (offset < 0 || offset + 12 > bytes.length) return null;

  const recordLength = readUint16(bytes, offset + 2);
  if (!Number.isFinite(recordLength) || recordLength < 14 || recordLength % 2 !== 0 || offset + recordLength > bytes.length) {
    return null;
  }

  const recordDate = readTimeReal(bytes, offset + 4);
  if (!recordDate || !isPlausibleTachoDate(recordDate)) return null;

  const dayStart = new Date(recordDate.slice(0, 10) + "T00:00:00.000Z");
  const changes: Array<{ minute: number; activityType: RawActivityRow["activity_type"] }> = [];

  for (let cursor = offset + 12; cursor + 1 < offset + recordLength; cursor += 2) {
    const word = readUint16(bytes, cursor);
    const minute = word & 0x07ff;
    const activityType = mapActivityChangeInfoType((word >> 11) & 0x03);
    if (minute >= 1440 || !activityType) continue;
    changes.push({ minute, activityType });
  }

  const uniqueChanges = changes
    .sort((left, right) => left.minute - right.minute)
    .filter((change, index, sorted) => index === 0 || change.minute !== sorted[index - 1].minute);

  if (uniqueChanges.length < 1) return null;

  const segments = uniqueChanges
    .map((change, index) => {
      const nextMinute = uniqueChanges[index + 1]?.minute ?? 1440;
      if (nextMinute <= change.minute) return null;
      return {
        startTime: addUtcMinutes(dayStart, change.minute),
        endTime: addUtcMinutes(dayStart, nextMinute),
        activityType: change.activityType,
      };
    })
    .filter((segment): segment is { startTime: string; endTime: string; activityType: RawActivityRow["activity_type"] } => segment !== null);

  if (segments.length === 0) return null;

  return {
    offset,
    length: recordLength,
    date: dayStart.toISOString().slice(0, 10),
    changeCount: uniqueChanges.length,
    segments,
  };
}

function mapActivityChangeInfoType(code: number): RawActivityRow["activity_type"] | null {
  switch (code) {
    case 0:
      return "rest";
    case 1:
      return "poa";
    case 2:
      return "work";
    case 3:
      return "driving";
    default:
      return null;
  }
}

function findHourWiseCaptureFile(capture: HourWiseReadOnlyCapture, fileId: string) {
  const files = Array.isArray(capture.files) ? capture.files as HourWiseReadOnlyCaptureFile[] : [];
  return files.find((file) => stringOrNull(file.fileId)?.toUpperCase() === fileId.toUpperCase()) ?? null;
}

function decodeBase64Bytes(value: string | null) {
  if (!value) return null;
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

function readAscii(bytes: Uint8Array, offset: number, length: number) {
  if (offset < 0 || offset + length > bytes.length) return null;
  return sanitizeDecodedText(String.fromCharCode(...bytes.slice(offset, offset + length)));
}

function readCodePageString(bytes: Uint8Array, offset: number, length: number) {
  if (offset < 0 || offset + length > bytes.length || length < 2) return null;
  const body = bytes.slice(offset + 1, offset + length - 1);
  return sanitizeDecodedText(String.fromCharCode(...body));
}

function sanitizeDecodedText(value: string) {
  const cleaned = value
    .replace(/\0/g, " ")
    .replace(/\u00ff/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

function readTimeReal(bytes: Uint8Array, offset: number) {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  const seconds = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
  if (!seconds) return null;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function readUint16(bytes: Uint8Array, offset: number) {
  if (offset < 0 || offset + 2 > bytes.length) return Number.NaN;
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getUint16(0);
}

function isPlausibleTachoDate(value: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const year = date.getUTCFullYear();
  const now = new Date();
  return year >= 2000 && date.getTime() <= now.getTime() + 366 * 24 * 60 * 60 * 1000;
}

function addUtcMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000).toISOString();
}

async function clearImportData(supabaseAdmin: ReturnType<typeof createClient>, importId: string) {
  await supabaseAdmin.from("tachograph_activities").delete().eq("file_id", importId);
  await supabaseAdmin.from("tachograph_speed_logs").delete().eq("file_id", importId);
  await supabaseAdmin.from("driver_card_downloads").delete().eq("import_id", importId);
  await supabaseAdmin.from("vehicle_unit_downloads").delete().eq("import_id", importId);
  await supabaseAdmin.from("tachograph_activity_segments").delete().eq("import_id", importId);
  await supabaseAdmin.from("tachograph_day_summaries").delete().eq("import_id", importId);
  await supabaseAdmin.from("tachograph_findings").delete().eq("import_id", importId);
  await supabaseAdmin.from("tachograph_technical_events").delete().eq("import_id", importId);
  await supabaseAdmin.from("tachograph_vehicle_motion_discrepancies").delete().eq("import_id", importId);
  await supabaseAdmin.from("tachograph_reconciliation_items").delete().eq("import_id", importId);
}

async function clearDerivedImportData(supabaseAdmin: ReturnType<typeof createClient>, importIds: string[]) {
  if (importIds.length === 0) return;
  await supabaseAdmin.from("tachograph_activities").delete().in("file_id", importIds);
  await supabaseAdmin.from("tachograph_speed_logs").delete().in("file_id", importIds);
  await supabaseAdmin.from("driver_card_downloads").delete().in("import_id", importIds);
  await supabaseAdmin.from("vehicle_unit_downloads").delete().in("import_id", importIds);
  await supabaseAdmin.from("tachograph_activity_segments").delete().in("import_id", importIds);
  await supabaseAdmin.from("tachograph_day_summaries").delete().in("import_id", importIds);
  await supabaseAdmin.from("tachograph_findings").delete().in("import_id", importIds);
  await supabaseAdmin.from("tachograph_technical_events").delete().in("import_id", importIds);
  await supabaseAdmin.from("tachograph_vehicle_motion_discrepancies").delete().in("import_id", importIds);
  await supabaseAdmin.from("tachograph_reconciliation_items").delete().in("import_id", importIds);
}

async function supersedePreviousHourWiseDriverCardReads(
  supabaseAdmin: ReturnType<typeof createClient>,
  input: {
    companyId: string | null;
    currentImportId: string;
    driverId: string | null;
    cardNumber: string | null;
    supersededByProcessedAt: string;
  }
) {
  if (!input.companyId || (!input.driverId && !input.cardNumber)) return [];

  const candidates = new Map<string, TachographFileSupersedeCandidate>();

  if (input.cardNumber) {
    const { data, error } = await supabaseAdmin
      .from("tachograph_files")
      .select("id, driver_id, external_card_number, metadata")
      .eq("company_id", input.companyId)
      .eq("source_type", "driver_card")
      .eq("external_card_number", normalizeCardNumber(input.cardNumber))
      .neq("id", input.currentImportId)
      .limit(500);
    if (error) throw error;
    for (const row of (data ?? []) as TachographFileSupersedeCandidate[]) candidates.set(row.id, row);
  }

  if (input.driverId) {
    const { data, error } = await supabaseAdmin
      .from("tachograph_files")
      .select("id, driver_id, external_card_number, metadata")
      .eq("company_id", input.companyId)
      .eq("source_type", "driver_card")
      .eq("driver_id", input.driverId)
      .neq("id", input.currentImportId)
      .limit(500);
    if (error) throw error;
    for (const row of (data ?? []) as TachographFileSupersedeCandidate[]) candidates.set(row.id, row);
  }

  const supersededRows = [...candidates.values()].filter((row) =>
    isHourWiseReadOnlyTachographFile(row) &&
    matchesSupersededCardOrDriver(row, {
      driverId: input.driverId,
      cardNumber: input.cardNumber,
    })
  );
  const supersededImportIds = supersededRows.map((row) => row.id);
  if (supersededImportIds.length === 0) return [];

  await clearDerivedImportData(supabaseAdmin, supersededImportIds);

  if (input.driverId) {
    await supabaseAdmin
      .from("driver_tacho_compliance_signals")
      .delete()
      .eq("company_id", input.companyId)
      .eq("driver_id", input.driverId)
      .eq("source", HOURWISE_READ_ONLY_CAPTURE_SIGNAL_SOURCE);
    await supabaseAdmin
      .from("driver_tacho_risk_signals")
      .delete()
      .eq("company_id", input.companyId)
      .eq("driver_id", input.driverId)
      .eq("source", HOURWISE_READ_ONLY_CAPTURE_SIGNAL_SOURCE);
  }

  for (const row of supersededRows) {
    const metadata = mergeMetadata(row.metadata, {
      helper_capture_superseded_by_import_id: input.currentImportId,
      helper_capture_superseded_at: input.supersededByProcessedAt,
      helper_capture_active_analysis_rows: false,
      summary: "Superseded by a newer HourWise helper card read. Import audit record retained; derived analysis rows were replaced.",
    });
    const { error } = await supabaseAdmin
      .from("tachograph_files")
      .update({ metadata })
      .eq("id", row.id);
    if (error) throw error;
  }

  return supersededImportIds;
}

function isHourWiseReadOnlyTachographFile(row: TachographFileSupersedeCandidate) {
  return (
    isHourWiseReadOnlyCaptureMetadata(row.metadata) ||
    stringOrNull(row.metadata?.parser_version) === HOURWISE_READ_ONLY_CAPTURE_PARSER_VERSION ||
    stringOrNull(row.metadata?.helper_capture_schema) === HOURWISE_READ_ONLY_CAPTURE_SCHEMA
  );
}

function matchesSupersededCardOrDriver(
  row: TachographFileSupersedeCandidate,
  input: { driverId: string | null; cardNumber: string | null }
) {
  if (input.driverId && row.driver_id === input.driverId) return true;
  if (!input.cardNumber) return false;

  const cardNumber = normalizeCardNumber(input.cardNumber);
  const rowCardNumber =
    normalizeCardNumber(row.external_card_number) ||
    normalizeCardNumber(stringOrNull(row.metadata?.driver_card_number_hint)) ||
    normalizeCardNumber(stringOrNull(row.metadata?.helper_capture_card_number));

  return Boolean(rowCardNumber && rowCardNumber === cardNumber);
}

function normalizeCardNumber(value: string | null | undefined) {
  return stringOrNull(value)?.replace(/\s+/g, "").toUpperCase() ?? null;
}

async function fetchWorkSessionsForRange(
  supabaseAdmin: ReturnType<typeof createClient>,
  input: { driverId: string; startDate: string; endDate: string }
) {
  const { data, error } = await supabaseAdmin
    .from("work_sessions")
    .select("start_time, other_data")
    .eq("user_id", input.driverId)
    .gte("date", input.startDate)
    .lte("date", input.endDate)
    .order("date", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as WorkSessionRow[]).filter((session) => !!session.start_time);
}

function extractRawActivities(parsed: any, context: { importId: string; driverId: string | null }): RawActivityRow[] {
  const flattened = flattenActivityRecords(parsed);
  return flattened
    .map((activity) => {
      const start = toIsoString(activity.start, activity.startTime, activity.begin, activity.from);
      const end = toIsoString(activity.end, activity.endTime, activity.finish, activity.to);
      if (!start || !end) return null;

      const mapped = mapRawActivityType(activity.type, activity.activityType);
      if (!mapped) return null;

      return {
        file_id: context.importId,
        driver_id: context.driverId,
        start_time: start,
        end_time: end,
        activity_type: mapped,
        slot: toInteger(activity.slot, 1),
        is_manual_entry: Boolean(activity.isManualEntry ?? activity.manualEntry),
        distance_km: toNumber(activity.distance, activity.distanceKm),
      };
    })
    .filter((row): row is RawActivityRow => !!row);
}

function flattenActivityRecords(parsed: any): any[] {
  const sources = [
    parsed?.activityDailyRecords,
    parsed?.activities,
    parsed?.activityRecords,
  ].filter(Array.isArray);

  const flattened: any[] = [];
  for (const source of sources) {
    for (const item of source) {
      if (Array.isArray(item?.activityRecords)) {
        flattened.push(...item.activityRecords);
      } else if (Array.isArray(item?.activities)) {
        flattened.push(...item.activities);
      } else if (item) {
        flattened.push(item);
      }
    }
  }
  return flattened;
}

function extractSpeedLogs(parsed: any, importId: string) {
  const sources = [
    parsed?.speedLogs,
    parsed?.speedRecords,
    parsed?.vehicleUnit?.speedLogs,
    parsed?.vuData?.speedLogs,
  ].filter(Array.isArray);

  const logs: Array<{ file_id: string; timestamp: string; speed_kmh: number }> = [];
  for (const source of sources) {
    for (const item of source) {
      const timestamp = toIsoString(item.timestamp, item.time, item.recordedAt);
      const speed = toInteger(item.speed, item.speedKmh);
      if (!timestamp || speed === null) continue;
      logs.push({ file_id: importId, timestamp, speed_kmh: speed });
    }
  }

  return logs;
}

function extractVuEvents(parsed: any): ExtractedVuEvent[] {
  const sources = [
    parsed?.events,
    parsed?.faults,
    parsed?.eventFaults,
    parsed?.eventRecords,
    parsed?.faultRecords,
    parsed?.vehicleUnit?.events,
    parsed?.vehicleUnit?.faults,
    parsed?.vehicleUnit?.eventFaults,
    parsed?.vehicleUnit?.eventRecords,
    parsed?.vehicleUnit?.faultRecords,
    parsed?.vuData?.events,
    parsed?.vuData?.faults,
    parsed?.vuData?.eventFaults,
    parsed?.vuData?.eventRecords,
    parsed?.vuData?.faultRecords,
  ].filter(Array.isArray);

  const events: ExtractedVuEvent[] = [];
  for (const source of sources) {
    for (const item of source) {
      const flattenedItems = flattenVuEventItems(item);
      for (const eventItem of flattenedItems) {
        const timestamp = toIsoString(
          eventItem.timestamp,
          eventItem.time,
          eventItem.recordedAt,
          eventItem.startTime,
          eventItem.occurredAt,
          eventItem.begin,
          eventItem.from
        );
        if (!timestamp) continue;

        const rawText = [
          eventItem.type,
          eventItem.eventType,
          eventItem.faultType,
          eventItem.code,
          eventItem.name,
          eventItem.description,
          eventItem.detail,
          eventItem.category,
        ]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase())
          .join(" ");

        const classification = classifyVuEvent(rawText);
        if (!classification) continue;

        events.push({
          timestamp,
          endTimestamp:
            toIsoString(eventItem.endTime, eventItem.finish, eventItem.to, eventItem.resolvedAt) ?? timestamp,
          ruleCode: classification.ruleCode,
          summary: buildVuEventSummary(classification.ruleCode, eventItem),
          evidenceLabel: firstString(eventItem.name, eventItem.eventType, eventItem.type, eventItem.code) ?? TACHO_RULE_TITLES[classification.ruleCode],
          severity: classification.severity,
          metadata: {
            rawType: firstString(eventItem.type, eventItem.eventType, eventItem.faultType, eventItem.code, eventItem.name),
            rawCategory: firstString(eventItem.category, eventItem.group, eventItem.classification),
            rawCode: firstString(eventItem.code, eventItem.eventCode, eventItem.faultCode),
            slot: toInteger(eventItem.slot),
          },
        });
      }
    }
  }

  return dedupeVuEvents(events);
}

function flattenVuEventItems(item: any): any[] {
  const nestedCollections = [
    item?.events,
    item?.faults,
    item?.eventFaults,
    item?.eventRecords,
    item?.faultRecords,
    item?.records,
    item?.items,
  ].filter(Array.isArray);

  if (nestedCollections.length === 0) return item ? [item] : [];

  return nestedCollections.flatMap((collection) => collection.filter(Boolean));
}

function dedupeVuEvents(events: ExtractedVuEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${event.ruleCode}:${event.timestamp}:${event.endTimestamp}:${event.summary}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function classifyVuEvent(rawText: string): Pick<ExtractedVuEvent, "ruleCode" | "severity"> | null {
  if (
    rawText.includes("driving without card") ||
    rawText.includes("vehicle motion without card") ||
    rawText.includes("no card inserted") ||
    rawText.includes("driving without suitable card")
  ) {
    return { ruleCode: "VU_DRIVING_WITHOUT_CARD", severity: "high" };
  }

  if (
    rawText.includes("insertion while driving") ||
    rawText.includes("card insertion while driving") ||
    rawText.includes("inserted while driving")
  ) {
    return { ruleCode: "VU_CARD_INSERTION_WHILE_DRIVING", severity: "high" };
  }

  if (
    rawText.includes("card conflict") ||
    rawText.includes("conflicting card") ||
    rawText.includes("multiple card") ||
    rawText.includes("driver card conflict")
  ) {
    return { ruleCode: "VU_CARD_CONFLICT", severity: "high" };
  }

  if (
    rawText.includes("security") ||
    rawText.includes("tamper") ||
    rawText.includes("authentication failure") ||
    rawText.includes("unauthorised") ||
    rawText.includes("unauthorized")
  ) {
    return { ruleCode: "VU_SECURITY_FAULT", severity: "high" };
  }

  if (
    rawText.includes("motion conflict") ||
    rawText.includes("motion data conflict") ||
    rawText.includes("motion inconsistency")
  ) {
    return { ruleCode: "VU_MOTION_CONFLICT", severity: "medium" };
  }

  if (
    rawText.includes("power interruption") ||
    rawText.includes("power supply interruption") ||
    rawText.includes("interruption of power supply") ||
    rawText.includes("power cut")
  ) {
    return { ruleCode: "VU_POWER_INTERRUPTION", severity: "medium" };
  }

  if (
    rawText.includes("sensor") ||
    rawText.includes("sender fault") ||
    rawText.includes("motion sensor") ||
    rawText.includes("sensor fault")
  ) {
    return { ruleCode: "VU_SENSOR_FAULT", severity: "medium" };
  }

  if (
    rawText.includes("calibration") ||
    rawText.includes("workshop") ||
    rawText.includes("time adjustment") ||
    rawText.includes("clock adjustment")
  ) {
    return { ruleCode: "VU_CALIBRATION_EVENT", severity: "medium" };
  }

  return null;
}

function buildVuEventSummary(ruleCode: ExtractedVuEvent["ruleCode"], item: any) {
  const details = firstString(item.description, item.detail, item.name, item.eventType, item.type);
  if (details) return details;

  return TACHO_RULE_TITLES[ruleCode];
}

function toSharedNormalizedActivities(
  activities: Array<NormalizedActivityRow & { id: string }>
): SharedNormalizedActivity[] {
  return activities.map((activity) => ({
    id: activity.id,
    driverId: activity.driver_id ?? null,
    vehicleId: activity.vehicle_id ?? null,
    startTime: activity.start_time,
    endTime: activity.end_time,
    activityType: activity.activity_type,
    durationMins: activity.duration_mins,
    distanceKm: activity.distance_km ?? null,
    label: activity.label ?? undefined,
  }));
}

function fromSharedNormalizedActivities(
  activities: SharedNormalizedActivity[],
  context: {
    importId: string;
    companyId: string | null;
    driverId: string | null;
    vehicleId: string | null;
    sourceType: "driver_card" | "vehicle_unit";
  }
): NormalizedActivityRow[] {
  return activities.map((activity) => ({
    import_id: context.importId,
    company_id: context.companyId,
    driver_id: activity.driverId ?? context.driverId,
    vehicle_id: activity.vehicleId ?? context.vehicleId,
    source: context.sourceType,
    activity_type: activity.activityType === "rest" ? "break_rest" : activity.activityType,
    start_time: activity.startTime,
    end_time: activity.endTime,
    duration_mins: activity.durationMins,
    distance_km: activity.distanceKm ?? null,
    confidence: "high",
    label: activity.label ?? null,
  }));
}

function buildDutyWindows(activities: NormalizedActivityRow[]): DutyWindow[] {
  const firstActivity = activities[0];
  const sharedWindows = buildSharedDutyWindows(
    toSharedNormalizedActivities(
      activities.map((activity, index) => ({
        ...activity,
        id: `${activity.activity_type}-${activity.start_time}-${index}`,
      }))
    )
  );

  return sharedWindows.map((window) => ({
    ...window,
    activities: window.activities.map((activity) => ({
      import_id: firstActivity?.import_id ?? "",
      company_id: firstActivity?.company_id ?? null,
      driver_id: activity.driverId ?? firstActivity?.driver_id ?? null,
      vehicle_id: activity.vehicleId ?? firstActivity?.vehicle_id ?? null,
      source: firstActivity?.source ?? "driver_card",
      activity_type: activity.activityType === "rest" ? "break_rest" : activity.activityType,
      start_time: activity.startTime,
      end_time: activity.endTime,
      duration_mins: activity.durationMins,
      distance_km: activity.distanceKm ?? null,
      confidence: "high",
      label: activity.label ?? null,
    })),
  }));
}

function buildDaySummaries(input: {
  importId: string;
  companyId: string | null;
  driverId: string | null;
  vehicleId: string | null;
  dutyWindows: DutyWindow[];
  speedLogsCountByDate: Record<string, number>;
}): DaySummaryRow[] {
  return buildSharedDaySummaries(input.dutyWindows).map((window) => ({
      import_id: input.importId,
      company_id: input.companyId,
      driver_id: input.driverId,
      vehicle_id: input.vehicleId,
      summary_date: window.date,
      driving_mins: window.drivingMins,
      work_mins: window.workMins,
      poa_mins: window.poaMins,
      rest_mins: window.restMins,
      app_driving_mins: null,
      findings_count: 0,
      vu_event_count: input.speedLogsCountByDate[window.date] ?? 0,
    }))
    .sort((a, b) => a.summary_date.localeCompare(b.summary_date));
}

function buildFindings(input: {
  importId: string;
  companyId: string | null;
  driverId: string | null;
  vehicleId: string | null;
  sourceType: "driver_card" | "vehicle_unit";
  dutyWindows: DutyWindow[];
  daySummaries: DaySummaryRow[];
  activities: NormalizedActivityRow[];
}): FindingRow[] {
  const sharedActivities = input.activities.map((activity, index) => ({
    id: `${activity.activity_type}-${activity.start_time}-${index}`,
    startTime: activity.start_time,
    endTime: activity.end_time,
    activityType: activity.activity_type,
    durationMins: activity.duration_mins,
  }));
  const sharedDutyWindows = input.dutyWindows.map((window) => ({
    id: window.id,
    dutyDate: window.dutyDate,
    dutyStart: window.dutyStart,
    dutyEnd: window.dutyEnd,
    activities: window.activities.map((activity, index) => ({
      id: `${activity.activity_type}-${activity.start_time}-${index}`,
      startTime: activity.start_time,
      endTime: activity.end_time,
      activityType: activity.activity_type,
      durationMins: activity.duration_mins,
    })),
    drivingMins: window.drivingMins,
    workMins: window.workMins,
    poaMins: window.poaMins,
    restMins: window.restMins,
  }));

  const sharedEvaluation = evaluateSharedRuleFindings({
    activities: sharedActivities,
    dutyWindows: sharedDutyWindows,
  });

  for (const summary of input.daySummaries) {
    summary.findings_count = sharedEvaluation.findingsPerDate[summary.summary_date] ?? 0;
  }

  return sharedEvaluation.combinedFindings.map((finding) =>
    makeFinding(input, {
      ruleCode: finding.ruleCode,
      summary: finding.summary,
      severity: finding.severity,
      status: finding.status,
      occurredAt: finding.occurredAt,
      periodStart: finding.periodStart,
      periodEnd: finding.periodEnd,
      legalBasis: finding.legalBasis,
      evidenceLabel: finding.evidenceLabel,
      evidenceKind: finding.evidenceKind,
      evidenceRefId: finding.evidenceRefId,
      metadata: finding.metadata,
    })
  );
}

function makeFinding(
  input: {
    importId: string;
    companyId: string | null;
    driverId: string | null;
    vehicleId: string | null;
    sourceType: "driver_card" | "vehicle_unit";
  },
  finding: {
    ruleCode: string;
    summary: string;
    severity: "high" | "medium";
    status: "breach" | "warning";
    occurredAt: string;
    periodStart: string;
    periodEnd: string;
    legalBasis: string;
    evidenceLabel: string;
    evidenceKind: "activity_segment" | "summary";
    evidenceRefId: string;
    metadata: Record<string, string | number | boolean | null>;
  }
): FindingRow {
  return {
    import_id: input.importId,
    company_id: input.companyId,
    driver_id: input.driverId,
    vehicle_id: input.vehicleId,
    source: input.sourceType,
    severity: finding.severity,
    status: finding.status,
    rule_code: finding.ruleCode,
    title: TACHO_RULE_TITLES[finding.ruleCode as keyof typeof TACHO_RULE_TITLES] ?? finding.ruleCode,
    summary: finding.summary,
    legal_basis: finding.legalBasis,
    occurred_at: finding.occurredAt,
    period_start: finding.periodStart,
    period_end: finding.periodEnd,
    evidence_refs: [{ kind: finding.evidenceKind, refId: finding.evidenceRefId, label: finding.evidenceLabel }],
    metadata: finding.metadata,
  };
}

function buildReconciliationRows(input: {
  importId: string;
  companyId: string | null;
  driverId: string | null;
  vehicleId: string | null;
  activities: NormalizedActivityRow[];
  workSessions: WorkSessionRow[];
}): ReconciliationRow[] {
  if (!input.driverId) return [];

  return buildSharedAppTachoReconciliationItems(
    input.activities.map((activity, index) => ({
      id: `${activity.activity_type}-${activity.start_time}-${index}`,
      startTime: activity.start_time,
      endTime: activity.end_time,
      activityType: activity.activity_type,
    })),
    input.workSessions.map((session) => ({
      startTime: session.start_time,
      drivingMins: Math.max(0, Number(session.other_data?.driving ?? 0)),
    }))
  ).map((item) => ({
    import_id: input.importId,
    company_id: input.companyId,
    driver_id: input.driverId,
    vehicle_id: input.vehicleId,
    recon_date: item.date,
    status: item.status,
    app_label: item.appLabel,
    tacho_label: item.tachoLabel,
    summary: item.summary,
    app_driving_mins: item.appDrivingMins,
    tacho_driving_mins: item.tachoDrivingMins,
    metadata: {
      derivedFrom: "app_tacho_day_compare",
    },
  }));
}

function buildTechnicalEvents(input: {
  importId: string;
  companyId: string | null;
  driverId: string | null;
  vehicleId: string | null;
  speedLogs: Array<{ file_id: string; timestamp: string; speed_kmh: number }>;
  vuEvents: ExtractedVuEvent[];
}): TechnicalEventRow[] {
  const overspeedEvents = input.speedLogs
    .filter((log) => log.speed_kmh >= 90)
    .map((log) => ({
      import_id: input.importId,
      company_id: input.companyId,
      driver_id: input.driverId,
      vehicle_id: input.vehicleId,
      source: "vehicle_unit" as const,
      severity: log.speed_kmh >= 100 ? "high" as const : "medium" as const,
      status: "warning" as const,
      rule_code: "VU_OVERSPEED",
      title: "Overspeed event",
      summary: `Recorded speed ${log.speed_kmh} km/h.`,
      legal_basis: "Vehicle Unit Event",
      occurred_at: log.timestamp,
      period_start: log.timestamp,
      period_end: log.timestamp,
      evidence_refs: [{ kind: "event", refId: input.importId, label: "Speed log" }],
      metadata: { speedKmh: log.speed_kmh, thresholdKmh: 90 },
    }));

  const extractedEvents = input.vuEvents.map((event) => ({
    import_id: input.importId,
    company_id: input.companyId,
    driver_id: input.driverId,
    vehicle_id: input.vehicleId,
    source: "vehicle_unit" as const,
    severity: event.severity,
    status: "warning" as const,
    rule_code: event.ruleCode,
    title: TACHO_RULE_TITLES[event.ruleCode],
    summary: event.summary,
    legal_basis: TACHO_RULE_LEGAL_BASIS[event.ruleCode],
    occurred_at: event.timestamp,
    period_start: event.timestamp,
    period_end: event.endTimestamp,
    evidence_refs: [{ kind: "event", refId: input.importId, label: event.evidenceLabel }],
    metadata: {
      ...event.metadata,
      severitySource: "parser_event_text",
    },
  }));

  return [...overspeedEvents, ...extractedEvents];
}

function buildVehicleMotionDiscrepancies(input: {
  importId: string;
  companyId: string | null;
  driverId: string | null;
  driverName: string | null;
  vehicleId: string | null;
  technicalEvents: TechnicalEventRow[];
  findings: FindingRow[];
}): VehicleMotionDiscrepancyRow[] {
  const fromTechnicalEvents = input.technicalEvents
    .filter((event) =>
      [
        "VU_DRIVING_WITHOUT_CARD",
        "VU_CARD_INSERTION_WHILE_DRIVING",
        "VU_CARD_CONFLICT",
        "VU_MOTION_CONFLICT",
      ].includes(event.rule_code)
    )
    .map((event) => ({
      import_id: input.importId,
      company_id: input.companyId,
      driver_id: event.driver_id ?? input.driverId,
      vehicle_id: event.vehicle_id ?? input.vehicleId,
      discrepancy_date: event.occurred_at.slice(0, 10),
      start_time: event.period_start,
      end_time: event.period_end,
      duration_mins: minutesBetween(event.period_start, event.period_end),
      severity: event.severity,
      status:
        event.rule_code === "VU_DRIVING_WITHOUT_CARD"
          ? "unassigned_motion"
          : event.rule_code === "VU_CARD_INSERTION_WHILE_DRIVING"
          ? "card_gap"
          : event.rule_code === "VU_CARD_CONFLICT"
          ? "driver_mismatch"
          : "needs_review",
      summary: event.summary,
      linked_driver_name: input.driverName,
      evidence_refs: event.evidence_refs,
      metadata: {
        ...event.metadata,
        derivedFrom: "technical_event",
      },
    }));

  const fromFindings = input.findings
    .filter((finding) => finding.rule_code.startsWith("DISC_"))
    .map((finding) => ({
      import_id: input.importId,
      company_id: input.companyId,
      driver_id: finding.driver_id ?? input.driverId,
      vehicle_id: finding.vehicle_id ?? input.vehicleId,
      discrepancy_date: finding.occurred_at.slice(0, 10),
      start_time: finding.period_start,
      end_time: finding.period_end,
      duration_mins: minutesBetween(finding.period_start, finding.period_end),
      severity: finding.severity,
      status: "driver_mismatch" as const,
      summary: finding.summary,
      linked_driver_name: input.driverName,
      evidence_refs: finding.evidence_refs,
      metadata: {
        ...finding.metadata,
        derivedFrom: "compliance_finding",
      },
    }));

  const combined = [...fromTechnicalEvents, ...fromFindings];
  const seen = new Set<string>();
  return combined.filter((item) => {
    const key = `${item.status}:${item.start_time}:${item.end_time}:${item.summary}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildComplianceSignals(input: {
  companyId: string | null;
  driverId: string;
  findings: FindingRow[];
  reconciliationRows: ReconciliationRow[];
  generatedAt: string;
  source?: string;
}) {
  return SIGNAL_PERIODS.map((periodDays) => {
    const since = new Date(input.generatedAt);
    since.setUTCDate(since.getUTCDate() - periodDays);

    const periodFindings = input.findings
      .filter((finding) => new Date(finding.occurred_at).getTime() >= since.getTime())
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
    const periodReconciliation = input.reconciliationRows.filter(
      (row) => new Date(`${row.recon_date}T23:59:59.999Z`).getTime() >= since.getTime()
    );
    const reconciliationSummary = summarizeSharedReconciliation(
      periodReconciliation.map((row) => ({
        id: `recon-${row.recon_date}`,
        status: row.status,
        date: row.recon_date,
        appLabel: row.app_label,
        tachoLabel: row.tacho_label,
        summary: row.summary,
        appDrivingMins: row.app_driving_mins,
        tachoDrivingMins: row.tacho_driving_mins,
      }))
    );
    const totalViolations = periodFindings.length;
    const averageScore = Math.max(
      0,
      100 - periodFindings.reduce((score, finding) => score + (finding.severity === "high" ? 12 : 8), 0)
    );
    const reviewFocus = buildSignalReviewFocus({
      findings: periodFindings,
      reconciliationRows: periodReconciliation,
      missingMileage: [],
    });

    return {
      company_id: input.companyId,
      driver_id: input.driverId,
      period_days: periodDays,
      average_score: averageScore,
      total_violations: totalViolations,
      violations: [...new Set(periodFindings.map((finding) => finding.title))],
      recent_violations: periodFindings.slice(0, 12).map((finding) => ({
        date: finding.occurred_at.slice(0, 10),
        violations: [finding.title],
        score: averageScore,
        sessionId: `tacho-${finding.rule_code}-${finding.occurred_at}`,
        source: "tacho",
      })),
      missing_mileage: [],
      reconciliation_summary: reconciliationSummary,
      review_focus: reviewFocus,
      has_data: true,
      source: input.source ?? "normalized_findings",
      generated_at: input.generatedAt,
    };
  });
}

function buildRiskSignals(input: {
  companyId: string | null;
  driverId: string;
  complianceSignals: Array<{
    period_days: number;
    average_score: number;
    total_violations: number;
    missing_mileage: unknown[];
    review_focus?: {
      date: string;
      kind: "violation" | "reconciliation" | "missing_mileage";
      summary: string;
    } | null;
    reconciliation_summary?: {
      matchedDays: number;
      tachoOnlyDays: number;
      appOnlyDays: number;
      mismatchDurationDays: number;
      mismatchActivityDays: number;
      uncertainDays: number;
      totalIssues: number;
    };
  }>;
  reconciliationRows: ReconciliationRow[];
  generatedAt: string;
  source?: string;
}) {
  return SIGNAL_PERIODS.map((periodDays) => {
    const compliance = input.complianceSignals.find((signal) => signal.period_days === periodDays);
    const reconciliationSummary = compliance?.reconciliation_summary ?? summarizeSharedReconciliation(
      input.reconciliationRows
        .filter((row) => {
          const since = new Date(input.generatedAt);
          since.setUTCDate(since.getUTCDate() - periodDays);
          return new Date(`${row.recon_date}T23:59:59.999Z`).getTime() >= since.getTime();
        })
        .map((row) => ({
          id: `recon-${row.recon_date}`,
          status: row.status,
          date: row.recon_date,
          appLabel: row.app_label,
          tachoLabel: row.tacho_label,
          summary: row.summary,
          appDrivingMins: row.app_driving_mins,
          tachoDrivingMins: row.tacho_driving_mins,
        }))
    );
    return {
      company_id: input.companyId,
      driver_id: input.driverId,
      period_days: periodDays,
      legal_compliance_score: compliance?.average_score ?? 100,
      violation_count: compliance?.total_violations ?? 0,
      missing_mileage_count: Array.isArray(compliance?.missing_mileage) ? compliance!.missing_mileage.length : 0,
      app_mismatch_count: reconciliationSummary.totalIssues,
      reconciliation_summary: reconciliationSummary,
      review_focus: compliance?.review_focus ?? buildSignalReviewFocus({
        findings: [],
        reconciliationRows: input.reconciliationRows.filter((row) => {
          const since = new Date(input.generatedAt);
          since.setUTCDate(since.getUTCDate() - periodDays);
          return new Date(`${row.recon_date}T23:59:59.999Z`).getTime() >= since.getTime();
        }),
        missingMileage: [],
      }),
      source: input.source ?? "normalized_findings",
      generated_at: input.generatedAt,
    };
  });
}

function buildSignalReviewFocus(input: {
  findings: FindingRow[];
  reconciliationRows: ReconciliationRow[];
  missingMileage: Array<{ start: string; end: string }>;
}) {
  const firstFinding = input.findings[0];
  if (firstFinding) {
    return {
      date: firstFinding.occurred_at.slice(0, 10),
      kind: "violation",
      summary: firstFinding.title,
    };
  }

  const firstReconciliation = input.reconciliationRows.find((row) => row.status !== "matched");
  if (firstReconciliation) {
    return {
      date: firstReconciliation.recon_date,
      kind: "reconciliation",
      summary: firstReconciliation.summary,
    };
  }

  const firstMissingMileage = input.missingMileage[0];
  if (firstMissingMileage) {
    return {
      date: firstMissingMileage.start.slice(0, 10),
      kind: "missing_mileage",
      summary: `Missing mileage gap from ${firstMissingMileage.start.slice(11, 16)} to ${firstMissingMileage.end.slice(11, 16)}.`,
    };
  }

  return null;
}

function resolvePeriodBounds(activities: NormalizedActivityRow[]) {
  if (activities.length === 0) {
    return { startTime: null as string | null, endTime: null as string | null };
  }

  const ordered = [...activities].sort((a, b) => a.start_time.localeCompare(b.start_time));
  return {
    startTime: ordered[0].start_time,
    endTime: ordered[ordered.length - 1].end_time,
  };
}

function buildImportSummary(segmentCount: number, findingCount: number, eventCount: number) {
  return `${segmentCount} segments, ${findingCount} findings, ${eventCount} technical events`;
}

function inferSourceType(record: ImportRecord, cardNumber: string | null, vuSerial: string | null) {
  if (record.source_type === "driver_card" || record.source_type === "vehicle_unit") {
    return record.source_type;
  }
  if (cardNumber && !vuSerial) return "driver_card";
  return "vehicle_unit";
}

function countByDate(timestamps: string[]) {
  return timestamps.reduce<Record<string, number>>((acc, timestamp) => {
    const date = timestamp.slice(0, 10);
    acc[date] = (acc[date] ?? 0) + 1;
    return acc;
  }, {});
}

function mapRawActivityType(...values: unknown[]): RawActivityRow["activity_type"] | null {
  const raw = values.find((value) => value !== undefined && value !== null);
  const text = String(raw ?? "").toLowerCase();
  const numeric = Number(raw);

  if (numeric === 0 || text === "rest" || text === "break") return "rest";
  if (numeric === 1 || text === "poa" || text === "available") return "poa";
  if (numeric === 2 || text === "work" || text === "other_work") return "work";
  if (numeric === 3 || text === "driving" || text === "drive") return "driving";
  return null;
}

function mapNormalizedActivityType(activityType: RawActivityRow["activity_type"]) {
  return activityType === "rest" ? "break_rest" : activityType;
}

function mergeMetadata(
  metadata: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>
) {
  return { ...(metadata ?? {}), ...patch };
}

function normalizeReg(value: string | null) {
  return value ? value.replace(/\s+/g, "").toUpperCase() : null;
}

function joinName(...values: unknown[]) {
  for (const value of values) {
    if (!value) continue;
    if (typeof value === "string") return value;
    if (typeof value === "object") {
      const first = firstString((value as any).firstName, (value as any).first_name, (value as any).forename);
      const last = firstString((value as any).lastName, (value as any).last_name, (value as any).surname);
      const full = [first, last].filter(Boolean).join(" ").trim();
      if (full) return full;
    }
  }
  return null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toIsoString(...values: unknown[]) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const date = new Date(value as string | number | Date);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

function toDateOnly(...values: unknown[]) {
  const iso = toIsoString(...values);
  return iso ? iso.slice(0, 10) : null;
}

function minutesBetween(start: string, end: string) {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

function toNumber(...values: unknown[]) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

function numberOrNull(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function toInteger(...values: unknown[]) {
  const parsed = toNumber(...values);
  return parsed === null ? null : Math.round(parsed);
}
