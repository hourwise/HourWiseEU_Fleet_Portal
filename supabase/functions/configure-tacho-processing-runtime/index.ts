import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-tacho-runtime-admin-token",
};

type RuntimeStatusRow = {
  trigger_enabled: boolean;
  process_tacho_url: string | null;
  trigger_token_configured: boolean;
  updated_at: string;
};

type RuntimeConfigPatch = {
  triggerEnabled?: boolean;
  processTachoUrl?: string | null;
  triggerToken?: string | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireAdminToken(req: Request) {
  const configuredToken = Deno.env.get("TACHO_RUNTIME_ADMIN_TOKEN");
  if (!configuredToken) {
    return jsonResponse(
      { error: "TACHO_RUNTIME_ADMIN_TOKEN is not configured for this function." },
      500
    );
  }

  const suppliedToken = req.headers.get("x-tacho-runtime-admin-token");
  if (!suppliedToken || suppliedToken !== configuredToken) {
    return jsonResponse({ error: "Invalid runtime admin token." }, 401);
  }

  return null;
}

function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

function normalizeStatusRow(row: RuntimeStatusRow | null | undefined) {
  return {
    triggerEnabled: row?.trigger_enabled ?? false,
    processTachoUrl: row?.process_tacho_url ?? null,
    triggerTokenConfigured: row?.trigger_token_configured ?? false,
    updatedAt: row?.updated_at ?? null,
  };
}

function isValidProcessTachoUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.pathname.endsWith("/process-tacho");
  } catch {
    return false;
  }
}

function validatePatch(patch: RuntimeConfigPatch) {
  if (
    patch.triggerEnabled !== undefined &&
    typeof patch.triggerEnabled !== "boolean"
  ) {
    return "triggerEnabled must be a boolean when provided.";
  }

  if (
    patch.processTachoUrl !== undefined &&
    patch.processTachoUrl !== null &&
    (!patch.processTachoUrl.trim() || !isValidProcessTachoUrl(patch.processTachoUrl))
  ) {
    return "processTachoUrl must be an https URL ending in /process-tacho.";
  }

  if (
    patch.triggerToken !== undefined &&
    patch.triggerToken !== null &&
    !String(patch.triggerToken).trim()
  ) {
    return "triggerToken cannot be blank when provided.";
  }

  return null;
}

function isRuntimeConfigPatch(value: unknown): value is RuntimeConfigPatch {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function getRuntimeStatus() {
  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient.rpc("get_tacho_processing_runtime");
  if (error) {
    throw error;
  }

  return normalizeStatusRow(Array.isArray(data) ? (data[0] as RuntimeStatusRow | undefined) : null);
}

async function updateRuntimeStatus(patch: RuntimeConfigPatch) {
  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient.rpc("configure_tacho_processing_runtime", {
    p_patch: patch,
  });

  if (error) {
    throw error;
  }

  return normalizeStatusRow(Array.isArray(data) ? (data[0] as RuntimeStatusRow | undefined) : null);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authError = requireAdminToken(req);
  if (authError) {
    return authError;
  }

  try {
    if (req.method === "GET") {
      return jsonResponse({ runtime: await getRuntimeStatus() });
    }

    if (req.method !== "PUT") {
      return jsonResponse({ error: "Method not allowed." }, 405);
    }

    const patchValue = await req.json();
    if (!isRuntimeConfigPatch(patchValue)) {
      return jsonResponse({ error: "Request body must be a JSON object." }, 400);
    }

    const patch = patchValue as RuntimeConfigPatch;
    const validationError = validatePatch(patch);
    if (validationError) {
      return jsonResponse({ error: validationError }, 400);
    }

    const runtime = await updateRuntimeStatus(patch);
    return jsonResponse({ runtime });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown runtime configuration error";
    console.error("configure-tacho-processing-runtime error:", error);
    return jsonResponse({ error: message }, 500);
  }
});
