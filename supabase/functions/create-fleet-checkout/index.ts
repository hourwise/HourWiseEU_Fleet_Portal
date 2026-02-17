// File: supabase/functions/create-fleet-checkout/index.ts

import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@14.11.0';

// Define CORS headers directly in the function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
};

const stripe = new Stripe(Deno.env.get('STRIPE_API_KEY') as string, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const priceId = Deno.env.get('STRIPE_PRICE_ID')!;

    // 1. Create a Supabase client with the user's authorization
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    });

    // 2. Get the logged-in user and their profile
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('User not found.');

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('company_id, full_name')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !profile.company_id) {
      throw new Error('Could not find user profile or company.');
    }

    // Use the service role client for elevated access
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // 3. Get company details and check for existing Stripe customer
    const { data: company, error: companyError } = await serviceClient
      .from('companies')
      .select('name, stripe_customer_id')
      .eq('id', profile.company_id)
      .single();
      
    if (companyError || !company) throw new Error('Company not found.');

    let customerId = company.stripe_customer_id;

    // 4. If no customer exists, create one in Stripe
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: company.name,
        metadata: { company_id: profile.company_id },
      });

      customerId = customer.id;

      // Save the new customer ID to your database
      await serviceClient
        .from('companies')
        .update({ stripe_customer_id: customerId })
        .eq('id', profile.company_id);
    }
    
    // 5. Create the Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price: priceId, // Use the Price ID from your Stripe product
          quantity: 1,    // Start with 1 seat for the manager
        },
      ],
      // Important: metadata links this checkout to your Supabase company
      metadata: {
        company_id: profile.company_id,
      },
      success_url: `${Deno.env.get('SITE_URL')}/dashboard?success=true`, // Use env var for your site URL
      cancel_url: `${Deno.env.get('SITE_URL')}/dashboard`,
    });
    
    return new Response(JSON.stringify({ checkoutUrl: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
