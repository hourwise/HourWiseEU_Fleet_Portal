import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Vehicle = Database['public']['Tables']['vehicles']['Row'];

export function useVehicles(companyId: string | undefined) {
  return useQuery({
    queryKey: ['vehicles', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('company_id', companyId)
        .order('reg_number', { ascending: true });

      if (error) throw error;
      return (data ?? []) as Vehicle[];
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5,
  });
}
