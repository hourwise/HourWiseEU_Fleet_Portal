// supabase/functions/accept-driver-invite/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create a Supabase client with the user's auth token
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    // Get the currently authenticated user
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("User not authenticated.");

    const { inviteCode } = await req.json();
    if (!inviteCode) throw new Error("Invite code is required.");

    // Use the service role client to perform admin tasks
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Find the invite
    const { data: invite, error: findError } = await serviceClient
      .from("driver_invites")
      .select("*")
      .eq("invite_code", inviteCode)
      .eq("status", "pending")
      .single();

    if (findError) throw new Error("Invalid or expired invite code.");

    // 2. Update the user's profile
    const { error: profileError } = await serviceClient
      .from("profiles")
      .update({
        company_id: invite.company_id,
        full_name: invite.full_name,
        role: 'driver'
      })
      .eq("user_id", user.id);

    if (profileError) throw new Error("Failed to update user profile.");

    // 3. Create the pay configuration from the snapshot
    const { error: payConfigError } = await serviceClient
      .from("pay_configurations")
      .insert({
        ...invite.pay_config_snapshot,
        user_id: user.id, // Link to the user
      });

    if (payConfigError) throw new Error("Failed to create pay configuration.");

    // 4. Mark the invite as accepted
    const { error: updateInviteError } = await serviceClient
      .from("driver_invites")
      .update({ status: "accepted", accepted_by_user_id: user.id })
      .eq("id", invite.id);

    if (updateInviteError) throw new Error("Failed to finalize invite.");

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

