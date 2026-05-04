import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import readesm from 'https://esm.sh/readesm@1.0.17'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { record } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Download file from Storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('tachograph-files')
      .download(record.file_path)

    if (downloadError) throw downloadError

    // 2. Parse binary with readesm
    const buffer = await fileData.arrayBuffer()
    const tachoData = readesm.parse(new Uint8Array(buffer))

    // 3. Identify Driver
    const cardNumber = tachoData.driverCard?.cardNumber || tachoData.cardNumber;
    let driverId = record.driver_id;

    if (cardNumber && !driverId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('tacho_card_number', cardNumber)
        .eq('company_id', record.company_id)
        .maybeSingle()

      if (profile) driverId = profile.id
    }

    // 4. Process Activities
    const activities = []
    const activityRecords = tachoData.activityDailyRecords || tachoData.activities || []

    for (const day of activityRecords) {
      const dayActivities = day.activityRecords || day.activities || []
      for (const activity of dayActivities) {
        // Convert to ISO strings if they are Dates or numbers
        const startTime = new Date(activity.start || activity.startTime).toISOString()
        const endTime = new Date(activity.end || activity.endTime).toISOString()

        activities.push({
          file_id: record.id,
          driver_id: driverId,
          company_id: record.company_id,
          start_time: startTime,
          end_time: endTime,
          activity_type: mapActivityType(activity.type),
          distance_km: activity.distance || 0
        })
      }
    }

    // 5. Bulk insert activities
    if (activities.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('tachograph_activities')
        .insert(activities)

      if (insertError) throw insertError
    }

    // 6. Mark as processed
    await supabaseAdmin
      .from('tachograph_files')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
        external_card_number: cardNumber,
        driver_id: driverId // Link the file to the driver found
      })
      .eq('id', record.id)

    return new Response(JSON.stringify({ success: true, activities_count: activities.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Tacho processing error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

function mapActivityType(type: any): string {
  // Common mapping for tachograph types
  // 0: rest, 1: poa, 2: work, 3: driving
  const typeInt = parseInt(type)
  const map: Record<number, string> = {
    0: 'rest',
    1: 'poa',
    2: 'work',
    3: 'driving'
  }
  return map[typeInt] || 'work'
}
