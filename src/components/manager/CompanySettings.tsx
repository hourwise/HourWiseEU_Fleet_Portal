import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Building2, Users, Calendar } from 'lucide-react';
import type { Database } from '../../lib/database.types';

type Company = Database['public']['Tables']['companies']['Row'];

export function CompanySettings() {
  const { profile } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.company_id) {
      loadCompany();
    }
  }, [profile]);

  const loadCompany = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile!.company_id!)
        .single();

      if (error) throw error;
      setCompany(data);
    } catch (error) {
      console.error('Error loading company:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const status = company?.subscription_status;
  const isSubscribed = status === 'active' || status === 'trialing';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <Building2 className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Company Information</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-medium text-gray-500">Company Name</label>
            <p className="text-lg font-semibold text-gray-900 mt-1">{company?.name}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">Subscription Status</label>
            <div className="mt-1">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                isSubscribed
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {isSubscribed ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">Created</label>
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="w-5 h-5 text-gray-400" />
              <p className="text-lg font-semibold text-gray-900">
                {company?.created_at ? new Date(company.created_at).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
