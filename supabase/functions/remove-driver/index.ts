// File: supabase/functions/remove-driver/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@11.1.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY") as string, {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: "2023-10-16",
});

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

async function unlinkDriverReference(
  serviceClient: ReturnType<typeof createClient>,
  table: string,
  driverId: string,
) {
  const { error } = await serviceClient
    .from(table)
    .update({ driver_id: null })
    .eq("driver_id", driverId);

  if (!error) return;

  // Some deployments may not have every optional tacho table yet.
  if (error.code === "42P01" || error.code === "42703") {
    console.warn(`Skipping optional driver unlink for ${table}: ${error.message}`);
    return;
  }

  throw new Error(`Failed to unlink driver from ${table}: ${error.message}`);
}

async function unlinkAcceptedInviteReference(
  serviceClient: ReturnType<typeof createClient>,
  driverId: string,
) {
  const { error } = await serviceClient
    .from("driver_invites")
    .update({ accepted_by_user_id: null })
    .eq("accepted_by_user_id", driverId);

  if (!error) return;

  if (error.code === "42P01" || error.code === "42703") {
    console.warn(`Skipping optional invite unlink: ${error.message}`);
    return;
  }

  throw new Error(`Failed to unlink accepted invite reference: ${error.message}`);
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
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "You must be signed in to remove a driver." }, 401);
    }

    // Get the driverId to be removed from the request body
    const { driverId } = await req.json();

    if (!driverId) {
      throw new Error("Driver ID is required.");
    }

    // Use the service role client for elevated privileges
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: requester, error: requesterError } = await serviceClient
      .from("profiles")
      .select("id, company_id, role")
      .eq("id", user.id)
      .single();

    if (requesterError || !requester || requester.role !== "manager") {
      return jsonResponse({ error: "Only managers can remove drivers." }, 403);
    }

    if (requester.id === driverId) {
      return jsonResponse({ error: "Managers cannot remove their own account from Driver Management." }, 400);
    }

    // 1. Get the driver's company_id to find the subscription
    const { data: driver, error: driverError } = await serviceClient
      .from("profiles") 
      .select("company_id, role")
      .eq("id", driverId)
      .single();

    if (driverError || !driver) {
      throw new Error("Driver not found or you do not have permission to remove them.");
    }

    if (driver.company_id !== requester.company_id) {
      return jsonResponse({ error: "You can only remove drivers from your own company." }, 403);
    }

    if (driver.role !== "driver") {
      return jsonResponse({ error: "Only driver accounts can be removed from Driver Management." }, 400);
    }
    
    // 2. Get the company's stripe_subscription_id
    const { data: company, error: companyError } = await serviceClient
      .from('companies')
      .select('stripe_subscription_id')
      .eq('id', driver.company_id)
      .single();

    if (companyError) throw new Error("Could not retrieve company subscription details.");
    
    if (company.stripe_subscription_id) {
        // 3. Decrement the subscription quantity in Stripe
        const subscription = await stripe.subscriptions.retrieve(company.stripe_subscription_id);
        const currentQuantity = subscription.items.data[0].quantity;

        if (currentQuantity <= 1) {
             // Prevents removing the manager's own seat. 
             // To remove the last seat, the manager should cancel the subscription entirely.
             throw new Error("Cannot remove the last seat. Please cancel the subscription instead.");
        }

        await stripe.subscriptions.update(company.stripe_subscription_id, {
            items: [{
                id: subscription.items.data[0].id,
                quantity: currentQuantity - 1,
            }],
        });
    } else {
        console.warn(`Company ${driver.company_id} has no subscription. Deleting driver only.`);
    }

    // 4. Unlink optional records that should survive as company evidence/history.
    const nullableDriverTables = [
      "tachograph_files",
      "driver_card_downloads",
      "tachograph_activity_segments",
      "tachograph_day_summaries",
      "tachograph_findings",
      "tachograph_technical_events",
      "tachograph_vehicle_motion_discrepancies",
      "tachograph_reconciliation_items",
    ];

    for (const table of nullableDriverTables) {
      await unlinkDriverReference(serviceClient, table, driverId);
    }
    await unlinkAcceptedInviteReference(serviceClient, driverId);

    // 5. Delete the user (driver) from the auth schema. Profile-owned rows with cascade FKs are removed by DB constraints.
    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(driverId);

    if (deleteError) {
      // Note: At this point, the subscription has been updated.
      // You might want to add logic to revert the Stripe change if the DB delete fails.
      throw new Error(`Failed to delete driver from database: ${deleteError.message}`);
    }

    return jsonResponse({ success: true, message: "Driver removed successfully." });

  } catch (error) {
    return jsonResponse({ error: error.message }, 400);
  }
});
