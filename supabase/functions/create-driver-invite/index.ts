import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Helper to generate a random code
function generateInviteCode(length = 8) {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const {
      companyId,
      inviteEmail,
      inviteFullName,
      payConfigSnapshot,
    } = await req.json();

    if (!companyId || !inviteEmail || !inviteFullName) {
        throw new Error("Missing required fields: companyId, inviteEmail, or inviteFullName");
    }

    const invite_code = generateInviteCode();
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days from now

    const { data, error } = await supabaseClient
      .from("driver_invites")
      .insert({
        company_id: companyId,
        email: inviteEmail,
        full_name: inviteFullName,
        invite_code: invite_code,
        pay_config_snapshot: payConfigSnapshot,
        expires_at: expires_at,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ invite: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 201,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
