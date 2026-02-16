// File: supabase/functions/create-driver-invite/index.ts

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

    // Use a service role client to fetch company name
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const {
      companyId,
      inviteEmail,
      inviteFullName,
      payConfigSnapshot,
    } = await req.json();

    if (!companyId || !inviteEmail || !inviteFullName) {
        throw new Error("Missing required fields");
    }

    // --- Create the invite in the database ---
    const invite_code = generateInviteCode();
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invite, error: insertError } = await supabaseClient
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

    if (insertError) throw insertError;

    // --- Get Company Name for the email ---
    const { data: company } = await serviceClient
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single();

    // --- Send the email using Resend ---
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("Resend API key is not configured.");

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "invites@hourwiseeu.co.uk", // Use your verified Resend domain email
        to: inviteEmail,
        subject: `You're invited to join ${company?.name || 'a fleet'} on HourWise EU`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2>Hello ${inviteFullName},</h2>
            <p>You have been invited by <strong>${company?.name || 'your manager'}</strong> to join their fleet on HourWise EU.</p>
            <p>To accept the invitation, download the HourWise EU app, create your account, and enter the following invite code when prompted:</p>
            <div style="background-color: #f0f0f0; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; margin: 0;">${invite_code}</p>
            </div>
            <p>This code will expire in 7 days.</p>
            <p>Thanks,<br/>The HourWise EU Team</p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
        const errorBody = await emailResponse.json();
        throw new Error(`Failed to send email: ${errorBody.message}`);
    }

    return new Response(JSON.stringify({ invite }), {
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
