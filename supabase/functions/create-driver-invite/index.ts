// File: supabase/functions/create-driver-invite/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@11.1.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";

const stripeApiKey = Deno.env.get("STRIPE_API_KEY");
const stripe = stripeApiKey ? new Stripe(stripeApiKey, {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: "2023-10-16",
}) : null;

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

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { companyId, inviteEmail, inviteFullName, payConfigSnapshot } = await req.json();

    if (!companyId || !inviteEmail || !inviteFullName) {
        throw new Error("Missing required fields: companyId, email, or name.");
    }

    // --- Get Company Data ---
    const { data: company, error: companyError } = await serviceClient
      .from('companies')
      .select('name, stripe_subscription_id')
      .eq('id', companyId)
      .single();

    if (companyError) throw new Error(`Failed to retrieve company: ${companyError.message}`);

    // --- Increment Subscription (Only if Stripe is configured) ---
    if (stripe && company.stripe_subscription_id) {
        try {
            const subscription = await stripe.subscriptions.retrieve(company.stripe_subscription_id);
            await stripe.subscriptions.update(company.stripe_subscription_id, {
                items: [{
                    id: subscription.items.data[0].id,
                    quantity: (subscription.items.data[0].quantity || 0) + 1,
                }],
            });
            console.log("Stripe subscription incremented.");
        } catch (sErr) {
            console.error("Stripe error (skipping):", sErr.message);
            // We don't throw here so the email still sends during testing
        }
    } else {
        console.log("Stripe not configured or no subscription ID found. Skipping billing increment.");
    }

    // --- Create the invite in the database ---
    function generateInviteCode(length = 8) {
      const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let result = "";
      for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      return result;
    }

    const invite_code = generateInviteCode();
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invite, error: insertError } = await serviceClient // Use serviceClient to bypass RLS for the insert
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

    if (insertError) throw new Error(`Database error: ${insertError.message}`);
    
    // --- Send the email using Resend ---
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");

    if (!resendApiKey || !fromEmail) {
        throw new Error("Resend configuration missing (API Key or From Email).");
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: inviteEmail,
        subject: `You're invited to join ${company.name || 'a fleet'} on HourWise EU`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; color: #333; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #0F172A;">Hello ${inviteFullName},</h2>
            <p>You have been invited by <strong>${company.name || 'your manager'}</strong> to join their fleet on the HourWise EU app.</p>

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
        throw new Error(`Resend error: ${errorBody.message || 'Unknown error'}`);
    }

    return new Response(JSON.stringify({ invite }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 201,
    });

  } catch (error) {
    console.error("Function error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
