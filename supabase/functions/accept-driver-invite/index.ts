// supabase/functions/accept-driver-invite/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type AcceptDriverInviteResult = {
  success?: boolean;
  company_id?: string;
  driver_id?: string;
  linked_import_ids?: string[];
  linked_import_count?: number;
  [key: string]: unknown;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) {
      return jsonResponse({ error: "Authentication required." }, 401);
    }

    const { inviteCode } = await req.json();
    if (!inviteCode || typeof inviteCode !== "string") {
      return jsonResponse({ error: "Invite code is required." }, 400);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authorization } } },
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "User not authenticated." }, 401);
    }

    const { data, error } = await supabaseClient.rpc("accept_driver_invite", {
      p_invite_code: inviteCode,
    });

    if (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    const result = (data ?? { success: true }) as AcceptDriverInviteResult;
    const linkedImportIds = Array.isArray(result.linked_import_ids)
      ? result.linked_import_ids.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
    const triggerToken = Deno.env.get("PROCESS_TACHO_TRIGGER_TOKEN");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    if (linkedImportIds.length > 0 && triggerToken && serviceRoleKey && supabaseUrl) {
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
      const { data: importRows, error: importError } = await supabaseAdmin
        .from("tachograph_files")
        .select("id,company_id,driver_id,vehicle_id,file_path,file_type,filename,metadata,source_type")
        .in("id", linkedImportIds);

      if (importError) {
        return jsonResponse({
          ...result,
          signal_rebuild_started: false,
          signal_rebuild_warning: importError.message,
        });
      }

      const kickoffResults = await Promise.allSettled(
        (importRows ?? []).map((record) =>
          supabaseAdmin.functions.invoke("process-tacho", {
            body: { record },
            headers: {
              "x-tacho-trigger-token": triggerToken,
            },
          })
        )
      );

      const failedKickoffs = kickoffResults.filter((kickoff) =>
        kickoff.status === "rejected" || (kickoff.status === "fulfilled" && kickoff.value.error)
      );

      return jsonResponse({
        ...result,
        signal_rebuild_started: failedKickoffs.length === 0,
        signal_rebuild_import_count: kickoffResults.length,
        signal_rebuild_warning: failedKickoffs.length > 0
          ? `${failedKickoffs.length} linked import signal rebuild kickoff${failedKickoffs.length === 1 ? "" : "s"} failed.`
          : null,
      });
    }

    return jsonResponse({
      ...result,
      signal_rebuild_started: linkedImportIds.length === 0 ? null : false,
      signal_rebuild_import_count: 0,
      signal_rebuild_warning: linkedImportIds.length > 0
        ? "Linked imports were paired, but PROCESS_TACHO_TRIGGER_TOKEN or service role configuration is missing."
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invite acceptance failed.";
    return jsonResponse({ error: message }, 400);
  }
});
