// supabase/functions/lookup-driver-invite/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { inviteCode } = await req.json();
    if (!inviteCode || typeof inviteCode !== "string") {
      return jsonResponse({ error: "Invite code is required." }, 400);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    const { data, error } = await supabaseClient.rpc("lookup_pending_driver_invite", {
      p_invite_code: inviteCode,
    });

    if (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    const invite = Array.isArray(data) ? data[0] : data;
    if (!invite) {
      return jsonResponse({ error: "Invalid or expired invite code." }, 404);
    }

    return jsonResponse({ invite });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invite lookup failed.";
    return jsonResponse({ error: message }, 400);
  }
});
