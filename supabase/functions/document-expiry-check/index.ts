// supabase/functions/document-expiry-check/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Define the notification triggers in days
const NOTIFICATION_DAYS = [30, 14, 7];

serve(async (_req) => {
  try {
    // Use the Service Role Key for elevated access to query all data
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all documents that are expiring on one of our notification days
    const { data: documents, error: docError } = await serviceClient
      .from("driver_documents")
      .select(`
        *,
        driver:profiles!user_id ( full_name, email ),
        manager:profiles!uploaded_by ( full_name, email )
      `)
      .in('expiry_date', NOTIFICATION_DAYS.map(days => {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + days);
        return targetDate.toISOString().split('T')[0];
      }));

    if (docError) throw docError;
    if (!documents || documents.length === 0) {
      console.log("No documents expiring on key dates today.");
      return new Response(JSON.stringify({ message: "No documents to notify for." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // --- Prepare and Send Emails ---
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
    if (!resendApiKey || !fromEmail) throw new Error("Resend API key or From Email is not configured.");

    const emailPromises = documents.map(doc => {
      const expiry = new Date(doc.expiry_date);
      const daysUntilExpiry = Math.round((expiry.getTime() - today.getTime()) / (1000 * 3600 * 24));

      const driverEmail = doc.driver?.email;
      const managerEmail = doc.manager?.email;
      const recipients = [driverEmail, managerEmail].filter(Boolean); // Filter out any null/undefined emails

      if (recipients.length === 0) return Promise.resolve(); // Skip if no recipients

      const subject = `Compliance Alert: Document for ${doc.driver?.full_name} expires in ${daysUntilExpiry} days`;
      const html = `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2>Compliance Early Warning</h2>
          <p>This is an automated notification to alert you that a compliance document for driver <strong>${doc.driver?.full_name}</strong> is nearing its expiry date.</p>
          <ul style="list-style-type: none; padding: 0;">
            <li><strong>Document Type:</strong> ${doc.document_type}</li>
            <li><strong>Document Number:</strong> ${doc.id_number}</li>
            <li style="color: #c0392b;"><strong>Expiry Date:</strong> ${expiry.toLocaleDateString()} (${daysUntilExpiry} days from now)</li>
          </ul>
          <h3>Action Required:</h3>
          <p>Please arrange for the renewal of this document and upload the new version to the Fleet Manager Portal as soon as possible to ensure continued compliance.</p>
          <p>Thanks,<br/>The HourWise EU Team</p>
        </div>
      `;

      return fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({ from: fromEmail, to: recipients, subject, html }),
      });
    });

    await Promise.all(emailPromises);

    return new Response(JSON.stringify({ success: true, message: `Sent ${documents.length} notification(s).` }), {
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
