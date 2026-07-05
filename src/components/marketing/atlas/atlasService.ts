import { supabase } from '../../../lib/supabase';

export interface AtlasFeedbackData {
  name?: string;
  email?: string;
  message_type: 'question' | 'feature_request' | 'unknown_query';
  message_content: string;
  atlas_matched_intent?: string;
  consent_contact?: boolean;
}

/**
 * Submits Atlas feedback directly to the Supabase public.public_atlas_feedback table.
 * This table must have RLS enabled and a policy allowing public 'anon' inserts.
 */
export async function submitAtlasFeedback(data: AtlasFeedbackData) {
  try {
    const { error } = await supabase
      .from('public_atlas_feedback')
      .insert([
        {
          name: data.name,
          email: data.email,
          message_type: data.message_type,
          message_content: data.message_content,
          atlas_matched_intent: data.atlas_matched_intent,
          user_agent: window.navigator.userAgent,
          consent_contact: data.consent_contact || false,
        },
      ]);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error submitting Atlas feedback:', error);
    return { success: false, error };
  }
}
