import { supabase } from './supabase';

export async function createFleetCheckout(params: {
  plan: 'starter' | 'professional' | 'business' | 'enterprise';
  companyName: string;
  managerEmail: string;
  managerName: string;
}): Promise<{
  sessionUrl?: string;
  authCode?: string;
  error?: string;
}> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-fleet-checkout`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to create checkout session');
    }

    const data = await response.json();
    return {
      sessionUrl: data.sessionUrl,
      authCode: data.authCode,
    };
  } catch (error) {
    console.error('Error creating checkout:', error);
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
