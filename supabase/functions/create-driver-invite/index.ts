// File: supabase/functions/create-driver-invite/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@11.1.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";

// ... (helper functions remain the same) ...

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ... (client setup and data extraction remain the same) ...
    const {
      companyId,
      inviteEmail,
      inviteFullName,
      payConfigSnapshot,
    } = await req.json();

    // ... (Stripe and company logic remain the same) ...

    const { data: invite, error: insertError } = await supabaseClient
      .from("driver_invites")
      .insert({
        // ... (insert logic remains the same) ...
      })
      .select()
      .single();

    if (insertError) throw insertError;
    
    // --- Send the email using Resend ---
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
    if (!resendApiKey || !fromEmail) throw new Error("Resend API key or From Email is not configured.");

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: inviteEmail,
        subject: `You're invited to join ${company?.name || 'a fleet'} on HourWise EU`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; color: #333; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #0F172A;">Hello ${inviteFullName},</h2>
            <p>You have been invited by <strong>${company?.name || 'your manager'}</strong> to join their fleet on the HourWise EU app.</p>

            <h3 style="color: #0F172A; border-bottom: 2px solid #2563EB; padding-bottom: 5px; margin-top: 30px;">Your Invite Code:</h3>
            <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; margin: 0; color: #0F172A;">${invite_code}</p>
            </div>

            <h3 style="color: #0F172A; border-bottom: 2px solid #2563EB; padding-bottom: 5px; margin-top: 30px;">Next Steps:</h3>
            <ol style="padding-left: 20px; line-height: 1.6;">
                <li>Download the <strong>HourWise EU</strong> app from your phone's app store.</li>
                <li>Open the app and choose <strong>"Create Account"</strong>.</li>
                <li>Select the <strong>"Fleet Member"</strong> option.</li>
                <li>Enter the invite code above when prompted. Your details will be pre-filled.</li>
                <li>Complete your account setup.</li>
            </ol>

            <p style="font-size: 12px; color: #64748B; margin-top: 30px;">This invite code will expire in 7 days.</p>
            <p style="margin-top: 20px;">Thanks,<br/>The HourWise EU Team</p>
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
