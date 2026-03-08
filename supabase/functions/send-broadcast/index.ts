// supabase/functions/send-broadcast/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // This is a webhook, so we need to handle the OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { record } = await req.json() // The new broadcast row from the webhook payload

    // Create a Supabase client with the service role key to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Get all drivers in this company who have a push token
    const { data: drivers, error: driverError } = await supabase
      .from('profiles')
      .select('expo_push_token')
      .eq('company_id', record.company_id)
      .not('expo_push_token', 'is', null)

    if (driverError) throw new Error(`Failed to fetch drivers: ${driverError.message}`);
    if (!drivers || drivers.length === 0) {
      console.log(`No push tokens found for company ${record.company_id}. Exiting.`);
      return new Response(JSON.stringify({ message: 'No push tokens found for users in this company.' }), { status: 200 });
    }

    const tokens = drivers.map(d => d.expo_push_token);
    console.log(`Found ${tokens.length} tokens. Preparing to send notification.`);

    // 2. Send to Expo Push Service
    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify({
        to: tokens,
        title: "New Fleet Message",
        body: record.content,
        data: { type: 'broadcast', id: record.id }, // Extra data for in-app navigation
        priority: 'high',
        sound: 'default'
      }),
    });

    const responseBody = await expoResponse.json();
    console.log('Expo push response:', responseBody);

    return new Response(JSON.stringify({ success: true, tickets: responseBody }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error('Error processing broadcast webhook:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
})
