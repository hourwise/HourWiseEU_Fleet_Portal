import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Fetch all companies to check their individual settings
    const { data: companies, error: companiesError } = await supabaseClient
      .from('companies')
      .select('id, name, pmi_alert_days');

    if (companiesError) throw companiesError;

    const summary = [];

    for (const company of companies) {
      const reminderDays = company.pmi_alert_days || 14;
      const today = new Date();
      const targetDate = new Date();
      targetDate.setDate(today.getDate() + reminderDays);
      const targetDateISO = targetDate.toISOString().split('T')[0];
      const todayISO = today.toISOString().split('T')[0];

      // 2. Find vehicles with compliance events due soon or overdue
      const { data: vehicles, error: vehiclesError } = await supabaseClient
        .from('vehicles')
        .select('*')
        .eq('company_id', company.id)
        .or(`mot_due_date.lte.${targetDateISO},pmi_due_date.lte.${targetDateISO},tacho_calibration_due.lte.${targetDateISO},loler_due_date.lte.${targetDateISO},insurance_expiry.lte.${targetDateISO}`);

      if (vehiclesError) {
        console.error(`Error fetching vehicles for company ${company.id}:`, vehiclesError);
        continue;
      }

      let companyAlertsCount = 0;

      for (const vehicle of vehicles) {
        const complianceChecks = [
          { type: 'mot', date: vehicle.mot_due_date, label: 'MOT' },
          { type: 'pmi', date: vehicle.pmi_due_date, label: 'PMI' },
          { type: 'tacho', date: vehicle.tacho_calibration_due, label: 'Tacho Calibration' },
          { type: 'loler', date: vehicle.loler_due_date, label: 'LOLER' },
          { type: 'insurance', date: vehicle.insurance_expiry, label: 'Insurance' },
        ];

        for (const check of complianceChecks) {
          if (check.date && check.date <= targetDateISO) {
            const isOverdue = check.date < todayISO;
            const severity = isOverdue ? 'critical' : 'warning';
            const statusLabel = isOverdue ? 'OVERDUE' : 'DUE SOON';

            const message = `${vehicle.reg_number}: ${check.label} is ${statusLabel} (${check.date})`;

            // Check if an active alert already exists for this vehicle and type to prevent duplicates
            const { data: existingAlert } = await supabaseClient
              .from('alerts')
              .select('id')
              .eq('company_id', company.id)
              .eq('type', check.type)
              .eq('is_dismissed', false)
              .contains('metadata', { vehicle_id: vehicle.id })
              .maybeSingle();

            if (!existingAlert) {
              await supabaseClient
                .from('alerts')
                .insert({
                  company_id: company.id,
                  type: check.type,
                  severity,
                  message,
                  metadata: {
                    vehicle_id: vehicle.id,
                    reg_number: vehicle.reg_number,
                    due_date: check.date,
                    check_type: check.type
                  }
                });
              companyAlertsCount++;
            }
          }
        }
      }

      summary.push({ company: company.name, alertsCreated: companyAlertsCount });
    }

    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
