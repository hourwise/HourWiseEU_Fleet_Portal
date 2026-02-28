// File: supabase/functions/request-account-deletion/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Get the user from the auth token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error("User not found.");

    // Update the user's profile to mark it for deletion
    // This is the "soft delete" you described
    const { error: profileError } = await supabaseClient
      .from("profiles")
      .update({
        status: 'pending_deletion',
        deactivation_date: new Date().toISOString() // Record when the request was made
      })
      .eq('id', user.id); // Ensure we only update the currently authenticated user

    if (profileError) throw profileError;

    // Optional: You could also trigger a notification to the company manager here

    return new Response(JSON.stringify({ success: true, message: "Account deletion request received." }), {
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
