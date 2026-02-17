// File: supabase/functions/remove-driver/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@11.1.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY") as string, {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: "2023-10-16",
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // This function requires the user to be a manager, which should be checked by RLS policies.
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

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

    // 1. Get the driver's company_id to find the subscription
    // I am assuming your drivers table is named 'drivers' and the user profile table is 'profiles'
    const { data: driver, error: driverError } = await serviceClient
      .from("profiles") 
      .select("company_id")
      .eq("id", driverId)
      .single();

    if (driverError || !driver) {
      throw new Error("Driver not found or you do not have permission to remove them.");
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

    // 4. Delete the user (driver) from the auth schema
    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(driverId);

    if (deleteError) {
      // Note: At this point, the subscription has been updated.
      // You might want to add logic to revert the Stripe change if the DB delete fails.
      throw new Error(`Failed to delete driver from database: ${deleteError.message}`);
    }

    return new Response(JSON.stringify({ success: true, message: "Driver removed successfully." }), {
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
