import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Key, Copy, RefreshCw, CheckCircle, Building2, Users, Calendar } from 'lucide-react';
import type { Database } from '../../lib/database.types';

type Company = Database['public']['Tables']['companies']['Row'];

export function CompanySettings() {
  const { profile } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const generateNewCode = async () => {
    setGenerating(true);
    try {
      const { data: newCode } = await supabase.rpc('generate_auth_code');

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error } = await supabase
        .from('companies')
        .update({
          auth_code: newCode as string,
          auth_code_expires_at: expiresAt.toISOString(),
        })
        .eq('id', profile!.company_id!);

      if (error) throw error;

      await loadCompany();
    } catch (error) {
      console.error('Error generating code:', error);
    } finally {
      setGenerating(false);
    }
  };

  const copyCode = () => {
    if (company?.auth_code) {
      navigator.clipboard.writeText(company.auth_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isCodeExpired = company ? new Date(company.auth_code_expires_at) < new Date() : false;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

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
                company?.subscription_status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : company?.subscription_status === 'trial'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {company?.subscription_status?.toUpperCase()}
              </span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">Maximum Drivers</label>
            <div className="flex items-center gap-2 mt-1">
              <Users className="w-5 h-5 text-gray-400" />
              <p className="text-lg font-semibold text-gray-900">{company?.max_drivers}</p>
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

      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-sm p-6 border-2 border-blue-200">
        <div className="flex items-center gap-3 mb-4">
          <Key className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Driver Link Code</h2>
        </div>

        <p className="text-gray-700 mb-6">
          Share this code with drivers to allow them to join your fleet. The code expires after 7 days for security.
        </p>

        <div className="bg-white rounded-lg p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <label className="text-sm font-medium text-gray-500 block mb-2">Current Code</label>
              <div className="flex items-center gap-4">
                <span className="text-3xl font-mono font-bold text-blue-600 tracking-wider">
                  {company?.auth_code}
                </span>
                {isCodeExpired && (
                  <span className="px-3 py-1 bg-red-100 text-red-700 text-sm font-medium rounded-full">
                    EXPIRED
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={copyCode}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  Copy
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>
              Expires: {company?.auth_code_expires_at
                ? new Date(company.auth_code_expires_at).toLocaleDateString()
                : 'N/A'}
            </span>
          </div>
        </div>

        <button
          onClick={generateNewCode}
          disabled={generating}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-5 h-5 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'Generating...' : 'Generate New Code'}
        </button>

        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-900">
            <strong>Note:</strong> Generating a new code will invalidate the previous code.
            Any drivers who haven't joined yet will need the new code.
          </p>
        </div>
      </div>
    </div>
  );
}
