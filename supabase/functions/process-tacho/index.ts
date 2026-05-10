import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import readesm from "https://esm.sh/readesm@1.0.17";

const PARSER_VERSION = "readesm@1.0.17";
const SIGNAL_PERIODS = [7, 14, 28, 30, 90, 180];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  severity: "medium";
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
    const normalizedActivities = rawActivities.map((activity) => ({
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
    }));
    const speedLogs = extractSpeedLogs(parsed, record.id);

    const summaryWindow = resolvePeriodBounds(normalizedActivities);
    const downloadedAt = summaryWindow.endTime ?? new Date().toISOString();
    const daySummaries = buildDaySummaries({
      importId: record.id,
      companyId: record.company_id ?? null,
      driverId,
      vehicleId,
      activities: normalizedActivities,
      speedLogsCountByDate: countByDate(speedLogs.map((log) => log.timestamp)),
    });
    const findings = buildFindings({
      importId: record.id,
      companyId: record.company_id ?? null,
      driverId,
      vehicleId,
      sourceType,
      daySummaries,
      activities: normalizedActivities,
    });
    const technicalEvents = buildTechnicalEvents({
      importId: record.id,
      companyId: record.company_id ?? null,
      driverId,
      vehicleId,
      speedLogs,
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
        generatedAt: downloadedAt,
      });
      const riskSignals = buildRiskSignals({
        companyId: record.company_id ?? null,
        driverId,
        complianceSignals,
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
  await supabaseAdmin.from("tachograph_processing_runs").delete().eq("import_id", importId);
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

function buildDaySummaries(input: {
  importId: string;
  companyId: string | null;
  driverId: string | null;
  vehicleId: string | null;
  activities: NormalizedActivityRow[];
  speedLogsCountByDate: Record<string, number>;
}): DaySummaryRow[] {
  const byDate = new Map<string, DaySummaryRow>();

  for (const activity of input.activities) {
    const date = activity.start_time.slice(0, 10);
    const summary = byDate.get(date) ?? {
      import_id: input.importId,
      company_id: input.companyId,
      driver_id: input.driverId,
      vehicle_id: input.vehicleId,
      summary_date: date,
      driving_mins: 0,
      work_mins: 0,
      poa_mins: 0,
      rest_mins: 0,
      app_driving_mins: null,
      findings_count: 0,
      vu_event_count: input.speedLogsCountByDate[date] ?? 0,
    };

    if (activity.activity_type === "driving") summary.driving_mins += activity.duration_mins;
    if (activity.activity_type === "work") summary.work_mins += activity.duration_mins;
    if (activity.activity_type === "poa") summary.poa_mins += activity.duration_mins;
    if (activity.activity_type === "break_rest") summary.rest_mins += activity.duration_mins;

    byDate.set(date, summary);
  }

  return [...byDate.values()].sort((a, b) => a.summary_date.localeCompare(b.summary_date));
}

function buildFindings(input: {
  importId: string;
  companyId: string | null;
  driverId: string | null;
  vehicleId: string | null;
  sourceType: "driver_card" | "vehicle_unit";
  daySummaries: DaySummaryRow[];
  activities: NormalizedActivityRow[];
}): FindingRow[] {
  const findings: FindingRow[] = [];

  for (const summary of input.daySummaries) {
    if (summary.driving_mins > 600) {
      findings.push(makeFinding(input, {
        ruleCode: "DRV_DAILY_10H_EXCEEDED",
        title: "Daily driving exceeded 10 hours",
        summary: `Driving recorded for ${summary.driving_mins} minutes on ${summary.summary_date}.`,
        severity: "high",
        status: "breach",
        occurredAt: `${summary.summary_date}T23:59:59.000Z`,
        periodStart: `${summary.summary_date}T00:00:00.000Z`,
        periodEnd: `${summary.summary_date}T23:59:59.000Z`,
        evidenceLabel: summary.summary_date,
      }));
      summary.findings_count += 1;
    } else if (summary.driving_mins > 540) {
      findings.push(makeFinding(input, {
        ruleCode: "DRV_DAILY_9H_EXCEEDED",
        title: "Daily driving exceeded 9 hours",
        summary: `Driving recorded for ${summary.driving_mins} minutes on ${summary.summary_date}.`,
        severity: "medium",
        status: "warning",
        occurredAt: `${summary.summary_date}T23:59:59.000Z`,
        periodStart: `${summary.summary_date}T00:00:00.000Z`,
        periodEnd: `${summary.summary_date}T23:59:59.000Z`,
        evidenceLabel: summary.summary_date,
      }));
      summary.findings_count += 1;
    }
  }

  let continuousDriving = 0;
  let continuousStart: string | null = null;

  for (const activity of [...input.activities].sort((a, b) => a.start_time.localeCompare(b.start_time))) {
    if (activity.activity_type === "driving") {
      continuousDriving += activity.duration_mins;
      continuousStart = continuousStart ?? activity.start_time;
      if (continuousDriving > 270) {
        findings.push(makeFinding(input, {
          ruleCode: "DRV_CONTINUOUS_4H30_EXCEEDED",
          title: "Continuous driving exceeded 4.5 hours",
          summary: `A continuous driving block reached ${continuousDriving} minutes.`,
          severity: "high",
          status: "breach",
          occurredAt: activity.end_time,
          periodStart: continuousStart,
          periodEnd: activity.end_time,
          evidenceLabel: "Continuous driving block",
        }));
        continuousDriving = 0;
        continuousStart = null;
      }
      continue;
    }

    if (activity.activity_type === "break_rest" && activity.duration_mins >= 45) {
      continuousDriving = 0;
      continuousStart = null;
    }
  }

  return findings;
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
    title: string;
    summary: string;
    severity: "high" | "medium";
    status: "breach" | "warning";
    occurredAt: string;
    periodStart: string;
    periodEnd: string;
    evidenceLabel: string;
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
    title: finding.title,
    summary: finding.summary,
    legal_basis: null,
    occurred_at: finding.occurredAt,
    period_start: finding.periodStart,
    period_end: finding.periodEnd,
    evidence_refs: [{ kind: "raw_file", refId: input.importId, label: finding.evidenceLabel }],
    metadata: {},
  };
}

function buildTechnicalEvents(input: {
  importId: string;
  companyId: string | null;
  driverId: string | null;
  vehicleId: string | null;
  speedLogs: Array<{ file_id: string; timestamp: string; speed_kmh: number }>;
}): TechnicalEventRow[] {
  return input.speedLogs
    .filter((log) => log.speed_kmh >= 90)
    .map((log) => ({
      import_id: input.importId,
      company_id: input.companyId,
      driver_id: input.driverId,
      vehicle_id: input.vehicleId,
      source: "vehicle_unit" as const,
      severity: "medium" as const,
      status: "warning" as const,
      rule_code: "VU_OVERSPEED",
      title: "Overspeed event",
      summary: `Recorded speed ${log.speed_kmh} km/h.`,
      occurred_at: log.timestamp,
      period_start: log.timestamp,
      period_end: log.timestamp,
      evidence_refs: [{ kind: "event", refId: input.importId, label: "Speed log" }],
      metadata: { speedKmh: log.speed_kmh },
    }));
}

function buildComplianceSignals(input: {
  companyId: string | null;
  driverId: string;
  findings: FindingRow[];
  generatedAt: string;
}) {
  return SIGNAL_PERIODS.map((periodDays) => {
    const since = new Date(input.generatedAt);
    since.setUTCDate(since.getUTCDate() - periodDays);

    const periodFindings = input.findings
      .filter((finding) => new Date(finding.occurred_at).getTime() >= since.getTime())
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
    const totalViolations = periodFindings.length;
    const averageScore = Math.max(
      0,
      100 - periodFindings.reduce((score, finding) => score + (finding.severity === "high" ? 12 : 8), 0)
    );

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
  }>;
  generatedAt: string;
}) {
  return SIGNAL_PERIODS.map((periodDays) => {
    const compliance = input.complianceSignals.find((signal) => signal.period_days === periodDays);
    return {
      company_id: input.companyId,
      driver_id: input.driverId,
      period_days: periodDays,
      legal_compliance_score: compliance?.average_score ?? 100,
      violation_count: compliance?.total_violations ?? 0,
      missing_mileage_count: Array.isArray(compliance?.missing_mileage) ? compliance!.missing_mileage.length : 0,
      app_mismatch_count: 0,
      source: "normalized_findings",
      generated_at: input.generatedAt,
    };
  });
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
