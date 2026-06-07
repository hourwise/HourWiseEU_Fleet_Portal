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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  let record: ImportRecord | null = null;

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

    await supabaseAdmin
      .from("tachograph_files")
      .update({ status: "processing" })
      .eq("id", record.id);

    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from("tachograph-files")
      .download(record.file_path);

    if (downloadError) throw downloadError;

    const buffer = await fileData.arrayBuffer();
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
            companyId: record.company_id ?? null,
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
      const { error } = await supabaseAdmin.from("tachograph_activity_segments").insert(normalizedActivities);
      if (error) throw error;
    }

    if (daySummaries.length > 0) {
      const { error } = await supabaseAdmin.from("tachograph_day_summaries").insert(daySummaries);
      if (error) throw error;
    }

    if (findings.length > 0) {
      const { error } = await supabaseAdmin.from("tachograph_findings").insert(findings);
      if (error) throw error;
    }

    if (technicalEvents.length > 0) {
      const { error } = await supabaseAdmin.from("tachograph_technical_events").insert(technicalEvents);
      if (error) throw error;
    }

    if (vehicleMotionDiscrepancies.length > 0) {
      const { error } = await supabaseAdmin.from("tachograph_vehicle_motion_discrepancies").insert(vehicleMotionDiscrepancies);
      if (error) throw error;
    }

    if (reconciliationRows.length > 0) {
      const { error } = await supabaseAdmin.from("tachograph_reconciliation_items").insert(reconciliationRows);
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

    await supabaseAdmin.from("tachograph_processing_runs").insert({
      import_id: record.id,
      company_id: record.company_id ?? null,
      parser_version: PARSER_VERSION,
      source: "normalized_findings",
      warnings: [],
      errors: [],
      processed_at: downloadedAt,
    });

    const finalStatus = normalizedActivities.length > 0 ? "processed" : "partial";
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
      const message = error instanceof Error ? error.message : "Unknown processing error";
      await supabaseAdmin.from("tachograph_processing_runs").insert({
        import_id: record.id,
        company_id: record.company_id ?? null,
        parser_version: PARSER_VERSION,
        source: "normalized_findings",
        warnings: [],
        errors: [message],
        processed_at: new Date().toISOString(),
      });

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
      { error: error instanceof Error ? error.message : "Unknown error" },
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
  await supabaseAdmin.from("tachograph_processing_runs").delete().eq("import_id", importId);
}

async function fetchWorkSessionsForRange(
  supabaseAdmin: ReturnType<typeof createClient>,
  input: { companyId: string | null; driverId: string; startDate: string; endDate: string }
) {
  const query = supabaseAdmin
    .from("work_sessions")
    .select("start_time, other_data")
    .eq("user_id", input.driverId)
    .gte("date", input.startDate)
    .lte("date", input.endDate)
    .order("date", { ascending: false });

  const scopedQuery = input.companyId ? query.eq("company_id", input.companyId) : query;
  const { data, error } = await scopedQuery;
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
  const sharedEvaluation = evaluateSharedRuleFindings({
    activities: input.activities.map((activity, index) => ({
      id: `${activity.activity_type}-${activity.start_time}-${index}`,
      startTime: activity.start_time,
      endTime: activity.end_time,
      activityType: activity.activity_type,
      durationMins: activity.duration_mins,
    })),
    dutyWindows: input.dutyWindows.map((window) => ({
      id: window.id,
      dutyDate: window.duty_date,
      dutyStart: window.duty_start,
      dutyEnd: window.duty_end,
      activities: window.activities.map((activity, index) => ({
        id: `${activity.activity_type}-${activity.start_time}-${index}`,
        startTime: activity.start_time,
        endTime: activity.end_time,
        activityType: activity.activity_type,
        durationMins: activity.duration_mins,
      })),
      drivingMins: window.driving_mins,
      workMins: window.work_mins,
      poaMins: window.poa_mins,
      restMins: window.rest_mins,
    })),
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
      source: "normalized_findings",
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
      source: "normalized_findings",
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

function toInteger(...values: unknown[]) {
  const parsed = toNumber(...values);
  return parsed === null ? null : Math.round(parsed);
}
